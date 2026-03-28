// ============================================
// IO-Darts-Agent - Internationalization Types
// ============================================

/**
 * Supported languages
 */
export type SupportedLanguage = 'en' | 'de' | 'es';

/**
 * All supported languages
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'de', 'es'];

/**
 * Default language
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Language metadata
 */
export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

/**
 * All language metadata
 */
export const LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
};

/**
 * Translation keys structure
 */
export interface TranslationKeys {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    back: string;
    next: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    yes: string;
    no: string;
    search: string;
    filter: string;
    reset: string;
    apply: string;
    close: string;
    open: string;
    enabled: string;
    disabled: string;
    on: string;
    off: string;
    name: string;
    description: string;
    status: string;
    actions: string;
    settings: string;
    version: string;
  };

  // Navigation
  nav: {
    dashboard: string;
    modules: string;
    players: string;
    settings: string;
    logout: string;
  };

  // Auth
  auth: {
    login: string;
    logout: string;
    username: string;
    password: string;
    loginButton: string;
    logoutButton: string;
    loginError: string;
    sessionExpired: string;
  };

  // Setup
  setup: {
    title: string;
    welcome: string;
    step1Title: string;
    step1Description: string;
    step2Title: string;
    step2Description: string;
    step3Title: string;
    step3Description: string;
    autodartsEmail: string;
    autodartsPassword: string;
    boardId: string;
    testConnection: string;
    connectionSuccess: string;
    connectionFailed: string;
    enableWebAuth: string;
    webAuthDescription: string;
    completeSetup: string;
  };

  // Dashboard
  dashboard: {
    title: string;
    hubStatus: string;
    connected: string;
    disconnected: string;
    uptime: string;
    modulesRunning: string;
    recentEvents: string;
    noEvents: string;
  };

  // Modules
  modules: {
    title: string;
    installed: string;
    available: string;
    install: string;
    uninstall: string;
    start: string;
    stop: string;
    restart: string;
    configure: string;
    running: string;
    stopped: string;
    error: string;
    noModules: string;
    installFromGit: string;
    installFromLocal: string;
    gitUrl: string;
    localPath: string;
    branch: string;
  };

  // Players
  players: {
    title: string;
    addPlayer: string;
    editPlayer: string;
    deletePlayer: string;
    playerName: string;
    nickname: string;
    avatar: string;
    color: string;
    autodartsLink: string;
    stats: string;
    gamesPlayed: string;
    gamesWon: string;
    winRate: string;
    average: string;
    highScore: string;
    total180s: string;
    bestCheckout: string;
    noPlayers: string;
    deleteConfirm: string;
    moduleSettings: string;
  };

  // Settings
  settings: {
    title: string;
    general: string;
    language: string;
    languageDescription: string;
    appearance: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    autodarts: string;
    autodartsDescription: string;
    webAuth: string;
    webAuthDescription: string;
    server: string;
    serverDescription: string;
    port: string;
    host: string;
    saveSuccess: string;
    saveError: string;
  };

  // WLED Module
  wled: {
    title: string;
    connection: string;
    host: string;
    port: string;
    testConnection: string;
    connectionSuccess: string;
    connectionFailed: string;
    events: string;
    eventActions: string;
    actionType: string;
    preset: string;
    effect: string;
    solidColor: string;
    brightness: string;
    playerColor: string;
    speed: string;
    intensity: string;
    duration: string;
    color: string;
    testAction: string;
    presets: string;
    effects: string;
    noPresetsFound: string;
    noEffectsFound: string;
  };

  // Events
  events: {
    matchStart: string;
    matchFinished: string;
    gameFinished: string;
    throwHit: string;
    throwMiss: string;
    throwHighlight: string;
    throw180: string;
    throwBust: string;
    playerChange: string;
    takeoutStarted: string;
    takeoutFinished: string;
  };

  // Errors
  errors: {
    notFound: string;
    unauthorized: string;
    forbidden: string;
    serverError: string;
    networkError: string;
    validationError: string;
    unknownError: string;
  };

  // Messages
  messages: {
    confirmDelete: string;
    unsavedChanges: string;
    operationSuccess: string;
    operationFailed: string;
  };
}

/**
 * Translation file structure
 */
export type Translations = TranslationKeys;

/**
 * API response for languages
 */
export interface LanguagesResponse {
  current: SupportedLanguage;
  available: LanguageInfo[];
}

/**
 * API request to change language
 */
export interface ChangeLanguageRequest {
  language: SupportedLanguage;
}
