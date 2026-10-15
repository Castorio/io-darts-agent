/**
 * Stability AI Provider
 *
 * Provider implementation for Stability AI's API.
 * Supports image generation with Stable Diffusion models.
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '../types.js';

/**
 * Stability AI-specific configuration
 */
export interface StabilityAIProviderConfig extends AIProviderConfig {
  type: 'stability';
  options?: {
    /** Default model/engine */
    defaultEngine?: string;
    /** Default style preset */
    defaultStylePreset?: string;
  };
}

/**
 * Stability AI image artifact
 */
interface StabilityArtifact {
  base64: string;
  seed: number;
  finishReason: 'SUCCESS' | 'CONTENT_FILTERED' | 'ERROR';
}

/**
 * Stability AI response
 */
interface StabilityResponse {
  artifacts: StabilityArtifact[];
}

/**
 * Available Stability AI engines
 */
export type StabilityEngine =
  | 'stable-diffusion-xl-1024-v1-0'
  | 'stable-diffusion-v1-6'
  | 'stable-diffusion-xl-beta-v2-2-2'
  | 'stable-image-core'
  | 'stable-image-ultra';

/**
 * Stability AI style presets
 */
export type StabilityStylePreset =
  | '3d-model'
  | 'analog-film'
  | 'anime'
  | 'cinematic'
  | 'comic-book'
  | 'digital-art'
  | 'enhance'
  | 'fantasy-art'
  | 'isometric'
  | 'line-art'
  | 'low-poly'
  | 'modeling-compound'
  | 'neon-punk'
  | 'origami'
  | 'photographic'
  | 'pixel-art'
  | 'tile-texture';

/**
 * Stability AI Provider implementation
 */
export class StabilityAIProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['image-generation'];

  private readonly baseUrl: string;
  private readonly defaultEngine: string;
  private readonly defaultStylePreset?: string;

  constructor(config: StabilityAIProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.stability.ai';
    this.defaultEngine = config.options?.defaultEngine ?? 'stable-diffusion-xl-1024-v1-0';
    this.defaultStylePreset = config.options?.defaultStylePreset;
  }

  /**
   * Get authentication headers
   */
  protected override getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      Accept: 'application/json',
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
      // Test connection by getting user account info (don't use fetchWithRetry to handle 4xx ourselves)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(`${this.baseUrl}/v1/user/account`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
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
        error: errorMessage.includes('abort') ? 'Connection timeout' : 'Failed to connect to Stability AI API',
      };
    }
  }

  /**
   * Generate images using Stable Diffusion
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const engine = request.model ?? this.defaultEngine;

    // Check if using new stable-image API or legacy engine API
    if (engine.startsWith('stable-image')) {
      return this.generateWithStableImage(request, engine);
    }

    return this.generateWithEngine(request, engine);
  }

  /**
   * Generate with legacy engine API
   */
  private async generateWithEngine(
    request: ImageGenerationRequest,
    engine: string
  ): Promise<ImageGenerationResponse> {
    const textPrompts = [
      { text: request.prompt, weight: 1 },
    ];

    if (request.negativePrompt) {
      textPrompts.push({ text: request.negativePrompt, weight: -1 });
    }

    const body: Record<string, unknown> = {
      text_prompts: textPrompts,
      cfg_scale: request.guidanceScale ?? 7,
      height: request.height ?? 1024,
      width: request.width ?? 1024,
      samples: request.count ?? 1,
      steps: 30,
    };

    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const stylePreset = request.style ?? this.defaultStylePreset;
    if (stylePreset) {
      body.style_preset = stylePreset;
    }

    const response = await this.fetchJson<StabilityResponse>(
      `${this.baseUrl}/v1/generation/${engine}/text-to-image`,
      {
        method: 'POST',
        // Paid request: sent once, a retry could bill twice
        retry: false,
        body,
      }
    );

    return {
      images: response.artifacts
        .filter((artifact) => artifact.finishReason === 'SUCCESS')
        .map((artifact) => ({
          base64: artifact.base64,
        })),
      model: engine,
    };
  }

  /**
   * Generate with new Stable Image API
   */
  private async generateWithStableImage(
    request: ImageGenerationRequest,
    model: string
  ): Promise<ImageGenerationResponse> {
    // Stable Image API uses FormData
    const formData = new FormData();
    formData.append('prompt', request.prompt);

    if (request.negativePrompt) {
      formData.append('negative_prompt', request.negativePrompt);
    }

    const aspectRatio = this.calculateAspectRatio(request.width, request.height);
    formData.append('aspect_ratio', aspectRatio);

    if (request.seed !== undefined) {
      formData.append('seed', request.seed.toString());
    }

    const stylePreset = request.style ?? this.defaultStylePreset;
    if (stylePreset) {
      formData.append('style_preset', stylePreset);
    }

    formData.append('output_format', 'png');

    const endpoint = model === 'stable-image-ultra' ? 'ultra' : 'core';
    const response = await this.fetchOnce(
      `${this.baseUrl}/v2beta/stable-image/generate/${endpoint}`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          Accept: 'application/json',
        },
        body: formData,
      }
    );

    const data = await response.json() as { image: string; seed: number; finish_reason: string };

    return {
      images: [{ base64: data.image }],
      model,
    };
  }

  /**
   * Calculate aspect ratio from dimensions
   */
  private calculateAspectRatio(width?: number, height?: number): string {
    if (!width || !height) return '1:1';

    const ratio = width / height;
    if (ratio >= 1.7) return '16:9';
    if (ratio >= 1.4) return '3:2';
    if (ratio >= 1.2) return '4:3';
    if (ratio >= 0.9) return '1:1';
    if (ratio >= 0.7) return '3:4';
    if (ratio >= 0.6) return '2:3';
    return '9:16';
  }
}

/**
 * Create a Stability AI provider instance
 */
export function createStabilityAIProvider(
  apiKey: string,
  options?: Partial<StabilityAIProviderConfig>
): StabilityAIProvider {
  return new StabilityAIProvider({
    id: options?.id ?? 'stability',
    type: 'stability',
    name: options?.name ?? 'Stability AI',
    apiKey,
    baseUrl: options?.baseUrl,
    timeout: options?.timeout ?? 120000,
    maxRetries: options?.maxRetries ?? 3,
    enabled: options?.enabled ?? true,
    options: options?.options,
  });
}
