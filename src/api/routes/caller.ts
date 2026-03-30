/**
 * Caller Routes
 *
 * API routes for the Darts Caller module
 */

import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { DartsCallerHandler, CallRequest } from '../../core/modules/handlers/index.js';

interface CallerRouteOptions {
  getCallerHandler: () => DartsCallerHandler | null;
  subscribeToCallRequests: (callback: (request: CallRequest) => void) => () => void;
}

/**
 * Register caller routes
 */
export function registerCallerRoutes(
  fastify: FastifyInstance,
  _server: APIServer,
  options: CallerRouteOptions
): void {
  const { getCallerHandler } = options;

  /**
   * GET /api/caller/config - Get caller configuration
   */
  fastify.get('/api/caller/config', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    return reply.send({
      success: true,
      config: handler.getConfig(),
    });
  });

  /**
   * GET /api/caller/stats - Get caller statistics
   */
  fastify.get('/api/caller/stats', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    return reply.send({
      success: true,
      stats: handler.getStats(),
    });
  });

  /**
   * POST /api/caller/stats/reset - Reset statistics
   */
  fastify.post('/api/caller/stats/reset', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    handler.resetStats();

    return reply.send({
      success: true,
      message: 'Statistics reset',
    });
  });

  /**
   * GET /api/caller/voices - Get available TTS voices (placeholder)
   * The actual voice list comes from the browser's speechSynthesis API
   */
  fastify.get('/api/caller/voices', async (_request, reply) => {
    // This is a placeholder - actual voices are fetched client-side
    // from window.speechSynthesis.getVoices()
    return reply.send({
      success: true,
      message: 'Use browser speechSynthesis API for voice list',
      example: 'window.speechSynthesis.getVoices()',
    });
  });

  /**
   * POST /api/caller/test - Test caller with a sample call (triggers actual audio playback)
   */
  fastify.post<{
    Body: { score?: number };
  }>('/api/caller/test', async (request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    const { score } = request.body || {};
    const config = handler.getConfig();

    // Trigger a real call through the handler's event system
    // This simulates a turn.finished event to test audio playback
    const testEvent = {
      type: 'turn.finished',
      timestamp: new Date(),
      data: {
        turnPoints: score ?? 180,
        remaining: 321,
        busted: false,
      },
    };

    // Handle the event to trigger audio playback
    await handler.handleEvent(testEvent as any);

    return reply.send({
      success: true,
      message: 'Test call triggered',
      config: {
        callerType: config.callerType,
        voicePackId: config.voicePackId,
        voicePacksDir: config.voicePacksDir,
      },
    });
  });

  /**
   * GET /api/caller/audio-packs - List available audio packs
   */
  fastify.get('/api/caller/audio-packs', async (_request, reply) => {
    // Audio packs would be stored in the media directory
    // This is a placeholder for the audio pack listing
    return reply.send({
      success: true,
      packs: [
        {
          id: 'default',
          name: 'Default',
          description: 'Default caller voice pack',
          path: 'caller/default',
        },
      ],
    });
  });

  /**
   * GET /api/caller/audio/status - Get audio playback status
   */
  fastify.get('/api/caller/audio/status', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    return reply.send({
      success: true,
      ...handler.getAudioStatus(),
    });
  });

  /**
   * POST /api/caller/audio/stop - Stop audio playback and clear queue
   */
  fastify.post('/api/caller/audio/stop', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    handler.stopPlayback();

    return reply.send({
      success: true,
      message: 'Audio playback stopped',
    });
  });

  /**
   * POST /api/caller/audio/skip - Skip current audio
   */
  fastify.post('/api/caller/audio/skip', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    handler.skipCurrent();

    return reply.send({
      success: true,
      message: 'Skipped to next audio',
    });
  });

  /**
   * GET /api/caller/voicepacks - List available voice packs
   */
  fastify.get('/api/caller/voicepacks', async (_request, reply) => {
    const handler = getCallerHandler();
    if (!handler) {
      return reply.status(503).send({ error: 'Caller module not running' });
    }

    return reply.send({
      success: true,
      packs: handler.getAvailableVoicePacks(),
    });
  });
}
