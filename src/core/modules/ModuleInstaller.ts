import { exec } from 'child_process';
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

const execAsync = promisify(exec);

interface InstallerOptions {
  modulesDir: string;
  timeout: number;
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
        default:
          throw new Error(`Unknown source type: ${(source as InstallSource).type}`);
      }

      if (result.success) {
        this.emit('installed', result);
      }

      return result;
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        moduleId: '',
        path: '',
        error: error.message,
      };
    }
  }

  /**
   * Update an installed module
   */
  async update(moduleId: string): Promise<UpdateResult> {
    const modulePath = path.join(this.options.modulesDir, moduleId);

    try {
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

      // Git pull
      await this.execCommand(`git -C "${modulePath}" pull`, modulePath);

      // Run npm install
      await this.execCommand(`npm install --production`, modulePath);

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
      throw new Error(`Module directory already exists: ${repoName}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    // Git clone
    let cloneCmd = `git clone "${source.url}"`;
    if (source.branch) {
      cloneCmd += ` --branch "${source.branch}"`;
    }
    if (source.tag) {
      cloneCmd += ` --branch "${source.tag}"`;
    }
    cloneCmd += ` "${targetPath}"`;

    this.emit('progress', { step: 'git-clone', message: `Cloning ${source.url}...` });
    await this.execCommand(cloneCmd, this.options.modulesDir);

    // Run npm install
    this.emit('progress', { step: 'npm-install', message: 'Installing dependencies...' });
    await this.execCommand('npm install --production', targetPath);

    // Read and validate manifest
    const manifest = await this.readManifest(targetPath);

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

    // Check if already exists
    try {
      await fs.access(targetPath);
      throw new Error(`Module directory already exists: ${manifest.id}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    // Create symlink for development or copy for production
    const useSymlink = process.env.NODE_ENV === 'development';

    if (useSymlink) {
      this.emit('progress', { step: 'symlink', message: 'Creating symlink...' });
      await fs.symlink(sourcePath, targetPath, 'dir');
    } else {
      this.emit('progress', { step: 'copy', message: 'Copying files...' });
      await this.copyDir(sourcePath, targetPath);

      // Run npm install in copied directory
      this.emit('progress', { step: 'npm-install', message: 'Installing dependencies...' });
      await this.execCommand('npm install --production', targetPath);
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
  private async installFromNpm(source: InstallSource): Promise<InstallResult> {
    if (!source.package) {
      throw new Error('NPM source requires package name');
    }

    // This is a placeholder for future NPM support
    throw new Error('NPM installation not yet implemented');
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
    return name;
  }

  /**
   * Execute a command with timeout
   */
  private async execCommand(command: string, cwd: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: this.options.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr) {
        this.emit('stderr', stderr);
      }

      return stdout;
    } catch (err) {
      const error = err as Error & { stderr?: string };
      throw new Error(`Command failed: ${command}\n${error.stderr || error.message}`);
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
