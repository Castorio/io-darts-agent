/**
 * Replicate Provider
 *
 * Provider implementation for Replicate's model hosting API.
 * Supports running any model hosted on Replicate.
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  AIJob,
  AIJobStatus,
} from '../types.js';

/**
 * Replicate-specific configuration
 */
export interface ReplicateProviderConfig extends AIProviderConfig {
  type: 'replicate';
  options?: {
    /** Default text model (owner/name:version) */
    defaultTextModel?: string;
    /** Default image model */
    defaultImageModel?: string;
    /** Default video model */
    defaultVideoModel?: string;
    /** Polling interval in ms */
    pollingInterval?: number;
  };
}

/**
 * Replicate prediction status
 */
interface ReplicatePrediction {
  id: string;
  version: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  logs: string | null;
  metrics?: {
    predict_time?: number;
  };
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  urls: {
    get: string;
    cancel: string;
  };
}

/**
 * Replicate Provider implementation
 */
export class ReplicateProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = [
    'text-generation',
    'image-generation',
    'video-generation',
  ];

  private readonly baseUrl: string;
  private readonly defaultTextModel: string;
  private readonly defaultImageModel: string;
  private readonly defaultVideoModel: string;
  private readonly pollingInterval: number;

  constructor(config: ReplicateProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.replicate.com';
    this.defaultTextModel =
      config.options?.defaultTextModel ??
      'meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3';
    this.defaultImageModel =
      config.options?.defaultImageModel ??
      'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
    this.defaultVideoModel =
      config.options?.defaultVideoModel ??
      'anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351';
    this.pollingInterval = config.options?.pollingInterval ?? 2000;
  }

  /**
   * Get authentication headers
   */
  protected override getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Token ${this.config.apiKey}`,
    };
  }

  /**
   * Get provider status by testing API connection
   */
  override async getStatus(): Promise<AIProviderStatus> {
    const baseStatus = await super.getStatus();

    if (!baseStatus.configured) {
      return baseStatus;
    }

    try {
      // Test connection by getting account info (don't use fetchWithRetry to handle 4xx ourselves)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(`${this.baseUrl}/v1/account`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          ...baseStatus,
          available: this.isAvailable(),
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          ...baseStatus,
          available: false,
          error: 'Invalid API key',
        };
      } else {
        return {
          ...baseStatus,
          available: false,
          error: `API error: ${response.status}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        ...baseStatus,
        available: false,
        error: errorMessage.includes('abort') ? 'Connection timeout' : 'Failed to connect to Replicate API',
      };
    }
  }

  /**
   * Generate text using a text model
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const model = request.model ?? this.defaultTextModel;

    // Extract prompt text
    const promptText =
      typeof request.prompt === 'string'
        ? request.prompt
        : request.prompt.map((m) => `${m.role}: ${m.content}`).join('\n');

    const input: Record<string, unknown> = {
      prompt: promptText,
      max_new_tokens: request.maxTokens ?? 500,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 0.95,
    };

    if (request.system) {
      input.system_prompt = request.system;
    }

    const prediction = await this.runPrediction(model, input);

    // Output can be string or array of strings
    const output = prediction.output;
    const text = Array.isArray(output) ? output.join('') : String(output);

    return {
      text,
      model,
      finishReason: 'stop',
    };
  }

  /**
   * Generate images
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const model = request.model ?? this.defaultImageModel;

    const input: Record<string, unknown> = {
      prompt: request.prompt,
      width: request.width ?? 1024,
      height: request.height ?? 1024,
      num_outputs: request.count ?? 1,
      guidance_scale: request.guidanceScale ?? 7.5,
    };

    if (request.negativePrompt) {
      input.negative_prompt = request.negativePrompt;
    }

    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    const prediction = await this.runPrediction(model, input);

    // Output is array of URLs
    const output = prediction.output as string[];

    return {
      images: output.map((url) => ({ url })),
      model,
    };
  }

  /**
   * Generate video
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const model = request.model ?? this.defaultVideoModel;

    const input: Record<string, unknown> = {
      prompt: request.prompt,
      num_frames: (request.duration ?? 4) * (request.fps ?? 8),
      width: request.width ?? 576,
      height: request.height ?? 320,
    };

    if (request.imageUrl) {
      input.init_image = request.imageUrl;
    }

    // Start prediction (don't wait for completion)
    const body: Record<string, unknown> = {
      version: this.extractVersion(model),
      input,
    };

    const response = await this.fetchJson<ReplicatePrediction>(
      `${this.baseUrl}/v1/predictions`,
      {
        method: 'POST',
        body,
      }
    );

    return {
      videoUrl: '',
      jobId: response.id,
      model,
      duration: request.duration ?? 4,
    };
  }

  /**
   * Run a prediction and wait for completion
   */
  private async runPrediction(
    model: string,
    input: Record<string, unknown>
  ): Promise<ReplicatePrediction> {
    const body: Record<string, unknown> = {
      version: this.extractVersion(model),
      input,
    };

    const response = await this.fetchJson<ReplicatePrediction>(
      `${this.baseUrl}/v1/predictions`,
      {
        method: 'POST',
        body,
      }
    );

    // Wait for completion
    return this.waitForPrediction(response.id);
  }

  /**
   * Wait for prediction completion
   */
  private async waitForPrediction(
    predictionId: string,
    maxWaitMs = 300000
  ): Promise<ReplicatePrediction> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const prediction = await this.fetchJson<ReplicatePrediction>(
        `${this.baseUrl}/v1/predictions/${predictionId}`,
        { method: 'GET' }
      );

      if (prediction.status === 'succeeded') {
        return prediction;
      }

      if (prediction.status === 'failed') {
        throw new Error(`Prediction failed: ${prediction.error}`);
      }

      if (prediction.status === 'canceled') {
        throw new Error('Prediction was canceled');
      }

      await this.delay(this.pollingInterval);
    }

    throw new Error(`Prediction timed out after ${maxWaitMs}ms`);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<AIJob> {
    const prediction = await this.fetchJson<ReplicatePrediction>(
      `${this.baseUrl}/v1/predictions/${jobId}`,
      { method: 'GET' }
    );

    const output = prediction.output;
    const resultUrl = Array.isArray(output) ? output[0] : undefined;

    return {
      id: jobId,
      providerId: this.config.id,
      providerJobId: prediction.id,
      type: 'video-generation',
      status: this.mapStatus(prediction.status),
      createdAt: new Date(prediction.created_at),
      updatedAt: new Date(),
      completedAt: prediction.completed_at ? new Date(prediction.completed_at) : undefined,
      resultUrl: typeof resultUrl === 'string' ? resultUrl : undefined,
      error: prediction.error ?? undefined,
    };
  }

  /**
   * Cancel a prediction
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.fetchJson(
        `${this.baseUrl}/v1/predictions/${jobId}/cancel`,
        { method: 'POST' }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract version hash from model string
   */
  private extractVersion(model: string): string {
    const parts = model.split(':');
    return parts.length > 1 ? parts[1] : model;
  }

  /**
   * Map Replicate status to standard status
   */
  private mapStatus(status: string): AIJobStatus {
    switch (status) {
      case 'starting':
        return 'pending';
      case 'processing':
        return 'processing';
      case 'succeeded':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}

/**
 * Create a Replicate provider instance
 */
export function createReplicateProvider(
  apiKey: string,
  options?: Partial<ReplicateProviderConfig>
): ReplicateProvider {
  return new ReplicateProvider({
    id: options?.id ?? 'replicate',
    type: 'replicate',
    name: options?.name ?? 'Replicate',
    apiKey,
    baseUrl: options?.baseUrl,
    timeout: options?.timeout ?? 300000,
    maxRetries: options?.maxRetries ?? 3,
    enabled: options?.enabled ?? true,
    options: options?.options,
  });
}
