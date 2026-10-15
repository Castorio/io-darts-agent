import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerAnimationRoutes } from '../../../src/api/routes/animations.js';
import type { APIServer } from '../../../src/api/Server.js';
import type { AnimationGeneratorService } from '../../../src/core/media/AnimationGeneratorService.js';

describe('animation engine routes', () => {
  let fastify: FastifyInstance;
  const authEnabled = vi.fn(() => false);
  let selected: 'runway' | 'higgsfield';
  const engine = {
    get: vi.fn(() => ({
      engine: selected,
      engines: [
        { id: 'runway', name: 'Runway ML', available: false },
        { id: 'higgsfield', name: 'Higgsfield', available: true },
      ],
    })),
    set: vi.fn((value: 'runway' | 'higgsfield') => {
      selected = value;
    }),
  };

  beforeEach(async () => {
    selected = 'runway';
    fastify = Fastify();
    fastify.decorateRequest('session', null);
    const server = { isAuthEnabled: authEnabled } as unknown as APIServer;
    const animationService = { isProviderConfigured: () => true } as unknown as AnimationGeneratorService;
    registerAnimationRoutes(fastify, server, { animationService, engine });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    authEnabled.mockReturnValue(false);
    vi.clearAllMocks();
  });

  it('reports the selected engine in the status', async () => {
    selected = 'higgsfield';

    const response = await fastify.inject({ method: 'GET', url: '/api/animations/status' });

    expect(response.json()).toEqual({ available: true, provider: 'higgsfield' });
  });

  it('lists the engines and the current choice', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/animations/engine' });

    expect(response.statusCode).toBe(200);
    expect(response.json().engine).toBe('runway');
    expect(response.json().engines).toHaveLength(2);
  });

  it('switches the engine', async () => {
    const response = await fastify.inject({
      method: 'PUT',
      url: '/api/animations/engine',
      payload: { engine: 'higgsfield' },
    });

    expect(response.statusCode).toBe(200);
    expect(engine.set).toHaveBeenCalledWith('higgsfield');
    expect(response.json().engine).toBe('higgsfield');
  });

  it('rejects unknown engines', async () => {
    const response = await fastify.inject({
      method: 'PUT',
      url: '/api/animations/engine',
      payload: { engine: 'dalle' },
    });

    expect(response.statusCode).toBe(400);
    expect(engine.set).not.toHaveBeenCalled();
  });

  it('requires authentication when web auth is enabled', async () => {
    authEnabled.mockReturnValue(true);

    const get = await fastify.inject({ method: 'GET', url: '/api/animations/engine' });
    const put = await fastify.inject({ method: 'PUT', url: '/api/animations/engine', payload: { engine: 'higgsfield' } });

    expect(get.statusCode).toBe(401);
    expect(put.statusCode).toBe(401);
    expect(engine.set).not.toHaveBeenCalled();
  });
});
