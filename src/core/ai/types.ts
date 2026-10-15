/**
 * AI Provider Service Types
 *
 * Generic types for AI service providers that can be used for:
 * - Text generation (LLMs)
 * - Image generation
 * - Video/Animation generation
 * - Audio generation (TTS, music)
 * - Embeddings
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported AI provider types
 */
export type AIProviderType =
  | 'openai'
  | 'anthropic'
  | 'runway'
  | 'replicate'
  | 'elevenlabs'
  | 'stability'
  | 'ollama'
  | 'higgsfield'
  | 'custom';

/**
 * AI capability types
 */
export type AICapability =
  | 'text-generation'
  | 'image-generation'
  | 'video-generation'
  | 'audio-tts'
  | 'audio-music'
  | 'embeddings'
  | 'transcription';

/**
 * Base provider configuration
 */
export interface AIProviderConfig {
  /** Unique provider ID */
  id: string;
  /** Provider type */
  type: AIProviderType;
  /** Display name */
  name: string;
  /** API key or token */
  apiKey: string;
  /** Base URL (optional, for custom endpoints) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Max retries for failed requests */
  maxRetries?: number;
  /** Whether this provider is enabled */
  enabled?: boolean;
  /** Provider-specific configuration */
  options?: Record<string, unknown>;
}

/**
 * Provider status
 */
/**
 * A model a provider offers, as listed by its API
 */
export interface AIModelInfo {
  id: string;
  name: string;
  /** For providers that offer several kinds of models */
  category?: 'video' | 'image';
}

export interface AIProviderStatus {
  /** Provider ID */
  id: string;
  /** Whether provider is configured */
  configured: boolean;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Whether provider is currently available */
  available: boolean;
  /** Error message if unavailable */
  error?: string;
  /** Supported capabilities */
  capabilities: AICapability[];
  /** Available models (for local providers like Ollama) */
  models?: string[];
  /** Rate limit info */
  rateLimit?: {
    remaining: number;
    total: number;
    resetsAt?: Date;
  };
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Base request options
 */
export interface AIRequestOptions {
  /** Request timeout override */
  timeout?: number;
  /** Abort signal */
  signal?: AbortSignal;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Text generation request
 */
export interface TextGenerationRequest extends AIRequestOptions {
  /** The prompt or messages */
  prompt: string | ChatMessage[];
  /** Model to use */
  model?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Top P sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string[];
  /** System prompt */
  system?: string;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Text generation response
 */
export interface TextGenerationResponse {
  /** Generated text */
  text: string;
  /** Model used */
  model: string;
  /** Usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Finish reason */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * Image generation request
 */
export interface ImageGenerationRequest extends AIRequestOptions {
  /** The prompt */
  prompt: string;
  /** Negative prompt */
  negativePrompt?: string;
  /** Model to use */
  model?: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Number of images to generate */
  count?: number;
  /** Generation style */
  style?: string;
  /** Guidance scale */
  guidanceScale?: number;
  /** Random seed */
  seed?: number;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  /** Generated image URLs or base64 data */
  images: Array<{
    url?: string;
    base64?: string;
    revisedPrompt?: string;
  }>;
  /** Model used */
  model: string;
}

/**
 * Video/Animation generation request
 */
export interface VideoGenerationRequest extends AIRequestOptions {
  /** The prompt */
  prompt: string;
  /** Model to use */
  model?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Frames per second */
  fps?: number;
  /** Video width */
  width?: number;
  /** Video height */
  height?: number;
  /** Source image URL (for image-to-video) */
  imageUrl?: string;
  /** Aspect ratio */
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

/**
 * Video generation response
 */
export interface VideoGenerationResponse {
  /** Generated video URL */
  videoUrl: string;
  /** Job ID for async generation */
  jobId?: string;
  /** Model used */
  model: string;
  /** Duration in seconds */
  duration?: number;
}

/**
 * Audio TTS request
 */
export interface TTSRequest extends AIRequestOptions {
  /** Text to synthesize */
  text: string;
  /** Voice ID or name */
  voice: string;
  /** Model to use */
  model?: string;
  /** Output format */
  format?: 'mp3' | 'wav' | 'ogg' | 'flac';
  /** Speed multiplier */
  speed?: number;
  /** Stability (0-1) */
  stability?: number;
  /** Similarity boost (0-1) */
  similarityBoost?: number;
}

/**
 * Audio TTS response
 */
export interface TTSResponse {
  /** Audio URL or base64 data */
  audioUrl?: string;
  audioBase64?: string;
  /** Duration in seconds */
  duration?: number;
  /** Model used */
  model: string;
  /** Characters used */
  charactersUsed?: number;
}

/**
 * Embeddings request
 */
export interface EmbeddingsRequest extends AIRequestOptions {
  /** Input text(s) */
  input: string | string[];
  /** Model to use */
  model?: string;
}

/**
 * Embeddings response
 */
export interface EmbeddingsResponse {
  /** Embedding vectors */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Usage statistics */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Async Job Types
// ============================================================================

/**
 * Async job status
 */
export type AIJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Async job info
 */
export interface AIJob {
  /** Job ID */
  id: string;
  /** Provider ID */
  providerId: string;
  /** Provider's internal job ID */
  providerJobId: string;
  /** Job type */
  type: AICapability;
  /** Current status */
  status: AIJobStatus;
  /** Progress (0-100) */
  progress?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Result URL */
  resultUrl?: string;
  /** Error message */
  error?: string;
  /** Original request */
  request?: Record<string, unknown>;
}

// ============================================================================
// Service Events
// ============================================================================

/**
 * AI service events
 */
export interface AIServiceEvents {
  'provider:added': { providerId: string; type: AIProviderType };
  'provider:removed': { providerId: string };
  'provider:status': { providerId: string; status: AIProviderStatus };
  'job:started': { job: AIJob };
  'job:progress': { job: AIJob; progress: number };
  'job:completed': { job: AIJob; resultUrl: string };
  'job:failed': { job: AIJob; error: string };
  'job:cancelled': { job: AIJob };
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Provider info for API responses (without sensitive data)
 */
export interface AIProviderInfo {
  id: string;
  type: AIProviderType;
  name: string;
  enabled: boolean;
  configured: boolean;
  capabilities: AICapability[];
  hasApiKey: boolean;
  baseUrl?: string;
  defaultModel?: string;
  options?: Record<string, unknown>;
}

/**
 * Provider configuration update request
 */
export interface AIProviderConfigUpdate {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

/**
 * Text generation API request
 */
export interface TextGenerationAPIRequest extends TextGenerationRequest {
  providerId?: string;
}

/**
 * Image generation API request
 */
export interface ImageGenerationAPIRequest extends ImageGenerationRequest {
  providerId?: string;
}

/**
 * TTS API request
 */
export interface TTSAPIRequest extends TTSRequest {
  providerId?: string;
}

/**
 * Embeddings API request
 */
export interface EmbeddingsAPIRequest extends EmbeddingsRequest {
  providerId?: string;
}
