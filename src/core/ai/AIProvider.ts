/**
 * AI Provider Interface
 *
 * Base interface and abstract class for AI service providers.
 * Each provider (OpenAI, Anthropic, Runway, etc.) implements this interface.
 */

import type {
  AIModelInfo,
  AIProviderConfig,
  AIProviderStatus,
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
} from './types.js';

/**
 * AI Provider interface
 */
export interface IAIProvider {
  /** Provider configuration */
  readonly config: AIProviderConfig;

  /** Provider capabilities */
  readonly capabilities: AICapability[];

  /**
   * Check if provider is configured (has credentials)
   */
  isConfigured(): boolean;

  /**
   * Check if provider is available (configured AND enabled)
   */
  isAvailable(): boolean;

  /**
   * Get provider status
   */
  getStatus(): Promise<AIProviderStatus>;

  /**
   * Text generation (if supported)
   */
  generateText?(request: TextGenerationRequest): Promise<TextGenerationResponse>;

  /**
   * Text models the configured API key can use (if supported)
   */
  listTextModels?(): Promise<AIModelInfo[]>;

  /**
   * Image generation (if supported)
   */
  generateImage?(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /**
   * Video generation (if supported)
   */
  generateVideo?(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;

  /**
   * Text-to-speech (if supported)
   */
  generateSpeech?(request: TTSRequest): Promise<TTSResponse>;

  /**
   * Generate embeddings (if supported)
   */
  generateEmbeddings?(request: EmbeddingsRequest): Promise<EmbeddingsResponse>;

  /**
   * Get async job status
   */
  getJobStatus?(jobId: string): Promise<AIJob>;

  /**
   * Cancel async job
   */
  cancelJob?(jobId: string): Promise<boolean>;
}

/**
 * Base AI Provider implementation with common functionality
 */
export abstract class BaseAIProvider implements IAIProvider {
  readonly config: AIProviderConfig;
  abstract readonly capabilities: AICapability[];

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /**
   * Check if provider is configured (has API key)
   * Note: This only checks if credentials are present, NOT if enabled
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Check if provider is available (configured AND enabled)
   */
  isAvailable(): boolean {
    return this.isConfigured() && this.config.enabled !== false;
  }

  /**
   * Get provider status
   */
  async getStatus(): Promise<AIProviderStatus> {
    return {
      id: this.config.id,
      configured: this.isConfigured(),
      enabled: this.config.enabled !== false,
      available: this.isAvailable(),
      capabilities: this.capabilities,
    };
  }

  /**
   * Make an API request with retry logic
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = this.config.maxRetries ?? 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeout ?? 30000
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          const error = await response.text();
          throw new Error(`API error (${response.status}): ${error}`);
        }

        // Retry on server errors (5xx)
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`);
          await this.delay(1000 * Math.pow(2, i)); // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort
        if (lastError.name === 'AbortError') {
          throw lastError;
        }

        await this.delay(1000 * Math.pow(2, i));
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Make a JSON API request
   */
  protected async fetchJson<T>(
    url: string,
    options: Omit<RequestInit, 'body'> & { body?: Record<string, unknown> }
  ): Promise<T> {
    const response = await this.fetchWithRetry(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    return response.json() as Promise<T>;
  }

  /**
   * Get authentication headers
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * Download a file from URL
   */
  protected async downloadFile(url: string, outputPath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
  }

  /**
   * Delay helper
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
