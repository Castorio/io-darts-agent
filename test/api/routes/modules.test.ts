import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIServer } from '../../../src/api/Server.js';
import { registerModuleRoutes, type ModuleDependencies } from '../../../src/api/routes/modules.js';
import { createAuthMiddleware } from '../../../src/api/middleware/auth.js';
import type { ModuleListItem, ModuleDetailResponse } from '../../../src/types/api.js';
import { serverUrl } from '../../helpers/serverUrl.js';

describe('Module Routes', () => {
  let server: APIServer;
  let moduleDeps: ModuleDependencies;
  let sessionCookie: string;

  const mockModules: ModuleListItem[] = [
    {
      id: 'caller-module',
      name: 'Caller Module',
      version: '1.0.0',
      description: 'Announces throws',
      status: 'running',
      events: ['throw.detected', 'match.start'],
    },
    {
      id: 'stats-module',
      name: 'Stats Module',
      version: '2.0.0',
      description: 'Track statistics',
      status: 'stopped',
      events: ['match.state'],
    },
  ];

  const mockModuleDetail: ModuleDetailResponse = {
    id: 'caller-module',
    name: 'Caller Module',
    version: '1.0.0',
    description: 'Announces throws',
    author: 'Test Author',
    status: 'running',
    events: ['throw.detected', 'match.start'],
    config: {
      schema: {
        enabled: { type: 'boolean', label: 'Enabled', default: true },
        language: { type: 'select', label: 'Language', options: [{ value: 'en', label: 'English' }, { value: 'de', label: 'German' }] },
      },
      values: { enabled: true, language: 'en' },
    },
    stats: {
      startedAt: '2024-01-01T00:00:00Z',
      restartCount: 0,
    },
  };

  beforeEach(async () => {
    server = new APIServer({ port: 0, logger: false });

    moduleDeps = {
      listModules: vi.fn().mockReturnValue(mockModules),
      getModule: vi.fn().mockImplementation((id) => id === 'caller-module' ? mockModuleDetail : null),
      getModuleConfig: vi.fn().mockReturnValue({ enabled: true }),
      updateModuleConfig: vi.fn().mockResolvedValue(undefined),
      startModule: vi.fn().mockResolvedValue(undefined),
      stopModule: vi.fn().mockResolvedValue(undefined),
      restartModule: vi.fn().mockResolvedValue(undefined),
      installModule: vi.fn().mockResolvedValue('new-module'),
      uninstallModule: vi.fn().mockResolvedValue(undefined),
      isModuleInstalled: vi.fn().mockImplementation((id) => id === 'caller-module'),
    };

    await server.initialize({
      setupCompleted: true,
      webAuth: { enabled: false, username: '', passwordHash: '' }, // Auth disabled for easier testing
      autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
      server: { port: 3000, host: '0.0.0.0' },
    });

    const fastify = server.getInstance();
    fastify.addHook('preHandler', createAuthMiddleware(server));
    registerModuleRoutes(fastify, server, moduleDeps);

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /api/modules', () => {
    it('should list all modules', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('caller-module');
      expect(moduleDeps.listModules).toHaveBeenCalled();
    });
  });

  describe('GET /api/modules/:id', () => {
    it('should return module details', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/caller-module`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.id).toBe('caller-module');
      expect(data.name).toBe('Caller Module');
      expect(data.config).toBeDefined();
    });

    it('should return 404 for unknown module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/unknown-module`);
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/modules/:id/config', () => {
    it('should update module config', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/caller-module/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { enabled: false, language: 'de' } }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(moduleDeps.updateModuleConfig).toHaveBeenCalledWith('caller-module', { enabled: false, language: 'de' });
    });

    it('should return 404 for unknown module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/unknown-module/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { enabled: false } }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/modules/:id/start', () => {
    it('should start module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/caller-module/start`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(moduleDeps.startModule).toHaveBeenCalledWith('caller-module');
    });
  });

  describe('POST /api/modules/:id/stop', () => {
    it('should stop module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/caller-module/stop`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(moduleDeps.stopModule).toHaveBeenCalledWith('caller-module');
    });
  });

  describe('POST /api/modules/:id/restart', () => {
    it('should restart module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/caller-module/restart`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(moduleDeps.restartModule).toHaveBeenCalledWith('caller-module');
    });
  });

  describe('POST /api/modules/install', () => {
    it('should install module from git', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'git',
          url: 'https://github.com/example/module.git',
          branch: 'main',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.moduleId).toBe('new-module');
      expect(moduleDeps.installModule).toHaveBeenCalledWith('git', 'https://github.com/example/module.git', undefined, 'main');
    });

    it('should install module from local path', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'local',
          path: '/path/to/module',
        }),
      });

      expect(response.ok).toBe(true);
      expect(moduleDeps.installModule).toHaveBeenCalledWith('local', undefined, '/path/to/module', undefined);
    });

    it('should reject git install without url', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'git' }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject local install without path', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'local' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/modules/:id', () => {
    it('should uninstall module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/caller-module`, {
        method: 'DELETE',
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(moduleDeps.uninstallModule).toHaveBeenCalledWith('caller-module');
    });

    it('should return 404 for unknown module', async () => {
      const response = await fetch(`${serverUrl(server)}/api/modules/unknown-module`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
    });
  });
});
