/**
 * Intent System Exports
 */

export { IntentBus, getIntentBus, createIntentBus } from './IntentBus.js';
export type { IntentBusConfig, IntentBusLogger } from './IntentBus.js';

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
