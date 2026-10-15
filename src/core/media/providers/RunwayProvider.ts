/**
 * Runway animation engine
 *
 * Starts `POST /v1/text_to_video` tasks with the model chosen in the AI
 * settings. Each model accepts its own ratios, durations and fields, so the
 * body comes from the Runway catalog.
 *
 * API Reference: https://docs.dev.runwayml.com/api/
 */

import {
  BaseAIProvider,
  type AIProviderConfig,
} from './AIProvider.js';
import { buildAnimationPrompt } from './animationPrompt.js';
import {
  buildRunwayTextToVideoBody,
  resolveRunwayModel,
  type RunwayAspect,
} from '../../ai/providers/runwayCatalog.js';
import type {
  AnimationGenerationOptions,
  ProviderGenerationResult,
  ProviderJobStatus,
} from '../types/animation.js';

/**
 * Runway-specific configuration
 */
export interface RunwayProviderConfig extends AIProviderConfig {
  /** text_to_video model id from the catalog; retired or unknown ids use the default */
  model?: string;
  /** Default seed for reproducible results */
  seed?: number;
}

/**
 * Runway API response types
 */
interface RunwayTaskResponse {
  id: string;
  status: 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  /** 0-1 */
  progress?: number;
  output?: string[];
  failure?: string;
  failureCode?: string;
}

const NOT_RETRIED =
  'The generation was not retried, because the task may already have started. Check the Runway dashboard before trying again.';

/**
 * Runway ML Provider implementation
 */
export class RunwayProvider extends BaseAIProvider {
  readonly name = 'Runway ML';
  readonly id = 'runway';

  private runwayConfig: RunwayProviderConfig;
  private baseUrl = 'https://api.dev.runwayml.com/v1';

  constructor(config: RunwayProviderConfig) {
    super(config);
    this.runwayConfig = config;
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /** Model sent to Runway: the configured one, or the default if that is retired or unknown */
  get model(): string {
    return resolveRunwayModel(this.runwayConfig.model).model;
  }

  /**
   * Start a text-to-video task for an animation
   */
  async generate(
    prompt: string,
    options?: AnimationGenerationOptions
  ): Promise<ProviderGenerationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Runway API key not configured',
      };
    }

    try {
      const { model, replaced } = resolveRunwayModel(this.runwayConfig.model);
      if (replaced) {
        console.warn(`[RunwayProvider] Model "${replaced}" is not available for text_to_video, using ${model}`);
      }

      const requestBody = buildRunwayTextToVideoBody(model, {
        prompt: buildAnimationPrompt(prompt, options),
        duration: options?.duration,
        aspect: this.getAspect(options),
        seed: this.runwayConfig.seed,
      });

      // Sent exactly once: a retry could start and bill a second task
      const response = await this.fetchOnce(
        `${this.baseUrl}/text_to_video`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'X-Runway-Version': '2024-11-06',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = this.parseRunwayError(response.status, errorData);
        return {
          success: false,
          error: response.status >= 500 ? `${errorMessage} ${NOT_RETRIED}` : errorMessage,
        };
      }

      const data = (await response.json()) as { id: string };

      return {
        success: true,
        jobId: data.id,
      };
    } catch (error) {
      const reason = error instanceof Error
        ? (error.name === 'AbortError' ? 'Runway did not answer in time.' : `Runway request failed: ${error.message}.`)
        : 'Runway request failed.';
      return {
        success: false,
        error: `${reason} ${NOT_RETRIED}`,
      };
    }
  }

  /**
   * Parse Runway API error response into a human-readable message
   */
  private parseRunwayError(status: number, errorData: Record<string, unknown>): string {
    const message = errorData.message || errorData.error || JSON.stringify(errorData);

    switch (status) {
      case 400:
        return `Invalid request: ${message}`;
      case 401:
        return 'Invalid API key. Please check your Runway API credentials.';
      case 403:
        return 'Access denied. Your API key may not have permission for this operation.';
      case 422:
        return `Validation error: ${message}`;
      case 429:
        return 'Rate limit exceeded. Please wait before making more requests.';
      case 500:
      case 502:
      case 503:
        return `Runway service error (${status}). Please try again later.`;
      default:
        return `Runway API error: ${status} - ${message}`;
    }
  }

  /**
   * Get status of a Runway generation task
   */
  async getJobStatus(jobId: string): Promise<ProviderJobStatus> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/tasks/${jobId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
        }
      );

      if (!response.ok) {
        return {
          status: 'failed',
          progress: 0,
          error: `Failed to get status: ${response.status}`,
        };
      }

      const data = (await response.json()) as RunwayTaskResponse;

      // Log failure details for debugging
      if (data.status === 'FAILED') {
        console.error('[RunwayProvider] Job failed:', {
          jobId,
          failure: data.failure,
          failureCode: data.failureCode,
        });
      }

      return this.mapRunwayStatus(data);
    } catch (error) {
      console.error('[RunwayProvider] Error getting job status:', error);
      return {
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a running Runway task (DELETE cancels pending, throttled and running tasks)
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/tasks/${jobId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'X-Runway-Version': '2024-11-06',
          },
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }



  /**
   * Orientation of the requested animation; the catalog picks the model's ratio
   */
  private getAspect(options?: AnimationGenerationOptions): RunwayAspect {
    const width = options?.width ?? 512;
    const height = options?.height ?? 512;
    if (width > height) return 'landscape';
    if (height > width) return 'portrait';
    return 'square';
  }

  /**
   * Map Runway status to our status format
   */
  private mapRunwayStatus(data: RunwayTaskResponse): ProviderJobStatus {
    switch (data.status) {
      case 'PENDING':
      case 'THROTTLED':
        return { status: 'pending', progress: 0 };
      case 'RUNNING':
        // Runway reports 0-1
        return {
          status: 'processing',
          progress: data.progress !== undefined ? Math.round(data.progress * 100) : 50,
        };
      case 'SUCCEEDED':
        return {
          status: 'completed',
          progress: 100,
          resultUrl: data.output?.[0],
        };
      case 'FAILED':
        // Provide more helpful error messages for common failure codes
        let errorMessage = data.failure ?? data.failureCode ?? 'Generation failed';
        if (data.failureCode === 'CONTENT_MODERATION') {
          errorMessage = 'Content moderation: The prompt may contain restricted content.';
        } else if (data.failureCode === 'INTERNAL_ERROR') {
          errorMessage = 'Runway internal error. Please try again.';
        } else if (data.failureCode === 'RATE_LIMITED') {
          errorMessage = 'Rate limited. Please wait before generating more animations.';
        }
        return {
          status: 'failed',
          progress: 0,
          error: errorMessage,
        };
      case 'CANCELLED':
        return {
          status: 'failed',
          progress: 0,
          error: 'Job was cancelled',
        };
      default:
        return { status: 'pending', progress: 0 };
    }
  }
}

/**
 * Create Runway provider from config
 */
export function createRunwayProvider(config?: {
  apiKey?: string;
  model?: string;
  seed?: number;
}): RunwayProvider | null {
  // Try config first, then fall back to environment
  const apiKey = config?.apiKey || process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new RunwayProvider({
    apiKey,
    model: config?.model || process.env.RUNWAY_MODEL || undefined,
    seed: config?.seed,
    timeout: 60000,
    maxRetries: 3,
  });
}
