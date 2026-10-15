/**
 * Anthropic AI Provider
 *
 * Provider implementation for Anthropic's Claude API.
 * Supports text generation with Claude models.
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIModelInfo,
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  TextGenerationRequest,
  TextGenerationResponse,
  ChatMessage,
} from '../types.js';

/** Default model (Claude Opus 5) */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5';

// Retired or deprecated models; configs that still name them fall back to the default
const RETIRED_MODEL_PATTERNS = [
  /^claude-2/,
  /^claude-3-/,
  /^claude-(sonnet|opus)-4-0$/,
  /^claude-(sonnet|opus)-4-20250514$/,
  /^claude-opus-4-1/,
];

// Models that still accept temperature/top_p; newer models reject them with a 400
const SAMPLING_MODEL_PATTERNS = [/^claude-haiku-4-5/, /^claude-(sonnet|opus)-4-[56]/];

// Models that support server-side refusal fallbacks with fallbacks: "default"
// (Claude API only, so not through custom base URLs)
const FALLBACK_MODEL_PATTERN = /^claude-(opus-5|fable-5-1)(-\d{8})?$/;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const ANTHROPIC_API_URL = 'https://api.anthropic.com';

// Current models think before answering; small budgets would end before any text
const MIN_THINKING_MAX_TOKENS = 1024;

export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

function resolveModel(model: string | undefined): string {
  if (!model || RETIRED_MODEL_PATTERNS.some((p) => p.test(model))) {
    return DEFAULT_ANTHROPIC_MODEL;
  }
  return model;
}

function acceptsSampling(model: string): boolean {
  return SAMPLING_MODEL_PATTERNS.some((p) => p.test(model));
}

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
    /** Effort for current models (default: low, the answers here are short tips) */
    effort?: AnthropicEffort;
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
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'thinking'; thinking: string }
    | { type: string }
  >;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'refusal' | string | null;
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
  private readonly effort: AnthropicEffort;

  constructor(config: AnthropicProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? ANTHROPIC_API_URL;
    this.apiVersion = config.options?.apiVersion ?? '2023-06-01';
    this.defaultModel = resolveModel(config.options?.defaultModel);
    this.effort = config.options?.effort ?? 'low';
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
      // Listing models verifies the API key without spending tokens
      // Don't use fetchWithRetry to handle 4xx ourselves
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(`${this.baseUrl}/v1/models`, {
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
        error: errorMessage.includes('abort') ? 'Connection timeout' : 'Failed to connect to Anthropic API',
      };
    }
  }

  /**
   * Text models the API key can use, as listed by the Models API
   */
  async listTextModels(): Promise<AIModelInfo[]> {
    const response = await this.fetchJson<{ data?: Array<{ id: string; display_name?: string }> }>(
      `${this.baseUrl}/v1/models?limit=100`,
      { method: 'GET' }
    );
    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected /v1/models response');
    }
    return response.data
      .filter((m) => !RETIRED_MODEL_PATTERNS.some((p) => p.test(m.id)))
      .map((m) => ({ id: m.id, name: m.display_name || m.id }));
  }

  /**
   * Generate text using Claude
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const model = request.model ? resolveModel(request.model) : this.defaultModel;
    const sampling = acceptsSampling(model);
    const fallback = FALLBACK_MODEL_PATTERN.test(model) && this.baseUrl === ANTHROPIC_API_URL;
    const maxTokens = request.maxTokens ?? 4096;

    // Convert prompt to messages format
    const { system, messages } = this.convertToMessages(request.prompt, request.system);

    const response = await this.fetchJson<AnthropicResponse>(
      `${this.baseUrl}/v1/messages`,
      {
        method: 'POST',
        // Paid request: sent once, a retry could bill twice
        retry: false,
        headers: fallback ? { 'anthropic-beta': FALLBACK_BETA } : undefined,
        body: {
          model,
          max_tokens: sampling ? maxTokens : Math.max(maxTokens, MIN_THINKING_MAX_TOKENS),
          system: system || undefined,
          messages,
          temperature: sampling ? request.temperature : undefined,
          top_p: sampling ? request.topP : undefined,
          stop_sequences: request.stop,
          // Current models think adaptively; low effort keeps short answers from
          // being used up by thinking. Older models do not take effort.
          output_config: sampling ? undefined : { effort: this.effort },
          fallbacks: fallback ? 'default' : undefined,
        },
      }
    );

    // Extract text from content blocks
    const text = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text && response.stop_reason === 'max_tokens') {
      throw new Error(`${response.model} reached the token limit before answering`);
    }
    if (!text && response.stop_reason === 'refusal') {
      throw new Error(`${response.model} declined the request`);
    }

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
      case 'refusal':
        return 'content_filter';
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
