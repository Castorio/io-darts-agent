/**
 * Runway ML Provider
 *
 * Provider implementation for Runway's Gen-2/Gen-3 API.
 * Supports video generation from text and images.
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  VideoGenerationRequest,
  VideoGenerationResponse,
  AIJob,
  AIJobStatus,
} from '../types.js';

/**
 * Runway-specific configuration
 */
export interface RunwayProviderConfig extends AIProviderConfig {
  type: 'runway';
  options?: {
    /** Default model (gen-2, gen-3) */
    defaultModel?: string;
    /** Polling interval in ms */
    pollingInterval?: number;
  };
}

/**
 * Runway task status
 */
interface RunwayTaskStatus {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  progress?: number;
  failure?: string;
  failureCode?: string;
  output?: string[];
  createdAt: string;
}

/**
 * Runway task creation response
 */
interface RunwayTaskResponse {
  id: string;
}

/**
 * Runway Provider implementation
 */
export class RunwayProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['video-generation'];

  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly pollingInterval: number;

  constructor(config: RunwayProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.dev.runwayml.com';
    this.defaultModel = config.options?.defaultModel ?? 'gen3a_turbo';
    this.pollingInterval = config.options?.pollingInterval ?? 5000;
  }

  /**
   * Get authentication headers
   */
  protected override getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'X-Runway-Version': '2024-11-06',
    };
  }

  /**
   * Check provider status by validating the API key
   * Uses a HEAD request to a known endpoint to verify credentials
   */
  override async getStatus(): Promise<AIProviderStatus> {
    const baseStatus = await super.getStatus();

    if (!this.isConfigured()) {
      return baseStatus;
    }

    // Verify API key by making a lightweight request
    // We use the text_to_video endpoint with an invalid request to check auth
    // A 401 means invalid API key, other errors mean the key is valid
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(`${this.baseUrl}/v1/text_to_video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({ promptText: '' }), // Empty prompt to trigger validation error, not auth error
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // 401/403 = Invalid API key
      if (response.status === 401 || response.status === 403) {
        return {
          ...baseStatus,
          available: false,
          error: 'Invalid API key',
        };
      }

      // 400/422 = Bad request but API key is valid (expected with empty prompt)
      // 200 = Success (unlikely with empty prompt but still means key is valid)
      // 429 = Rate limited but key is valid
      return {
        ...baseStatus,
        available: this.isAvailable(),
      };
    } catch (error) {
      // Network error or timeout
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        ...baseStatus,
        available: false,
        error: errorMessage.includes('abort') ? 'Connection timeout' : 'Failed to connect to Runway API',
      };
    }
  }

  /**
   * Generate video from text or image
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const model = request.model ?? this.defaultModel;

    // Determine if image-to-video or text-to-video
    if (request.imageUrl) {
      return this.imageToVideo(request, model);
    }

    return this.textToVideo(request, model);
  }

  /**
   * Text-to-video generation
   */
  private async textToVideo(
    request: VideoGenerationRequest,
    model: string
  ): Promise<VideoGenerationResponse> {
    const body: Record<string, unknown> = {
      promptText: request.prompt,
      model,
      duration: request.duration ?? 5,
    };

    if (request.aspectRatio) {
      body.ratio = request.aspectRatio;
    }

    const response = await this.fetchJson<RunwayTaskResponse>(
      `${this.baseUrl}/v1/text_to_video`,
      {
        method: 'POST',
        body,
      }
    );

    return {
      videoUrl: '',
      jobId: response.id,
      model,
      duration: request.duration ?? 5,
    };
  }

  /**
   * Image-to-video generation
   */
  private async imageToVideo(
    request: VideoGenerationRequest,
    model: string
  ): Promise<VideoGenerationResponse> {
    const body: Record<string, unknown> = {
      promptImage: request.imageUrl,
      model,
      duration: request.duration ?? 5,
    };

    if (request.prompt) {
      body.promptText = request.prompt;
    }

    if (request.aspectRatio) {
      body.ratio = request.aspectRatio;
    }

    const response = await this.fetchJson<RunwayTaskResponse>(
      `${this.baseUrl}/v1/image_to_video`,
      {
        method: 'POST',
        body,
      }
    );

    return {
      videoUrl: '',
      jobId: response.id,
      model,
      duration: request.duration ?? 5,
    };
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<AIJob> {
    const response = await this.fetchJson<RunwayTaskStatus>(
      `${this.baseUrl}/v1/tasks/${jobId}`,
      { method: 'GET' }
    );

    return {
      id: jobId,
      providerId: this.config.id,
      providerJobId: response.id,
      type: 'video-generation',
      status: this.mapStatus(response.status),
      progress: response.progress,
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(),
      resultUrl: response.output?.[0],
      error: response.failure,
    };
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.fetchJson(
        `${this.baseUrl}/v1/tasks/${jobId}/cancel`,
        { method: 'POST' }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for job completion
   */
  async waitForCompletion(
    jobId: string,
    maxWaitMs = 300000
  ): Promise<AIJob> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const job = await this.getJobStatus(jobId);

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        return job;
      }

      await this.delay(this.pollingInterval);
    }

    throw new Error(`Job ${jobId} timed out after ${maxWaitMs}ms`);
  }

  /**
   * Map Runway status to standard status
   */
  private mapStatus(status: string): AIJobStatus {
    switch (status) {
      case 'PENDING':
        return 'pending';
      case 'RUNNING':
        return 'processing';
      case 'SUCCEEDED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}

/**
 * Create a Runway provider instance
 */
export function createRunwayProvider(
  apiKey: string,
  options?: Partial<RunwayProviderConfig>
): RunwayProvider {
  return new RunwayProvider({
    id: options?.id ?? 'runway',
    type: 'runway',
    name: options?.name ?? 'Runway ML',
    apiKey,
    baseUrl: options?.baseUrl,
    timeout: options?.timeout ?? 120000,
    maxRetries: options?.maxRetries ?? 3,
    enabled: options?.enabled ?? true,
    options: options?.options,
  });
}
