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
    registry.initialize(fastify, { isAuthEnabled: () => false });
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

    // The real hub sets request.session via a global onRequest auth
    // middleware (src/api/middleware/auth.ts) registered before any route
    // runs. ModuleRouteRegistry.checkAuth now reads that instead of the
    // session cookie itself, so tests simulate the middleware the same way.
    async function setupWithAuth(authenticated: boolean): Promise<ModuleRouteRegistry> {
      fastify = Fastify();
      await fastify.register(fastifyCookie);
      fastify.addHook('onRequest', async (request) => {
        request.session = { authenticated };
      });
      const registry = new ModuleRouteRegistry();
      registry.initialize(fastify, { isAuthEnabled: () => true });
      registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: { pong: 1 } }));
      await registry.registerRoutes(authedRegistration);
      return registry;
    }

    it('lets a request through when the auth middleware marked it authenticated', async () => {
      await setupWithAuth(true);

      const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ pong: 1 });
    });

    it('rejects a request the auth middleware did not mark authenticated', async () => {
      await setupWithAuth(false);

      const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });

      expect(res.statusCode).toBe(401);
    });

    it('rejects a request with no session set at all', async () => {
      fastify = Fastify();
      const registry = new ModuleRouteRegistry();
      registry.initialize(fastify, { isAuthEnabled: () => true });
      registry.setRouteHandler('demo', () => Promise.resolve({ statusCode: 200, body: { pong: 1 } }));
      await registry.registerRoutes(authedRegistration);

      const res = await fastify.inject({ method: 'GET', url: '/api/modules/demo/routes/ping' });

      expect(res.statusCode).toBe(401);
    });
  });
});
