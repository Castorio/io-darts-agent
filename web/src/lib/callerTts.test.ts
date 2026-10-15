import { describe, it, expect } from 'vitest'
import { applyCallerTts, type UtteranceLike } from './callerTts'

function utterance(): UtteranceLike {
  return { volume: 1, rate: 1, pitch: 1, lang: '', voice: null }
}

const voices = [
  { name: 'Anna', lang: 'de-DE' },
  { name: 'Daniel', lang: 'en-GB' },
] as unknown as SpeechSynthesisVoice[]

describe('applyCallerTts', () => {
  it('applies rate, pitch, volume, language and the named voice', () => {
    const u = utterance()
    applyCallerTts(u, { voice: 'Anna', rate: 1.4, pitch: 0.8, volume: 40, lang: 'de-DE' }, voices, 0.8)
    expect(u).toEqual({ volume: 0.4, rate: 1.4, pitch: 0.8, lang: 'de-DE', voice: voices[0] })
  })

  it('keeps the browser default voice when the named voice is missing', () => {
    const u = utterance()
    applyCallerTts(u, { voice: 'Nobody', rate: 1, pitch: 1, volume: 100, lang: 'en-GB' }, voices, 0.8)
    expect(u.voice).toBeNull()
    expect(u.lang).toBe('en-GB')
  })

  it('uses the fallback volume and neutral values without settings', () => {
    const u = utterance()
    applyCallerTts(u, undefined, voices, 0.8)
    expect(u).toEqual({ volume: 0.8, rate: 1, pitch: 1, lang: '', voice: null })
  })

  it('clamps out of range values', () => {
    const u = utterance()
    applyCallerTts(u, { voice: '', rate: 9, pitch: 0, volume: 250, lang: '' }, voices, 0.8)
    expect(u.rate).toBe(2)
    expect(u.pitch).toBe(0.5)
    expect(u.volume).toBe(1)
  })
})
