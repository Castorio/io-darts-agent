import { createI18n } from 'vue-i18n'
import de from './locales/de'
import en from './locales/en'
import es from './locales/es'

export type SupportedLocale = 'de' | 'en' | 'es'

export const SUPPORTED_LOCALES: { code: SupportedLocale; name: string; flag: string }[] = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
]

// Get saved locale from localStorage or detect from browser
function getDefaultLocale(): SupportedLocale {
  // Check localStorage first
  const saved = localStorage.getItem('locale')
  if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
    return saved as SupportedLocale
  }

  // Try to detect from browser
  const browserLang = navigator.language.split('-')[0]
  if (SUPPORTED_LOCALES.some((l) => l.code === browserLang)) {
    return browserLang as SupportedLocale
  }

  // Default to German
  return 'de'
}

const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    de,
    en,
    es,
  },
})

export function setLocale(locale: SupportedLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = locale
}

export function getLocale(): SupportedLocale {
  return i18n.global.locale.value as SupportedLocale
}

export default i18n
