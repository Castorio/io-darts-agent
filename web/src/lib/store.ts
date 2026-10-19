/**
 * Pure helpers for the module store page (ModuleStoreView.vue). Catalog
 * content (name, description, homepage, repo) comes from a remote catalog
 * and must be treated as untrusted display data: never rendered as HTML,
 * and only ever linked to when it is a plain http(s) URL.
 */

export interface LocalizedText {
  de: string
  en: string
}

export type SupportedStoreLocale = 'de' | 'en'

/**
 * Normalizes a vue-i18n locale (e.g. "de-DE") to one of the languages the
 * store catalog provides text in, falling back to "en" for anything else.
 */
export function normalizeLocale(locale: string): SupportedStoreLocale {
  const lang = locale.split('-')[0]?.toLowerCase()
  return lang === 'de' ? 'de' : 'en'
}

/**
 * Picks the catalog text for the current UI language, falling back to
 * English when the UI language isn't "de" or the "de" string is empty.
 */
export function localizedText(text: LocalizedText, locale: string): string {
  const lang = normalizeLocale(locale)
  return (lang === 'de' && text.de) || text.en
}

/**
 * Guards against rendering a catalog-supplied link as anything other than a
 * plain http(s) URL (e.g. a "javascript:" or "data:" URL), as defense in
 * depth on top of the hub's own catalog validation.
 */
export function isSafeExternalUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Decides whether a thrown install error means "already installed" (the
 * hub's POST /api/store/:id/install returns 409 for that case), as opposed
 * to any other failure. Duck-typed against the shape of client.ts's
 * APIError (a `statusCode` number on the thrown value) rather than
 * importing that class, so this stays a dependency-free pure function.
 */
export function isAlreadyInstalledError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const statusCode = (error as { statusCode?: unknown }).statusCode
  return statusCode === 409
}

export interface StoreModuleSummary {
  category: string
  name: LocalizedText
}

/**
 * Sorts store modules by category, then by their localized display name, so
 * the catalog renders in a stable, grouped order regardless of the order the
 * catalog JSON happened to list entries in.
 */
export function sortStoreModules<T extends StoreModuleSummary>(modules: T[], locale: string): T[] {
  return [...modules].sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category)
    if (categoryCompare !== 0) return categoryCompare
    return localizedText(a.name, locale).localeCompare(localizedText(b.name, locale))
  })
}
