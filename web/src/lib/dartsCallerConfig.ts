/**
 * Darts Caller config as the Darts Caller page edits it.
 *
 * Same shape as the hub (modules/darts-caller/src/config.ts) and the
 * module.json schema. The hub migrates older stored shapes; this file only
 * fills missing values so the page always has a complete object.
 * dartsCallerConfig.test.ts keeps the defaults in sync with the hub.
 */

export type CallerType = 'tts' | 'voicepack' | 'elevenlabs' | 'audio'
export type CallerLanguage = 'en' | 'de'

export interface DartsCallerForm {
  enabled: boolean
  callerType: CallerType
  language: CallerLanguage
  volume: number
  delayMs: number
  ttsSettings: { voice: string; rate: number; pitch: number }
  voicepackSettings: { packId: string }
  elevenlabsSettings: { voiceId: string; stability: number; similarity: number }
  audioSettings: { packPath: string }
  callSettings: {
    scores: boolean
    highScoresOnly: boolean
    checkouts: boolean
    checkoutThreshold: number
    playerChange: boolean
    gameStart: boolean
    gameOver: boolean
    special180: boolean
    busts: boolean
    bulls: boolean
    doubleBulls: boolean
    cricketClosed: boolean
    cricketMarks: boolean
    cricketMarksThreshold: number
  }
}

export const CALLER_TYPES: readonly CallerType[] = ['tts', 'voicepack', 'elevenlabs', 'audio']
export const CALLER_LANGUAGES: readonly CallerLanguage[] = ['de', 'en']

export const DARTS_CALLER_DEFAULTS: DartsCallerForm = {
  enabled: true,
  callerType: 'tts',
  language: 'en',
  volume: 80,
  delayMs: 200,
  ttsSettings: { voice: '', rate: 1.0, pitch: 1.0 },
  voicepackSettings: { packId: '' },
  elevenlabsSettings: { voiceId: '', stability: 0.5, similarity: 0.75 },
  audioSettings: { packPath: '' },
  callSettings: {
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
    cricketClosed: true,
    cricketMarks: true,
    cricketMarksThreshold: 6,
  },
}

type Raw = Record<string, unknown>

function asObject(value: unknown): Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

/** Take values of the same type as the default, keep the default otherwise */
function fill<T extends object>(defaults: T, value: unknown): T {
  const raw = asObject(value)
  const result = { ...defaults }
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const v = raw[key as string]
    if (typeof v === typeof defaults[key]) {
      result[key] = v as T[keyof T]
    }
  }
  return result
}

/** Build a complete page form from the module config values of the hub */
export function toDartsCallerForm(values: unknown): DartsCallerForm {
  const raw = asObject(values)
  const d = DARTS_CALLER_DEFAULTS
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    callerType: CALLER_TYPES.includes(raw.callerType as CallerType) ? (raw.callerType as CallerType) : d.callerType,
    language: CALLER_LANGUAGES.includes(raw.language as CallerLanguage) ? (raw.language as CallerLanguage) : d.language,
    volume: typeof raw.volume === 'number' ? raw.volume : d.volume,
    delayMs: typeof raw.delayMs === 'number' ? raw.delayMs : d.delayMs,
    ttsSettings: fill(d.ttsSettings, raw.ttsSettings),
    voicepackSettings: fill(d.voicepackSettings, raw.voicepackSettings),
    elevenlabsSettings: fill(d.elevenlabsSettings, raw.elevenlabsSettings),
    audioSettings: fill(d.audioSettings, raw.audioSettings),
    callSettings: fill(d.callSettings, raw.callSettings),
  }
}
