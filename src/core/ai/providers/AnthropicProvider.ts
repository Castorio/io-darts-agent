/**
 * Anthropic AI Provider
 *
 * Provider implementation for Anthropic's Claude API.
 * Supports text generation with Claude models.
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  TextGenerationRequest,
  TextGenerationResponse,
  ChatMessage,
} from '../types.js';

/**
 * Anthropic-specific configuration
 */
export interface AnthropicProviderConfig extends AIProviderConfig {
  type: 'anthropic';
  options?: {
    /** Default model */
    defaultModel?: string;
    /** API version */
    apiVersion?: string;
  };
}

/**
 * Anthropic API message format
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Anthropic API response
 */
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic Provider implementation
 */
export class AnthropicProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['text-generation'];

  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly defaultModel: string;

  constructor(config: AnthropicProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com';
    this.apiVersion = config.options?.apiVersion ?? '2023-06-01';
    this.defaultModel = config.options?.defaultModel ?? 'claude-3-5-sonnet-20241022';
  }

  /**
   * Get authentication headers for Anthropic API
   */
  protected override getAuthHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': this.apiVersion,
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
      // Anthropic doesn't have a simple status endpoint, so we do a minimal request
      // Using a simple message request with minimal tokens to verify API key
      // Don't use fetchWithRetry to handle 4xx ourselves
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // 200 = success, 400 = bad request (but API key valid), 401 = invalid key
      if (response.ok || response.status === 400) {
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
        error: errorMessage.includes('abort') ? 'Connection timeout' : 'Failed to connect to Anthropic API',
      };
    }
  }

  /**
   * Generate text using Claude
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const model = request.model ?? this.defaultModel;

    // Convert prompt to messages format
    const { system, messages } = this.convertToMessages(request.prompt, request.system);

    const response = await this.fetchJson<AnthropicResponse>(
      `${this.baseUrl}/v1/messages`,
      {
        method: 'POST',
        body: {
          model,
          max_tokens: request.maxTokens ?? 4096,
          system: system || undefined,
          messages,
          temperature: request.temperature,
          top_p: request.topP,
          stop_sequences: request.stop,
        },
      }
    );

    // Extract text from content blocks
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: this.mapFinishReason(response.stop_reason),
    };
  }

  /**
   * Convert prompt to Anthropic messages format
   */
  private convertToMessages(
    prompt: string | ChatMessage[],
    systemPrompt?: string
  ): { system: string | null; messages: AnthropicMessage[] } {
    if (typeof prompt === 'string') {
      return {
        system: systemPrompt ?? null,
        messages: [{ role: 'user', content: prompt }],
      };
    }

    // Extract system message if present
    let system: string | null = systemPrompt ?? null;
    const messages: AnthropicMessage[] = [];

    for (const msg of prompt) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return { system, messages };
  }

  /**
   * Map Anthropic finish reason to standard format
   */
  private mapFinishReason(
    reason: string | null
  ): 'stop' | 'length' | 'content_filter' | 'error' | undefined {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return undefined;
    }
  }
}

/**
 * Create an Anthropic provider instance
 */
export function createAnthropicProvider(
  apiKey: string,
  options?: Partial<AnthropicProviderConfig>
): AnthropicProvider {
  return new AnthropicProvider({
    id: options?.id ?? 'anthropic',
    type: 'anthropic',
    name: options?.name ?? 'Anthropic Claude',
    apiKey,
    baseUrl: options?.baseUrl,
    timeout: options?.timeout ?? 60000,
    maxRetries: options?.maxRetries ?? 3,
    enabled: options?.enabled ?? true,
    options: options?.options,
  });
}
