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
   * Called after the configuration (key, base URL, options) changed
   */
  onConfigUpdated?(): void;

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
 * Error answer from a provider API (status and response text)
 */
export class ApiResponseError extends Error {
  constructor(readonly status: number, body: string) {
    super(`API error (${status}): ${body}`);
    this.name = 'ApiResponseError';
  }
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

        // Client errors (4xx) are final
        if (response.status >= 400 && response.status < 500) {
          throw new ApiResponseError(response.status, await response.text());
        }

        // Retry on server errors (5xx)
        if (response.status >= 500) {
          lastError = new ApiResponseError(response.status, await response.text().catch(() => ''));
          if (i < retries - 1) await this.delay(1000 * Math.pow(2, i)); // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Neither a client error nor an abort gets better by retrying
        if (lastError instanceof ApiResponseError || lastError.name === 'AbortError') {
          throw lastError;
        }

        if (i < retries - 1) await this.delay(1000 * Math.pow(2, i));
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Send a request exactly once, for requests that start paid work: after a
   * 5xx, timeout or network error the provider may already have processed and
   * billed it. A 4xx stays an ApiResponseError (nothing was processed).
   */
  protected async fetchOnce(url: string, options: RequestInit): Promise<Response> {
    try {
      return await this.fetchWithRetry(url, options, 1);
    } catch (error) {
      if (error instanceof ApiResponseError && error.status < 500) throw error;
      const reason = error instanceof ApiResponseError
        ? `status ${error.status}`
        : error instanceof Error
          ? (error.name === 'AbortError' ? 'timeout' : error.message)
          : String(error);
      throw new Error(
        `${this.config.name ?? this.config.id}: request failed (${reason}); not retried, because it may already have been processed and billed`
      );
    }
  }

  /**
   * Make a JSON API request
   */
  protected async fetchJson<T>(
    url: string,
    options: Omit<RequestInit, 'body'> & {
      body?: Record<string, unknown>;
      /**
       * false sends the request exactly once. Use it for requests that start
       * paid work: after a timeout or 5xx the provider may already have run it.
       */
      retry?: boolean;
    }
  ): Promise<T> {
    const { retry, ...init } = options;
    const request: RequestInit = {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    };
    const response = retry === false ? await this.fetchOnce(url, request) : await this.fetchWithRetry(url, request);

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
