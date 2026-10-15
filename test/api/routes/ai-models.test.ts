import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerAIRoutes } from '../../../src/api/routes/ai.js';
import type { APIServer } from '../../../src/api/Server.js';
import type { AIProviderService } from '../../../src/core/ai/AIProviderService.js';

describe('GET /api/ai/providers/:id/models', () => {
  let fastify: FastifyInstance;
  const authEnabled = vi.fn(() => false);
  const providers: Record<string, unknown> = {};

  beforeEach(async () => {
    fastify = Fastify();
    fastify.decorateRequest('session', null);
    const server = { isAuthEnabled: authEnabled } as unknown as APIServer;
    const service = { getProvider: (id: string) => providers[id] } as unknown as AIProviderService;
    registerAIRoutes(fastify, server, { getService: () => service });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    authEnabled.mockReturnValue(false);
    for (const key of Object.keys(providers)) delete providers[key];
  });

  it('returns the text models of the provider', async () => {
    providers.openai = {
      listTextModels: vi.fn().mockResolvedValue([{ id: 'gpt-4.1-mini', name: 'gpt-4.1-mini' }]),
    };

    const response = await fastify.inject({ method: 'GET', url: '/api/ai/providers/openai/models' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ models: [{ id: 'gpt-4.1-mini', name: 'gpt-4.1-mini' }] });
  });

  it('returns 404 for an unknown provider', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/api/ai/providers/nope/models' });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 when the provider cannot list models', async () => {
    providers.ollama = {};

    const response = await fastify.inject({ method: 'GET', url: '/api/ai/providers/ollama/models' });

    expect(response.statusCode).toBe(400);
  });

  it('returns 502 without leaking the upstream error when listing fails', async () => {
    providers.openai = {
      listTextModels: vi.fn().mockRejectedValue(new Error('API error (401): invalid key sk-123')),
    };

    const response = await fastify.inject({ method: 'GET', url: '/api/ai/providers/openai/models' });

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('sk-123');
  });

  it('requires authentication when web auth is enabled', async () => {
    authEnabled.mockReturnValue(true);
    providers.openai = { listTextModels: vi.fn() };

    const response = await fastify.inject({ method: 'GET', url: '/api/ai/providers/openai/models' });

    expect(response.statusCode).toBe(401);
  });
});
