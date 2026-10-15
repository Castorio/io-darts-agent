import type { CallRequestTts } from '../types/api'

/** The SpeechSynthesisUtterance fields the caller sets */
export type UtteranceLike = Pick<SpeechSynthesisUtterance, 'volume' | 'rate' | 'pitch' | 'lang' | 'voice'>

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Apply the Darts Caller browser TTS settings to an utterance.
 * Without settings (older hub or intent calls) neutral values and the
 * player volume (0 to 1) are used.
 */
export function applyCallerTts(
  utterance: UtteranceLike,
  tts: CallRequestTts | undefined,
  voices: readonly SpeechSynthesisVoice[],
  fallbackVolume: number,
): void {
  if (!tts) {
    utterance.volume = fallbackVolume
    utterance.rate = 1
    utterance.pitch = 1
    return
  }
  utterance.volume = clamp(tts.volume / 100, 0, 1)
  utterance.rate = clamp(tts.rate, 0.5, 2)
  utterance.pitch = clamp(tts.pitch, 0.5, 2)
  if (tts.lang) utterance.lang = tts.lang
  const voice = tts.voice ? voices.find((v) => v.name === tts.voice) : undefined
  if (voice) utterance.voice = voice
}
