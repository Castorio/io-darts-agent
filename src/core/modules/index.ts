// Module System - Core Exports
export { ModuleProtocol } from './ModuleProtocol.js';
export { ModuleBridge } from './ModuleBridge.js';
export { ModuleManager } from './ModuleManager.js';
export { ModuleInstaller } from './ModuleInstaller.js';
export {
  getTranslatedManifest,
  getModuleTranslations,
  getModuleString,
  getModuleStrings,
  hasTranslations,
  getAvailableLanguages,
} from './ModuleI18n.js';
export type { TranslatedModuleManifest, TranslatedModuleConfigSchema, TranslatedModuleConfigField } from './ModuleI18n.js';

// Module Event Handlers
export {
  WledHandler,
  createWledHandler,
  GameDisplayHandler,
  createGameDisplayHandler,
  DartsCallerHandler,
  createDartsCallerHandler,
} from './handlers/index.js';
export type {
  WledConfig,
  WledAction,
  WledActionType,
  PlayerServiceInterface,
  WledLoggerInterface,
  GameDisplayConfig,
  GameDisplayAnimations,
  AnimationConfig,
  AnimationEventType,
  AnimationTrigger,
  PlayerAnimationConfig,
  GameDisplayEventCallback,
  DartsCallerConfig,
  CallerType,
  CallRequest,
  CallRequestCallback,
} from './handlers/index.js';
