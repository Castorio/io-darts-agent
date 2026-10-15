import { describe, it, expect } from 'vitest'
import { DARTS_CALLER_DEFAULTS, toDartsCallerForm } from './dartsCallerConfig'
import {
  DEFAULT_DARTS_CALLER_CONFIG,
  normalizeDartsCallerConfig,
} from '../../../modules/darts-caller/src/config'

describe('Darts Caller page config', () => {
  it('uses the same defaults as the hub', () => {
    expect(DARTS_CALLER_DEFAULTS).toEqual(DEFAULT_DARTS_CALLER_CONFIG)
  })

  it('fills missing groups and fields with defaults', () => {
    const form = toDartsCallerForm({ callerType: 'voicepack', callSettings: { scores: false } })
    expect(form.callerType).toBe('voicepack')
    expect(form.callSettings).toEqual({ ...DARTS_CALLER_DEFAULTS.callSettings, scores: false })
    expect(form.ttsSettings).toEqual(DARTS_CALLER_DEFAULTS.ttsSettings)
  })

  it('returns a normalized hub config unchanged', () => {
    const stored = normalizeDartsCallerConfig({
      callerType: 'elevenlabs',
      language: 'de',
      elevenlabsSettings: { voiceId: 'v1', stability: 0.3 },
      callSettings: { checkoutThreshold: 99 },
    })
    expect(toDartsCallerForm(stored)).toEqual(stored)
  })

  it('does not share nested objects with the defaults', () => {
    const form = toDartsCallerForm({})
    form.callSettings.scores = false
    expect(DARTS_CALLER_DEFAULTS.callSettings.scores).toBe(true)
  })

  it('ignores unknown caller types and languages', () => {
    const form = toDartsCallerForm({ callerType: 'custom', language: 'fr' })
    expect(form.callerType).toBe('tts')
    expect(form.language).toBe('en')
  })
})
