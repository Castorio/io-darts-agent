import { createI18n } from 'vue-i18n'
import en from './locales/en'
import de from './locales/de'
import es from './locales/es'

// Get browser language or default to English
function getDefaultLocale(): string {
  const browserLang = navigator.language.split('-')[0]
  const supportedLocales = ['en', 'de', 'es']

  if (supportedLocales.includes(browserLang)) {
    return browserLang
  }

  return 'en'
}

export const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    de,
    es,
  },
})

export default i18n
