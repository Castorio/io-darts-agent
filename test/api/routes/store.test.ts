import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerStoreRoutes } from '../../../src/api/routes/store.js';
import type { StoreDependencies } from '../../../src/api/routes/store.js';
import type { StoreModule } from '../../../src/core/store/catalog.js';

const mockServer = {
  isAuthEnabled: vi.fn().mockReturnValue(false),
};

function makeModule(overrides: Partial<StoreModule> = {}): StoreModule {
  return {
    id: 'mqtt',
    name: { de: 'MQTT Modul', en: 'MQTT module' },
    description: { de: 'Verbindet mit MQTT', en: 'Connects to MQTT' },
    category: 'integration',
    author: 'Castorio',
    repo: 'https://github.com/castorio/autodarts-mqtt-module',
    branch: 'main',
    ...overrides,
  };
}

describe('Store Routes', () => {
  let fastify: FastifyInstance;
  let load: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let installedVersion: ReturnType<typeof vi.fn>;
  let installModule: ReturnType<typeof vi.fn>;
  let uninstallModule: ReturnType<typeof vi.fn>;
  let deps: StoreDependencies;

  beforeEach(async () => {
    load = vi.fn().mockResolvedValue({ available: true, modules: [makeModule()] });
    find = vi.fn();
    installedVersion = vi.fn().mockReturnValue(null);
    installModule = vi.fn().mockResolvedValue('mqtt');
    uninstallModule = vi.fn().mockResolvedValue(undefined);

    deps = { catalog: { load, find }, installedVersion, installModule, uninstallModule };

    fastify = Fastify();
    registerStoreRoutes(fastify, mockServer as any, deps);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
    mockServer.isAuthEnabled.mockReturnValue(false);
  });

  describe('GET /api/store', () => {
    it('lists catalog modules with install status', async () => {
      installedVersion.mockReturnValue(null);

      const response = await fastify.inject({ method: 'GET', url: '/api/store' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(true);
      expect(body.modules).toHaveLength(1);
      expect(body.modules[0]).toMatchObject({ id: 'mqtt', installed: false, installedVersion: null });
    });

    it('marks an installed module with its version', async () => {
      installedVersion.mockImplementation((id: string) => (id === 'mqtt' ? '1.2.0' : null));

      const response = await fastify.inject({ method: 'GET', url: '/api/store' });

      const body = JSON.parse(response.body);
      expect(body.modules[0]).toMatchObject({ installed: true, installedVersion: '1.2.0' });
    });

    it('reports the store as unavailable when the catalog cannot load', async () => {
      load.mockResolvedValue({ available: false, error: 'Catalog request timed out' });

      const response = await fastify.inject({ method: 'GET', url: '/api/store' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.available).toBe(false);
      expect(body.error).toBe('Catalog request timed out');
      expect(body.modules).toEqual([]);
    });

    it('requires authentication when enabled', async () => {
      mockServer.isAuthEnabled.mockReturnValue(true);

      const response = await fastify.inject({ method: 'GET', url: '/api/store' });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/store/:id/install', () => {
    it('installs an uninstalled module using the catalog repo and branch', async () => {
      installedVersion.mockReturnValue(null);

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.moduleId).toBe('mqtt');
      expect(installModule).toHaveBeenCalledWith('https://github.com/castorio/autodarts-mqtt-module', 'main');
    });

    it('ignores a url and branch supplied in the request body', async () => {
      installedVersion.mockReturnValue(null);

      await fastify.inject({
        method: 'POST',
        url: '/api/store/mqtt/install',
        payload: { url: 'https://github.com/attacker/evil', branch: 'main; rm -rf /' },
      });

      expect(installModule).toHaveBeenCalledWith('https://github.com/castorio/autodarts-mqtt-module', 'main');
    });

    it('returns 404 for an id not in the catalog', async () => {
      const response = await fastify.inject({ method: 'POST', url: '/api/store/unknown-module/install' });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(installModule).not.toHaveBeenCalled();
    });

    it('returns 409 when the module is already installed', async () => {
      installedVersion.mockImplementation((id: string) => (id === 'mqtt' ? '1.0.0' : null));

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(installModule).not.toHaveBeenCalled();
    });

    it('returns 503 when the catalog is unavailable', async () => {
      load.mockResolvedValue({ available: false, error: 'Catalog request timed out' });

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(installModule).not.toHaveBeenCalled();
    });

    it('requires authentication when enabled', async () => {
      mockServer.isAuthEnabled.mockReturnValue(true);

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(401);
      expect(installModule).not.toHaveBeenCalled();
    });

    it('returns 500 when the installer throws', async () => {
      installedVersion.mockReturnValue(null);
      installModule.mockRejectedValue(new Error('git clone failed'));

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('git clone failed');
      expect(uninstallModule).not.toHaveBeenCalled();
    });

    it('treats an "already exists" installer error as already installed (409), not a 500', async () => {
      installedVersion.mockReturnValue(null);
      installModule.mockRejectedValue(new Error('Module directory already exists'));

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(uninstallModule).not.toHaveBeenCalled();
    });

    it('treats a manifest-id collision error ("already installed") from the installer as 409, not a 500', async () => {
      installedVersion.mockReturnValue(null);
      installModule.mockRejectedValue(new Error("Module 'wled' is already installed"));

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(uninstallModule).not.toHaveBeenCalled();
    });

    it('rolls back and errors when the installer reports a different module id than the catalog id', async () => {
      installedVersion.mockReturnValue(null);
      installModule.mockResolvedValue('autodarts-mqtt-module');

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('autodarts-mqtt-module');
      expect(body.error).toContain('mqtt');
      expect(uninstallModule).toHaveBeenCalledWith('autodarts-mqtt-module');
      expect(uninstallModule).toHaveBeenCalledTimes(1);
    });

    it('does not report success when the installed id mismatches, even if rollback itself fails', async () => {
      installedVersion.mockReturnValue(null);
      installModule.mockResolvedValue('autodarts-mqtt-module');
      uninstallModule.mockRejectedValue(new Error('rm failed'));

      const response = await fastify.inject({ method: 'POST', url: '/api/store/mqtt/install' });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(uninstallModule).toHaveBeenCalledWith('autodarts-mqtt-module');
    });
  });
});
