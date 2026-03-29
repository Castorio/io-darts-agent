import { createI18n } from 'vue-i18n'
import de from './locales/de'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import it from './locales/it'
import ja from './locales/ja'
import nl from './locales/nl'
import ru from './locales/ru'
import uk from './locales/uk'
import zh from './locales/zh'

export type SupportedLocale = 'de' | 'en' | 'es' | 'fr' | 'it' | 'ja' | 'nl' | 'ru' | 'uk' | 'zh'

export const SUPPORTED_LOCALES: { code: SupportedLocale; name: string; flag: string }[] = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
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
    fr,
    it,
    ja,
    nl,
    ru,
    uk,
    zh,
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
