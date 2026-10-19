import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { ModuleRouteRegistry, type ModuleRouteRegistration } from './ModuleRouteRegistry.js';

const registration: ModuleRouteRegistration = {
  moduleId: 'demo',
  routes: [{ method: 'GET', path: '/ping', handlerId: 'ping', requireAuth: false }],
};

describe('ModuleRouteRegistry', () => {
  let fastify: FastifyInstance;

  afterEach(async () => {
    await fastify.close();
  });

  function setup(): ModuleRouteRegistry {
    fastify = Fastify();
    const registry = new ModuleRouteRegistry();
    registry.initialize(fastify, { isAuthEnabled: () => false, getSession: () => undefined });
    return registry;
  }

  it('forwards requests to the module handler', async () => {
    const registry = setup();
    registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: { pong: 1 } }));
    await registry.registerRoutes(registration);

    const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ pong: 1 });
  });

  it('keeps the new handler when a module announces its routes again', async () => {
    const registry = setup();
    registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: { v: 1 } }));
    await registry.registerRoutes(registration);

    // Module reconnects (crash restart) and registers handler and routes again
    registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: { v: 2 } }));
    await registry.registerRoutes(registration);

    const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ v: 2 });
  });

  it('drops routes and handler on unregister', async () => {
    const registry = setup();
    registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: {} }));
    await registry.registerRoutes(registration);
    await registry.unregisterRoutes('demo');

    expect(registry.hasRoutes('demo')).toBe(false);
    const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });
    expect(res.statusCode).toBe(404);
  });

  describe('authentication', () => {
    const authedRegistration: ModuleRouteRegistration = {
      moduleId: 'demo',
      // requireAuth omitted -> defaults to true
      routes: [{ method: 'GET', path: '/ping', handlerId: 'ping' }],
    };

    async function setupWithAuth(): Promise<ModuleRouteRegistry> {
      fastify = Fastify();
      await fastify.register(fastifyCookie);
      const registry = new ModuleRouteRegistry();
      registry.initialize(fastify, {
        isAuthEnabled: () => true,
        getSession: (sessionId) =>
          sessionId === 'valid-session-id' ? { authenticated: true } : undefined,
      });
      registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: { pong: 1 } }));
      await registry.registerRoutes(authedRegistration);
      return registry;
    }

    it('lets a request through when it carries the cookie the hub login sets', async () => {
      await setupWithAuth();

      const res = await fastify.inject({
        method: 'GET',
        url: '/api/modules/demo/routes/ping',
        headers: { cookie: 'autodarts_session=valid-session-id' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ pong: 1 });
    });

    it('rejects a request with no session cookie', async () => {
      await setupWithAuth();

      const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });

      expect(res.statusCode).toBe(401);
    });
  });
});
