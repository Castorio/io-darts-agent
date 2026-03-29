/**
 * Module Internationalization Service
 *
 * Provides translation support for modules
 */

import type {
  ModuleManifest,
  ModuleTranslations,
  ConfigFieldTranslation,
  ModuleConfigSchema,
  ModuleConfigField,
} from '../../types/modules.js';
import type { SupportedLanguage } from '../../types/i18n.js';
import { DEFAULT_LANGUAGE } from '../../types/i18n.js';

/**
 * Translated module manifest
 */
export interface TranslatedModuleManifest extends Omit<ModuleManifest, 'config'> {
  config?: TranslatedModuleConfigSchema;
}

export interface TranslatedModuleConfigSchema {
  [key: string]: TranslatedModuleConfigField;
}

export interface TranslatedModuleConfigField extends ModuleConfigField {
  // Options will have translated labels
}

/**
 * Get translated module manifest
 */
export function getTranslatedManifest(
  manifest: ModuleManifest,
  language: SupportedLanguage
): TranslatedModuleManifest {
  const translations = getModuleTranslations(manifest, language);

  // Start with original manifest
  const translated: TranslatedModuleManifest = {
    ...manifest,
    name: translations?.name ?? manifest.name,
    description: translations?.description ?? manifest.description,
  };

  // Translate config fields
  if (manifest.config) {
    translated.config = translateConfigSchema(
      manifest.config,
      translations?.config
    );
  }

  return translated;
}

/**
 * Get translations for a specific language
 * Falls back to English, then to original values
 */
export function getModuleTranslations(
  manifest: ModuleManifest,
  language: SupportedLanguage
): ModuleTranslations | undefined {
  if (!manifest.i18n) {
    return undefined;
  }

  // Try requested language first
  if (manifest.i18n[language]) {
    return manifest.i18n[language];
  }

  // Fall back to English
  if (language !== DEFAULT_LANGUAGE && manifest.i18n[DEFAULT_LANGUAGE]) {
    return manifest.i18n[DEFAULT_LANGUAGE];
  }

  return undefined;
}

/**
 * Translate config schema
 */
function translateConfigSchema(
  schema: ModuleConfigSchema,
  translations?: { [fieldKey: string]: ConfigFieldTranslation }
): TranslatedModuleConfigSchema {
  const translated: TranslatedModuleConfigSchema = {};

  for (const [key, field] of Object.entries(schema)) {
    translated[key] = translateConfigField(field, translations?.[key]);
  }

  return translated;
}

/**
 * Translate a single config field
 */
function translateConfigField(
  field: ModuleConfigField,
  translation?: ConfigFieldTranslation
): TranslatedModuleConfigField {
  const translated: TranslatedModuleConfigField = { ...field };

  if (translation) {
    if (translation.label) {
      translated.label = translation.label;
    }
    if (translation.description) {
      translated.description = translation.description;
    }

    // Translate select options
    if (field.options && translation.options) {
      translated.options = field.options.map((opt) => ({
        value: opt.value,
        label: translation.options?.[String(opt.value)] ?? opt.label,
      }));
    }
  }

  return translated;
}

/**
 * Get a custom string from module translations
 */
export function getModuleString(
  manifest: ModuleManifest,
  key: string,
  language: SupportedLanguage,
  fallback?: string
): string {
  const translations = getModuleTranslations(manifest, language);
  return translations?.strings?.[key] ?? fallback ?? key;
}

/**
 * Get all custom strings for a module
 */
export function getModuleStrings(
  manifest: ModuleManifest,
  language: SupportedLanguage
): Record<string, string> {
  const translations = getModuleTranslations(manifest, language);
  return translations?.strings ?? {};
}

/**
 * Check if module has translations for a language
 */
export function hasTranslations(
  manifest: ModuleManifest,
  language: SupportedLanguage
): boolean {
  return !!manifest.i18n?.[language];
}

/**
 * Get available languages for a module
 */
export function getAvailableLanguages(manifest: ModuleManifest): string[] {
  if (!manifest.i18n) {
    return [];
  }
  return Object.keys(manifest.i18n);
}
