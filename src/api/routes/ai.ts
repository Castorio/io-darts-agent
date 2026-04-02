/**
 * AI Provider API Routes
 *
 * REST API endpoints for AI provider management and generation tasks.
 */

import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type {
  AIProviderInfo,
  AIProviderConfigUpdate,
  AIProviderStatus,
  AICapability,
  TextGenerationAPIRequest,
  TextGenerationResponse,
  ImageGenerationAPIRequest,
  ImageGenerationResponse,
  TTSAPIRequest,
  TTSResponse,
  EmbeddingsAPIRequest,
  EmbeddingsResponse,
  AIJob,
} from '../../core/ai/types.js';
import type { AIProviderService } from '../../core/ai/AIProviderService.js';

/**
 * Dependencies for AI routes
 */
export interface AIDependencies {
  getService: () => AIProviderService;
  saveConfig?: () => void;
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
 * Register AI provider routes
 */
export function registerAIRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: AIDependencies
): void {
  // ============================================================================
  // Provider Management
  // ============================================================================

  /**
   * GET /api/ai/providers - List all providers
   */
  fastify.get<{
    Reply: { providers: AIProviderInfo[] } | { error: string };
  }>('/api/ai/providers', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const providers = service.getProviders();

    return {
      providers: providers.map((provider) => ({
        id: provider.config.id,
        type: provider.config.type,
        name: provider.config.name,
        enabled: provider.config.enabled !== false,
        configured: provider.isConfigured(),
        capabilities: provider.capabilities,
        hasApiKey: !!provider.config.apiKey,
        baseUrl: provider.config.baseUrl,
        defaultModel: (provider.config.options as Record<string, unknown>)?.defaultModel as string | undefined,
        options: provider.config.options,
      })),
    };
  });

  /**
   * GET /api/ai/providers/:id - Get provider details
   */
  fastify.get<{
    Params: { id: string };
    Reply: AIProviderInfo | { error: string };
  }>('/api/ai/providers/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const provider = service.getProvider(request.params.id);

    if (!provider) {
      reply.code(404);
      return { error: 'Provider not found' };
    }

    return {
      id: provider.config.id,
      type: provider.config.type,
      name: provider.config.name,
      enabled: provider.config.enabled !== false,
      configured: provider.isConfigured(),
      capabilities: provider.capabilities,
      hasApiKey: !!provider.config.apiKey,
      baseUrl: provider.config.baseUrl,
      defaultModel: (provider.config.options as Record<string, unknown>)?.defaultModel as string | undefined,
      options: provider.config.options,
    };
  });

  /**
   * GET /api/ai/providers/:id/status - Get provider status
   */
  fastify.get<{
    Params: { id: string };
    Reply: AIProviderStatus | { error: string };
  }>('/api/ai/providers/:id/status', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const provider = service.getProvider(request.params.id);

    if (!provider) {
      reply.code(404);
      return { error: 'Provider not found' };
    }

    return provider.getStatus();
  });

  /**
   * PUT /api/ai/providers/:id - Update provider configuration
   */
  fastify.put<{
    Params: { id: string };
    Body: AIProviderConfigUpdate;
    Reply: { success: boolean } | { error: string };
  }>('/api/ai/providers/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const provider = service.getProvider(request.params.id);

    if (!provider) {
      reply.code(404);
      return { error: 'Provider not found' };
    }

    try {
      service.updateProviderConfig(request.params.id, request.body);
      // Persist config changes to disk
      if (deps.saveConfig) {
        deps.saveConfig();
      }
      return { success: true };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'Failed to update provider' };
    }
  });

  /**
   * POST /api/ai/providers/:id/enable - Enable provider
   */
  fastify.post<{
    Params: { id: string };
    Reply: { success: boolean } | { error: string };
  }>('/api/ai/providers/:id/enable', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();

    try {
      service.updateProviderConfig(request.params.id, { enabled: true });
      if (deps.saveConfig) {
        deps.saveConfig();
      }
      return { success: true };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'Failed to enable provider' };
    }
  });

  /**
   * POST /api/ai/providers/:id/disable - Disable provider
   */
  fastify.post<{
    Params: { id: string };
    Reply: { success: boolean } | { error: string };
  }>('/api/ai/providers/:id/disable', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();

    try {
      service.updateProviderConfig(request.params.id, { enabled: false });
      if (deps.saveConfig) {
        deps.saveConfig();
      }
      return { success: true };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'Failed to disable provider' };
    }
  });

  /**
   * GET /api/ai/capabilities - List all available capabilities
   */
  fastify.get<{
    Reply: { capabilities: AICapability[]; providers: Record<AICapability, string[]> } | { error: string };
  }>('/api/ai/capabilities', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const capabilities = service.getAvailableCapabilities();
    const providers = service.getProviders();

    // Map capabilities to provider IDs (only available providers)
    const capabilityProviders: Record<string, string[]> = {};
    for (const cap of capabilities) {
      capabilityProviders[cap] = providers
        .filter((p) => p.capabilities.includes(cap) && p.isAvailable())
        .map((p) => p.config.id);
    }

    return {
      capabilities,
      providers: capabilityProviders as Record<AICapability, string[]>,
    };
  });

  // ============================================================================
  // Generation Endpoints
  // ============================================================================

  /**
   * POST /api/ai/generate/text - Generate text
   */
  fastify.post<{
    Body: TextGenerationAPIRequest;
    Reply: TextGenerationResponse | { error: string };
  }>('/api/ai/generate/text', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const { providerId, ...requestBody } = request.body;

    try {
      return await service.generateText(requestBody, providerId);
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Text generation failed' };
    }
  });

  /**
   * POST /api/ai/generate/image - Generate images
   */
  fastify.post<{
    Body: ImageGenerationAPIRequest;
    Reply: ImageGenerationResponse | { error: string };
  }>('/api/ai/generate/image', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const { providerId, ...requestBody } = request.body;

    try {
      return await service.generateImage(requestBody, providerId);
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Image generation failed' };
    }
  });

  /**
   * POST /api/ai/generate/speech - Generate speech (TTS)
   */
  fastify.post<{
    Body: TTSAPIRequest;
    Reply: TTSResponse | { error: string };
  }>('/api/ai/generate/speech', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const { providerId, ...requestBody } = request.body;

    try {
      return await service.generateSpeech(requestBody, providerId);
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Speech generation failed' };
    }
  });

  /**
   * POST /api/ai/generate/embeddings - Generate embeddings
   */
  fastify.post<{
    Body: EmbeddingsAPIRequest;
    Reply: EmbeddingsResponse | { error: string };
  }>('/api/ai/generate/embeddings', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const { providerId, ...requestBody } = request.body;

    try {
      return await service.generateEmbeddings(requestBody, providerId);
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Embeddings generation failed' };
    }
  });

  // ============================================================================
  // Job Management
  // ============================================================================

  /**
   * GET /api/ai/jobs - List all jobs
   */
  fastify.get<{
    Querystring: { status?: string; limit?: number };
    Reply: AIJob[] | { error: string };
  }>('/api/ai/jobs', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    let jobs = service.getJobs();

    // Filter by status if provided
    if (request.query.status) {
      jobs = jobs.filter((j) => j.status === request.query.status);
    }

    // Limit results
    const limit = request.query.limit ?? 100;
    return jobs.slice(0, limit);
  });

  /**
   * GET /api/ai/jobs/:id - Get job status
   */
  fastify.get<{
    Params: { id: string };
    Reply: AIJob | { error: string };
  }>('/api/ai/jobs/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();
    const job = service.getJob(request.params.id);

    if (!job) {
      reply.code(404);
      return { error: 'Job not found' };
    }

    return job;
  });

  /**
   * POST /api/ai/jobs/:id/cancel - Cancel a job
   */
  fastify.post<{
    Params: { id: string };
    Reply: { success: boolean } | { error: string };
  }>('/api/ai/jobs/:id/cancel', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();

    try {
      const success = await service.cancelJob(request.params.id);
      if (!success) {
        reply.code(404);
        return { error: 'Job not found or cannot be cancelled' };
      }
      return { success: true };
    } catch (error) {
      reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to cancel job' };
    }
  });

  /**
   * DELETE /api/ai/jobs/:id - Delete job from history
   */
  fastify.delete<{
    Params: { id: string };
    Reply: { success: boolean } | { error: string };
  }>('/api/ai/jobs/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const service = deps.getService();

    try {
      service.deleteJob(request.params.id);
      return { success: true };
    } catch (error) {
      reply.code(404);
      return { error: 'Job not found' };
    }
  });
}
