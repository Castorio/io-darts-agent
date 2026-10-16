/**
 * WLED Module Exports
 */

export { WledHandler, createWledHandler } from './WledHandler.js';
export { normalizeWledConfig, mergeWledConfigUpdate } from './fade.js';
export type {
  WledConfig,
  WledAction,
  WledActionType,
  PlayerServiceInterface,
  WledLoggerInterface,
} from './WledHandler.js';
