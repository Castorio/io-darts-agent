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
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(TEST_MANIFEST));
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
      // Setup mocks in order they will be called:
      // 1. mkdir for modules dir
      // 2. access for source path check
      // 3. readFile for manifest
      // 4. access for target path check (should not exist)
      // 5. symlink or copy
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // source exists
        .mockRejectedValueOnce({ code: 'ENOENT' }); // target doesn't exist

      const result = await installer.install({
        type: 'local',
        path: '/path/to/local/module',
      });

      expect(result.success).toBe(true);
      expect(result.moduleId).toBe('test-module');
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
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // source exists
        .mockResolvedValueOnce(undefined); // target already exists

      const result = await installer.install({
        type: 'local',
        path: '/path/to/local/module',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.errorCode).toBe('MODULE_ALREADY_INSTALLED');
    });

    it('should fail without path', async () => {
      const result = await installer.install({
        type: 'local',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires path');
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
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // source exists
        .mockRejectedValueOnce({ code: 'ENOENT' }); // target doesn't exist yet
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
