/**
 * Internationalization Service
 *
 * Handles translation loading and retrieval
 */

import type {
  SupportedLanguage,
  Translations,
  LanguageInfo,
} from '../types/i18n.js';
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  LANGUAGES,
} from '../types/i18n.js';

// Import translations
import en from './locales/en.js';
import de from './locales/de.js';
import es from './locales/es.js';

const translations: Record<SupportedLanguage, Translations> = {
  en,
  de,
  es,
};

export interface I18nServiceOptions {
  defaultLanguage?: SupportedLanguage;
}

export class I18nService {
  private currentLanguage: SupportedLanguage;
  private translations: Record<SupportedLanguage, Translations>;

  constructor(options: I18nServiceOptions = {}) {
    this.currentLanguage = options.defaultLanguage ?? DEFAULT_LANGUAGE;
    this.translations = translations;
  }

  /**
   * Get current language
   */
  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Set current language
   */
  setLanguage(language: SupportedLanguage): void {
    if (!this.isSupported(language)) {
      throw new Error(`Language "${language}" is not supported`);
    }
    this.currentLanguage = language;
  }

  /**
   * Check if a language is supported
   */
  isSupported(language: string): language is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * Get language info
   */
  getLanguageInfo(language: SupportedLanguage): LanguageInfo {
    return LANGUAGES[language];
  }

  /**
   * Get all language info
   */
  getAllLanguageInfo(): LanguageInfo[] {
    return Object.values(LANGUAGES);
  }

  /**
   * Get translations for current language
   */
  getTranslations(): Translations {
    return this.translations[this.currentLanguage];
  }

  /**
   * Get translations for a specific language
   */
  getTranslationsFor(language: SupportedLanguage): Translations {
    if (!this.isSupported(language)) {
      return this.translations[DEFAULT_LANGUAGE];
    }
    return this.translations[language];
  }

  /**
   * Translate a key using dot notation
   * Example: t('common.save') => 'Save'
   */
  t(key: string, language?: SupportedLanguage): string {
    const lang = language ?? this.currentLanguage;
    const trans = this.translations[lang];

    const keys = key.split('.');
    let result: unknown = trans;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = (result as Record<string, unknown>)[k];
      } else {
        // Key not found, return the key itself
        return key;
      }
    }

    if (typeof result === 'string') {
      return result;
    }

    return key;
  }

  /**
   * Translate with interpolation
   * Example: t('hello {{name}}', { name: 'World' }) => 'Hello World'
   */
  translate(key: string, params?: Record<string, string | number>, language?: SupportedLanguage): string {
    let text = this.t(key, language);

    if (params) {
      for (const [paramKey, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(value));
      }
    }

    return text;
  }

  /**
   * Get default language
   */
  getDefaultLanguage(): SupportedLanguage {
    return DEFAULT_LANGUAGE;
  }
}

// Singleton instance
let instance: I18nService | null = null;

/**
 * Get or create I18nService instance
 */
export function getI18nService(options?: I18nServiceOptions): I18nService {
  if (!instance) {
    instance = new I18nService(options);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetI18nService(): void {
  instance = null;
}
