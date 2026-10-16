/**
 * Darts Caller configuration: the one shape that the handler, the generic
 * module config form (module.json) and the Darts Caller page all share.
 *
 * normalizeDartsCallerConfig() turns any stored config into this shape. It
 * migrates the two older shapes that may still exist in
 * config/modules/darts-caller.json:
 *
 *  - the old Darts Caller page shape (voiceType, systemVoice,
 *    elevenLabsVoiceId, callScores, callPlayerNames, events, ...)
 *  - the old flat handler shape (ttsVoice, callGameStart, elevenlabs {...}, ...)
 *
 * Grouped (new) values always win over legacy values. Legacy and unsupported
 * keys are dropped, unrelated keys (for example autoStart) are kept.
 */

export type CallerType = 'tts' | 'voicepack' | 'elevenlabs' | 'audio';
export type CallerLanguage = 'en' | 'de';

export interface TtsSettings {
  /** Browser voice name (SpeechSynthesisVoice.name), empty for the default voice */
  voice: string;
  /** Speech rate factor, 0.5 to 2.0 */
  rate: number;
  /** Pitch factor, 0.5 to 2.0 */
  pitch: number;
}

export interface VoicepackSettings {
  /** Folder name of the voice pack below the voice packs directory */
  packId: string;
}

export interface ElevenlabsSettings {
  voiceId: string;
  stability: number;
  similarity: number;
}

export interface AudioSettings {
  packPath: string;
}

export interface CallSettings {
  scores: boolean;
  highScoresOnly: boolean;
  checkouts: boolean;
  /** "You require X" is only called when X is at most this value (2 to 170) */
  checkoutThreshold: number;
  playerChange: boolean;
  gameStart: boolean;
  gameOver: boolean;
  special180: boolean;
  busts: boolean;
  bulls: boolean;
  doubleBulls: boolean;
}

export interface NormalizedDartsCallerConfig {
  enabled: boolean;
  callerType: CallerType;
  language: CallerLanguage;
  /** 0 to 100 */
  volume: number;
  /** 0 to 2000 ms */
  delayMs: number;
  ttsSettings: TtsSettings;
  voicepackSettings: VoicepackSettings;
  elevenlabsSettings: ElevenlabsSettings;
  audioSettings: AudioSettings;
  callSettings: CallSettings;
}

export const DEFAULT_DARTS_CALLER_CONFIG: NormalizedDartsCallerConfig = Object.freeze({
  enabled: true,
  callerType: 'tts',
  language: 'en',
  volume: 80,
  delayMs: 200,
  ttsSettings: Object.freeze({ voice: '', rate: 1.0, pitch: 1.0 }),
  voicepackSettings: Object.freeze({ packId: '' }),
  elevenlabsSettings: Object.freeze({ voiceId: '', stability: 0.5, similarity: 0.75 }),
  audioSettings: Object.freeze({ packPath: '' }),
  callSettings: Object.freeze({
    scores: true,
    highScoresOnly: false,
    checkouts: true,
    checkoutThreshold: 170,
    playerChange: true,
    gameStart: true,
    gameOver: true,
    special180: true,
    busts: true,
    bulls: true,
    doubleBulls: true,
  }),
}) as NormalizedDartsCallerConfig;

const CALLER_TYPES: readonly CallerType[] = ['tts', 'voicepack', 'elevenlabs', 'audio'];
const LANGUAGES: readonly CallerLanguage[] = ['en', 'de'];

/** Keys of the old page and flat handler shapes. They are never kept. */
const LEGACY_KEYS = [
  // old Darts Caller page
  'voiceType', 'systemVoice', 'elevenLabsApiKey', 'elevenLabsVoiceId', 'customVoiceUrl',
  'pitch', 'rate', 'callRemaining', 'checkoutThreshold', 'callPlayerNames',
  'usePlayerNicknames', 'events', 'playerOverrides', 'selectedVoicePackId',
  // old flat handler shape
  'ttsVoice', 'ttsRate', 'ttsPitch', 'audioPackPath', 'voicePackId',
  'callScores', 'callHighScoresOnly', 'callCheckouts', 'callPlayerChange', 'callGameStart',
  'callGameOver', 'call180', 'callBusts', 'callBulls', 'callDoubleBulls', 'elevenlabs',
  // flat ElevenLabs keys found in real stored configs (lowercase l)
  'elevenlabsVoiceId', 'elevenlabsStability', 'elevenlabsSimilarity',
] as const;

/** Old page event keys that map onto a supported call setting */
const PAGE_EVENT_TO_SETTING: Record<string, keyof CallSettings> = {
  score: 'scores',
  checkout: 'checkouts',
  playerChange: 'playerChange',
  gameOn: 'gameStart',
  gameShot: 'gameOver',
  matchShot: 'gameOver',
  '180': 'special180',
  bust: 'busts',
  bull: 'bulls',
  bullseye: 'doubleBulls',
};

/** Old flat handler keys for call settings */
const FLAT_CALL_KEYS: Partial<Record<keyof CallSettings, string>> = {
  scores: 'callScores',
  highScoresOnly: 'callHighScoresOnly',
  checkouts: 'callCheckouts',
  playerChange: 'callPlayerChange',
  gameStart: 'callGameStart',
  gameOver: 'callGameOver',
  special180: 'call180',
  busts: 'callBusts',
  bulls: 'callBulls',
  doubleBulls: 'callDoubleBulls',
};

type Raw = Record<string, unknown>;

function asObject(value: unknown): Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  return values.find((v): v is boolean => typeof v === 'boolean');
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.find(isNumber);
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((v): v is string => typeof v === 'string');
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  return values.find((v): v is string => typeof v === 'string' && v !== '');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Old page stored rate and pitch as percent (50 to 200). */
function percentToFactor(value: unknown): number | undefined {
  return isNumber(value) ? value / 100 : undefined;
}

/** A voice pack id is a single folder name, never a path. */
function sanitizePackId(value: string): string {
  if (value === '.' || value === '..' || !/^[A-Za-z0-9._-]+$/.test(value)) {
    return '';
  }
  return value;
}

function resolveCallerType(raw: Raw, packId: string): CallerType {
  const explicit = CALLER_TYPES.includes(raw.callerType as CallerType) ? (raw.callerType as CallerType) : undefined;
  // The default value 'tts' is always present after merging manifest defaults,
  // so only a non default callerType counts as an explicit choice here.
  if (explicit && explicit !== 'tts') return explicit;
  switch (raw.voiceType) {
    case 'elevenlabs':
      return packId ? 'voicepack' : 'elevenlabs';
    case 'system':
    case 'custom':
      return 'tts';
    default:
      return explicit ?? DEFAULT_DARTS_CALLER_CONFIG.callerType;
  }
}

function resolveCallSettings(raw: Raw): CallSettings {
  const grouped = asObject(raw.callSettings);
  const pageEvents = asObject(raw.events);
  const defaults = DEFAULT_DARTS_CALLER_CONFIG.callSettings;

  const fromPageEvents: Partial<Record<keyof CallSettings, boolean>> = {};
  for (const [eventKey, settingKey] of Object.entries(PAGE_EVENT_TO_SETTING)) {
    const enabled = asObject(pageEvents[eventKey]).enabled;
    if (enabled === false) fromPageEvents[settingKey] = false;
  }

  const pageOnly: Partial<Record<keyof CallSettings, unknown>> = {
    playerChange: raw.callPlayerNames,
  };

  const result = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof CallSettings>) {
    if (key === 'checkoutThreshold') continue;
    const flatKey = FLAT_CALL_KEYS[key];
    const value = firstBoolean(
      grouped[key],
      flatKey ? raw[flatKey] : undefined,
      pageOnly[key],
      fromPageEvents[key],
    );
    (result as Record<string, unknown>)[key] = value ?? defaults[key];
  }

  const threshold = firstNumber(grouped.checkoutThreshold, raw.checkoutThreshold);
  result.checkoutThreshold = threshold === undefined
    ? defaults.checkoutThreshold
    : Math.round(clamp(threshold, 2, 170));

  return result;
}

/** The normalized shape plus unrelated keys that were passed through (autoStart, ...) */
export type StoredDartsCallerConfig = NormalizedDartsCallerConfig & Record<string, unknown>;

/**
 * Normalize a stored or submitted Darts Caller config into the current shape.
 * Pure: does not mutate its input.
 */
export function normalizeDartsCallerConfig(input: unknown): StoredDartsCallerConfig {
  const raw = asObject(input);
  const d = DEFAULT_DARTS_CALLER_CONFIG;

  const tts = asObject(raw.ttsSettings);
  const voicepack = asObject(raw.voicepackSettings);
  const eleven = asObject(raw.elevenlabsSettings);
  const legacyEleven = asObject(raw.elevenlabs);
  const audio = asObject(raw.audioSettings);

  // The handler used selectedVoicePackId (page) before voicepackSettings.packId (form)
  const packId = sanitizePackId(
    firstNonEmptyString(raw.selectedVoicePackId, voicepack.packId, raw.voicePackId) ?? '',
  );

  // Keep unrelated keys (autoStart and the like), drop legacy ones
  const passthrough: Raw = { ...raw };
  for (const key of LEGACY_KEYS) delete passthrough[key];

  const volume = firstNumber(raw.volume);
  const delayMs = firstNumber(raw.delayMs);
  const rate = firstNumber(tts.rate, raw.ttsRate, percentToFactor(raw.rate));
  const pitch = firstNumber(tts.pitch, raw.ttsPitch, percentToFactor(raw.pitch));
  const stability = firstNumber(eleven.stability, legacyEleven.stability, raw.elevenlabsStability);
  const similarity = firstNumber(eleven.similarity, legacyEleven.similarityBoost, raw.elevenlabsSimilarity);

  return {
    ...passthrough,
    enabled: firstBoolean(raw.enabled) ?? d.enabled,
    callerType: resolveCallerType(raw, packId),
    language: LANGUAGES.includes(raw.language as CallerLanguage) ? (raw.language as CallerLanguage) : d.language,
    volume: volume === undefined ? d.volume : clamp(volume, 0, 100),
    delayMs: delayMs === undefined ? d.delayMs : clamp(delayMs, 0, 2000),
    ttsSettings: {
      voice: firstString(tts.voice, raw.ttsVoice, raw.systemVoice) ?? d.ttsSettings.voice,
      rate: rate === undefined ? d.ttsSettings.rate : clamp(rate, 0.5, 2),
      pitch: pitch === undefined ? d.ttsSettings.pitch : clamp(pitch, 0.5, 2),
    },
    voicepackSettings: { packId },
    elevenlabsSettings: {
      voiceId: firstNonEmptyString(eleven.voiceId, legacyEleven.voiceId, raw.elevenLabsVoiceId, raw.elevenlabsVoiceId) ?? d.elevenlabsSettings.voiceId,
      stability: stability === undefined ? d.elevenlabsSettings.stability : clamp(stability, 0, 1),
      similarity: similarity === undefined ? d.elevenlabsSettings.similarity : clamp(similarity, 0, 1),
    },
    audioSettings: {
      packPath: firstString(audio.packPath, raw.audioPackPath) ?? d.audioSettings.packPath,
    },
    callSettings: resolveCallSettings(raw),
  };
}
