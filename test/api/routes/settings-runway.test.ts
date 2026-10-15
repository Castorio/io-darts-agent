import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerSettingsRoutes } from '../../../src/api/routes/settings.js';
import type { APIServer } from '../../../src/api/Server.js';
import type { HubConfiguration } from '../../../src/types/api.js';

function hubConfig(runway?: { apiKey: string; model?: string }): HubConfiguration {
  return {
    setupCompleted: true,
    language: 'en',
    server: { port: 3000, host: '0.0.0.0' },
    webAuth: { enabled: false, username: '', passwordHash: '' },
    autodarts: { email: '', password: '', boardId: '' },
    aiProviders: runway ? { runway } : undefined,
  } as unknown as HubConfiguration;
}

describe('GET /api/settings, legacy Runway entry', () => {
  let fastify: FastifyInstance;

  async function settingsFor(config: HubConfiguration) {
    fastify = Fastify();
    fastify.decorateRequest('session', null);
    const server = { isAuthEnabled: () => false, getConfig: () => config } as unknown as APIServer;
    registerSettingsRoutes(fastify, server, { saveConfig: async () => {} });
    await fastify.ready();
    return (await fastify.inject({ method: 'GET', url: '/api/settings' })).json();
  }

  afterEach(async () => {
    await fastify?.close();
  });

  it('no longer invents the retired gen3a_turbo model', async () => {
    const body = await settingsFor(hubConfig({ apiKey: 'k' }));

    expect(body.aiProviders.runway).toEqual({ configured: true });
    expect(JSON.stringify(body)).not.toContain('gen3a');
  });

  it('reports a model that is still in the legacy config as is', async () => {
    const body = await settingsFor(hubConfig({ apiKey: 'k', model: 'gen4.5' }));

    expect(body.aiProviders.runway).toEqual({ configured: true, model: 'gen4.5' });
  });
});
