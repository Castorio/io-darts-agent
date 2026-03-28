import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerI18nRoutes } from '../../../src/api/routes/i18n.js';
import { I18nService, resetI18nService } from '../../../src/i18n/I18nService.js';

// Mock APIServer
const mockServer = {
  isAuthEnabled: vi.fn().mockReturnValue(false),
};

describe('I18n Routes', () => {
  let fastify: FastifyInstance;
  let i18nService: I18nService;
  const saveLanguage = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    resetI18nService();
    i18nService = new I18nService();
    saveLanguage.mockClear();

    fastify = Fastify();
    registerI18nRoutes(fastify, mockServer as any, { i18nService, saveLanguage });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    resetI18nService();
  });

  describe('GET /api/i18n/languages', () => {
    it('should return available languages', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/languages',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.current).toBe('en');
      expect(body.available).toHaveLength(3);
      expect(body.available.map((l: any) => l.code)).toEqual(['en', 'de', 'es']);
    });

    it('should include language metadata', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/languages',
      });

      const body = JSON.parse(response.body);
      const german = body.available.find((l: any) => l.code === 'de');
      expect(german.name).toBe('German');
      expect(german.nativeName).toBe('Deutsch');
    });
  });

  describe('GET /api/i18n/translations', () => {
    it('should return translations for current language', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/translations',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.language).toBe('en');
      expect(body.translations.common.save).toBe('Save');
    });

    it('should return translations for specified language', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/translations?lang=de',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.language).toBe('de');
      expect(body.translations.common.save).toBe('Speichern');
    });

    it('should return Spanish translations', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/translations?lang=es',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.language).toBe('es');
      expect(body.translations.common.save).toBe('Guardar');
    });

    it('should fall back to current language for invalid lang param', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/translations?lang=fr',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.language).toBe('en');
    });
  });

  describe('PUT /api/i18n/language', () => {
    it('should change language to German', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/i18n/language',
        payload: { language: 'de' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.language).toBe('de');
      expect(saveLanguage).toHaveBeenCalledWith('de');
    });

    it('should change language to Spanish', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/i18n/language',
        payload: { language: 'es' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.language).toBe('es');
    });

    it('should return error for missing language', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/i18n/language',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('required');
    });

    it('should return error for unsupported language', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/i18n/language',
        payload: { language: 'fr' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('not supported');
    });

    it('should persist language change', async () => {
      // Change to German
      await fastify.inject({
        method: 'PUT',
        url: '/api/i18n/language',
        payload: { language: 'de' },
      });

      // Verify persistence was called
      expect(saveLanguage).toHaveBeenCalledWith('de');

      // Verify language in subsequent requests
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/languages',
      });

      const body = JSON.parse(response.body);
      expect(body.current).toBe('de');
    });
  });

  describe('GET /api/i18n/t/:key', () => {
    it('should translate a key', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/t/common.save',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key).toBe('common.save');
      expect(body.value).toBe('Save');
      expect(body.language).toBe('en');
    });

    it('should translate in specified language', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/t/common.save?lang=de',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.value).toBe('Speichern');
      expect(body.language).toBe('de');
    });

    it('should return key for non-existent translation', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/t/non.existent.key',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key).toBe('non.existent.key');
      expect(body.value).toBe('non.existent.key');
    });

    it('should translate nested keys', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/i18n/t/wled.testConnection?lang=es',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.value).toBe('Probar Conexión');
    });
  });
});
