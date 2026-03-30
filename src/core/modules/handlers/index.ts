/**
 * Module Event Handlers
 *
 * Centralized handlers for processing events for each module type
 */

export { WledHandler, createWledHandler } from './WledHandler.js';
export type {
  WledConfig,
  WledAction,
  WledActionType,
  PlayerServiceInterface,
  WledLoggerInterface,
} from './WledHandler.js';

export { GameDisplayHandler, createGameDisplayHandler } from './GameDisplayHandler.js';
export type {
  GameDisplayConfig,
  GameDisplayAnimations,
  AnimationConfig,
  AnimationEventType,
  AnimationTrigger,
  PlayerAnimationConfig,
  GameDisplayEventCallback,
} from './GameDisplayHandler.js';

export { DartsCallerHandler, createDartsCallerHandler } from './DartsCallerHandler.js';
export type {
  DartsCallerConfig,
  ElevenLabsCallerConfig,
  CallerType,
  CallRequest,
  CallRequestCallback,
} from './DartsCallerHandler.js';
