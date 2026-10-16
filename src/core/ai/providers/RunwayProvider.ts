/**
 * Runway ML Provider
 *
 * Video generation through the Runway API (X-Runway-Version 2024-11-06).
 * Text-to-video bodies come from the model catalog, because every model
 * accepts its own ratios, durations and fields.
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
  AIModelInfo,
} from '../types.js';
import {
  RUNWAY_TEXT_TO_VIDEO_MODELS,
  buildRunwayTextToVideoBody,
  resolveRunwayModel,
  type RunwayAspect,
} from './runwayCatalog.js';

/**
 * Runway-specific configuration
 */
export interface RunwayProviderConfig extends AIProviderConfig {
  type: 'runway';
  options?: {
    /** text_to_video model id from the catalog (default: gen4.5) */
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
  status: 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  /** 0-1 */
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
  private readonly pollingInterval: number;

  constructor(config: RunwayProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.dev.runwayml.com';
    this.pollingInterval = config.options?.pollingInterval ?? 5000;
  }

  /**
   * Saved model, read per call because the AI settings replace config.options
   * at runtime. Retired or unknown ids fall back to the catalog default.
   */
  private configuredModel(): string {
    const saved = (this.config as RunwayProviderConfig).options?.defaultModel;
    const { model, replaced } = resolveRunwayModel(saved);
    if (replaced) {
      console.warn(`[RunwayProvider] Model "${replaced}" is not available for text_to_video, using ${model}`);
    }
    return model;
  }

  /**
   * Runway has no model listing endpoint; the catalog comes from its API reference
   */
  listTextModels(): Promise<AIModelInfo[]> {
    return Promise.resolve(RUNWAY_TEXT_TO_VIDEO_MODELS.map((m) => ({ id: m.id, name: m.name, category: 'video' })));
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
    // An explicit model is sent as is; the catalog builds a safe body for unknown ids
    const model = request.model || this.configuredModel();

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
    const body = buildRunwayTextToVideoBody(model, {
      prompt: request.prompt,
      duration: request.duration,
      aspect: aspectOf(request),
    });

    const response = await this.startTask('text_to_video', body);

    return {
      videoUrl: '',
      jobId: response.id,
      model,
      duration: body.duration as number,
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

    const response = await this.startTask('image_to_video', body);

    return {
      videoUrl: '',
      jobId: response.id,
      model,
      duration: request.duration ?? 5,
    };
  }

  /**
   * Start a paid generation task. Sent exactly once: after a timeout, network
   * error or 5xx Runway may already have started (and billed) the task.
   */
  private async startTask(endpoint: 'text_to_video' | 'image_to_video', body: Record<string, unknown>): Promise<RunwayTaskResponse> {
    return this.fetchJson<RunwayTaskResponse>(`${this.baseUrl}/v1/${endpoint}`, {
      method: 'POST',
      body,
      retry: false,
    });
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
      // Runway reports 0-1, AIJob uses percent
      progress: response.progress !== undefined ? Math.round(response.progress * 100) : undefined,
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(),
      resultUrl: response.output?.[0],
      error: response.failure,
    };
  }

  /**
   * Cancel a running job (DELETE cancels pending, throttled and running tasks)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(`${this.baseUrl}/v1/tasks/${jobId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
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
      case 'THROTTLED':
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

function aspectOf(request: VideoGenerationRequest): RunwayAspect {
  if (request.aspectRatio === '9:16') return 'portrait';
  if (request.aspectRatio === '1:1') return 'square';
  if (request.aspectRatio === '16:9') return 'landscape';
  if (request.width && request.height) {
    if (request.height > request.width) return 'portrait';
    if (request.height === request.width) return 'square';
  }
  return 'landscape';
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
