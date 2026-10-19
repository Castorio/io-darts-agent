import { describe, it, expect } from 'vitest'
import {
  localizedText,
  normalizeLocale,
  isSafeExternalUrl,
  sortStoreModules,
  type LocalizedText,
} from './store'
import de from '../i18n/locales/de'
import en from '../i18n/locales/en'

function lookup(messages: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages)
}

describe('normalizeLocale', () => {
  it('passes through a plain de/en locale', () => {
    expect(normalizeLocale('de')).toBe('de')
    expect(normalizeLocale('en')).toBe('en')
  })

  it('strips a region suffix', () => {
    expect(normalizeLocale('de-DE')).toBe('de')
    expect(normalizeLocale('en-US')).toBe('en')
  })

  it('falls back to en for any other language', () => {
    expect(normalizeLocale('es')).toBe('en')
    expect(normalizeLocale('fr-FR')).toBe('en')
    expect(normalizeLocale('')).toBe('en')
  })
})

describe('localizedText', () => {
  const text: LocalizedText = { de: 'Deutsch', en: 'English' }

  it('returns the text for the current UI language', () => {
    expect(localizedText(text, 'de')).toBe('Deutsch')
    expect(localizedText(text, 'en')).toBe('English')
  })

  it('falls back to en for an unsupported language', () => {
    expect(localizedText(text, 'es-ES')).toBe('English')
  })

  it('falls back to en if the de string is missing', () => {
    expect(localizedText({ de: '', en: 'English' }, 'de')).toBe('English')
  })
})

describe('isSafeExternalUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeExternalUrl('https://github.com/user/repo')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
  })

  it('rejects javascript: and other dangerous schemes', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects missing or malformed values', () => {
    expect(isSafeExternalUrl(undefined)).toBe(false)
    expect(isSafeExternalUrl(null)).toBe(false)
    expect(isSafeExternalUrl('')).toBe(false)
    expect(isSafeExternalUrl('not a url')).toBe(false)
  })
})

describe('sortStoreModules', () => {
  it('sorts by category, then by localized name', () => {
    const modules = [
      { id: 'b', name: { de: 'Zebra', en: 'Zebra' }, category: 'lighting' },
      { id: 'a', name: { de: 'Anton', en: 'Anton' }, category: 'lighting' },
      { id: 'c', name: { de: 'Mitte', en: 'Mitte' }, category: 'display' },
    ]
    expect(sortStoreModules(modules, 'de').map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by the localized name for the given locale', () => {
    const modules = [
      { id: 'x', name: { de: 'Zebra', en: 'Apple' }, category: 'misc' },
      { id: 'y', name: { de: 'Anton', en: 'Banana' }, category: 'misc' },
    ]
    expect(sortStoreModules(modules, 'en').map((m) => m.id)).toEqual(['x', 'y'])
    expect(sortStoreModules(modules, 'de').map((m) => m.id)).toEqual(['y', 'x'])
  })

  it('does not mutate the input array', () => {
    const modules = [
      { id: 'b', name: { de: 'B', en: 'B' }, category: 'z' },
      { id: 'a', name: { de: 'A', en: 'A' }, category: 'a' },
    ]
    const copy = [...modules]
    sortStoreModules(modules, 'en')
    expect(modules).toEqual(copy)
  })
})

describe('store i18n keys', () => {
  const keys = [
    'title',
    'subtitle',
    'category',
    'byAuthor',
    'viewRepo',
    'installed',
    'install',
    'installFailed',
    'unavailable',
    'retry',
    'installSuccessHint',
    'viewModule',
    'noModules',
  ]

  it('has German and English labels for every store key', () => {
    for (const key of keys) {
      expect(typeof lookup(de, `store.${key}`), `de store.${key}`).toBe('string')
      expect(typeof lookup(en, `store.${key}`), `en store.${key}`).toBe('string')
    }
  })
})
