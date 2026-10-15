/**
 * AI Provider Interface
 * Abstract interface for different AI animation generation providers
 */

import type {
  AnimationGenerationOptions,
  ProviderGenerationResult,
  ProviderJobStatus,
} from '../types/animation.js';

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
  /** API key or token */
  apiKey: string;
  /** Base URL override (optional) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Max retries */
  maxRetries?: number;
}

/**
 * AI Provider interface
 * Implement this for each AI service (Runway, Replicate, etc.)
 */
export interface AIProvider {
  /** Provider name */
  readonly name: string;

  /** Provider ID */
  readonly id: string;

  /**
   * Check if provider is configured and ready
   */
  isConfigured(): boolean;

  /**
   * Start an animation generation job
   * @param prompt - The generation prompt
   * @param options - Generation options
   * @returns Provider job ID or direct result
   */
  generate(
    prompt: string,
    options?: AnimationGenerationOptions
  ): Promise<ProviderGenerationResult>;

  /**
   * Check status of a running job
   * @param jobId - Provider job ID
   * @returns Current job status
   */
  getJobStatus(jobId: string): Promise<ProviderJobStatus>;

  /**
   * Cancel a running job
   * @param jobId - Provider job ID
   * @returns Whether cancellation succeeded
   */
  cancelJob(jobId: string): Promise<boolean>;

  /**
   * Download result to local file
   * @param resultUrl - URL of the generated animation
   * @param outputPath - Local path to save file
   */
  downloadResult(resultUrl: string, outputPath: string): Promise<void>;
}

/**
 * Base provider class with common functionality
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly id: string;

  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  abstract generate(
    prompt: string,
    options?: AnimationGenerationOptions
  ): Promise<ProviderGenerationResult>;

  abstract getJobStatus(jobId: string): Promise<ProviderJobStatus>;

  abstract cancelJob(jobId: string): Promise<boolean>;

  async downloadResult(resultUrl: string, outputPath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download file
    const response = await fetch(resultUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
  }

  /**
   * Helper to make API requests with retries
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
          return response;
        }

        // Retry on server errors (5xx)
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`);
          await this.delay(1000 * (i + 1)); // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await this.delay(1000 * (i + 1));
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Send a request exactly once, for requests that start paid work: after a
   * timeout, network error or 5xx the provider may already have run it.
   * Returns the response for every status; throws on network errors and timeouts.
   */
  protected async fetchOnce(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
