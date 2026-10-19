import { describe, it, expect } from 'vitest'
import {
  localizedText,
  normalizeLocale,
  isSafeExternalUrl,
  sortStoreModules,
  isAlreadyInstalledError,
  storeModuleLinks,
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

describe('isAlreadyInstalledError', () => {
  it('recognizes an APIError-shaped 409 (statusCode on the error object)', () => {
    expect(isAlreadyInstalledError({ statusCode: 409, message: 'Module already installed' })).toBe(true)
  })

  it('rejects other status codes', () => {
    expect(isAlreadyInstalledError({ statusCode: 404, message: 'Module not found in store' })).toBe(false)
    expect(isAlreadyInstalledError({ statusCode: 500, message: 'boom' })).toBe(false)
    expect(isAlreadyInstalledError({ statusCode: 503, message: 'unavailable' })).toBe(false)
  })

  it('rejects values that are not error-like objects', () => {
    expect(isAlreadyInstalledError(null)).toBe(false)
    expect(isAlreadyInstalledError(undefined)).toBe(false)
    expect(isAlreadyInstalledError('409')).toBe(false)
    expect(isAlreadyInstalledError(new Error('plain error, no statusCode'))).toBe(false)
    expect(isAlreadyInstalledError({ message: 'no statusCode field' })).toBe(false)
  })
})

describe('storeModuleLinks', () => {
  it('always returns the repo link when it is safe', () => {
    const links = storeModuleLinks({ repo: 'https://github.com/user/repo' })
    expect(links.repo).toBe('https://github.com/user/repo')
    expect(links.homepage).toBeNull()
  })

  it('returns both the repo and homepage links when both are safe', () => {
    const links = storeModuleLinks({
      repo: 'https://github.com/user/repo',
      homepage: 'https://example.com',
    })
    expect(links.repo).toBe('https://github.com/user/repo')
    expect(links.homepage).toBe('https://example.com')
  })

  it('omits the homepage link when none is set', () => {
    const links = storeModuleLinks({ repo: 'https://github.com/user/repo', homepage: undefined })
    expect(links.homepage).toBeNull()
  })

  it('drops an unsafe homepage without affecting the repo link', () => {
    const links = storeModuleLinks({
      repo: 'https://github.com/user/repo',
      homepage: 'javascript:alert(1)',
    })
    expect(links.repo).toBe('https://github.com/user/repo')
    expect(links.homepage).toBeNull()
  })

  it('drops an unsafe repo without affecting the homepage link', () => {
    const links = storeModuleLinks({
      repo: 'javascript:alert(1)',
      homepage: 'https://example.com',
    })
    expect(links.repo).toBeNull()
    expect(links.homepage).toBe('https://example.com')
  })
})

describe('store i18n keys', () => {
  const keys = [
    'title',
    'subtitle',
    'openStore',
    'backToModules',
    'category',
    'byAuthor',
    'viewRepo',
    'viewHomepage',
    'installed',
    'install',
    'installing',
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
