import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { ModuleInstaller, ModuleAlreadyInstalledError } from './ModuleInstaller.js';
import type { ModuleManifest } from '../../types/modules.js';

vi.mock('fs/promises');
vi.mock('child_process', () => ({
  execFile: vi.fn(
    (_file: string, _args: string[], _opts: unknown, cb: (err: Error | null, out: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout: '', stderr: '' });
    }
  ),
}));

const TEST_MANIFEST: ModuleManifest = {
  id: 'test-module',
  name: 'Test Module',
  version: '1.0.0',
  description: 'A test module',
  entry: 'index.js',
  events: ['throw.detected'],
};

describe('ModuleAlreadyInstalledError', () => {
  it('carries a stable MODULE_ALREADY_INSTALLED code', () => {
    const error = new ModuleAlreadyInstalledError("Module 'x' is already installed");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('MODULE_ALREADY_INSTALLED');
    expect(error.message).toBe("Module 'x' is already installed");
  });
});

describe('ModuleInstaller', () => {
  let installer: ModuleInstaller;
  const testModulesDir = '/test/modules';

  beforeEach(() => {
    vi.clearAllMocks();
    installer = new ModuleInstaller({ modulesDir: testModulesDir });

    // Default mocks
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
    // Explicit per-file dispatch rather than one blanket resolved value, so
    // a .gitignore read (local install) is deterministically "not found"
    // instead of relying on the manifest JSON happening to fail the
    // simple-pattern filter.
    vi.mocked(fs.readFile).mockImplementation(async (file) => {
      if (String(file).endsWith('.gitignore')) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return JSON.stringify(TEST_MANIFEST);
    });
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.symlink).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.lstat).mockRejectedValue({ code: 'ENOENT' });
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('install() - Git', () => {
    it('should install from git repository', async () => {
      const handler = vi.fn();
      installer.on('installed', handler);

      const result = await installer.install({
        type: 'git',
        url: 'https://github.com/user/test-repo.git',
      });

      expect(result.success).toBe(true);
      expect(result.moduleId).toBe('test-module');
      expect(result.manifest).toEqual(TEST_MANIFEST);
      expect(handler).toHaveBeenCalledWith(result);
    });

    it('should handle git clone with branch', async () => {
      const result = await installer.install({
        type: 'git',
        url: 'https://github.com/user/test-repo.git',
        branch: 'develop',
      });

      expect(result.success).toBe(true);
    });

    it('should fail if directory already exists', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined); // mkdir check
      vi.mocked(fs.access).mockResolvedValueOnce(undefined); // target exists

      const result = await installer.install({
        type: 'git',
        url: 'https://github.com/user/test-repo.git',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
    });

    it('should fail without url', async () => {
      const result = await installer.install({
        type: 'git',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires url');
      expect(result.errorCode).toBeUndefined();
    });
  });

  describe('install() - Local', () => {
    it('should install from local path', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined); // source exists
      // Target pre-check (fs.lstat) and the atomic claim (fs.mkdir) both
      // default to "free" (lstat rejects ENOENT; mkdir resolves).

      const result = await installer.install({
        type: 'local',
        path: '/path/to/local/module',
      });

      expect(result.success).toBe(true);
      expect(result.moduleId).toBe('test-module');
    });

    it('emits a progress warning naming each symlink skipped while copying (regression: silently dropped in-tree symlinks)', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined); // source exists
      vi.mocked(fs.readdir).mockResolvedValueOnce([
        { name: 'linked-assets', isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false },
        { name: 'index.js', isSymbolicLink: () => false, isDirectory: () => false, isFile: () => true },
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const progressHandler = vi.fn();
      installer.on('progress', progressHandler);

      const result = await installer.install({
        type: 'local',
        path: '/path/to/local/module',
      });

      expect(result.success).toBe(true);
      expect(progressHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          step: 'copy-symlink-warning',
          message: expect.stringContaining('linked-assets') as string,
        })
      );
    });

    it('should fail if source path does not exist', async () => {
      vi.mocked(fs.access)
        .mockRejectedValueOnce({ code: 'ENOENT' }) // modules dir
        .mockRejectedValueOnce({ code: 'ENOENT' }); // source doesn't exist

      const result = await installer.install({
        type: 'local',
        path: '/nonexistent/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should fail if the target directory already exists', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined); // source exists
      // lstat (not access/stat) so a dangling symlink at the target still
      // counts as "already exists".
      vi.mocked(fs.lstat).mockResolvedValueOnce(undefined as never); // target already exists

      const result = await installer.install({
        type: 'local',
        path: '/path/to/local/module',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('should fail without path', async () => {
      const result = await installer.install({
        type: 'local',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires path');
    });

    describe('concurrent install of the same manifest id (claim race)', () => {
      // The lstat pre-check only catches a race that's already lost by the
      // time it runs. The real guard is the atomic claim (fs.mkdir/symlink
      // on targetPath): if a concurrent install got there first, the claim
      // itself fails with EEXIST - and that must never be treated as "this
      // install's own failure" (which would delete the other install's
      // folder, or a merge of both installs' files for the copy path's
      // recursive mkdir).
      it('does not remove the other install when the copy-path claim (fs.mkdir) races and hits EEXIST', async () => {
        vi.mocked(fs.access).mockResolvedValueOnce(undefined); // source exists
        // lstat pre-check still reports "free" - the race happens after it
        vi.mocked(fs.mkdir)
          .mockResolvedValueOnce(undefined) // ensure modulesDir (install())
          .mockRejectedValueOnce(Object.assign(new Error('EEXIST'), { code: 'EEXIST' })); // claim loses the race

        const result = await installer.install({ type: 'local', path: '/path/to/local/module' });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
        expect(fs.rm).not.toHaveBeenCalled();
        expect(fs.readdir).not.toHaveBeenCalled(); // never started copying into the other install's folder
      });

      it('does not remove the other install when the symlink-path claim races and hits EEXIST', async () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development'; // selects the symlink branch
        try {
          vi.mocked(fs.access).mockResolvedValueOnce(undefined); // source exists
          vi.mocked(fs.symlink).mockRejectedValueOnce(
            Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
          );

          const result = await installer.install({ type: 'local', path: '/path/to/local/module' });

          expect(result.success).toBe(false);
          expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
          expect(fs.rm).not.toHaveBeenCalled();
        } finally {
          process.env.NODE_ENV = previousEnv;
        }
      });
    });
  });

  describe('install() - manifest id already registered', () => {
    // The directory existence check for git installs is keyed by the repo
    // name, not the manifest id - a repo that clones into a brand new
    // directory can still declare a manifest.id that collides with an
    // already-installed module (installed under a different directory
    // name). The installer must catch that after reading the manifest,
    // clean up only the directory it just created, and never touch the
    // pre-existing module.
    it('rejects a git install whose manifest id is already installed, removing only the freshly cloned directory', async () => {
      installer = new ModuleInstaller({
        modulesDir: testModulesDir,
        isModuleIdInstalled: (id) => id === 'test-module',
      });

      const result = await installer.install({
        type: 'git',
        url: 'https://github.com/user/fresh-repo.git',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("'test-module'");
      expect(result.error).toContain('already installed');
      expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(testModulesDir, 'fresh-repo'),
        { recursive: true, force: true }
      );
      expect(fs.rm).not.toHaveBeenCalledWith(
        path.join(testModulesDir, 'test-module'),
        expect.anything()
      );
    });

    it('rejects a local install whose manifest id is already installed, without creating anything', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined); // source exists
      // target pre-check (fs.lstat) defaults to "free" (ENOENT)
      installer = new ModuleInstaller({
        modulesDir: testModulesDir,
        isModuleIdInstalled: (id) => id === 'test-module',
      });

      const result = await installer.install({
        type: 'local',
        path: '/path/to/local/module',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("'test-module'");
      expect(result.error).toContain('already installed');
      expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
      expect(fs.symlink).not.toHaveBeenCalled();
      expect(fs.copyFile).not.toHaveBeenCalled();
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('still installs normally when the manifest id is not registered', async () => {
      installer = new ModuleInstaller({
        modulesDir: testModulesDir,
        isModuleIdInstalled: (id) => id === 'some-other-module',
      });

      const result = await installer.install({
        type: 'git',
        url: 'https://github.com/user/test-repo.git',
      });

      expect(result.success).toBe(true);
      expect(result.moduleId).toBe('test-module');
    });
  });

  describe('install() - NPM', () => {
    it('should throw not implemented error', async () => {
      const result = await installer.install({
        type: 'npm',
        package: 'some-package',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
    });
  });

  describe('failed installation', () => {
    it('removes the cloned folder when the build fails', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (file) =>
        String(file).endsWith('package.json') ? JSON.stringify({ scripts: { build: 'tsc' } }) : JSON.stringify(TEST_MANIFEST)
      );
      vi.mocked(execFile).mockImplementation(((file: string, args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'npm' && args[0] === 'run') cb(Object.assign(new Error('tsc: not found'), { stderr: 'tsc: not found' }));
        else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'git', url: 'https://github.com/user/broken-module.git' });

      expect(result.success).toBe(false);
      expect(fs.rm).toHaveBeenCalledWith(path.join(testModulesDir, 'broken-module'), { recursive: true, force: true });
    });

    it('removes the folder it created when a local install fails to build, so a retry does not see "already exists"', async () => {
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // source exists
        .mockRejectedValueOnce({ code: 'ENOENT' }); // target doesn't exist yet - this install creates it
      vi.mocked(fs.readFile).mockImplementation(async (file) =>
        String(file).endsWith('package.json') ? JSON.stringify({ scripts: { build: 'tsc' } }) : JSON.stringify(TEST_MANIFEST)
      );
      vi.mocked(execFile).mockImplementation(((file: string, args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'npm' && args[0] === 'run') cb(Object.assign(new Error('tsc: not found'), { stderr: 'tsc: not found' }));
        else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'local', path: '/path/to/local/module' });

      expect(result.success).toBe(false);
      expect(fs.rm).toHaveBeenCalledWith(path.join(testModulesDir, 'test-module'), { recursive: true, force: true });
    });
  });

  describe('missing git or npm', () => {
    const originalPlatform = process.platform;
    const GIT_MISSING = 'Module installation needs Git, which was not found on this computer. Install Git and try again.';
    const NPM_MISSING =
      'Module installation needs Node.js (npm), which was not found on this computer. Install Node.js and try again.';

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('gives a clear error when git is not installed', async () => {
      // 1st fs.access: install()'s own "target doesn't exist yet" pre-check.
      // 2nd: execCommand's "does the cwd we tried to run git in exist" check.
      vi.mocked(fs.access).mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValueOnce(undefined);
      vi.mocked(execFile).mockImplementation(((file: string, _args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'git') cb(Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }));
        else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'git', url: 'https://github.com/user/test-repo.git' });

      expect(result.success).toBe(false);
      expect(result.error).toBe(GIT_MISSING);
    });

    it('gives a clear error when npm (Node.js) is not installed on macOS/Linux', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValueOnce(undefined);
      vi.mocked(execFile).mockImplementation(((file: string, _args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'npm') cb(Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' }));
        else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'git', url: 'https://github.com/user/test-repo.git' });

      expect(result.success).toBe(false);
      expect(result.error).toBe(NPM_MISSING);
    });

    it('does not map a plain ENOENT to a "missing tool" message when the working directory itself does not exist', async () => {
      // Both calls reject: the target doesn't exist (expected - it's a fresh
      // install) AND the cwd check fails too, which must NOT be read as "git
      // is missing" - it's the generic fallback instead.
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(execFile).mockImplementation(((file: string, _args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'git') cb(Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }));
        else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'git', url: 'https://github.com/user/test-repo.git' });

      expect(result.success).toBe(false);
      expect(result.error).not.toBe(GIT_MISSING);
      expect(result.error).toContain('Command failed: git');
    });

    it('gives a clear error when npm is not installed on Windows (cmd.exe exits 9009 because it could not find npm)', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.mocked(fs.access).mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValueOnce(undefined);
      vi.mocked(execFile).mockImplementation(((file: string, _args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'cmd.exe') {
          cb(
            Object.assign(new Error('Command failed'), {
              code: 9009,
              stdout: '',
              stderr: '',
            })
          );
        } else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'git', url: 'https://github.com/user/test-repo.git' });

      expect(result.success).toBe(false);
      expect(result.error).toBe(NPM_MISSING);
    });

    it('does not report npm as missing when a module\'s own build script fails on Windows (npm exits 1, not 9009 - e.g. its "tsc" is not found, not npm itself)', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.mocked(fs.access).mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (file) =>
        String(file).endsWith('package.json') ? JSON.stringify({ scripts: { build: 'tsc' } }) : JSON.stringify(TEST_MANIFEST)
      );
      vi.mocked(execFile).mockImplementation(((file: string, args: string[], _opts: unknown, cb: (err: Error | null, out?: unknown) => void) => {
        if (file === 'cmd.exe' && args.includes('build')) {
          cb(
            Object.assign(new Error('Command failed'), {
              code: 1,
              stdout: "'tsc' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n",
              stderr: '',
            })
          );
        } else cb(null, { stdout: '', stderr: '' });
      }) as never);

      const result = await installer.install({ type: 'git', url: 'https://github.com/user/test-repo.git' });

      expect(result.success).toBe(false);
      expect(result.error).not.toBe(NPM_MISSING);
      expect(result.error).toContain('Command failed: npm run build');
    });
  });

  describe('module SDK link', () => {
    const sdkPath = '/hub/module-sdk';
    const modulePath = path.join(testModulesDir, 'autodarts-mqtt-module');
    const link = path.join(modulePath, 'node_modules', '@autodarts-hub', 'module-sdk');

    beforeEach(() => {
      installer = new ModuleInstaller({ modulesDir: testModulesDir, sdkPath });
      vi.mocked(fs.readFile).mockImplementation(async (file) =>
        String(file).endsWith('package.json')
          ? JSON.stringify({ dependencies: { '@autodarts-hub/module-sdk': 'file:../AutodartsClient/module-sdk' } })
          : JSON.stringify(TEST_MANIFEST)
      );
    });

    it('links the hub SDK when the module points to a path that does not exist here', async () => {
      // npm leaves an empty @autodarts-hub folder for the unreachable file: dependency
      vi.mocked(fs.access).mockImplementation(async (p) => {
        if (String(p) === sdkPath || String(p) === path.join(sdkPath, 'package.json')) return
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      });

      await installer.refreshAt(modulePath);

      expect(fs.symlink).toHaveBeenCalledWith(sdkPath, link, 'dir');
    });

    it('links the hub SDK with a junction on Windows (a "dir" symlink needs admin rights there)', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        vi.mocked(fs.access).mockImplementation(async (p) => {
          if (String(p) === sdkPath || String(p) === path.join(sdkPath, 'package.json')) return
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        });

        await installer.refreshAt(modulePath);

        expect(fs.symlink).toHaveBeenCalledWith(sdkPath, link, 'junction');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('keeps a working SDK link', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await installer.refreshAt(modulePath);

      expect(fs.symlink).not.toHaveBeenCalled();
    });
  });

  describe('refreshAt()', () => {
    it('pulls, installs with dev dependencies and builds a module at any folder name', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (file) =>
        String(file).endsWith('package.json')
          ? JSON.stringify({ name: 'mqtt', scripts: { build: 'tsc' } })
          : JSON.stringify(TEST_MANIFEST)
      );
      const modulePath = path.join(testModulesDir, 'autodarts-mqtt-module');

      await installer.refreshAt(modulePath);

      const calls = vi.mocked(execFile).mock.calls.map((c) => [c[0], ...(c[1] as string[])]);
      expect(calls).toEqual([
        ['git', '-C', modulePath, 'pull'],
        ['npm', 'install', '--include=dev'],
        ['npm', 'run', 'build'],
      ]);
      expect(vi.mocked(execFile).mock.calls.every((c) => (c[2] as { cwd: string }).cwd === modulePath)).toBe(true);
    });
  });

  describe('update()', () => {
    it('should update a git module', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined); // all checks pass
      // module.json is read before and after the pull; package.json by the SDK check and the build
      let manifestReads = 0;
      vi.mocked(fs.readFile).mockImplementation(async (file) => {
        if (String(file).endsWith('package.json')) return JSON.stringify({ name: 'test-module' });
        manifestReads++;
        return JSON.stringify({ ...TEST_MANIFEST, version: manifestReads === 1 ? '1.0.0' : '1.1.0' });
      });

      const handler = vi.fn();
      installer.on('updated', handler);

      const result = await installer.update('test-module');

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('1.1.0');
      expect(handler).toHaveBeenCalled();
    });

    it('should fail if module not found', async () => {
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const result = await installer.update('nonexistent');

      expect(result.success).toBe(false);
    });

    it('should fail if not a git repo', async () => {
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // module exists
        .mockRejectedValueOnce({ code: 'ENOENT' }); // .git doesn't exist

      const result = await installer.update('test-module');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a git repository');
    });
  });

  describe('uninstall()', () => {
    it('should uninstall a module', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const handler = vi.fn();
      installer.on('uninstalled', handler);

      await installer.uninstall('test-module');

      expect(fs.rm).toHaveBeenCalledWith(
        path.join(testModulesDir, 'test-module'),
        { recursive: true, force: true }
      );
      expect(handler).toHaveBeenCalledWith('test-module');
    });

    it('should throw if module not found', async () => {
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      await expect(installer.uninstall('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('isInstalled()', () => {
    it('should return true if module exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await installer.isInstalled('test-module');

      expect(result).toBe(true);
    });

    it('should return false if module does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });

      const result = await installer.isInstalled('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getModulePath()', () => {
    it('should return correct path', () => {
      const result = installer.getModulePath('test-module');

      expect(result).toBe(path.join(testModulesDir, 'test-module'));
    });
  });

  describe('Event Emissions', () => {
    it('should emit progress events during installation', async () => {
      const progressHandler = vi.fn();
      installer.on('progress', progressHandler);

      await installer.install({
        type: 'git',
        url: 'https://github.com/user/repo.git',
      });

      expect(progressHandler).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'git-clone' })
      );
      expect(progressHandler).toHaveBeenCalledWith(
        expect.objectContaining({ step: 'npm-install' })
      );
    });

    it('should emit installing event', async () => {
      const handler = vi.fn();
      installer.on('installing', handler);

      await installer.install({
        type: 'git',
        url: 'https://github.com/user/repo.git',
      });

      expect(handler).toHaveBeenCalledWith({
        type: 'git',
        url: 'https://github.com/user/repo.git',
      });
    });
  });

  describe('command execution and name validation', () => {
    it('passes the git url as a single argument without a shell', async () => {
      const url = 'https://github.com/user";$(touch /tmp/pwn)"/repo.git';

      const result = await installer.install({ type: 'git', url });

      expect(result.success).toBe(true);
      const gitCall = vi.mocked(execFile).mock.calls.find((c) => c[0] === 'git');
      expect(gitCall![1]).toEqual(['clone', '--', url, path.join(testModulesDir, 'repo')]);
      expect((gitCall![2] as { shell?: boolean }).shell).toBeFalsy();
    });

    it('runs npm through cmd.exe on Windows without a shell option', async () => {
      const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        await installer.install({ type: 'git', url: 'https://github.com/user/repo.git' });
      } finally {
        Object.defineProperty(process, 'platform', platform);
      }

      const npmCall = vi.mocked(execFile).mock.calls.find((c) => c[0] === 'cmd.exe');
      expect(npmCall![1]).toEqual(['/d', '/s', '/c', 'npm', 'install', '--include=dev']);
      expect((npmCall![2] as { shell?: boolean }).shell).toBeFalsy();
    });

    it('installs dev dependencies for the build even when the hub runs in production', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // set by the systemd unit, makes npm omit dev dependencies
      try {
        await installer.install({ type: 'git', url: 'https://github.com/user/repo.git' });
      } finally {
        process.env.NODE_ENV = previous;
      }

      const installCall = vi.mocked(execFile).mock.calls.find((c) => c[0] === 'npm' && (c[1] as string[])[0] === 'install');
      expect(installCall![1]).toEqual(['install', '--include=dev']);
    });

    it('rejects a git url whose repository name escapes the modules dir', async () => {
      const result = await installer.install({ type: 'git', url: 'https://example.com/..' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid repository name');
    });

    it('rejects a local module whose manifest id is a path', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        JSON.stringify({ ...TEST_MANIFEST, id: '../evil' })
      );

      const result = await installer.install({ type: 'local', path: '/path/to/module' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid module id');
    });

    it('refuses to uninstall a module id that is a path', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await expect(installer.uninstall('../..')).rejects.toThrow('Invalid module id');
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('refuses to update a module id that is a path', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await installer.update('../other');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid module id');
    });
  });
});
