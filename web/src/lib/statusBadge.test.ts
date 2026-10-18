import { describe, it, expect } from 'vitest'
import { STATUS_KINDS, statusLabelKey } from './statusBadge'
import de from '../i18n/locales/de'
import en from '../i18n/locales/en'

function lookup(messages: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages)
}

describe('statusLabelKey', () => {
  it('maps every badge status to a translation key', () => {
    expect(statusLabelKey('stopped')).toBe('status.stopped')
    expect(statusLabelKey('disconnected')).toBe('status.disconnected')
  })

  it('falls back to stopped for an unknown status', () => {
    expect(statusLabelKey('weird' as never)).toBe('status.stopped')
  })

  it('has German and English labels for every status', () => {
    for (const kind of STATUS_KINDS) {
      expect(typeof lookup(de, statusLabelKey(kind)), `de ${kind}`).toBe('string')
      expect(typeof lookup(en, statusLabelKey(kind)), `en ${kind}`).toBe('string')
    }
    expect(lookup(de, 'status.stopped')).toBe('Gestoppt')
    expect(lookup(de, 'status.disconnected')).toBe('Getrennt')
    expect(lookup(en, 'status.disconnected')).toBe('Disconnected')
  })
})
