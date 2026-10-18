import { describe, it, expect } from 'vitest';
import manifest from '../../../modules/darts-caller/module.json';
import {
  normalizeDartsCallerConfig,
  DEFAULT_DARTS_CALLER_CONFIG,
} from '../../../modules/darts-caller/src/config.js';

type SchemaField = { type: string; default?: unknown; fields?: Record<string, SchemaField> };

describe('normalizeDartsCallerConfig', () => {
  describe('defaults', () => {
    it('returns the full default shape for an empty config', () => {
      expect(normalizeDartsCallerConfig({})).toEqual(DEFAULT_DARTS_CALLER_CONFIG);
    });

    it('returns the full default shape for non-object input', () => {
      expect(normalizeDartsCallerConfig(null)).toEqual(DEFAULT_DARTS_CALLER_CONFIG);
      expect(normalizeDartsCallerConfig('nope')).toEqual(DEFAULT_DARTS_CALLER_CONFIG);
    });

    it('matches every default declared in module.json', () => {
      const schema = manifest.config as unknown as Record<string, SchemaField>;
      const defaults = DEFAULT_DARTS_CALLER_CONFIG as unknown as Record<string, unknown>;
      for (const [key, field] of Object.entries(schema)) {
        if (field.type === 'group') {
          const group = defaults[key] as Record<string, unknown>;
          expect(group, `group ${key}`).toBeDefined();
          for (const [sub, subField] of Object.entries(field.fields ?? {})) {
            expect(group[sub], `${key}.${sub}`).toEqual(subField.default);
          }
          expect(Object.keys(group).sort(), `${key} keys`).toEqual(Object.keys(field.fields ?? {}).sort());
        } else {
          expect(defaults[key], key).toEqual(field.default);
        }
      }
    });
  });

  describe('new shape', () => {
    it('keeps valid grouped values unchanged', () => {
      const input = {
        enabled: false,
        callerType: 'elevenlabs',
        language: 'de',
        volume: 55,
        delayMs: 0,
        ttsSettings: { voice: 'Anna', rate: 1.3, pitch: 0.8 },
        voicepackSettings: { packId: 'abc_de' },
        elevenlabsSettings: { voiceId: 'v1', stability: 0.3, similarity: 0.9 },
        audioSettings: { packPath: 'caller/mine' },
        callSettings: {
          scores: false,
          highScoresOnly: true,
          checkouts: false,
          checkoutThreshold: 100,
          playerChange: false,
          gameStart: false,
          gameOver: false,
          special180: false,
          busts: false,
          bulls: false,
          doubleBulls: false,
          cricketClosed: false,
          cricketMarks: false,
          cricketMarksThreshold: 7,
        },
      };
      expect(normalizeDartsCallerConfig(input)).toEqual(input);
    });

    it('fills missing fields inside a partial group', () => {
      const result = normalizeDartsCallerConfig({ callSettings: { scores: false } });
      expect(result.callSettings).toEqual({ ...DEFAULT_DARTS_CALLER_CONFIG.callSettings, scores: false });
    });

    it('clamps numbers to the allowed ranges', () => {
      const result = normalizeDartsCallerConfig({
        volume: 300,
        delayMs: -5,
        ttsSettings: { rate: 9, pitch: 0.1 },
        elevenlabsSettings: { stability: 2, similarity: -1 },
        callSettings: { checkoutThreshold: 500 },
      });
      expect(result.volume).toBe(100);
      expect(result.delayMs).toBe(0);
      expect(result.ttsSettings.rate).toBe(2);
      expect(result.ttsSettings.pitch).toBe(0.5);
      expect(result.elevenlabsSettings.stability).toBe(1);
      expect(result.elevenlabsSettings.similarity).toBe(0);
      expect(result.callSettings.checkoutThreshold).toBe(170);
    });

    it('falls back to defaults for invalid enum values and wrong types', () => {
      const result = normalizeDartsCallerConfig({
        callerType: 'custom',
        language: 'fr',
        volume: 'loud',
        callSettings: { scores: 'yes' },
      });
      expect(result.callerType).toBe('tts');
      expect(result.language).toBe('en');
      expect(result.volume).toBe(80);
      expect(result.callSettings.scores).toBe(true);
    });

    it('rejects voice pack ids that could escape the voice pack directory', () => {
      for (const packId of ['../etc', 'a/b', 'a\\b', '..', '.']) {
        expect(normalizeDartsCallerConfig({ voicepackSettings: { packId } }).voicepackSettings.packId).toBe('');
      }
    });

    it('keeps unrelated keys such as autoStart', () => {
      const result = normalizeDartsCallerConfig({ autoStart: true });
      expect((result as unknown as Record<string, unknown>).autoStart).toBe(true);
    });
  });

  describe('migration of the old config page shape', () => {
    const oldPage = {
      voiceType: 'system',
      language: 'de',
      systemVoice: 'Anna',
      elevenLabsApiKey: 'secret',
      elevenLabsVoiceId: 'voice123',
      customVoiceUrl: 'http://localhost:5000/tts',
      volume: 70,
      pitch: 120,
      rate: 90,
      callScores: false,
      callRemaining: true,
      callCheckouts: true,
      checkoutThreshold: 120,
      callPlayerNames: false,
      usePlayerNicknames: false,
      events: { bust: { enabled: false, useCustomSound: false }, '180': { enabled: true, useCustomSound: true, soundUrl: '/media/x.mp3' } },
      playerOverrides: [{ playerName: 'Bob', customGreeting: 'Hi' }],
      selectedVoicePackId: '',
    };

    it('maps the page fields into the grouped shape', () => {
      const result = normalizeDartsCallerConfig(oldPage);
      expect(result.callerType).toBe('tts');
      expect(result.language).toBe('de');
      expect(result.volume).toBe(70);
      expect(result.ttsSettings).toEqual({ voice: 'Anna', rate: 0.9, pitch: 1.2 });
      expect(result.elevenlabsSettings.voiceId).toBe('voice123');
      expect(result.callSettings.scores).toBe(false);
      expect(result.callSettings.checkouts).toBe(true);
      expect(result.callSettings.checkoutThreshold).toBe(120);
      expect(result.callSettings.playerChange).toBe(false);
      expect(result.callSettings.busts).toBe(false);
      expect(result.callSettings.special180).toBe(true);
    });

    it('drops every legacy and unsupported key', () => {
      const result = normalizeDartsCallerConfig(oldPage) as unknown as Record<string, unknown>;
      for (const key of [
        'voiceType', 'systemVoice', 'elevenLabsApiKey', 'elevenLabsVoiceId', 'customVoiceUrl', 'pitch', 'rate',
        'callScores', 'callRemaining', 'callCheckouts', 'checkoutThreshold', 'callPlayerNames',
        'usePlayerNicknames', 'events', 'playerOverrides', 'selectedVoicePackId',
      ]) {
        expect(result, key).not.toHaveProperty(key);
      }
    });

    it('maps voiceType elevenlabs with a selected pack to the voice pack caller', () => {
      const result = normalizeDartsCallerConfig({ callerType: 'tts', voiceType: 'elevenlabs', selectedVoicePackId: 'voice123_de' });
      expect(result.callerType).toBe('voicepack');
      expect(result.voicepackSettings.packId).toBe('voice123_de');
    });

    it('maps voiceType elevenlabs without a pack to the live ElevenLabs caller', () => {
      expect(normalizeDartsCallerConfig({ callerType: 'tts', voiceType: 'elevenlabs' }).callerType).toBe('elevenlabs');
    });

    it('maps the unsupported custom voice type to browser TTS', () => {
      expect(normalizeDartsCallerConfig({ voiceType: 'custom' }).callerType).toBe('tts');
    });

    it('lets an explicit non default callerType win over voiceType', () => {
      expect(normalizeDartsCallerConfig({ callerType: 'audio', voiceType: 'elevenlabs' }).callerType).toBe('audio');
    });

    it('prefers selectedVoicePackId over voicepackSettings.packId, as the handler did', () => {
      const result = normalizeDartsCallerConfig({
        selectedVoicePackId: 'picked',
        voicepackSettings: { packId: 'form' },
      });
      expect(result.voicepackSettings.packId).toBe('picked');
    });

    it('lets grouped call settings win over the old flat page flags', () => {
      const result = normalizeDartsCallerConfig({ callScores: false, callSettings: { scores: true } });
      expect(result.callSettings.scores).toBe(true);
    });
  });

  describe('migration of the old flat handler shape', () => {
    it('maps flat handler keys into the grouped shape', () => {
      const result = normalizeDartsCallerConfig({
        callerType: 'voicepack',
        ttsVoice: 'Daniel',
        ttsRate: 1.5,
        ttsPitch: 0.7,
        audioPackPath: 'caller/old',
        voicePackId: 'old_pack',
        callHighScoresOnly: true,
        callPlayerChange: false,
        callGameStart: false,
        callGameOver: false,
        call180: false,
        callBusts: false,
        callBulls: false,
        callDoubleBulls: false,
        elevenlabs: { voiceId: 'el', stability: 0.2, similarityBoost: 0.4, apiKey: 'secret' },
      });
      expect(result.ttsSettings).toEqual({ voice: 'Daniel', rate: 1.5, pitch: 0.7 });
      expect(result.audioSettings.packPath).toBe('caller/old');
      expect(result.voicepackSettings.packId).toBe('old_pack');
      expect(result.elevenlabsSettings).toEqual({ voiceId: 'el', stability: 0.2, similarity: 0.4 });
      expect(result.callSettings).toEqual({
        ...DEFAULT_DARTS_CALLER_CONFIG.callSettings,
        highScoresOnly: true,
        playerChange: false,
        gameStart: false,
        gameOver: false,
        special180: false,
        busts: false,
        bulls: false,
        doubleBulls: false,
      });
      const raw = result as unknown as Record<string, unknown>;
      for (const key of ['ttsVoice', 'ttsRate', 'ttsPitch', 'audioPackPath', 'voicePackId', 'callHighScoresOnly', 'elevenlabs']) {
        expect(raw, key).not.toHaveProperty(key);
      }
    });

    it('migrates the flat elevenlabs* keys as the last fallback and removes them', () => {
      const result = normalizeDartsCallerConfig({
        elevenlabsVoiceId: 'flatVoice',
        elevenlabsStability: 0.25,
        elevenlabsSimilarity: 0.6,
      });
      expect(result.elevenlabsSettings).toEqual({ voiceId: 'flatVoice', stability: 0.25, similarity: 0.6 });
      const raw = result as unknown as Record<string, unknown>;
      for (const key of ['elevenlabsVoiceId', 'elevenlabsStability', 'elevenlabsSimilarity']) {
        expect(raw, key).not.toHaveProperty(key);
      }
    });

    it('prefers the page voice id over the flat elevenlabsVoiceId when both exist', () => {
      const result = normalizeDartsCallerConfig({
        elevenLabsVoiceId: 'pageVoice',
        elevenlabsVoiceId: 'flatVoice',
        elevenlabsStability: 0.25,
      });
      expect(result.elevenlabsSettings.voiceId).toBe('pageVoice');
      expect(result.elevenlabsSettings.stability).toBe(0.25);
      expect(result).not.toHaveProperty('elevenlabsVoiceId');
      expect(result).not.toHaveProperty('elevenLabsVoiceId');
    });

    it('lets grouped ElevenLabs settings win over the flat elevenlabs* keys', () => {
      const result = normalizeDartsCallerConfig({
        elevenlabsSettings: { voiceId: 'grouped', stability: 0.9, similarity: 0.1 },
        elevenlabsVoiceId: 'flatVoice',
        elevenlabsStability: 0.25,
        elevenlabsSimilarity: 0.6,
      });
      expect(result.elevenlabsSettings).toEqual({ voiceId: 'grouped', stability: 0.9, similarity: 0.1 });
    });

    it('is idempotent', () => {
      const once = normalizeDartsCallerConfig({ voiceType: 'elevenlabs', selectedVoicePackId: 'p', callScores: false, rate: 150 });
      expect(normalizeDartsCallerConfig(once)).toEqual(once);
    });
  });
});
