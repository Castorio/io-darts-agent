/**
 * TTS Services
 *
 * Text-to-Speech services for audio generation
 */

export {
  ElevenLabsService,
  createElevenLabsService,
} from './ElevenLabsService.js';

export type {
  ElevenLabsConfig,
  ElevenLabsVoice,
  VoiceSettings,
  GenerationOptions,
} from './ElevenLabsService.js';

export {
  VoicePackGenerator,
  createVoicePackGenerator,
} from './VoicePackGenerator.js';

export type {
  GenerationStatus,
  GenerationProgress,
  VoicePackConfig,
} from './VoicePackGenerator.js';
