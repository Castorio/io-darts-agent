/**
 * TTS Routes
 *
 * API routes for Text-to-Speech services
 */

import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { ElevenLabsService, VoicePackGenerator, VoicePackConfig } from '../../core/modules/handlers/index.js';

interface TtsRouteOptions {
  getElevenLabsService: () => ElevenLabsService | null;
  getVoicePackGenerator: () => VoicePackGenerator | null;
}

/**
 * Register TTS routes
 */
export function registerTtsRoutes(
  fastify: FastifyInstance,
  _server: APIServer,
  options: TtsRouteOptions
): void {
  const { getElevenLabsService, getVoicePackGenerator } = options;

  /**
   * GET /api/tts/elevenlabs/voices - Get available ElevenLabs voices
   */
  fastify.get('/api/tts/elevenlabs/voices', async (_request, reply) => {
    const service = getElevenLabsService();
    if (!service) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not configured',
      });
    }

    if (!service.isConfigured()) {
      return reply.status(400).send({
        success: false,
        error: 'ElevenLabs API key not configured',
      });
    }

    try {
      const voices = await service.getVoices();
      return reply.send({
        success: true,
        voices,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voices',
      });
    }
  });

  /**
   * GET /api/tts/elevenlabs/voice/:voiceId - Get specific voice info
   */
  fastify.get<{
    Params: { voiceId: string };
  }>('/api/tts/elevenlabs/voice/:voiceId', async (request, reply) => {
    const service = getElevenLabsService();
    if (!service || !service.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not available',
      });
    }

    try {
      const voice = await service.getVoice(request.params.voiceId);
      if (!voice) {
        return reply.status(404).send({
          success: false,
          error: 'Voice not found',
        });
      }
      return reply.send({
        success: true,
        voice,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voice',
      });
    }
  });

  /**
   * GET /api/tts/elevenlabs/subscription - Get subscription info
   */
  fastify.get('/api/tts/elevenlabs/subscription', async (_request, reply) => {
    const service = getElevenLabsService();
    if (!service || !service.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not available',
      });
    }

    try {
      const subscription = await service.getSubscriptionInfo();
      return reply.send({
        success: true,
        subscription,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch subscription',
      });
    }
  });

  /**
   * POST /api/tts/elevenlabs/generate - Generate speech (for testing)
   */
  fastify.post<{
    Body: {
      text: string;
      voiceId?: string;
    };
  }>('/api/tts/elevenlabs/generate', async (request, reply) => {
    const service = getElevenLabsService();
    if (!service || !service.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not available',
      });
    }

    const { text, voiceId } = request.body;

    if (!text) {
      return reply.status(400).send({
        success: false,
        error: 'Text is required',
      });
    }

    try {
      const audioBuffer = await service.generateSpeech(text, { voiceId });

      // Return as base64 for easy frontend playback
      return reply.send({
        success: true,
        audio: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
        text,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate speech',
      });
    }
  });

  /**
   * GET /api/tts/elevenlabs/cache/stats - Get cache statistics
   */
  fastify.get('/api/tts/elevenlabs/cache/stats', async (_request, reply) => {
    const service = getElevenLabsService();
    if (!service) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not available',
      });
    }

    const stats = service.getCacheStats();
    return reply.send({
      success: true,
      stats: {
        ...stats,
        sizeMB: (stats.sizeBytes / (1024 * 1024)).toFixed(2),
      },
    });
  });

  /**
   * DELETE /api/tts/elevenlabs/cache - Clear cache
   */
  fastify.delete('/api/tts/elevenlabs/cache', async (_request, reply) => {
    const service = getElevenLabsService();
    if (!service) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not available',
      });
    }

    await service.clearCache();
    return reply.send({
      success: true,
      message: 'Cache cleared',
    });
  });

  /**
   * GET /api/tts/elevenlabs/status - Get service status
   */
  fastify.get('/api/tts/elevenlabs/status', async (_request, reply) => {
    const service = getElevenLabsService();

    return reply.send({
      success: true,
      status: {
        available: !!service,
        configured: service?.isConfigured() ?? false,
        cache: service?.getCacheStats() ?? null,
      },
    });
  });

  // ==========================================
  // Voice Pack Generation Routes
  // ==========================================

  /**
   * GET /api/tts/voicepacks - List all voice packs
   */
  fastify.get('/api/tts/voicepacks', async (_request, reply) => {
    const generator = getVoicePackGenerator();
    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    try {
      const packs = generator.listPacks();
      return reply.send({
        success: true,
        packs,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list voice packs',
      });
    }
  });

  /**
   * GET /api/tts/voicepacks/:packId - Get voice pack info
   */
  fastify.get<{
    Params: { packId: string };
  }>('/api/tts/voicepacks/:packId', async (request, reply) => {
    const generator = getVoicePackGenerator();
    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    try {
      const packInfo = generator.getPackInfo(request.params.packId);
      if (!packInfo) {
        return reply.status(404).send({
          success: false,
          error: 'Voice pack not found',
        });
      }
      return reply.send({
        success: true,
        pack: packInfo,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get voice pack info',
      });
    }
  });

  /**
   * DELETE /api/tts/voicepacks/:packId - Delete a voice pack
   */
  fastify.delete<{
    Params: { packId: string };
  }>('/api/tts/voicepacks/:packId', async (request, reply) => {
    const generator = getVoicePackGenerator();
    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    try {
      const deleted = generator.deletePack(request.params.packId);
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Voice pack not found',
        });
      }
      return reply.send({
        success: true,
        message: `Voice pack ${request.params.packId} deleted`,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete voice pack',
      });
    }
  });

  /**
   * GET /api/tts/voicepacks/generation/progress - Get current generation progress
   */
  fastify.get('/api/tts/voicepacks/generation/progress', async (_request, reply) => {
    const generator = getVoicePackGenerator();
    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    const progress = generator.getProgress();
    return reply.send({
      success: true,
      isGenerating: generator.isGenerating(),
      progress,
    });
  });

  /**
   * POST /api/tts/voicepacks/generate - Start voice pack generation
   */
  fastify.post<{
    Body: {
      packId: string;
      packName: string;
      voiceId: string;
      language: string;
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
    };
  }>('/api/tts/voicepacks/generate', async (request, reply) => {
    const generator = getVoicePackGenerator();
    const elevenLabsService = getElevenLabsService();

    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    if (!elevenLabsService || !elevenLabsService.isConfigured()) {
      return reply.status(503).send({
        success: false,
        error: 'ElevenLabs service not configured',
      });
    }

    if (generator.isGenerating()) {
      return reply.status(409).send({
        success: false,
        error: 'Generation already in progress',
        progress: generator.getProgress(),
      });
    }

    const { packId, packName, voiceId, language, modelId, stability, similarityBoost } = request.body;

    // Validate required fields
    if (!packId || !packName || !voiceId || !language) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields: packId, packName, voiceId, language',
      });
    }

    // Validate language
    if (!['en', 'de'].includes(language)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid language. Supported: en, de',
      });
    }

    const config: VoicePackConfig = {
      packId,
      packName,
      voiceId,
      language,
      modelId,
      stability,
      similarityBoost,
    };

    // Start generation in background (don't await)
    generator.generate(config).catch((error) => {
      console.error('Voice pack generation failed:', error);
    });

    return reply.send({
      success: true,
      message: 'Voice pack generation started',
      progress: generator.getProgress(),
    });
  });

  /**
   * POST /api/tts/voicepacks/generation/cancel - Cancel current generation
   */
  fastify.post('/api/tts/voicepacks/generation/cancel', async (_request, reply) => {
    const generator = getVoicePackGenerator();
    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    if (!generator.isGenerating()) {
      return reply.status(400).send({
        success: false,
        error: 'No generation in progress',
      });
    }

    generator.cancel();
    return reply.send({
      success: true,
      message: 'Cancellation requested',
    });
  });

  /**
   * GET /api/tts/voicepacks/generation/status - Get generation status (combined endpoint)
   */
  fastify.get('/api/tts/voicepacks/generation/status', async (_request, reply) => {
    const generator = getVoicePackGenerator();
    const elevenLabsService = getElevenLabsService();

    if (!generator) {
      return reply.status(503).send({
        success: false,
        error: 'Voice pack generator not available',
      });
    }

    const progress = generator.getProgress();
    const packs = generator.listPacks();

    return reply.send({
      success: true,
      elevenLabsConfigured: elevenLabsService?.isConfigured() ?? false,
      isGenerating: generator.isGenerating(),
      progress,
      existingPacks: packs.length,
      packs,
    });
  });
}
