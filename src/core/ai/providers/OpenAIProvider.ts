/**
 * OpenAI Provider
 *
 * Provider implementation for OpenAI API (GPT, DALL-E, Whisper, TTS)
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIModelInfo,
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  TTSRequest,
  TTSResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
  ChatMessage,
} from '../types.js';

/**
 * OpenAI-specific configuration
 */
// Preferred models, newest first (developers.openai.com, 2026-10-15). Which ones a key
// can use depends on the OpenAI project, so the first one listed by /models wins.
const PREFERRED_TEXT_MODELS = ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra', 'gpt-4.1-mini', 'gpt-4.1'];
const PREFERRED_IMAGE_MODELS = ['gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1'];

/** Fallbacks when the model list cannot be loaded: widely available models */
export const DEFAULT_OPENAI_TEXT_MODEL = 'gpt-4.1-mini';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';
export const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';

// Ids that are not chat models: audio, realtime, search, research, Responses-only
// pro models and dated snapshots
const NON_CHAT_TEXT_MODELS = [
  /realtime|audio|transcribe|tts|search|research|embedding|moderation|instruct|codex/,
  /-pro($|-)/,
  /-\d{4}-\d{2}-\d{2}$/,
];

// Shut down or scheduled for shutdown; configs that still name them use the defaults
// Image and speech models also land here when picked as "default model" in older UIs
const DEPRECATED_TEXT_MODELS = [
  /^gpt-4o(-mini)?$/,
  /^gpt-4(-\d{4})?$/,
  /^gpt-4-turbo/,
  // Shut down by 2026-10-23 (developers.openai.com/api/docs/deprecations)
  /^o1(-mini)?$/,
  /^o[34]-mini$/,
  /^gpt-4\.1-nano$/,
  /^gpt-5-chat/,
  /^gpt-3\.5-turbo/,
  /^dall-e-/,
  /^gpt-image/,
  /tts/,
];
const DEPRECATED_IMAGE_MODELS = [/^dall-e-/];
const DEPRECATED_TTS_MODELS = [/^tts-1/];

// Reasoning models spend completion tokens on thinking first; small budgets would end
// before any answer, so they get a floor and low effort
const MIN_REASONING_COMPLETION_TOKENS = 1024;

// Non-reasoning models that still accept temperature, top_p and stop
const SAMPLING_TEXT_MODELS = [/^gpt-4\.1/, /^gpt-4o/];

function isUsable(model: string | undefined, deprecated: RegExp[]): model is string {
  return !!model && !deprecated.some((p) => p.test(model));
}

function isChatModel(id: string): boolean {
  return (
    /^(gpt-|o\d)/.test(id) &&
    !/^gpt-image/.test(id) &&
    isUsable(id, DEPRECATED_TEXT_MODELS) &&
    !NON_CHAT_TEXT_MODELS.some((p) => p.test(id))
  );
}

function preferredFirst(ids: string[], preferred: string[]): string[] {
  const rank = (id: string): number => {
    const index = preferred.indexOf(id);
    return index === -1 ? preferred.length : index;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export interface OpenAIProviderConfig extends AIProviderConfig {
  type: 'openai';
  options?: {
    /** Text model chosen in the settings UI */
    defaultModel?: string;
    /** Default model for text generation */
    textModel?: string;
    /** Default model for image generation */
    imageModel?: string;
    /** Default model for TTS */
    ttsModel?: string;
    /** Default model for embeddings */
    embeddingsModel?: string;
    /** Organization ID */
    organization?: string;
  };
}

/**
 * OpenAI Provider implementation
 */
export class OpenAIProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = [
    'text-generation',
    'image-generation',
    'audio-tts',
    'embeddings',
    'transcription',
  ];

  private baseUrl: string;
  private availableModels: Promise<string[]> | null = null;

  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  protected override getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const options = (this.config as OpenAIProviderConfig).options;
    if (options?.organization) {
      headers['OpenAI-Organization'] = options.organization;
    }

    return headers;
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
      // Test connection by listing models (don't use fetchWithRetry to handle 4xx ourselves)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

      const response = await fetch(`${this.baseUrl}/models`, {
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
        error: errorMessage.includes('abort') ? 'Connection timeout' : 'Failed to connect to OpenAI API',
      };
    }
  }

  /**
   * Drop the cached model list; it belongs to the previous key
   */
  onConfigUpdated(): void {
    this.availableModels = null;
  }

  /**
   * Chat models the API key can use, preferred models first
   */
  async listTextModels(): Promise<AIModelInfo[]> {
    // The settings page asks for this; always reload so models enabled in the
    // OpenAI project since the last call show up (and refresh the cache with it)
    this.availableModels = null;
    const ids = await this.loadModelIds();
    return preferredFirst(ids.filter(isChatModel), PREFERRED_TEXT_MODELS).map((id) => ({ id, name: id }));
  }

  /**
   * Model ids from GET /models, cached per provider instance. A failed load is not
   * cached so the next request tries again.
   */
  private loadModelIds(): Promise<string[]> {
    this.availableModels ??= this.fetchJson<{ data?: Array<{ id: string }> }>(`${this.baseUrl}/models`, {
      method: 'GET',
    }).then((response) => {
      if (!Array.isArray(response.data)) throw new Error('Unexpected /models response');
      return response.data.map((m) => m.id);
    });
    return this.availableModels.catch((error: unknown) => {
      this.availableModels = null;
      throw error;
    });
  }

  private async pickAvailable(
    pick: (ids: string[]) => string | undefined,
    fallback: string
  ): Promise<string> {
    try {
      return pick(await this.loadModelIds()) ?? fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Generate text using GPT models
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const options = (this.config as OpenAIProviderConfig).options;
    const configured = request.model || options?.defaultModel || options?.textModel;
    const model = isUsable(configured, DEPRECATED_TEXT_MODELS)
      ? configured
      : await this.pickAvailable(
          (ids) => preferredFirst(ids.filter(isChatModel), PREFERRED_TEXT_MODELS)[0],
          DEFAULT_OPENAI_TEXT_MODEL
        );
    // Reasoning models reject sampling parameters
    const sampling = SAMPLING_TEXT_MODELS.some((p) => p.test(model));

    // Convert prompt to messages format
    const messages: Array<{ role: string; content: string }> = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }

    if (typeof request.prompt === 'string') {
      messages.push({ role: 'user', content: request.prompt });
    } else {
      for (const msg of request.prompt as ChatMessage[]) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await this.fetchJson<{
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      model: string;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    }>(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      body: {
        model,
        messages,
        max_completion_tokens:
          sampling || request.maxTokens === undefined
            ? request.maxTokens
            : Math.max(request.maxTokens, MIN_REASONING_COMPLETION_TOKENS),
        reasoning_effort: sampling ? undefined : 'low',
        temperature: sampling ? request.temperature : undefined,
        top_p: sampling ? request.topP : undefined,
        stop: sampling ? request.stop : undefined,
      },
    });

    const text = response.choices[0]?.message.content || '';
    if (!text && response.choices[0]?.finish_reason === 'length') {
      throw new Error(`${response.model} reached the token limit before answering`);
    }

    return {
      text,
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      finishReason: response.choices[0]?.finish_reason as TextGenerationResponse['finishReason'],
    };
  }

  /**
   * Generate images using GPT Image
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const options = (this.config as OpenAIProviderConfig).options;
    const configured = request.model || options?.imageModel;
    const model = isUsable(configured, DEPRECATED_IMAGE_MODELS)
      ? configured
      : await this.pickAvailable(
          (ids) => PREFERRED_IMAGE_MODELS.find((id) => ids.includes(id)),
          DEFAULT_OPENAI_IMAGE_MODEL
        );

    let size = '1024x1024';
    if (request.width && request.height) {
      if (request.width > request.height) {
        size = '1536x1024';
      } else if (request.height > request.width) {
        size = '1024x1536';
      }
    }

    // GPT Image always returns base64; response_format was DALL-E only
    const response = await this.fetchJson<{
      data: Array<{
        url?: string;
        b64_json?: string;
        revised_prompt?: string;
      }>;
    }>(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      body: {
        model,
        prompt: request.prompt,
        n: request.count || 1,
        size,
        quality: request.style === 'hd' ? 'high' : 'auto',
      },
    });

    return {
      images: response.data.map((img) => ({
        url: img.url,
        base64: img.b64_json,
        revisedPrompt: img.revised_prompt,
      })),
      model,
    };
  }

  /**
   * Generate speech using TTS
   */
  async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    const options = (this.config as OpenAIProviderConfig).options;
    const configured = request.model || options?.ttsModel;
    const model = isUsable(configured, DEPRECATED_TTS_MODELS) ? configured : DEFAULT_OPENAI_TTS_MODEL;
    // speed only applies to the tts-1 family
    const speed = model.startsWith('tts-1') ? request.speed || 1.0 : undefined;

    const response = await this.fetchWithRetry(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        model,
        input: request.text,
        voice: request.voice || 'alloy',
        response_format: request.format || 'mp3',
        speed,
      }),
    });

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      audioBase64: base64,
      model,
      charactersUsed: request.text.length,
    };
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    const options = (this.config as OpenAIProviderConfig).options;
    const model = request.model || options?.embeddingsModel || 'text-embedding-3-small';

    const response = await this.fetchJson<{
      data: Array<{ embedding: number[] }>;
      model: string;
      usage: {
        prompt_tokens: number;
        total_tokens: number;
      };
    }>(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      body: {
        model,
        input: request.input,
      },
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }
}

/**
 * Create OpenAI provider
 */
export function createOpenAIProvider(config: OpenAIProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}
