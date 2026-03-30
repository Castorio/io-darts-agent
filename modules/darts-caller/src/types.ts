/**
 * Darts Caller Module Types
 */

/**
 * Caller output type
 */
export type CallerType = 'tts' | 'audio';

/**
 * Call request type
 */
export type CallType = 'score' | 'checkout' | 'player' | 'game' | 'special';

/**
 * Call request sent to frontend for playback
 */
export interface CallRequest {
  id: string;
  type: CallType;
  text: string;
  audioFile?: string;
  priority: number;
  timestamp: number;
}

/**
 * Score call configuration
 */
export interface ScoreCallConfig {
  enabled: boolean;
  highScoresOnly: boolean;
  minScore: number;
  delay: number;
}

/**
 * Checkout call configuration
 */
export interface CheckoutCallConfig {
  enabled: boolean;
  announceRemaining: boolean;
  announceCheckoutPath: boolean;
}

/**
 * Special calls configuration
 */
export interface SpecialCallsConfig {
  call180: boolean;
  callBust: boolean;
  callGameStart: boolean;
  callGameOver: boolean;
  callPlayerChange: boolean;
}

/**
 * TTS configuration
 */
export interface TtsConfig {
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  language: string;
}

/**
 * Audio pack configuration
 */
export interface AudioPackConfig {
  packPath: string;
  fallbackToTts: boolean;
}

/**
 * Full caller module configuration
 */
export interface CallerModuleConfig {
  enabled: boolean;
  callerType: CallerType;
  tts: TtsConfig;
  audioPack: AudioPackConfig;
  scores: ScoreCallConfig;
  checkouts: CheckoutCallConfig;
  special: SpecialCallsConfig;
  volume: number;
  delayMs: number;
}

/**
 * Default TTS config
 */
export const DEFAULT_TTS_CONFIG: TtsConfig = {
  voice: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  language: 'en-GB',
};

/**
 * Default audio pack config
 */
export const DEFAULT_AUDIO_PACK_CONFIG: AudioPackConfig = {
  packPath: 'caller/default',
  fallbackToTts: true,
};

/**
 * Default score call config
 */
export const DEFAULT_SCORE_CALL_CONFIG: ScoreCallConfig = {
  enabled: true,
  highScoresOnly: false,
  minScore: 0,
  delay: 200,
};

/**
 * Default checkout call config
 */
export const DEFAULT_CHECKOUT_CALL_CONFIG: CheckoutCallConfig = {
  enabled: true,
  announceRemaining: true,
  announceCheckoutPath: false,
};

/**
 * Default special calls config
 */
export const DEFAULT_SPECIAL_CALLS_CONFIG: SpecialCallsConfig = {
  call180: true,
  callBust: true,
  callGameStart: true,
  callGameOver: true,
  callPlayerChange: true,
};

/**
 * Default caller module config
 */
export const DEFAULT_CALLER_CONFIG: CallerModuleConfig = {
  enabled: true,
  callerType: 'tts',
  tts: DEFAULT_TTS_CONFIG,
  audioPack: DEFAULT_AUDIO_PACK_CONFIG,
  scores: DEFAULT_SCORE_CALL_CONFIG,
  checkouts: DEFAULT_CHECKOUT_CALL_CONFIG,
  special: DEFAULT_SPECIAL_CALLS_CONFIG,
  volume: 80,
  delayMs: 200,
};
