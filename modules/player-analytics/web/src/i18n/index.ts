import { createI18n } from 'vue-i18n'
import en from './locales/en'
import de from './locales/de'

const i18n = createI18n({
  legacy: false,
  locale: navigator.language.split('-')[0] || 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    de,
  },
})

export default i18n
