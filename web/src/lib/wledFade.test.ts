import { describe, it, expect } from 'vitest'
import * as web from './wledFade'
import * as hub from '../../../modules/wled/src/fade'

const samples: unknown[] = [undefined, null, '', 'abc', '700', -1, 0, 2, 5, 10, 20, 50, 99, 100, 101, 149, 150, 1500, 10000, 65500, 1e9, Number.NaN]

describe('web WLED fade helpers', () => {
  it('match the hub implementation for every sample value', () => {
    expect(web.FADE_TIME_UNIT).toBe(hub.FADE_TIME_UNIT)
    expect(web.MAX_FADE_MS).toBe(hub.MAX_FADE_MS)
    for (const v of samples) {
      expect(web.sanitizeFadeMs(v), String(v)).toBe(hub.sanitizeFadeMs(v))
      expect(web.migrateLegacyActionFade(v), String(v)).toBe(hub.migrateLegacyActionFade(v))
    }
  })

  it('normalize configs exactly like the hub', () => {
    const configs = [
      {},
      { fadeTime: 700, events: { a: { actionType: 'solid', fadeTime: 50 }, b: { actionType: 'none' } } },
      { fadeTimeUnit: 'ms' as const, events: { a: { actionType: 'solid', fadeTime: 50 } } },
      { fadeTime: -1, events: { a: { actionType: 'solid', fadeTime: 'x' } } },
      { fadeTime: 0, events: {} },
      { fadeTimeUnit: 'ms' as const, fadeTime: 0 },
      { fadeTimeUnit: 'ms' as const, fadeTime: null },
    ]
    for (const c of configs) {
      expect(web.normalizeWledConfig(c as never)).toEqual(hub.normalizeWledConfig(c as never))
    }
  })

  it('offers fade presets whose labels match their millisecond values', () => {
    const byLabel = Object.fromEntries(web.FADE_PRESETS_MS.map((p) => [p.label, p.value]))
    expect(byLabel['0.2s']).toBe(200)
    expect(byLabel['0.5s']).toBe(500)
    expect(byLabel['1s']).toBe(1000)
    expect(byLabel['2s']).toBe(2000)
    expect(byLabel['5s']).toBe(5000)
    expect(hub.toWledTransition(byLabel['5s'] as number)).toBe(50)
  })

  it('formats milliseconds as seconds for the editor', () => {
    expect(web.formatSeconds(5000)).toBe('5s')
    expect(web.formatSeconds(200)).toBe('0.2s')
    expect(web.formatSeconds(1500)).toBe('1.5s')
  })

  it('reads the global fade field: empty means WLED default, 0 means instant', () => {
    expect(web.parseGlobalFadeInput('')).toBeUndefined()
    expect(web.parseGlobalFadeInput(undefined)).toBeUndefined()
    expect(web.parseGlobalFadeInput(null)).toBeUndefined()
    expect(web.parseGlobalFadeInput(0)).toBe(0)
    expect(web.parseGlobalFadeInput('0')).toBe(0)
    expect(web.parseGlobalFadeInput(700)).toBe(700)
    expect(web.parseGlobalFadeInput(-5)).toBeUndefined()
  })
})
