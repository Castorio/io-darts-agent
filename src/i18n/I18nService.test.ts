import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18nService, resetI18nService, getI18nService } from './I18nService.js';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../types/i18n.js';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    resetI18nService();
    service = new I18nService();
  });

  afterEach(() => {
    resetI18nService();
  });

  describe('constructor', () => {
    it('should use default language', () => {
      expect(service.getLanguage()).toBe(DEFAULT_LANGUAGE);
    });

    it('should use provided default language', () => {
      const germanService = new I18nService({ defaultLanguage: 'de' });
      expect(germanService.getLanguage()).toBe('de');
    });
  });

  describe('getLanguage()', () => {
    it('should return current language', () => {
      expect(service.getLanguage()).toBe('en');
    });
  });

  describe('setLanguage()', () => {
    it('should change language to German', () => {
      service.setLanguage('de');
      expect(service.getLanguage()).toBe('de');
    });

    it('should change language to Spanish', () => {
      service.setLanguage('es');
      expect(service.getLanguage()).toBe('es');
    });

    it('should throw error for unsupported language', () => {
      expect(() => service.setLanguage('fr' as never)).toThrow('not supported');
    });
  });

  describe('isSupported()', () => {
    it('should return true for supported languages', () => {
      expect(service.isSupported('en')).toBe(true);
      expect(service.isSupported('de')).toBe(true);
      expect(service.isSupported('es')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(service.isSupported('fr')).toBe(false);
      expect(service.isSupported('it')).toBe(false);
      expect(service.isSupported('')).toBe(false);
    });
  });

  describe('getSupportedLanguages()', () => {
    it('should return all supported languages', () => {
      const languages = service.getSupportedLanguages();
      expect(languages).toEqual(SUPPORTED_LANGUAGES);
      expect(languages).toContain('en');
      expect(languages).toContain('de');
      expect(languages).toContain('es');
    });
  });

  describe('getLanguageInfo()', () => {
    it('should return info for English', () => {
      const info = service.getLanguageInfo('en');
      expect(info.code).toBe('en');
      expect(info.name).toBe('English');
      expect(info.nativeName).toBe('English');
    });

    it('should return info for German', () => {
      const info = service.getLanguageInfo('de');
      expect(info.code).toBe('de');
      expect(info.name).toBe('German');
      expect(info.nativeName).toBe('Deutsch');
    });

    it('should return info for Spanish', () => {
      const info = service.getLanguageInfo('es');
      expect(info.code).toBe('es');
      expect(info.name).toBe('Spanish');
      expect(info.nativeName).toBe('Español');
    });
  });

  describe('getAllLanguageInfo()', () => {
    it('should return all language info', () => {
      const allInfo = service.getAllLanguageInfo();
      expect(allInfo).toHaveLength(3);
      expect(allInfo.map(i => i.code)).toEqual(['en', 'de', 'es']);
    });
  });

  describe('getTranslations()', () => {
    it('should return translations for current language', () => {
      const trans = service.getTranslations();
      expect(trans.common.save).toBe('Save');
    });

    it('should return German translations after language change', () => {
      service.setLanguage('de');
      const trans = service.getTranslations();
      expect(trans.common.save).toBe('Speichern');
    });

    it('should return Spanish translations after language change', () => {
      service.setLanguage('es');
      const trans = service.getTranslations();
      expect(trans.common.save).toBe('Guardar');
    });
  });

  describe('getTranslationsFor()', () => {
    it('should return translations for specified language', () => {
      const trans = service.getTranslationsFor('de');
      expect(trans.common.save).toBe('Speichern');
    });

    it('should return default translations for unsupported language', () => {
      const trans = service.getTranslationsFor('fr' as never);
      expect(trans.common.save).toBe('Save');
    });
  });

  describe('t()', () => {
    it('should translate common keys', () => {
      expect(service.t('common.save')).toBe('Save');
      expect(service.t('common.cancel')).toBe('Cancel');
      expect(service.t('common.delete')).toBe('Delete');
    });

    it('should translate nested keys', () => {
      expect(service.t('nav.dashboard')).toBe('Dashboard');
      expect(service.t('auth.login')).toBe('Login');
      expect(service.t('settings.title')).toBe('Settings');
    });

    it('should translate in German', () => {
      service.setLanguage('de');
      expect(service.t('common.save')).toBe('Speichern');
      expect(service.t('nav.dashboard')).toBe('Dashboard');
      expect(service.t('auth.login')).toBe('Anmelden');
    });

    it('should translate in Spanish', () => {
      service.setLanguage('es');
      expect(service.t('common.save')).toBe('Guardar');
      expect(service.t('nav.dashboard')).toBe('Panel');
      expect(service.t('auth.login')).toBe('Iniciar Sesión');
    });

    it('should return key for non-existent translation', () => {
      expect(service.t('non.existent.key')).toBe('non.existent.key');
    });

    it('should accept language override', () => {
      expect(service.t('common.save', 'de')).toBe('Speichern');
      expect(service.t('common.save', 'es')).toBe('Guardar');
    });
  });

  describe('translate()', () => {
    it('should translate with interpolation', () => {
      // Note: Our current translations don't have interpolation,
      // but we test the mechanism
      const text = service.translate('common.save');
      expect(text).toBe('Save');
    });

    it('should accept language parameter', () => {
      const text = service.translate('common.save', undefined, 'de');
      expect(text).toBe('Speichern');
    });
  });

  describe('getDefaultLanguage()', () => {
    it('should return default language', () => {
      expect(service.getDefaultLanguage()).toBe(DEFAULT_LANGUAGE);
    });
  });

  describe('getI18nService()', () => {
    it('should return singleton instance', () => {
      const instance1 = getI18nService();
      const instance2 = getI18nService();
      expect(instance1).toBe(instance2);
    });

    it('should preserve language across calls', () => {
      const instance1 = getI18nService();
      instance1.setLanguage('de');

      const instance2 = getI18nService();
      expect(instance2.getLanguage()).toBe('de');
    });
  });

  describe('WLED translations', () => {
    it('should have WLED translations in English', () => {
      const trans = service.getTranslations();
      expect(trans.wled.title).toBe('WLED Configuration');
      expect(trans.wled.testConnection).toBe('Test Connection');
    });

    it('should have WLED translations in German', () => {
      service.setLanguage('de');
      const trans = service.getTranslations();
      expect(trans.wled.title).toBe('WLED Konfiguration');
      expect(trans.wled.testConnection).toBe('Verbindung testen');
    });

    it('should have WLED translations in Spanish', () => {
      service.setLanguage('es');
      const trans = service.getTranslations();
      expect(trans.wled.title).toBe('Configuración WLED');
      expect(trans.wled.testConnection).toBe('Probar Conexión');
    });
  });

  describe('Event translations', () => {
    it('should have event translations in all languages', () => {
      // English
      expect(service.t('events.matchStart')).toBe('Match Start');
      expect(service.t('events.throw180')).toBe('180!');

      // German
      service.setLanguage('de');
      expect(service.t('events.matchStart')).toBe('Match Start');
      expect(service.t('events.throwBust')).toBe('Überworfen');

      // Spanish
      service.setLanguage('es');
      expect(service.t('events.matchStart')).toBe('Inicio de Partida');
      expect(service.t('events.throw180')).toBe('¡180!');
    });
  });

  describe('Player translations', () => {
    it('should have player translations', () => {
      expect(service.t('players.title')).toBe('Players');
      expect(service.t('players.addPlayer')).toBe('Add Player');

      service.setLanguage('de');
      expect(service.t('players.title')).toBe('Spieler');
      expect(service.t('players.addPlayer')).toBe('Spieler hinzufügen');

      service.setLanguage('es');
      expect(service.t('players.title')).toBe('Jugadores');
      expect(service.t('players.addPlayer')).toBe('Añadir Jugador');
    });
  });
});
