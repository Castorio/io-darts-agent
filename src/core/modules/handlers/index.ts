/**
 * Module Event Handlers
 *
 * Re-exports handlers from individual module directories.
 * Module-specific code lives in the module folders, not in core.
 */

// WLED Module
export { WledHandler, createWledHandler } from '../../../../modules/wled/src/index.js';
export type {
  WledConfig,
  WledAction,
  WledActionType,
  PlayerServiceInterface,
  WledLoggerInterface,
} from '../../../../modules/wled/src/index.js';

// Game Display Module
export { GameDisplayHandler, createGameDisplayHandler } from '../../../../modules/game-display/src/index.js';
export type {
  GameDisplayConfig,
  GameDisplayAnimations,
  AnimationConfig,
  AnimationEventType,
  AnimationTrigger,
  PlayerAnimationConfig,
  GameDisplayEventCallback,
} from '../../../../modules/game-display/src/index.js';

// Darts Caller Module
export { DartsCallerHandler, createDartsCallerHandler } from '../../../../modules/darts-caller/src/index.js';
export type {
  DartsCallerConfig,
  ElevenLabsCallerConfig,
  CallerType,
  CallRequest,
  CallRequestCallback,
} from '../../../../modules/darts-caller/src/index.js';

// Re-export ElevenLabs and VoicePackGenerator from darts-caller
export { ElevenLabsService, VoicePackGenerator, LocalAudioPlayer } from '../../../../modules/darts-caller/src/index.js';
export type {
  ElevenLabsVoice,
  VoiceSettings,
  GenerationOptions,
  ElevenLabsConfig,
  GenerationStatus,
  GenerationProgress,
  VoicePackConfig,
  LocalAudioPlayerConfig,
} from '../../../../modules/darts-caller/src/index.js';

