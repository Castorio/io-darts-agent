/**
 * OpenAI Provider
 *
 * Provider implementation for OpenAI API (GPT, DALL-E, Whisper, TTS)
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
  TTSRequest,
  TTSResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
  ChatMessage,
} from '../types.js';

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends AIProviderConfig {
  type: 'openai';
  options?: {
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
   * Generate text using GPT models
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const options = (this.config as OpenAIProviderConfig).options;
    const model = request.model || options?.textModel || 'gpt-4o';

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
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        top_p: request.topP,
        stop: request.stop,
      },
    });

    return {
      text: response.choices[0]?.message.content || '',
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
   * Generate images using DALL-E
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const options = (this.config as OpenAIProviderConfig).options;
    const model = request.model || options?.imageModel || 'dall-e-3';

    // DALL-E 3 size options
    let size = '1024x1024';
    if (request.width && request.height) {
      if (request.width > request.height) {
        size = '1792x1024';
      } else if (request.height > request.width) {
        size = '1024x1792';
      }
    }

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
        quality: request.style === 'hd' ? 'hd' : 'standard',
        response_format: 'url',
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
    const model = request.model || options?.ttsModel || 'tts-1';

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
        speed: request.speed || 1.0,
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
