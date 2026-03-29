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
