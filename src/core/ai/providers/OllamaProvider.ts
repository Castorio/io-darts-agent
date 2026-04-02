/**
 * Ollama Provider
 *
 * Provider implementation for Ollama local LLM server.
 * Supports text generation and embeddings with locally hosted models.
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  TextGenerationRequest,
  TextGenerationResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
  ChatMessage,
} from '../types.js';

/**
 * Ollama-specific configuration
 */
export interface OllamaProviderConfig extends AIProviderConfig {
  type: 'ollama';
  options?: {
    /** Default model for text generation */
    defaultModel?: string;
    /** Default model for embeddings */
    defaultEmbeddingModel?: string;
    /** Keep model loaded in memory (default: 5m) */
    keepAlive?: string;
  };
}

/**
 * Ollama model info
 */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Ollama chat message
 */
interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

/**
 * Ollama chat response
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama generate response
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama embeddings response
 */
interface OllamaEmbeddingsResponse {
  embedding: number[];
}

/**
 * Ollama models list response
 */
interface OllamaModelsResponse {
  models: OllamaModel[];
}

/**
 * Ollama Provider implementation
 */
export class OllamaProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['text-generation', 'embeddings'];

  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultEmbeddingModel: string;
  private readonly keepAlive: string;

  constructor(config: OllamaProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.defaultModel = config.options?.defaultModel ?? 'llama3.2';
    this.defaultEmbeddingModel = config.options?.defaultEmbeddingModel ?? 'nomic-embed-text';
    this.keepAlive = config.options?.keepAlive ?? '5m';
  }

  /**
   * Ollama doesn't require authentication
   */
  protected override getAuthHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Check if Ollama is configured (always true for local - no API key needed)
   */
  override isConfigured(): boolean {
    return true;
  }

  /**
   * Check if Ollama is available (configured AND enabled)
   */
  override isAvailable(): boolean {
    return this.isConfigured() && this.config.enabled !== false;
  }

  /**
   * Check provider status by pinging Ollama server
   */
  override async getStatus(): Promise<AIProviderStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          id: this.config.id,
          configured: true,
          enabled: this.config.enabled !== false,
          available: false,
          capabilities: this.capabilities,
          error: 'Ollama server not responding',
        };
      }

      const data = (await response.json()) as OllamaModelsResponse;

      return {
        id: this.config.id,
        configured: true,
        enabled: this.config.enabled !== false,
        available: true,
        capabilities: this.capabilities,
        models: data.models.map((m) => m.name),
      };
    } catch (error) {
      return {
        id: this.config.id,
        configured: true,
        enabled: this.config.enabled !== false,
        available: false,
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Failed to connect to Ollama',
      };
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    const response = await this.fetchJson<OllamaModelsResponse>(`${this.baseUrl}/api/tags`, {
      method: 'GET',
    });
    return response.models;
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as { status: string };
          if (onProgress) {
            onProgress(data.status);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model: ${response.statusText}`);
    }
  }

  /**
   * Generate text using Ollama
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const model = request.model ?? this.defaultModel;

    // Use chat endpoint for message arrays, generate for simple prompts
    if (Array.isArray(request.prompt)) {
      return this.generateChat(request, model);
    }

    return this.generateCompletion(request, model);
  }

  /**
   * Generate using chat endpoint
   */
  private async generateChat(
    request: TextGenerationRequest,
    model: string
  ): Promise<TextGenerationResponse> {
    const messages = this.convertMessages(request.prompt as ChatMessage[], request.system);

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      keep_alive: this.keepAlive,
    };

    if (request.temperature !== undefined) {
      body.options = { ...((body.options as object) ?? {}), temperature: request.temperature };
    }
    if (request.topP !== undefined) {
      body.options = { ...((body.options as object) ?? {}), top_p: request.topP };
    }
    if (request.maxTokens !== undefined) {
      body.options = { ...((body.options as object) ?? {}), num_predict: request.maxTokens };
    }
    if (request.stop) {
      body.options = { ...((body.options as object) ?? {}), stop: request.stop };
    }

    const response = await this.fetchJson<OllamaChatResponse>(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body,
    });

    return {
      text: response.message.content,
      model: response.model,
      usage: this.extractUsage(response),
      finishReason: 'stop',
    };
  }

  /**
   * Generate using completion endpoint
   */
  private async generateCompletion(
    request: TextGenerationRequest,
    model: string
  ): Promise<TextGenerationResponse> {
    const body: Record<string, unknown> = {
      model,
      prompt: request.prompt as string,
      stream: false,
      keep_alive: this.keepAlive,
    };

    if (request.system) {
      body.system = request.system;
    }

    if (request.temperature !== undefined) {
      body.options = { ...((body.options as object) ?? {}), temperature: request.temperature };
    }
    if (request.topP !== undefined) {
      body.options = { ...((body.options as object) ?? {}), top_p: request.topP };
    }
    if (request.maxTokens !== undefined) {
      body.options = { ...((body.options as object) ?? {}), num_predict: request.maxTokens };
    }
    if (request.stop) {
      body.options = { ...((body.options as object) ?? {}), stop: request.stop };
    }

    const response = await this.fetchJson<OllamaGenerateResponse>(
      `${this.baseUrl}/api/generate`,
      {
        method: 'POST',
        body,
      }
    );

    return {
      text: response.response,
      model: response.model,
      usage: this.extractUsage(response),
      finishReason: 'stop',
    };
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(request: EmbeddingsRequest): Promise<EmbeddingsResponse> {
    const model = request.model ?? this.defaultEmbeddingModel;

    // Ollama processes one text at a time
    const texts = Array.isArray(request.input) ? request.input : [request.input];
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await this.fetchJson<OllamaEmbeddingsResponse>(
        `${this.baseUrl}/api/embeddings`,
        {
          method: 'POST',
          body: {
            model,
            prompt: text,
            keep_alive: this.keepAlive,
          },
        }
      );
      embeddings.push(response.embedding);
    }

    return {
      embeddings,
      model,
    };
  }

  /**
   * Stream text generation
   */
  async *streamText(
    request: TextGenerationRequest
  ): AsyncGenerator<string, void, unknown> {
    const model = request.model ?? this.defaultModel;
    const isChat = Array.isArray(request.prompt);

    const body: Record<string, unknown> = {
      model,
      stream: true,
      keep_alive: this.keepAlive,
    };

    if (isChat) {
      body.messages = this.convertMessages(request.prompt as ChatMessage[], request.system);
    } else {
      body.prompt = request.prompt;
      if (request.system) {
        body.system = request.system;
      }
    }

    if (request.temperature !== undefined) {
      body.options = { ...((body.options as object) ?? {}), temperature: request.temperature };
    }
    if (request.maxTokens !== undefined) {
      body.options = { ...((body.options as object) ?? {}), num_predict: request.maxTokens };
    }

    const endpoint = isChat ? '/api/chat' : '/api/generate';
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaChatResponse | OllamaGenerateResponse;
          if ('message' in data) {
            yield data.message.content;
          } else if ('response' in data) {
            yield data.response;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * Convert chat messages to Ollama format
   */
  private convertMessages(
    messages: ChatMessage[],
    systemPrompt?: string
  ): OllamaChatMessage[] {
    const result: OllamaChatMessage[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      result.push({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      });
    }

    return result;
  }

  /**
   * Extract usage from response
   */
  private extractUsage(
    response: OllamaChatResponse | OllamaGenerateResponse
  ): { promptTokens: number; completionTokens: number; totalTokens: number } | undefined {
    if (response.prompt_eval_count === undefined && response.eval_count === undefined) {
      return undefined;
    }

    const promptTokens = response.prompt_eval_count ?? 0;
    const completionTokens = response.eval_count ?? 0;

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
}

/**
 * Create an Ollama provider instance
 */
export function createOllamaProvider(
  options?: Partial<OllamaProviderConfig>
): OllamaProvider {
  return new OllamaProvider({
    id: options?.id ?? 'ollama',
    type: 'ollama',
    name: options?.name ?? 'Ollama (Local)',
    apiKey: '', // Not required for local Ollama
    baseUrl: options?.baseUrl ?? 'http://localhost:11434',
    timeout: options?.timeout ?? 120000,
    maxRetries: options?.maxRetries ?? 3,
    enabled: options?.enabled ?? true,
    options: options?.options,
  });
}
