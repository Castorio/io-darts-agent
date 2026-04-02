/**
 * AI Provider Service
 *
 * Central service for managing AI providers and routing requests.
 * Supports multiple providers with fallback and load balancing.
 */

import { EventEmitter } from 'events';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AIProviderType,
  AICapability,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  TTSRequest,
  TTSResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
  AIJob,
  AIJobStatus,
  AIProviderConfigUpdate,
} from './types.js';
import type { IAIProvider } from './AIProvider.js';

/**
 * AI Provider Service configuration
 */
export interface AIProviderServiceConfig {
  /** Default provider for each capability */
  defaultProviders?: Partial<Record<AICapability, string>>;
  /** Enable fallback to other providers */
  enableFallback?: boolean;
  /** Job polling interval in ms */
  jobPollingInterval?: number;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: AIProviderConfig) => IAIProvider;

/**
 * AI Provider Service
 * Manages multiple AI providers and routes requests
 */
export class AIProviderService extends EventEmitter {
  private config: AIProviderServiceConfig;
  private providers = new Map<string, IAIProvider>();
  private providerFactories = new Map<AIProviderType, ProviderFactory>();
  private jobs = new Map<string, AIJob>();
  private jobPollingTimers = new Map<string, NodeJS.Timeout>();

  constructor(config: AIProviderServiceConfig = {}) {
    super();
    this.config = {
      enableFallback: true,
      jobPollingInterval: 2000,
      ...config,
    };
  }

  // ============================================================================
  // Provider Registration
  // ============================================================================

  /**
   * Register a provider factory for a provider type
   */
  registerProviderFactory(type: AIProviderType, factory: ProviderFactory): void {
    this.providerFactories.set(type, factory);
  }

  /**
   * Add a provider instance
   */
  addProvider(config: AIProviderConfig): IAIProvider {
    const factory = this.providerFactories.get(config.type);
    if (!factory) {
      throw new Error(`No factory registered for provider type: ${config.type}`);
    }

    const provider = factory(config);
    this.providers.set(config.id, provider);

    this.emit('provider:added', { providerId: config.id, type: config.type });
    return provider;
  }

  /**
   * Remove a provider
   */
  removeProvider(providerId: string): boolean {
    const removed = this.providers.delete(providerId);
    if (removed) {
      this.emit('provider:removed', { providerId });
    }
    return removed;
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): IAIProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all providers
   */
  getAllProviders(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Alias for getAllProviders (used by API routes)
   */
  getProviders(): IAIProvider[] {
    return this.getAllProviders();
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(providerId: string, update: AIProviderConfigUpdate): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Update mutable config properties
    const config = provider.config as AIProviderConfig;

    if (update.enabled !== undefined) {
      (config as { enabled?: boolean }).enabled = update.enabled;
    }

    if (update.apiKey !== undefined) {
      (config as { apiKey: string }).apiKey = update.apiKey;
    }

    if (update.baseUrl !== undefined) {
      (config as { baseUrl?: string }).baseUrl = update.baseUrl;
    }

    if (update.options !== undefined) {
      (config as { options?: Record<string, unknown> }).options = {
        ...(config.options ?? {}),
        ...update.options,
      };
    }

    this.emit('provider:status', {
      providerId,
      status: {
        id: providerId,
        configured: provider.isConfigured(),
        enabled: config.enabled !== false,
        available: provider.isAvailable(),
        capabilities: provider.capabilities,
      },
    });
  }

  /**
   * Get available capabilities across all available (configured + enabled) providers
   */
  getAvailableCapabilities(): AICapability[] {
    const capabilities = new Set<AICapability>();

    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        for (const cap of provider.capabilities) {
          capabilities.add(cap);
        }
      }
    }

    return Array.from(capabilities);
  }

  /**
   * Get providers by capability (only available ones)
   */
  getProvidersByCapability(capability: AICapability): IAIProvider[] {
    return this.getAllProviders().filter(
      (p) => p.capabilities.includes(capability) && p.isAvailable()
    );
  }

  /**
   * Get default provider for a capability
   */
  getDefaultProvider(capability: AICapability): IAIProvider | undefined {
    const defaultId = this.config.defaultProviders?.[capability];
    if (defaultId) {
      const provider = this.providers.get(defaultId);
      if (provider?.isAvailable() && provider.capabilities.includes(capability)) {
        return provider;
      }
    }

    // Fall back to first available provider
    return this.getProvidersByCapability(capability)[0];
  }

  /**
   * Set default provider for a capability
   */
  setDefaultProvider(capability: AICapability, providerId: string): void {
    if (!this.config.defaultProviders) {
      this.config.defaultProviders = {};
    }
    this.config.defaultProviders[capability] = providerId;
  }

  /**
   * Get all provider statuses
   */
  async getAllStatuses(): Promise<AIProviderStatus[]> {
    const statuses: AIProviderStatus[] = [];
    for (const provider of this.providers.values()) {
      statuses.push(await provider.getStatus());
    }
    return statuses;
  }

  // ============================================================================
  // Generation Methods
  // ============================================================================

  /**
   * Generate text
   */
  async generateText(
    request: TextGenerationRequest,
    providerId?: string
  ): Promise<TextGenerationResponse> {
    const provider = this.resolveProvider('text-generation', providerId);

    if (!provider.generateText) {
      throw new Error(`Provider ${provider.config.id} does not support text generation`);
    }

    return provider.generateText(request);
  }

  /**
   * Generate image
   */
  async generateImage(
    request: ImageGenerationRequest,
    providerId?: string
  ): Promise<ImageGenerationResponse> {
    const provider = this.resolveProvider('image-generation', providerId);

    if (!provider.generateImage) {
      throw new Error(`Provider ${provider.config.id} does not support image generation`);
    }

    return provider.generateImage(request);
  }

  /**
   * Generate video/animation
   */
  async generateVideo(
    request: VideoGenerationRequest,
    providerId?: string
  ): Promise<VideoGenerationResponse> {
    const provider = this.resolveProvider('video-generation', providerId);

    if (!provider.generateVideo) {
      throw new Error(`Provider ${provider.config.id} does not support video generation`);
    }

    const result = await provider.generateVideo(request);

    // If async job, track it
    if (result.jobId) {
      const job = this.createJob(provider.config.id, result.jobId, 'video-generation', request as unknown as Record<string, unknown>);
      this.startJobPolling(job, provider);
    }

    return result;
  }

  /**
   * Generate speech (TTS)
   */
  async generateSpeech(
    request: TTSRequest,
    providerId?: string
  ): Promise<TTSResponse> {
    const provider = this.resolveProvider('audio-tts', providerId);

    if (!provider.generateSpeech) {
      throw new Error(`Provider ${provider.config.id} does not support TTS`);
    }

    return provider.generateSpeech(request);
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(
    request: EmbeddingsRequest,
    providerId?: string
  ): Promise<EmbeddingsResponse> {
    const provider = this.resolveProvider('embeddings', providerId);

    if (!provider.generateEmbeddings) {
      throw new Error(`Provider ${provider.config.id} does not support embeddings`);
    }

    return provider.generateEmbeddings(request);
  }

  // ============================================================================
  // Job Management
  // ============================================================================

  /**
   * Get job by ID
   */
  getJob(jobId: string): AIJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): AIJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: AIJobStatus): AIJob[] {
    return this.getAllJobs().filter((j) => j.status === status);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    const provider = this.providers.get(job.providerId);
    if (!provider?.cancelJob) {
      return false;
    }

    const cancelled = await provider.cancelJob(job.providerJobId);
    if (cancelled) {
      this.updateJobStatus(jobId, 'cancelled');
      this.stopJobPolling(jobId);
      this.emit('job:cancelled', { job: this.jobs.get(jobId)! });
    }

    return cancelled;
  }

  /**
   * Alias for getAllJobs (used by API routes)
   */
  getJobs(): AIJob[] {
    return this.getAllJobs();
  }

  /**
   * Delete a job from history
   */
  deleteJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Stop polling if active
    this.stopJobPolling(jobId);

    // Remove from jobs map
    this.jobs.delete(jobId);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Resolve provider for a capability
   */
  private resolveProvider(capability: AICapability, providerId?: string): IAIProvider {
    if (providerId) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }
      if (!provider.isAvailable()) {
        throw new Error(`Provider not available: ${providerId}`);
      }
      if (!provider.capabilities.includes(capability)) {
        throw new Error(`Provider ${providerId} does not support ${capability}`);
      }
      return provider;
    }

    const provider = this.getDefaultProvider(capability);
    if (!provider) {
      throw new Error(`No provider available for: ${capability}`);
    }

    return provider;
  }

  /**
   * Create a job record
   */
  private createJob(
    providerId: string,
    providerJobId: string,
    type: AICapability,
    request?: Record<string, unknown>
  ): AIJob {
    const job: AIJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      providerId,
      providerJobId,
      type,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      request,
    };

    this.jobs.set(job.id, job);
    this.emit('job:started', { job });

    return job;
  }

  /**
   * Update job status
   */
  private updateJobStatus(
    jobId: string,
    status: AIJobStatus,
    updates?: Partial<AIJob>
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.updatedAt = new Date();

    if (updates) {
      Object.assign(job, updates);
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      job.completedAt = new Date();
    }
  }

  /**
   * Start polling for job status
   */
  private startJobPolling(job: AIJob, provider: IAIProvider): void {
    if (!provider.getJobStatus) return;

    const poll = async () => {
      try {
        const status = await provider.getJobStatus!(job.providerJobId);

        if (status.progress !== undefined) {
          job.progress = status.progress;
          this.emit('job:progress', { job, progress: status.progress });
        }

        if (status.status === 'completed') {
          this.updateJobStatus(job.id, 'completed', { resultUrl: status.resultUrl });
          this.stopJobPolling(job.id);
          this.emit('job:completed', { job: this.jobs.get(job.id)!, resultUrl: status.resultUrl! });
        } else if (status.status === 'failed') {
          this.updateJobStatus(job.id, 'failed', { error: status.error });
          this.stopJobPolling(job.id);
          this.emit('job:failed', { job: this.jobs.get(job.id)!, error: status.error! });
        } else if (status.status === 'processing') {
          this.updateJobStatus(job.id, 'processing');
        }
      } catch (error) {
        console.error(`Job polling error for ${job.id}:`, error);
      }
    };

    // Initial poll
    poll();

    // Schedule polling
    const timer = setInterval(poll, this.config.jobPollingInterval);
    this.jobPollingTimers.set(job.id, timer);
  }

  /**
   * Stop polling for job status
   */
  private stopJobPolling(jobId: string): void {
    const timer = this.jobPollingTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.jobPollingTimers.delete(jobId);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    for (const timer of this.jobPollingTimers.values()) {
      clearInterval(timer);
    }
    this.jobPollingTimers.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: AIProviderService | null = null;

/**
 * Get the singleton AI Provider Service instance
 */
export function getAIProviderService(config?: AIProviderServiceConfig): AIProviderService {
  if (!serviceInstance) {
    serviceInstance = new AIProviderService(config);
  }
  return serviceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetAIProviderService(): void {
  if (serviceInstance) {
    serviceInstance.destroy();
    serviceInstance = null;
  }
}
