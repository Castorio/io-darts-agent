/**
 * Animation Generator API Routes
 * Endpoints for AI-powered animation generation
 */

import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { AnimationGeneratorService } from '../../core/media/AnimationGeneratorService.js';
import type {
  AnimationStyle,
  AnimationJob,
  DartEventType,
  AnimationGenerationOptions,
} from '../../core/media/types/animation.js';

/**
 * Dependencies for animation routes
 */
export interface AnimationDependencies {
  animationService: AnimationGeneratorService;
}

/**
 * Request/Response types
 */
interface GenerateSingleBody {
  eventType: DartEventType;
  styleId?: string;
  customStyle?: {
    name: string;
    prompt: string;
  };
  customPrompt?: string;
  options?: AnimationGenerationOptions;
}

interface GenerateBatchBody {
  styleId?: string;
  customStyle?: {
    name: string;
    prompt: string;
  };
  eventTypes?: DartEventType[];
  options?: AnimationGenerationOptions;
}

/**
 * Helper to check authentication
 */
function isAuthorized(
  server: APIServer,
  session: { authenticated?: boolean } | undefined
): boolean {
  if (!server.isAuthEnabled()) {
    return true;
  }
  return session?.authenticated === true;
}

/**
 * Register animation routes
 */
export function registerAnimationRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: AnimationDependencies
): void {
  const { animationService } = deps;

  /**
   * GET /api/animations/status - Check if animation generation is available
   */
  fastify.get('/api/animations/status', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    return {
      available: animationService.isProviderConfigured(),
      provider: animationService.isProviderConfigured() ? 'runway' : null,
    };
  });

  /**
   * GET /api/animations/styles - Get all style presets
   */
  fastify.get<{
    Reply: { styles: AnimationStyle[] };
  }>('/api/animations/styles', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { styles: [] };
    }

    return {
      styles: animationService.getStylePresets(),
    };
  });

  /**
   * GET /api/animations/events - Get all dart event types
   */
  fastify.get<{
    Reply: { events: DartEventType[] };
  }>('/api/animations/events', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { events: [] };
    }

    return {
      events: animationService.getEventTypes(),
    };
  });

  /**
   * POST /api/animations/generate - Generate a single animation
   */
  fastify.post<{
    Body: GenerateSingleBody;
    Reply: { success: boolean; job?: AnimationJob; error?: string };
  }>('/api/animations/generate', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Unauthorized' };
    }

    const { eventType, styleId, customStyle, customPrompt, options } = request.body;

    if (!eventType) {
      reply.code(400);
      return { success: false, error: 'eventType is required' };
    }

    // Get or build style
    let style: AnimationStyle;
    if (customStyle) {
      style = {
        id: 'custom',
        name: customStyle.name,
        prompt: customStyle.prompt,
        category: 'custom',
      };
    } else if (styleId) {
      const preset = animationService.getStylePreset(styleId);
      if (!preset) {
        reply.code(400);
        return { success: false, error: `Style '${styleId}' not found` };
      }
      style = preset;
    } else {
      reply.code(400);
      return { success: false, error: 'styleId or customStyle is required' };
    }

    try {
      const job = await animationService.generateSingle({
        eventType,
        style,
        customPrompt,
        options,
      });

      return { success: true, job };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  });

  /**
   * POST /api/animations/generate-batch - Generate animations for multiple events
   */
  fastify.post<{
    Body: GenerateBatchBody;
    Reply: { success: boolean; jobs?: AnimationJob[]; error?: string };
  }>('/api/animations/generate-batch', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Unauthorized' };
    }

    const { styleId, customStyle, eventTypes, options } = request.body;

    // Get or build style
    let style: AnimationStyle;
    if (customStyle) {
      style = {
        id: 'custom',
        name: customStyle.name,
        prompt: customStyle.prompt,
        category: 'custom',
      };
    } else if (styleId) {
      const preset = animationService.getStylePreset(styleId);
      if (!preset) {
        reply.code(400);
        return { success: false, error: `Style '${styleId}' not found` };
      }
      style = preset;
    } else {
      reply.code(400);
      return { success: false, error: 'styleId or customStyle is required' };
    }

    try {
      const jobs = await animationService.generateBatch({
        style,
        eventTypes,
        options,
      });

      return { success: true, jobs };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch generation failed',
      };
    }
  });

  /**
   * GET /api/animations/jobs - Get all jobs
   */
  fastify.get<{
    Querystring: { status?: string };
    Reply: { jobs: AnimationJob[] };
  }>('/api/animations/jobs', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { jobs: [] };
    }

    let jobs = animationService.getJobs();

    // Filter by status if provided
    const { status } = request.query;
    if (status) {
      jobs = jobs.filter((j) => j.status === status);
    }

    return { jobs };
  });

  /**
   * GET /api/animations/jobs/:id - Get a specific job
   */
  fastify.get<{
    Params: { id: string };
    Reply: AnimationJob | { error: string };
  }>('/api/animations/jobs/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const job = animationService.getJob(request.params.id);
    if (!job) {
      reply.code(404);
      return { error: 'Job not found' };
    }

    return job;
  });

  /**
   * DELETE /api/animations/jobs/:id - Cancel or delete a job
   */
  fastify.delete<{
    Params: { id: string };
    Reply: { success: boolean; error?: string };
  }>('/api/animations/jobs/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Unauthorized' };
    }

    const job = animationService.getJob(request.params.id);
    if (!job) {
      reply.code(404);
      return { success: false, error: 'Job not found' };
    }

    // Cancel if still running, otherwise delete
    if (job.status === 'pending' || job.status === 'queued' || job.status === 'processing') {
      const cancelled = await animationService.cancelJob(request.params.id);
      return { success: cancelled };
    } else {
      const deleted = await animationService.deleteJob(request.params.id);
      return { success: deleted };
    }
  });

  /**
   * POST /api/animations/jobs/clear - Clear finished jobs
   */
  fastify.post<{
    Reply: { success: boolean; cleared: number };
  }>('/api/animations/jobs/clear', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, cleared: 0 };
    }

    const cleared = await animationService.clearFinishedJobs();
    return { success: true, cleared };
  });
}
