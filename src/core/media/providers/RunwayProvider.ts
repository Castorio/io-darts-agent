/**
 * Runway ML Provider
 * Implementation for Runway Gen-3 Alpha video generation
 *
 * Note: Gen-3 Alpha Turbo only supports image-to-video.
 * For text-to-video, use Gen-3 Alpha (non-turbo) model.
 *
 * API Reference: https://docs.dev.runwayml.com/api/
 */

import {
  BaseAIProvider,
  type AIProviderConfig,
} from './AIProvider.js';
import { buildAnimationPrompt } from './animationPrompt.js';
import type {
  AnimationGenerationOptions,
  ProviderGenerationResult,
  ProviderJobStatus,
} from '../types/animation.js';

/**
 * Runway-specific configuration
 */
export interface RunwayProviderConfig extends AIProviderConfig {
  /** Model to use (default: gen3a_turbo) */
  model?: 'gen3a_turbo' | 'gen3a';
  /** Enable watermark (default: false) */
  watermark?: boolean;
  /** Default seed for reproducible results */
  seed?: number;
}

/**
 * Runway API response types
 */
interface RunwayTaskResponse {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  progress?: number;
  output?: string[];
  failure?: string;
  failureCode?: string;
}

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

  /**
   * Generate animation using Runway Gen-3 Alpha
   *
   * @param prompt - Text prompt for video generation
   * @param options - Generation options including optional source image
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
      const model = this.runwayConfig.model ?? 'gen3a_turbo';
      const duration = this.normalizeDuration(options?.duration);
      const ratio = this.getAspectRatio(options);

      // Generate a base image with the style colors for image-to-video
      const baseImageDataUrl = this.generateBaseImage(options);

      // Build generation request - Runway API uses snake_case for parameters
      // See: https://docs.dev.runwayml.com/api/
      const requestBody: Record<string, unknown> = {
        model,
        promptImage: baseImageDataUrl,
        promptText: buildAnimationPrompt(prompt, options),
        duration,
        ratio,
        watermark: this.runwayConfig.watermark ?? false,
      };

      // Add seed if configured for reproducible results
      if (this.runwayConfig.seed !== undefined) {
        requestBody.seed = this.runwayConfig.seed;
      }

      const response = await this.fetchWithRetry(
        `${this.baseUrl}/image_to_video`,
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
          error: errorMessage,
        };
      }

      const data = (await response.json()) as { id: string };

      return {
        success: true,
        jobId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
   * Normalize duration to Runway's supported values (5 or 10 seconds)
   */
  private normalizeDuration(duration?: number): number {
    if (!duration || duration <= 7) {
      return 5;
    }
    return 10;
  }

  /**
   * Generate a base image as PNG data URL using a publicly accessible placeholder
   * Runway works better with real images rather than programmatically generated ones
   *
   * Note: Runway requires accessible image URLs or proper base64 images
   * https://docs.dev.runwayml.com/assets/inputs/
   */
  private generateBaseImage(options?: AnimationGenerationOptions): string {
    // For transparency post-processing, always use black background
    // This ensures consistent chromakey removal later
    if (options?.transparent !== false) {
      return 'https://placehold.co/1280x768/000000/000000.png';
    }

    // Use style colors if transparency is not needed
    const primaryColor = options?.colors?.[0] ?? '#1a1a2e';
    const hexColor = primaryColor.replace('#', '');

    // Use a placeholder service that generates solid color images
    // This provides a reliable, properly-formatted image for Runway
    return `https://placehold.co/1280x768/${hexColor}/${hexColor}.png`;
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
   * Cancel a running Runway task
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/tasks/${jobId}/cancel`,
        {
          method: 'POST',
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
   * Get aspect ratio string from options
   * Runway Gen-3 Alpha Turbo only supports: "768:1280", "1280:768"
   * Runway Gen-3 Alpha (non-turbo) supports: "16:9", "9:16"
   */
  private getAspectRatio(options?: AnimationGenerationOptions): string {
    const width = options?.width ?? 512;
    const height = options?.height ?? 512;
    const model = this.runwayConfig.model ?? 'gen3a_turbo';

    // Gen-3 Alpha Turbo only supports pixel ratios
    if (model === 'gen3a_turbo') {
      if (height > width) {
        return '768:1280';  // Portrait
      } else {
        return '1280:768';  // Landscape (default)
      }
    }

    // Gen-3 Alpha (non-turbo) supports standard ratios
    if (height > width) {
      return '9:16';
    } else {
      return '16:9';
    }
  }

  /**
   * Map Runway status to our status format
   */
  private mapRunwayStatus(data: RunwayTaskResponse): ProviderJobStatus {
    switch (data.status) {
      case 'PENDING':
        return { status: 'pending', progress: 0 };
      case 'RUNNING':
        return { status: 'processing', progress: data.progress ?? 50 };
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
  model?: 'gen3a_turbo' | 'gen3a';
  watermark?: boolean;
  seed?: number;
}): RunwayProvider | null {
  // Try config first, then fall back to environment
  const apiKey = config?.apiKey || process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new RunwayProvider({
    apiKey,
    model: config?.model ?? (process.env.RUNWAY_MODEL as 'gen3a_turbo' | 'gen3a') ?? 'gen3a_turbo',
    watermark: config?.watermark ?? process.env.RUNWAY_WATERMARK === 'true',
    seed: config?.seed,
    timeout: 60000,
    maxRetries: 3,
  });
}
