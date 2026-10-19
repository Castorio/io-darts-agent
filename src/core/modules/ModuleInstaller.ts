import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import type {
  ModuleManifest,
  InstallSource,
  InstallResult,
  UpdateResult,
} from '../../types/modules.js';
import { copyModuleDir, readSimpleGitignoreNames } from './localInstallCopy.js';
import { ensureSdkLink } from './sdkLink.js';

const execFileAsync = promisify(execFile);

// The hub runs with NODE_ENV=production (systemd unit), which makes npm skip
// devDependencies; modules need them (e.g. typescript) for npm run build
const NPM_INSTALL_WITH_DEV = ['install', '--include=dev'];

// The desktop app does not bundle Git or Node.js/npm, so an install can fail
// because the tool itself is missing from the computer rather than because
// of anything module-specific. Surface that plainly instead of a raw ENOENT
// or (on Windows, where npm runs through cmd.exe - see execCommand) cmd.exe's
// own "command not found" exit code.
const MISSING_TOOL_MESSAGES: Record<'git' | 'npm', string> = {
  git: 'Module installation needs Git, which was not found on this computer. Install Git and try again.',
  npm: 'Module installation needs Node.js (npm), which was not found on this computer. Install Node.js and try again.',
};

// cmd.exe's documented exit code when it could not find the program it was
// told to run. This fires both when OUR OWN direct `cmd.exe ... npm ...`
// invocation can't find npm itself, AND when npm ran fine but a script IT
// spawned (e.g. a module's build script calling a missing local tool) hit
// the same cmd.exe "not found" - npm passes a failing script's exit code
// straight through as its own (verified: `npm run <script-that-exits-N>`
// exits N; a script naming an unknown command exits 127 on POSIX, and the
// Windows equivalent is this same 9009 from the nested cmd.exe). So this
// exit code alone never proves npm itself is missing - see
// npmIsOnWindowsPath, which disambiguates the two with Windows' own PATH
// resolver before either conclusion is drawn.
const WINDOWS_COMMAND_NOT_FOUND_EXIT_CODE = 9009;

// Module ids and repository names become directory names below modulesDir,
// so they must not contain path separators or be "." / "..".
const MODULE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isValidModuleName(name: string): boolean {
  return MODULE_NAME_PATTERN.test(name) && name !== '.' && name !== '..';
}

function assertValidModuleId(moduleId: string): void {
  if (!isValidModuleName(moduleId)) {
    throw new Error(`Invalid module id: ${moduleId}`);
  }
}

/**
 * Thrown when an install collides with something already present: either
 * the target directory already exists, or the manifest id resolves to a
 * module that's already registered with the hub. Carries a stable `code`
 * instead of relying on message text or `instanceof` (which breaks across
 * module/bundle boundaries) so callers such as the store route can
 * distinguish this from any other install failure - including an unrelated
 * error (e.g. npm's own EEXIST) whose message happens to contain the same
 * words.
 */
export class ModuleAlreadyInstalledError extends Error {
  readonly code = 'MODULE_ALREADY_INSTALLED';

  constructor(message: string) {
    super(message);
    this.name = 'ModuleAlreadyInstalledError';
  }
}

interface InstallerOptions {
  modulesDir: string;
  timeout: number;
  /** The hub's module SDK, linked into modules that cannot resolve their own */
  sdkPath?: string;
  /**
   * Reports whether a module id is already registered by the hub (installed
   * modules, including built-ins). Checked against the manifest id after
   * it's read from the source - a git repo clones into a directory named
   * after the repo, not the manifest id, so this is the only place that
   * catches a manifest id colliding with an already-installed module whose
   * on-disk directory happens to have a different name.
   */
  isModuleIdInstalled?: (moduleId: string) => boolean;
}

const DEFAULT_OPTIONS: InstallerOptions = {
  modulesDir: './modules',
  timeout: 120000, // 2 minutes for git clone + npm install
};

/**
 * ModuleInstaller - Handles module installation from various sources
 *
 * Supports:
 * - Git repositories (git clone)
 * - Local directories (symlink/copy)
 * - NPM packages (future)
 */
export class ModuleInstaller extends EventEmitter {
  private options: InstallerOptions;

  constructor(options: Partial<InstallerOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Install a module from a source
   */
  async install(source: InstallSource): Promise<InstallResult> {
    try {
      // Ensure modules directory exists
      await fs.mkdir(this.options.modulesDir, { recursive: true });

      let result: InstallResult;

      switch (source.type) {
        case 'git':
          result = await this.installFromGit(source);
          break;
        case 'local':
          result = await this.installFromLocal(source);
          break;
        case 'npm':
          result = await this.installFromNpm(source);
          break;
        default: {
          // Exhaustiveness check; still guards against untyped callers at runtime
          const unknownType: never = source.type;
          throw new Error(`Unknown source type: ${String(unknownType)}`);
        }
      }

      if (result.success) {
        this.emit('installed', result);
      }

      return result;
    } catch (err) {
      const error = err as Error & { code?: unknown };
      const failure: InstallResult = {
        success: false,
        moduleId: '',
        path: '',
        error: error.message,
      };
      if (typeof error.code === 'string') {
        failure.errorCode = error.code;
      }
      return failure;
    }
  }

  /**
   * Update an installed module
   */
  async update(moduleId: string): Promise<UpdateResult> {
    const modulePath = path.join(this.options.modulesDir, moduleId);

    try {
      assertValidModuleId(moduleId);

      // Check if module exists
      await fs.access(modulePath);

      // Get current version
      const manifestPath = path.join(modulePath, 'module.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestData) as ModuleManifest;
      const previousVersion = manifest.version;

      // Check if it's a git repo
      const gitPath = path.join(modulePath, '.git');
      try {
        await fs.access(gitPath);
      } catch {
        return {
          success: false,
          moduleId,
          error: 'Module is not a git repository, cannot update',
        };
      }

      this.emit('updating', moduleId);

      await this.refreshAt(modulePath);

      // Get new version
      const newManifestData = await fs.readFile(manifestPath, 'utf-8');
      const newManifest = JSON.parse(newManifestData) as ModuleManifest;

      const result: UpdateResult = {
        success: true,
        moduleId,
        previousVersion,
        newVersion: newManifest.version,
      };

      this.emit('updated', result);
      return result;
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        moduleId,
        error: error.message,
      };
    }
  }

  /**
   * Uninstall a module
   */
  async uninstall(moduleId: string): Promise<void> {
    assertValidModuleId(moduleId);
    const modulePath = path.join(this.options.modulesDir, moduleId);

    try {
      await fs.access(modulePath);
    } catch {
      throw new Error(`Module ${moduleId} not found`);
    }

    this.emit('uninstalling', moduleId);

    // Remove directory recursively
    await fs.rm(modulePath, { recursive: true, force: true });

    this.emit('uninstalled', moduleId);
  }

  /**
   * Check if a module is installed
   */
  async isInstalled(moduleId: string): Promise<boolean> {
    const modulePath = path.join(this.options.modulesDir, moduleId);
    try {
      await fs.access(modulePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installed module path
   */
  getModulePath(moduleId: string): string {
    return path.join(this.options.modulesDir, moduleId);
  }

  /**
   * Install from git repository
   */
  private async installFromGit(source: InstallSource): Promise<InstallResult> {
    if (!source.url) {
      throw new Error('Git source requires url');
    }

    this.emit('installing', { type: 'git', url: source.url });

    // Extract repo name from URL
    const repoName = this.extractRepoName(source.url);
    const targetPath = path.join(this.options.modulesDir, repoName);

    // Check if already exists
    try {
      await fs.access(targetPath);
      throw new ModuleAlreadyInstalledError(`Module directory already exists: ${repoName}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    // Git clone
    const cloneArgs = ['clone'];
    if (source.branch) {
      cloneArgs.push('--branch', source.branch);
    }
    if (source.tag) {
      cloneArgs.push('--branch', source.tag);
    }
    // "--" keeps a url starting with "-" from being parsed as an option
    cloneArgs.push('--', source.url, targetPath);

    this.emit('progress', { step: 'git-clone', message: `Cloning ${source.url}...` });
    await this.execCommand('git', cloneArgs, this.options.modulesDir);

    let manifest: ModuleManifest;
    try {
      // Run npm install (including devDependencies for build)
      this.emit('progress', { step: 'npm-install', message: 'Installing dependencies...' });
      await this.execCommand('npm', NPM_INSTALL_WITH_DEV, targetPath);

      // Fix SDK symlink if it uses relative path
      await this.fixSdkLink(targetPath);

      // Build the module if it has a build script
      await this.buildModule(targetPath);

      // Read and validate manifest
      manifest = await this.readManifest(targetPath);

      // The directory-existence check above is keyed by the repo name, not
      // the manifest id, so a fresh clone can still declare an id that's
      // already installed elsewhere. Catch that here, before registering -
      // the catch block below removes only this freshly cloned directory.
      if (this.options.isModuleIdInstalled?.(manifest.id)) {
        throw new ModuleAlreadyInstalledError(`Module '${manifest.id}' is already installed`);
      }
    } catch (err) {
      // A half installed clone would show up as a broken module and block a retry
      await fs.rm(targetPath, { recursive: true, force: true });
      throw err;
    }

    return {
      success: true,
      moduleId: manifest.id,
      path: targetPath,
      manifest,
    };
  }

  /**
   * Install from local directory
   */
  private async installFromLocal(source: InstallSource): Promise<InstallResult> {
    if (!source.path) {
      throw new Error('Local source requires path');
    }

    const sourcePath = path.resolve(source.path);

    // Check source exists
    try {
      await fs.access(sourcePath);
    } catch {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    // Read manifest from source
    const manifest = await this.readManifest(sourcePath);
    const targetPath = path.join(this.options.modulesDir, manifest.id);

    this.emit('installing', { type: 'local', path: sourcePath });

    // Fast existence pre-check. This is a courtesy for the common case (a
    // quick, friendly error without attempting a claim) - it is NOT what
    // makes concurrent installs of the same id safe; see the atomic claim
    // below for that. lstat (not access/stat) so a dangling symlink at the
    // target still counts as "already exists" instead of being silently
    // treated as free space.
    if (await this.lexists(targetPath)) {
      throw new ModuleAlreadyInstalledError(`Module directory already exists: ${manifest.id}`);
    }

    // The check above only catches a collision when the existing module
    // happens to live at modulesDir/<manifest.id>; an already installed
    // module registered under a differently-named directory would slip
    // through. Nothing has been created yet at this point, so there's
    // nothing to clean up.
    if (this.options.isModuleIdInstalled?.(manifest.id)) {
      throw new ModuleAlreadyInstalledError(`Module '${manifest.id}' is already installed`);
    }

    // Create symlink for development or copy for production
    const useSymlink = process.env.NODE_ENV === 'development';

    // Atomically claim targetPath before doing any other work. The
    // existence check above only looked at a snapshot in time - a
    // concurrent install of the same manifest id can still create
    // targetPath between that check and here. fs.mkdir/fs.symlink either
    // create targetPath exclusively or fail with EEXIST; nothing else is
    // created or removed until the claim itself has succeeded. Without
    // this, a copy-path install's recursive `fs.mkdir(dest, {recursive:
    // true})` would silently merge into a concurrent install's
    // already-created folder instead of failing, and either install's
    // failure cleanup could then delete the other install's data.
    this.emit('progress', useSymlink
      ? { step: 'symlink', message: 'Creating symlink...' }
      : { step: 'copy', message: 'Copying files...' });
    try {
      if (useSymlink) {
        await fs.symlink(sourcePath, targetPath, 'dir');
      } else {
        await fs.mkdir(targetPath);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        // Lost the race to a concurrent install (or a leftover this
        // process didn't create) - never touch what's there.
        throw new ModuleAlreadyInstalledError(`Module directory already exists: ${manifest.id}`);
      }
      throw err;
    }

    if (useSymlink) {
      return {
        success: true,
        moduleId: manifest.id,
        path: targetPath,
        manifest,
      };
    }

    try {
      const skipNames = new Set(await readSimpleGitignoreNames(sourcePath));
      await copyModuleDir(sourcePath, targetPath, skipNames, true, (relativePath) => {
        this.emit('progress', {
          step: 'copy-symlink-warning',
          message: `Warning: skipped symlink "${relativePath}" (symlinks are never followed when copying a local install)`,
        });
      });

      // Run npm install in copied directory
      this.emit('progress', { step: 'npm-install', message: 'Installing dependencies...' });
      await this.execCommand('npm', NPM_INSTALL_WITH_DEV, targetPath);

      // Fix SDK symlink if it uses relative path
      await this.fixSdkLink(targetPath);

      // Build the module
      await this.buildModule(targetPath);
    } catch (err) {
      // The claim above succeeded exclusively, so this install - and only
      // this install - created targetPath; it's always safe to remove on
      // failure. Without this, a failed local install (e.g. npm install or
      // the build failing) leaves the half-installed folder behind, so a
      // retry fails with "already exists".
      await fs.rm(targetPath, { recursive: true, force: true });
      throw err;
    }

    return {
      success: true,
      moduleId: manifest.id,
      path: targetPath,
      manifest,
    };
  }

  /**
   * Install from NPM package (placeholder for future)
   */
  private installFromNpm(source: InstallSource): Promise<InstallResult> {
    if (!source.package) {
      return Promise.reject(new Error('NPM source requires package name'));
    }

    // This is a placeholder for future NPM support
    return Promise.reject(new Error('NPM installation not yet implemented'));
  }

  /**
   * Fix SDK symlink if the module uses a relative path for @autodarts-hub/module-sdk
   * After git clone, the relative path in package.json may point to wrong location
   */
  private async fixSdkLink(modulePath: string): Promise<void> {
    const sdkPath = this.options.sdkPath ?? path.resolve(this.options.modulesDir, '..', 'module-sdk');
    await ensureSdkLink(modulePath, sdkPath, {
      onWarning: (message) => this.emit('progress', { step: 'fix-sdk-warning', message }),
      onLinked: (message) => this.emit('progress', { step: 'fix-sdk', message }),
    });
  }

  private async exists(file: string): Promise<boolean> {
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Like exists(), but using lstat instead of access/stat: a dangling
   * symlink (one whose target is missing) still "exists" here, where
   * access() would follow the link and report it as absent.
   */
  private async lexists(file: string): Promise<boolean> {
    try {
      await fs.lstat(file);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pull the latest version of a git module and rebuild it in place
   *
   * Works with the module's real folder, which can differ from its id
   * (e.g. folder autodarts-mqtt-module for module mqtt).
   */
  async refreshAt(modulePath: string): Promise<void> {
    await this.execCommand('git', ['-C', modulePath, 'pull'], modulePath);
    // Including devDependencies, which the build needs
    await this.execCommand('npm', NPM_INSTALL_WITH_DEV, modulePath);
    await this.fixSdkLink(modulePath);
    await this.buildModule(modulePath);
  }

  /**
   * Build the module if it has a build script
   */
  private async buildModule(modulePath: string): Promise<void> {
    const packageJsonPath = path.join(modulePath, 'package.json');

    try {
      const packageData = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageData) as { scripts?: Record<string, unknown> } | null;

      // Check if the module has a build script
      if (packageJson?.scripts?.build) {
        this.emit('progress', { step: 'build', message: 'Building module...' });
        await this.execCommand('npm', ['run', 'build'], modulePath);
      }
    } catch (err) {
      // If package.json doesn't exist or has no build script, skip silently
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * Read and validate module manifest
   */
  private async readManifest(modulePath: string): Promise<ModuleManifest> {
    const manifestPath = path.join(modulePath, 'module.json');

    try {
      const data = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(data) as ModuleManifest;

      if (!this.validateManifest(manifest)) {
        throw new Error('Invalid module manifest');
      }
      assertValidModuleId(manifest.id);

      return manifest;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('module.json not found');
      }
      throw err;
    }
  }

  /**
   * Validate manifest structure
   */
  private validateManifest(manifest: unknown): manifest is ModuleManifest {
    if (typeof manifest !== 'object' || manifest === null) return false;

    const m = manifest as Record<string, unknown>;
    return (
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      typeof m.version === 'string' &&
      typeof m.entry === 'string' &&
      Array.isArray(m.events)
    );
  }

  /**
   * Extract repository name from git URL
   */
  private extractRepoName(url: string): string {
    // Handle various git URL formats:
    // https://github.com/user/repo.git
    // git@github.com:user/repo.git
    // /path/to/local/repo

    let name = url.split('/').pop() || 'unknown';
    name = name.replace(/\.git$/, '');
    if (!isValidModuleName(name)) {
      throw new Error(`Invalid repository name in url: ${url}`);
    }
    return name;
  }

  /**
   * Execute a command with timeout
   */
  private async execCommand(file: string, args: string[], cwd: string): Promise<string> {
    // execFile runs without a shell, so arguments are never interpreted.
    // On Windows npm is a .cmd script, which Node cannot start directly;
    // run it through cmd.exe instead of shell:true (DEP0190). npm is only
    // ever called with constant arguments.
    const [command, commandArgs] =
      file === 'npm' && process.platform === 'win32'
        ? ['cmd.exe', ['/d', '/s', '/c', 'npm', ...args]]
        : [file, args];
    try {
      const { stdout, stderr } = await execFileAsync(command, commandArgs, {
        cwd,
        timeout: this.options.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr) {
        this.emit('stderr', stderr);
      }

      return stdout;
    } catch (err) {
      // execFile's rejection has `.code` as a string (e.g. 'ENOENT') when the
      // executable itself couldn't be spawned, but as the process's numeric
      // exit code when it ran and exited non-zero (e.g. cmd.exe's 9009) -
      // NodeJS.ErrnoException only types the string case.
      const error = err as Error & { code?: string | number; stderr?: string; stdout?: string };
      // A bad/missing cwd also throws ENOENT (or, via cmd.exe on Windows, the
      // same "command not found" exit) for reasons that have nothing to do
      // with git or npm being absent - only read either as the tool itself
      // missing when the directory we tried to run it in actually exists.
      if (await this.exists(cwd)) {
        if ((file === 'git' || file === 'npm') && error.code === 'ENOENT') {
          throw new Error(MISSING_TOOL_MESSAGES[file]);
        }
        if (
          file === 'npm' &&
          process.platform === 'win32' &&
          error.code === WINDOWS_COMMAND_NOT_FOUND_EXIT_CODE &&
          !(await this.npmIsOnWindowsPath())
        ) {
          throw new Error(MISSING_TOOL_MESSAGES.npm);
        }
      }
      // tsc reports its errors on stdout, so include the end of it
      const output = [error.stderr, error.stdout?.slice(-2000)].filter((part) => part && part.trim()).join('\n');
      throw new Error(`Command failed: ${file} ${args.join(' ')}\n${output || error.message}`);
    }
  }

  /**
   * Confirms (on Windows only) whether npm is actually reachable on PATH,
   * using the OS's own file-on-PATH resolver (no shell, no locale-specific
   * text to parse). Only called to disambiguate cmd.exe's 9009 "command not
   * found" exit code - which npm also exits with when IT runs a script that
   * hits the same cmd.exe error - from npm itself being genuinely absent.
   */
  private async npmIsOnWindowsPath(): Promise<boolean> {
    try {
      await execFileAsync('where.exe', ['npm'], { timeout: this.options.timeout });
      return true;
    } catch {
      return false;
    }
  }
}
