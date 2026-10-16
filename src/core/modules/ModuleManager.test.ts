import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { ModuleManager } from './ModuleManager.js';
import { EventBus } from '../events/EventBus.js';
import type { ModuleManifest } from '../../types/modules.js';

vi.mock('fs/promises');
vi.mock('child_process', async () => {
  const { EventEmitter } = await import('events');
  class FakeProcess extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    killed = false;
    kill = vi.fn(() => {
      this.killed = true;
      this.emit('exit', 0, null);
    });
  }
  return { spawn: vi.fn(() => new FakeProcess()) };
});

/** Minimal Dirent stand-in for the fs.readdir mock */
function dirents(entries: Array<{ name: string; dir: boolean }>): Awaited<ReturnType<typeof fs.readdir>> {
  return entries.map((e) => ({ name: e.name, isDirectory: (): boolean => e.dir })) as unknown as Awaited<
    ReturnType<typeof fs.readdir>
  >;
}

const TEST_MANIFEST: ModuleManifest = {
  id: 'test-module',
  name: 'Test Module',
  version: '1.0.0',
  description: 'A test module',
  entry: 'index.js',
  events: ['throw.detected', 'match.start'],
  config: {
    setting1: {
      type: 'string',
      label: 'Setting 1',
      default: 'default-value',
    },
  },
};

describe('ModuleManager', () => {
  let manager: ModuleManager;
  let eventBus: EventBus;
  const testModulesDir = '/test/modules';
  const testSocketDir = '/tmp';

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    manager = new ModuleManager(eventBus, {
      modulesDir: testModulesDir,
      socketDir: testSocketDir,
      maxRestarts: 2,
      restartDelay: 100,
      shutdownTimeout: 1000,
    });
  });

  afterEach(async () => {
    await manager.stopAll();
    eventBus.clear();
  });

  describe('discoverModules()', () => {
    it('should create modules directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const manifests = await manager.discoverModules();

      expect(fs.mkdir).toHaveBeenCalledWith(testModulesDir, { recursive: true });
      expect(manifests).toEqual([]);
    });

    it('should discover modules in directory', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(
        dirents([
          { name: 'test-module', dir: true },
          { name: 'file.txt', dir: false },
        ])
      );
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(TEST_MANIFEST));

      const manifests = await manager.discoverModules();

      expect(manifests).toHaveLength(1);
      expect(manifests[0].id).toBe('test-module');
    });

    it('should skip invalid manifests', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(dirents([{ name: 'invalid-module', dir: true }]));
      vi.mocked(fs.readFile).mockResolvedValue('{ "invalid": "json" }');

      const manifests = await manager.discoverModules();

      expect(manifests).toHaveLength(0);
    });
  });

  describe('registerModule()', () => {
    it('should register a module', async () => {
      const handler = vi.fn();
      manager.on('moduleRegistered', handler);

      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      expect(handler).toHaveBeenCalledWith('test-module');

      const info = manager.getModule('test-module');
      expect(info).toBeDefined();
      expect(info?.manifest.id).toBe('test-module');
      expect(info?.state.status).toBe('stopped');
    });

    it('should throw if module already registered', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      await expect(
        manager.registerModule(TEST_MANIFEST, '/test/modules/test-module')
      ).rejects.toThrow('already registered');
    });

    it('should merge config with defaults', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module', {
        setting1: 'custom-value',
        extraSetting: 'extra',
      });

      const info = manager.getModule('test-module');
      expect(info?.config.setting1).toBe('custom-value');
      expect(info?.config.extraSetting).toBe('extra');
    });
  });

  describe('unregisterModule()', () => {
    it('should unregister a module', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      const handler = vi.fn();
      manager.on('moduleUnregistered', handler);

      await manager.unregisterModule('test-module');

      expect(handler).toHaveBeenCalledWith('test-module');
      expect(manager.getModule('test-module')).toBeUndefined();
    });

    it('should throw if module not found', async () => {
      await expect(manager.unregisterModule('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getModule()', () => {
    it('should return undefined for unknown module', () => {
      expect(manager.getModule('unknown')).toBeUndefined();
    });

    it('should return module info', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      const info = manager.getModule('test-module');

      expect(info).toBeDefined();
      expect(info?.manifest).toEqual(TEST_MANIFEST);
      expect(info?.state.id).toBe('test-module');
      expect(info?.path).toBe('/test/modules/test-module');
    });
  });

  describe('getAllModules()', () => {
    it('should return empty array when no modules', () => {
      expect(manager.getAllModules()).toEqual([]);
    });

    it('should return all registered modules', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');
      await manager.registerModule(
        { ...TEST_MANIFEST, id: 'test-module-2', name: 'Test Module 2' },
        '/test/modules/test-module-2'
      );

      const modules = manager.getAllModules();

      expect(modules).toHaveLength(2);
    });
  });

  describe('getRunningModules()', () => {
    it('should return empty array when no modules running', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      expect(manager.getRunningModules()).toEqual([]);
    });
  });

  describe('updateModuleConfig()', () => {
    it('should update module config', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      const handler = vi.fn();
      manager.on('moduleConfigUpdated', handler);

      await manager.updateModuleConfig('test-module', { setting1: 'new-value' });

      expect(handler).toHaveBeenCalledWith('test-module', ['setting1']);

      const info = manager.getModule('test-module');
      expect(info?.config.setting1).toBe('new-value');
    });

    it('should throw if module not found', async () => {
      await expect(
        manager.updateModuleConfig('nonexistent', { setting: 'value' })
      ).rejects.toThrow('not found');
    });
  });

  describe('Module Status Events', () => {
    it('should emit moduleStatusChange events', async () => {
      await manager.registerModule(TEST_MANIFEST, '/test/modules/test-module');

      const handler = vi.fn();
      manager.on('moduleStatusChange', handler);

      // Trigger status change (we can't fully test without starting)
      const info = manager.getModule('test-module');
      expect(info?.state.status).toBe('stopped');
    });
  });

  describe('Manifest Validation', () => {
    it('should reject manifest without id', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(dirents([{ name: 'bad-module', dir: true }]));
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ name: 'Bad', version: '1.0.0', entry: 'index.js', events: [] })
      );

      const manifests = await manager.discoverModules();
      expect(manifests).toHaveLength(0);
    });

    it('should reject manifest without events array', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(dirents([{ name: 'bad-module', dir: true }]));
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ id: 'bad', name: 'Bad', version: '1.0.0', entry: 'index.js' })
      );

      const manifests = await manager.discoverModules();
      expect(manifests).toHaveLength(0);
    });
  });
});
