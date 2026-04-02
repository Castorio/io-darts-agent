/**
 * AI Provider Service
 *
 * Central service for managing AI providers (OpenAI, ElevenLabs, Runway, etc.)
 */

// Core types
export type {
  AIProviderType,
  AICapability,
  AIProviderConfig,
  AIProviderStatus,
  AIRequestOptions,
  // Text generation
  TextGenerationRequest,
  TextGenerationResponse,
  ChatMessage,
  // Image generation
  ImageGenerationRequest,
  ImageGenerationResponse,
  // Video generation
  VideoGenerationRequest,
  VideoGenerationResponse,
  // TTS
  TTSRequest,
  TTSResponse,
  // Embeddings
  EmbeddingsRequest,
  EmbeddingsResponse,
  // Jobs
  AIJobStatus,
  AIJob,
  AIServiceEvents,
} from './types.js';

// Provider interface
export { BaseAIProvider } from './AIProvider.js';
export type { IAIProvider } from './AIProvider.js';

// Main service
export {
  AIProviderService,
  getAIProviderService,
  resetAIProviderService,
} from './AIProviderService.js';
export type { AIProviderServiceConfig, ProviderFactory } from './AIProviderService.js';

// Provider implementations
export {
  OpenAIProvider,
  createOpenAIProvider,
  ElevenLabsProvider,
  createElevenLabsProvider,
} from './providers/index.js';
export type {
  OpenAIProviderConfig,
  ElevenLabsProviderConfig,
  ElevenLabsVoice,
} from './providers/index.js';
