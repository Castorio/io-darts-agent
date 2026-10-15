/**
 * Darts Caller Module Exports
 */

export { DartsCallerHandler, createDartsCallerHandler } from './DartsCallerHandler.js';
export type {
  DartsCallerConfig,
  ElevenLabsCallerConfig,
  CallerType,
  CallRequest,
  CallRequestTts,
  CallRequestCallback,
} from './DartsCallerHandler.js';

export { normalizeDartsCallerConfig, DEFAULT_DARTS_CALLER_CONFIG } from './config.js';
export type {
  NormalizedDartsCallerConfig,
  CallerLanguage,
  TtsSettings,
  VoicepackSettings,
  ElevenlabsSettings,
  AudioSettings,
  CallSettings,
} from './config.js';

export { ElevenLabsService } from './ElevenLabsService.js';
export type {
  ElevenLabsVoice,
  VoiceSettings,
  GenerationOptions,
  ElevenLabsConfig,
} from './ElevenLabsService.js';

export { VoicePackGenerator, isValidPackId } from './VoicePackGenerator.js';
export type {
  GenerationStatus,
  GenerationProgress,
  VoicePackConfig,
} from './VoicePackGenerator.js';

export { LocalAudioPlayer } from './LocalAudioPlayer.js';
export type { LocalAudioPlayerConfig } from './LocalAudioPlayer.js';
