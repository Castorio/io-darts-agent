/**
 * Intent System Exports
 */

export { IntentBus, getIntentBus, createIntentBus } from './IntentBus.js';
export type { IntentBusConfig, IntentBusLogger } from './IntentBus.js';

// Intent Emitter for modules
export { IntentEmitter, createIntentEmitter, createEmitterFromManifest } from './IntentEmitter.js';
export type { IntentEmitterConfig } from './IntentEmitter.js';

// Module Intent Handler
export {
  ModuleIntentHandler,
  createModuleIntentHandler,
} from './ModuleIntentHandler.js';
export type {
  ActionExecutor,
  IntentHandlerLogger,
  ModuleIntentHandlerConfig,
} from './ModuleIntentHandler.js';

// Re-export types
export type {
  Intent,
  IntentHandler,
  IntentPayloadField,
  IntentEmitDefinition,
  IntentHandleDefinition,
  ModuleIntentsConfig,
  RegisteredIntentHandler,
  IntentSubscriptionOptions,
  RegisteredIntent,
  // New types for configurable actions
  IntentSubscriptionConfig,
  IntentActionConfig,
  ModuleIntentAction,
  IntentActionConfigField,
  // Payload types
  PlayerAchievementPayload,
  Player180Payload,
  PlayerHighScorePayload,
  PlayerCheckoutPayload,
  MatchMilestonePayload,
  LegWonPayload,
  GameWonPayload,
  MatchEndedPayload,
  PlayerStatsPayload,
} from '../../types/intents.js';

export { IntentCategories, StandardIntents } from '../../types/intents.js';

// Template resolver utilities
export {
  resolveTemplate,
  extractVariables,
  validateTemplate,
  resolveActionConfigTemplates,
} from './templateResolver.js';
