import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { I18nService } from '../../i18n/I18nService.js';
import type {
  SupportedLanguage,
  LanguagesResponse,
  ChangeLanguageRequest,
  Translations,
} from '../../types/i18n.js';

export interface I18nDependencies {
  i18nService: I18nService;
  saveLanguage: (language: SupportedLanguage) => Promise<void>;
}

/**
 * Register i18n routes
 */
export function registerI18nRoutes(
  fastify: FastifyInstance,
  _server: APIServer,
  deps: I18nDependencies
): void {
  const { i18nService, saveLanguage } = deps;

  /**
   * GET /api/i18n/languages - Get available languages
   */
  fastify.get<{
    Reply: LanguagesResponse;
  }>('/api/i18n/languages', () => {
    return {
      current: i18nService.getLanguage(),
      available: i18nService.getAllLanguageInfo(),
    };
  });

  /**
   * GET /api/i18n/translations - Get translations for current language
   */
  fastify.get<{
    Querystring: { lang?: string };
    Reply: { language: SupportedLanguage; translations: Translations };
  }>('/api/i18n/translations', (request) => {
    const { lang } = request.query;

    let language = i18nService.getLanguage();
    if (lang && i18nService.isSupported(lang)) {
      language = lang;
    }

    return {
      language,
      translations: i18nService.getTranslationsFor(language),
    };
  });

  /**
   * PUT /api/i18n/language - Change current language
   */
  fastify.put<{
    Body: ChangeLanguageRequest;
    Reply: { success: boolean; language: SupportedLanguage; error?: string };
  }>('/api/i18n/language', async (request, reply) => {
    const { language } = request.body;

    if (!language) {
      void reply.code(400);
      return { success: false, language: i18nService.getLanguage(), error: 'Language is required' };
    }

    if (!i18nService.isSupported(language)) {
      void reply.code(400);
      return {
        success: false,
        language: i18nService.getLanguage(),
        error: `Language "${String(language)}" is not supported`,
      };
    }

    try {
      i18nService.setLanguage(language);
      await saveLanguage(language);

      return {
        success: true,
        language: i18nService.getLanguage(),
      };
    } catch (error) {
      void reply.code(500);
      return {
        success: false,
        language: i18nService.getLanguage(),
        error: error instanceof Error ? error.message : 'Failed to change language',
      };
    }
  });

  /**
   * GET /api/i18n/t/:key - Translate a single key
   */
  fastify.get<{
    Params: { key: string };
    Querystring: { lang?: string };
    Reply: { key: string; value: string; language: SupportedLanguage };
  }>('/api/i18n/t/:key', (request) => {
    const { key } = request.params;
    const { lang } = request.query;

    let language = i18nService.getLanguage();
    if (lang && i18nService.isSupported(lang)) {
      language = lang;
    }

    return {
      key,
      value: i18nService.t(key, language),
      language,
    };
  });
}
