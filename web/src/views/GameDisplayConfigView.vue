<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { usePlayersStore } from '../stores/players'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import MediaUpload from '../components/MediaUpload.vue'
import AnimationGenerator from '../components/AnimationGenerator.vue'
import StatusBadge from '../components/StatusBadge.vue'

// Player animation override interface
interface PlayerAnimationOverride {
  playerId?: string
  playerName: string
  throw180?: {
    enabled?: boolean
    type?: 'builtin' | 'gif' | 'video' | 'none'
    mediaUrl?: string
    soundUrl?: string
  }
  legWin?: {
    enabled?: boolean
    type?: 'builtin' | 'gif' | 'video' | 'none'
    mediaUrl?: string
    soundUrl?: string
  }
  matchWin?: {
    enabled?: boolean
    type?: 'builtin' | 'gif' | 'video' | 'none'
    mediaUrl?: string
    soundUrl?: string
  }
  checkout?: {
    enabled?: boolean
    type?: 'builtin' | 'gif' | 'video' | 'none'
    mediaUrl?: string
    soundUrl?: string
  }
}

const route = useRoute()
const modulesStore = useModulesStore()
const playersStore = usePlayersStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Configuration state - loaded dynamically from module
const config = ref<Record<string, unknown>>({})

// UI state
const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const actionLoading = ref(false)

// Tab state
const activeTab = ref<'display' | 'animations' | 'players'>('display')

// Player override modal state
const selectedPlayerOverride = ref<string | null>(null)
const showPlayerOverrideModal = ref(false)
const selectedAnimationType = ref<'throw180' | 'legWin' | 'matchWin' | 'checkout'>('throw180')

// Current language for i18n
const currentLang = computed(() => {
  const browserLang = navigator.language.split('-')[0]
  return ['de', 'en', 'es'].includes(browserLang) ? browserLang : 'de'
})

// i18n translations from module.json
const i18n = computed(() => {
  const translations = module.value?.i18n as Record<string, {
    name?: string
    description?: string
    config?: Record<string, { label?: string; description?: string; options?: Record<string, string> }>
    strings?: Record<string, string>
  }> | undefined

  const lang = currentLang.value
  const t = translations?.[lang] || translations?.['en'] || {}

  return {
    name: t.name || module.value?.name || 'Game Display',
    description: t.description || module.value?.description || '',
    config: t.config || {},
    strings: {
      backToModule: lang === 'de' ? 'Zurück zum Modul' : lang === 'es' ? 'Volver al Módulo' : 'Back to Module',
      configuration: lang === 'de' ? 'Konfiguration' : lang === 'es' ? 'Configuración' : 'Configuration',
      displayPreview: lang === 'de' ? 'Display Vorschau' : lang === 'es' ? 'Vista Previa' : 'Display Preview',
      displayPreviewDesc: lang === 'de' ? 'So sieht das Display auf externen Bildschirmen aus' : lang === 'es' ? 'Así se ve la pantalla en monitores externos' : 'This is how the display looks on external screens',
      openInNewWindow: lang === 'de' ? 'Im neuen Fenster öffnen' : lang === 'es' ? 'Abrir en nueva ventana' : 'Open in new window',
      copyUrl: lang === 'de' ? 'URL kopieren' : lang === 'es' ? 'Copiar URL' : 'Copy URL',
      openDisplay: lang === 'de' ? 'Display öffnen' : lang === 'es' ? 'Abrir pantalla' : 'Open Display',
      save: lang === 'de' ? 'Speichern' : lang === 'es' ? 'Guardar' : 'Save',
      saved: lang === 'de' ? 'Konfiguration gespeichert!' : lang === 'es' ? '¡Configuración guardada!' : 'Configuration saved!',
      saveError: lang === 'de' ? 'Fehler beim Speichern' : lang === 'es' ? 'Error al guardar' : 'Error saving',
      urlCopied: lang === 'de' ? 'URL kopiert!' : lang === 'es' ? '¡URL copiada!' : 'URL copied!',
      copyFailed: lang === 'de' ? 'Kopieren fehlgeschlagen' : lang === 'es' ? 'Error al copiar' : 'Copy failed',
      start: lang === 'de' ? 'Starten' : lang === 'es' ? 'Iniciar' : 'Start',
      stop: lang === 'de' ? 'Stoppen' : lang === 'es' ? 'Detener' : 'Stop',
      animations: lang === 'de' ? 'Animationen' : lang === 'es' ? 'Animaciones' : 'Animations',
      animationsDesc: lang === 'de' ? 'GIF- oder Video-Animationen für besondere Ereignisse' : lang === 'es' ? 'Animaciones GIF o video para eventos especiales' : 'GIF or video animations for special events',
      winAnimationOptions: lang === 'de' ? 'Win Animation Optionen' : lang === 'es' ? 'Opciones de Animación de Victoria' : 'Win Animation Display Options',
      winAnimationOverlayInfo: lang === 'de' ? 'Diese Optionen erscheinen als Overlay über dem GIF/Video' : lang === 'es' ? 'Estas opciones aparecen como superposición sobre el GIF/Video' : 'These options appear as overlay on top of the GIF/Video',
      usage: lang === 'de' ? 'Verwendung' : lang === 'es' ? 'Uso' : 'Usage',
      step1Title: lang === 'de' ? 'Display öffnen' : lang === 'es' ? 'Abrir pantalla' : 'Open display',
      step1Desc: lang === 'de' ? 'Klicken Sie auf "Display öffnen" oder kopieren Sie die URL und öffnen Sie diese auf einem externen Bildschirm.' : lang === 'es' ? 'Haga clic en "Abrir pantalla" o copie la URL y ábrala en un monitor externo.' : 'Click "Open Display" or copy the URL and open it on an external screen.',
      step2Title: lang === 'de' ? 'Spiel starten' : lang === 'es' ? 'Iniciar juego' : 'Start game',
      step2Desc: lang === 'de' ? 'Starten Sie ein Match in Autodarts. Das Display aktualisiert sich automatisch in Echtzeit.' : lang === 'es' ? 'Inicie un partido en Autodarts. La pantalla se actualiza automáticamente en tiempo real.' : 'Start a match in Autodarts. The display updates automatically in real-time.',
      step3Title: lang === 'de' ? 'Spielen!' : lang === 'es' ? '¡Jugar!' : 'Play!',
      step3Desc: lang === 'de' ? 'Der aktuelle Punktestand, Checkout-Vorschläge und alle Würfe werden live angezeigt.' : lang === 'es' ? 'La puntuación actual, sugerencias de checkout y todos los lanzamientos se muestran en vivo.' : 'The current score, checkout suggestions and all throws are displayed live.',
      clickPreview: lang === 'de' ? 'Klicken Sie auf die Vorschau oder nutzen Sie den Button oben, um das Display in einem neuen Fenster zu öffnen. Sie können die URL auch auf einem anderen Gerät im selben Netzwerk öffnen.' : lang === 'es' ? 'Haga clic en la vista previa o use el botón de arriba para abrir la pantalla en una nueva ventana. También puede abrir la URL en otro dispositivo de la misma red.' : 'Click on the preview or use the button above to open the display in a new window. You can also open the URL on another device on the same network.',
      // Tab labels
      tabDisplay: lang === 'de' ? 'Display' : lang === 'es' ? 'Pantalla' : 'Display',
      tabAnimations: lang === 'de' ? 'Animationen' : lang === 'es' ? 'Animaciones' : 'Animations',
      tabPlayers: lang === 'de' ? 'Spieler' : lang === 'es' ? 'Jugadores' : 'Players',
      // Player overrides
      playerAnimations: lang === 'de' ? 'Spieler-Animationen' : lang === 'es' ? 'Animaciones de Jugadores' : 'Player Animations',
      playerAnimationsDesc: lang === 'de' ? 'Individuelle Animationen pro Spieler - werden angezeigt wenn der Spieler am Zug ist' : lang === 'es' ? 'Animaciones individuales por jugador - se muestran cuando es el turno del jugador' : 'Individual animations per player - shown when player is active',
      customAnimationsActive: lang === 'de' ? 'Individuelle Animationen aktiv' : lang === 'es' ? 'Animaciones personalizadas activas' : 'Custom animations active',
      usingDefaultAnimations: lang === 'de' ? 'Verwendet Standard-Animationen' : lang === 'es' ? 'Usando animaciones predeterminadas' : 'Using default animations',
      configure: lang === 'de' ? 'Konfigurieren' : lang === 'es' ? 'Configurar' : 'Configure',
      playerSettings: lang === 'de' ? 'Spieler-Einstellungen' : lang === 'es' ? 'Configuración del Jugador' : 'Player Settings',
      noPlayers: lang === 'de' ? 'Keine Spieler vorhanden.' : lang === 'es' ? 'No hay jugadores.' : 'No players found.',
      createPlayers: lang === 'de' ? 'Spieler erstellen' : lang === 'es' ? 'Crear jugadores' : 'Create players',
      animationType: lang === 'de' ? 'Animationstyp' : lang === 'es' ? 'Tipo de animación' : 'Animation type',
      animation180: lang === 'de' ? '180 Animation' : lang === 'es' ? 'Animación 180' : '180 Animation',
      animationLegWin: lang === 'de' ? 'Leg Gewonnen' : lang === 'es' ? 'Leg Ganado' : 'Leg Won',
      animationMatchWin: lang === 'de' ? 'Match Gewonnen' : lang === 'es' ? 'Match Ganado' : 'Match Won',
      animationCheckout: lang === 'de' ? 'Checkout' : lang === 'es' ? 'Checkout' : 'Checkout',
      mediaUrl: lang === 'de' ? 'GIF/Video URL' : lang === 'es' ? 'URL de GIF/Video' : 'GIF/Video URL',
      soundUrl: lang === 'de' ? 'Sound URL' : lang === 'es' ? 'URL de Sonido' : 'Sound URL',
      useBuiltin: lang === 'de' ? 'Standard' : lang === 'es' ? 'Predeterminado' : 'Built-in',
      useGif: lang === 'de' ? 'GIF' : lang === 'es' ? 'GIF' : 'GIF',
      useVideo: lang === 'de' ? 'Video' : lang === 'es' ? 'Video' : 'Video',
      useNone: lang === 'de' ? 'Keine' : lang === 'es' ? 'Ninguna' : 'None',
      ...t.strings
    }
  }
})

// Config schema from module.json
const configSchema = computed(() => {
  return (module.value?.config?.schema || module.value?.config || {}) as Record<string, ConfigField>
})

// Get translated label for a config field
function getConfigLabel(key: string): string {
  return i18n.value.config[key]?.label || configSchema.value[key]?.label || key
}

// Get translated description for a config field
function getConfigDescription(key: string): string | undefined {
  return i18n.value.config[key]?.description || configSchema.value[key]?.description
}

// Get translated option label for select fields
function getOptionLabel(fieldKey: string, optionValue: string): string {
  const i18nOptions = i18n.value.config[fieldKey]?.options
  if (i18nOptions && i18nOptions[optionValue]) {
    return i18nOptions[optionValue]
  }
  const field = configSchema.value[fieldKey]
  if (field?.type === 'select' && field.options) {
    const option = field.options.find((o: { value: string | number }) => o.value === optionValue)
    return option?.label || optionValue
  }
  return optionValue
}

// Check if field should be shown based on showIf condition
function shouldShowField(field: ConfigField): boolean {
  if (!field.showIf) return true
  const { field: dependentField, value: expectedValue } = field.showIf
  // Get actual value, falling back to schema default if not set
  let actualValue = config.value[dependentField]
  if (actualValue === undefined) {
    actualValue = configSchema.value[dependentField]?.default
  }
  if (Array.isArray(expectedValue)) {
    return expectedValue.includes(actualValue)
  }
  return actualValue === expectedValue
}

// Type definitions for config fields
interface ConfigField {
  type: string
  label?: string
  description?: string
  default?: unknown
  showIf?: { field: string; value: unknown }
  options?: Array<{ value: string | number; label: string }>
  min?: number
  max?: number
  step?: number
  fields?: Record<string, ConfigField>
}

// Get sorted basic fields (non-animation, non-group fields)
const basicFields = computed(() => {
  const entries = Object.entries(configSchema.value)
  return entries.filter(([key, field]) => {
    // Exclude animation groups and player-specific settings
    if (key.startsWith('animation') && field.type === 'group') return false
    if (key === 'defaultAnimations' || key === 'playerAnimations') return false
    return shouldShowField(field)
  })
})

// Get animation group fields
const animationFields = computed(() => {
  const entries = Object.entries(configSchema.value)
  return entries.filter(([key, field]) => {
    if (!key.startsWith('animation') || field.type !== 'group') return false
    if (key === 'animationsEnabled') return false
    return shouldShowField(field)
  })
})

// Check if an animation group is a win animation
function isWinAnimation(key: string): boolean {
  return key === 'animationLegWin' || key === 'animationMatchWin' || key === 'animationSetWin'
}

// Load config from module
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      config.value = { ...values }
    }
  },
  { immediate: true }
)

// Get value with default fallback
function getValue(key: string): unknown {
  if (config.value[key] !== undefined) {
    return config.value[key]
  }
  return configSchema.value[key]?.default
}

// Update a single value
function updateValue(key: string, value: unknown) {
  config.value = { ...config.value, [key]: value }
}

// Get nested group value
function getGroupValue(groupKey: string, fieldKey: string): unknown {
  const groupValue = config.value[groupKey] as Record<string, unknown> | undefined
  if (groupValue && groupValue[fieldKey] !== undefined) {
    return groupValue[fieldKey]
  }
  const groupSchema = configSchema.value[groupKey]
  if (groupSchema?.type === 'group' && groupSchema.fields) {
    return groupSchema.fields[fieldKey]?.default
  }
  return undefined
}

// Update nested group value
function updateGroupValue(groupKey: string, fieldKey: string, value: unknown) {
  const groupValue = (config.value[groupKey] as Record<string, unknown>) || {}
  const newGroupValue = { ...groupValue, [fieldKey]: value }
  updateValue(groupKey, newGroupValue)
}

// Save configuration
async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    await modulesStore.updateConfig(module.value.id, config.value)
    saveMessage.value = { type: 'success', text: i18n.value.strings.saved }
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (e) {
    saveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : i18n.value.strings.saveError,
    }
  } finally {
    isSaving.value = false
  }
}

// Handle AI-generated animation ready
function onAnimationReady(eventType: string, url: string) {
  const animationKey = `animation${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`
  const currentGroup = (config.value[animationKey] as Record<string, unknown>) || {}
  updateValue(animationKey, {
    ...currentGroup,
    type: 'gif',
    mediaUrl: url
  })
  saveMessage.value = { type: 'success', text: `Animation für "${eventType}" hinzugefügt!` }
  setTimeout(() => {
    saveMessage.value = null
  }, 3000)
}

// Player animation override helpers
function getPlayerAnimations(): PlayerAnimationOverride[] {
  return (config.value.playerAnimations as PlayerAnimationOverride[]) || []
}

function hasPlayerOverride(playerName: string): boolean {
  const overrides = getPlayerAnimations()
  const override = overrides.find(p => p.playerName === playerName)
  if (!override) return false
  // Check if any animation is configured
  return !!(
    (override.throw180?.type && override.throw180.type !== 'none') ||
    (override.legWin?.type && override.legWin.type !== 'none') ||
    (override.matchWin?.type && override.matchWin.type !== 'none') ||
    (override.checkout?.type && override.checkout.type !== 'none')
  )
}

function openPlayerOverrideEditor(playerName: string) {
  selectedPlayerOverride.value = playerName
  selectedAnimationType.value = 'throw180'
  showPlayerOverrideModal.value = true
}

function closePlayerOverrideModal() {
  showPlayerOverrideModal.value = false
  selectedPlayerOverride.value = null
}

function updatePlayerAnimationField(
  playerName: string,
  animType: 'throw180' | 'legWin' | 'matchWin' | 'checkout',
  field: string,
  value: unknown
) {
  const overrides = [...getPlayerAnimations()]
  let override = overrides.find(p => p.playerName === playerName)
  if (!override) {
    override = { playerName }
    overrides.push(override)
  }
  if (!override[animType]) {
    override[animType] = {}
  }
  (override[animType] as Record<string, unknown>)[field] = value
  config.value = { ...config.value, playerAnimations: overrides }
}

function getPlayerAnimationField(
  playerName: string,
  animType: 'throw180' | 'legWin' | 'matchWin' | 'checkout',
  field: string
): unknown {
  const override = getPlayerAnimations().find(p => p.playerName === playerName)
  if (!override || !override[animType]) return undefined
  return (override[animType] as Record<string, unknown>)[field]
}

function removePlayerOverride(playerName: string) {
  const overrides = getPlayerAnimations().filter(p => p.playerName !== playerName)
  config.value = { ...config.value, playerAnimations: overrides }
}

// Open display in new window
function openDisplay() {
  const displayUrl = `${window.location.origin}/module-ui/game-display/`
  window.open(displayUrl, 'GameDisplay', 'width=1920,height=1080')
}

// Copy display URL
async function copyDisplayUrl() {
  const displayUrl = `${window.location.origin}/module-ui/game-display/`
  try {
    await navigator.clipboard.writeText(displayUrl)
    saveMessage.value = { type: 'success', text: i18n.value.strings.urlCopied }
    setTimeout(() => {
      saveMessage.value = null
    }, 2000)
  } catch {
    saveMessage.value = { type: 'error', text: i18n.value.strings.copyFailed }
  }
}

// Module control
async function startModule() {
  if (!module.value) return
  actionLoading.value = true
  try {
    await modulesStore.startModule(module.value.id)
  } finally {
    actionLoading.value = false
  }
}

async function stopModule() {
  if (!module.value) return
  actionLoading.value = true
  try {
    await modulesStore.stopModule(module.value.id)
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  modulesStore.fetchModule(moduleId.value)
  playersStore.fetchPlayers()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Back Link -->
      <router-link
        :to="`/modules/${moduleId}`"
        class="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        {{ i18n.strings.backToModule }}
      </router-link>

      <!-- Loading State -->
      <div v-if="modulesStore.isLoading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-autodarts-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <!-- Module Content -->
      <template v-else-if="module">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div
              :class="[
                'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                module.status === 'running' ? 'bg-autodarts-500/20' : 'bg-dark-700',
              ]"
            >
              <!-- Display Icon -->
              <svg
                :class="['w-8 h-8', module.status === 'running' ? 'text-autodarts-400' : 'text-dark-400']"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-2xl font-bold text-white">{{ i18n.name }}</h1>
                <StatusBadge :status="module.status" />
              </div>
              <p class="text-dark-400 mt-1">{{ i18n.description }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <BaseButton variant="secondary" @click="copyDisplayUrl">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              {{ i18n.strings.copyUrl }}
            </BaseButton>
            <BaseButton @click="openDisplay">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {{ i18n.strings.openDisplay }}
            </BaseButton>
            <BaseButton
              v-if="module.status === 'running'"
              variant="secondary"
              :loading="actionLoading"
              @click="stopModule"
            >
              {{ i18n.strings.stop }}
            </BaseButton>
            <BaseButton
              v-else
              :loading="actionLoading"
              @click="startModule"
            >
              {{ i18n.strings.start }}
            </BaseButton>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 border-b border-dark-700 pb-1">
          <button
            v-for="tab in [
              { id: 'display', label: i18n.strings.tabDisplay, icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { id: 'animations', label: i18n.strings.tabAnimations, icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'players', label: i18n.strings.tabPlayers, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' }
            ]"
            :key="tab.id"
            @click="activeTab = tab.id as 'display' | 'animations' | 'players'"
            :class="[
              'flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-dark-700 text-white border-b-2 border-autodarts-500'
                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
            ]"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
            </svg>
            {{ tab.label }}
          </button>
        </div>

        <!-- Display Tab -->
        <template v-if="activeTab === 'display'">
          <!-- Display Preview -->
        <BaseCard :title="i18n.strings.displayPreview" :subtitle="i18n.strings.displayPreviewDesc">
          <div class="relative rounded-xl overflow-hidden border border-dark-600 bg-dark-900">
            <!-- Preview Frame -->
            <div class="aspect-video relative">
              <iframe
                src="/module-ui/game-display/"
                class="absolute inset-0 w-full h-full"
                style="pointer-events: none;"
              />
              <!-- Overlay for click handling -->
              <div
                class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                @click="openDisplay"
              >
                <div class="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span class="text-white font-medium">{{ i18n.strings.openInNewWindow }}</span>
                </div>
              </div>
            </div>
          </div>
          <p class="text-sm text-dark-400 mt-3">
            {{ i18n.strings.clickPreview }}
          </p>
        </BaseCard>

        <!-- Configuration -->
        <BaseCard :title="i18n.strings.configuration">
          <form @submit.prevent="saveConfig" class="space-y-6">
            <!-- Dynamic Basic Fields -->
            <template v-for="[key, field] in basicFields" :key="key">
              <!-- String Field -->
              <div v-if="field.type === 'string' && !key.toLowerCase().includes('url')">
                <BaseInput
                  :model-value="(getValue(key) as string) || ''"
                  @update:model-value="updateValue(key, $event)"
                  :label="getConfigLabel(key)"
                />
                <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-1">
                  {{ getConfigDescription(key) }}
                </p>
              </div>

              <!-- URL/Media Field -->
              <div v-else-if="field.type === 'string' && key.toLowerCase().includes('url')">
                <MediaUpload
                  :model-value="(getValue(key) as string) || ''"
                  @update:model-value="updateValue(key, $event)"
                  :label="getConfigLabel(key)"
                  :media-type="key.toLowerCase().includes('sound') ? 'sound' : 'image'"
                />
                <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-1">
                  {{ getConfigDescription(key) }}
                </p>
              </div>

              <!-- Select Field -->
              <div v-else-if="field.type === 'select'">
                <label class="block text-sm font-medium text-dark-200 mb-3">{{ getConfigLabel(key) }}</label>
                <div :class="['grid gap-3', field.options && field.options.length <= 3 ? `grid-cols-${field.options.length}` : 'grid-cols-2 md:grid-cols-3']">
                  <button
                    v-for="option in field.options"
                    :key="option.value"
                    type="button"
                    @click="updateValue(key, option.value)"
                    :class="[
                      'px-4 py-4 rounded-lg border-2 text-center transition-all',
                      getValue(key) === option.value
                        ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                        : 'border-dark-600 text-dark-400 hover:border-dark-500',
                    ]"
                  >
                    {{ getOptionLabel(key, String(option.value)) }}
                  </button>
                </div>
                <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-2">
                  {{ getConfigDescription(key) }}
                </p>
              </div>

              <!-- Boolean Field -->
              <div v-else-if="field.type === 'boolean'" class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <div>
                  <p class="text-white font-medium">{{ getConfigLabel(key) }}</p>
                  <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-1">
                    {{ getConfigDescription(key) }}
                  </p>
                </div>
                <button
                  type="button"
                  @click="updateValue(key, !getValue(key))"
                  :class="[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    getValue(key) ? 'bg-autodarts-600' : 'bg-dark-600',
                  ]"
                >
                  <span
                    :class="[
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      getValue(key) ? 'translate-x-6' : 'translate-x-1',
                    ]"
                  />
                </button>
              </div>

              <!-- Number Field (Range) -->
              <div v-else-if="field.type === 'number' && field.max">
                <label class="block text-sm font-medium text-dark-200 mb-2">
                  {{ getConfigLabel(key) }}:
                  <span v-if="key.includes('Duration')">
                    {{ (getValue(key) as number) === 0 ? 'Unbegrenzt' : ((getValue(key) as number) / 1000) + 's' }}
                  </span>
                  <span v-else>{{ getValue(key) }}</span>
                </label>
                <input
                  type="range"
                  :value="getValue(key) as number"
                  @input="updateValue(key, Number(($event.target as HTMLInputElement).value))"
                  :min="field.min ?? 0"
                  :max="field.max"
                  :step="field.step ?? (key.includes('Duration') ? 1000 : 1)"
                  class="w-full accent-autodarts-500"
                />
                <div class="flex justify-between text-sm text-dark-400 mt-1">
                  <span>{{ key.includes('Duration') && field.min === 0 ? 'Unbegrenzt' : (field.min ?? 0) }}</span>
                  <span>{{ key.includes('Duration') ? ((field.max || 0) / 1000) + 's' : field.max }}</span>
                </div>
                <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-1">
                  {{ getConfigDescription(key) }}
                </p>
              </div>

              <!-- Number Field (Input) -->
              <div v-else-if="field.type === 'number'">
                <label class="block text-sm font-medium text-dark-200 mb-2">
                  {{ getConfigLabel(key) }}
                </label>
                <input
                  type="number"
                  :value="getValue(key) as number"
                  @input="updateValue(key, Number(($event.target as HTMLInputElement).value))"
                  :min="field.min"
                  :step="field.step ?? 1"
                  class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                />
                <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-1">
                  {{ getConfigDescription(key) }}
                </p>
              </div>

              <!-- Color Field -->
              <div v-else-if="field.type === 'color'">
                <label class="block text-sm font-medium text-dark-200 mb-2">{{ getConfigLabel(key) }}</label>
                <div class="flex items-center gap-3">
                  <input
                    type="color"
                    :value="getValue(key) as string"
                    @input="updateValue(key, ($event.target as HTMLInputElement).value)"
                    class="w-12 h-10 rounded-lg cursor-pointer border border-dark-600 bg-transparent"
                  />
                  <input
                    type="text"
                    :value="getValue(key) as string"
                    @input="updateValue(key, ($event.target as HTMLInputElement).value)"
                    placeholder="#0a0a0f"
                    class="flex-1 px-4 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 font-mono text-sm"
                  />
                  <button
                    type="button"
                    @click="updateValue(key, field.default as string)"
                    class="px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-400 hover:text-white hover:border-dark-500 transition-colors text-sm"
                  >
                    Reset
                  </button>
                </div>
                <p v-if="getConfigDescription(key)" class="text-sm text-dark-400 mt-1">
                  {{ getConfigDescription(key) }}
                </p>
              </div>
            </template>

            <!-- Save Message -->
            <div
              v-if="saveMessage"
              :class="[
                'p-3 rounded-lg',
                saveMessage.type === 'success'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400',
              ]"
            >
              {{ saveMessage.text }}
            </div>

            <!-- Save Button -->
            <div class="flex justify-end">
              <BaseButton type="submit" :loading="isSaving">
                {{ i18n.strings.save }}
              </BaseButton>
            </div>
          </form>
        </BaseCard>

        <!-- Usage Info -->
        <BaseCard :title="i18n.strings.usage">
          <div class="space-y-4">
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-lg bg-autodarts-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-autodarts-400 font-bold">1</span>
              </div>
              <div>
                <p class="text-white font-medium">{{ i18n.strings.step1Title }}</p>
                <p class="text-dark-400 text-sm mt-1">
                  {{ i18n.strings.step1Desc }}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-lg bg-autodarts-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-autodarts-400 font-bold">2</span>
              </div>
              <div>
                <p class="text-white font-medium">{{ i18n.strings.step2Title }}</p>
                <p class="text-dark-400 text-sm mt-1">
                  {{ i18n.strings.step2Desc }}
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-lg bg-autodarts-500/20 flex items-center justify-center flex-shrink-0">
                <span class="text-autodarts-400 font-bold">3</span>
              </div>
              <div>
                <p class="text-white font-medium">{{ i18n.strings.step3Title }}</p>
                <p class="text-dark-400 text-sm mt-1">
                  {{ i18n.strings.step3Desc }}
                </p>
              </div>
            </div>
          </div>
        </BaseCard>
        </template>

        <!-- Animations Tab -->
        <template v-if="activeTab === 'animations'">
        <!-- Animations Configuration -->
        <BaseCard :title="i18n.strings.animations" :subtitle="i18n.strings.animationsDesc">
          <!-- Enable Animations Toggle -->
          <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600 mb-6">
            <div>
              <p class="text-white font-medium">{{ getConfigLabel('animationsEnabled') }}</p>
              <p class="text-sm text-dark-400 mt-1">
                {{ getConfigDescription('animationsEnabled') }}
              </p>
            </div>
            <button
              type="button"
              @click="updateValue('animationsEnabled', !getValue('animationsEnabled'))"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                getValue('animationsEnabled') ? 'bg-autodarts-600' : 'bg-dark-600',
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  getValue('animationsEnabled') ? 'translate-x-6' : 'translate-x-1',
                ]"
              />
            </button>
          </div>

          <!-- Animation Groups -->
          <div v-if="getValue('animationsEnabled')" class="space-y-4">
            <div
              v-for="[key, field] in animationFields"
              :key="key"
              class="p-4 rounded-lg border border-dark-600 bg-dark-700/30"
            >
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h4 class="text-white font-medium">{{ field.label || key }}</h4>
                  <p v-if="field.description" class="text-sm text-dark-400 mt-1">
                    {{ field.description }}
                  </p>
                </div>
                <!-- Quick status indicator -->
                <span
                  v-if="getGroupValue(key, 'type') !== 'none'"
                  class="px-2 py-0.5 rounded-full bg-autodarts-500/20 text-autodarts-400 text-xs"
                >
                  {{ getGroupValue(key, 'type') === 'builtin' ? 'Built-in' : (getGroupValue(key, 'type') as string)?.toUpperCase() }}
                </span>
              </div>

              <!-- Nested Fields -->
              <div class="space-y-4" v-if="field.fields">
                <!-- Base animation fields (type, mediaUrl, soundUrl, duration) -->
                <template v-for="[nestedKey, nestedField] in Object.entries(field.fields)" :key="`${key}.${nestedKey}`">
                  <!-- Skip win animation specific fields here - they're shown below -->
                  <template v-if="!['showPlayerName', 'showStats', 'effectType', 'backgroundColor', 'textColor'].includes(nestedKey)">
                    <!-- Type Select -->
                    <div v-if="nestedField.type === 'select'">
                      <label class="block text-sm font-medium text-dark-200 mb-2">
                        {{ nestedField.label || nestedKey }}
                      </label>
                      <select
                        :value="getGroupValue(key, nestedKey)"
                        @change="updateGroupValue(key, nestedKey, ($event.target as HTMLSelectElement).value)"
                        class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                      >
                        <option
                          v-for="option in nestedField.options"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </div>

                    <!-- Media URL (only show if type is gif or video) -->
                    <div v-else-if="nestedField.type === 'string' && nestedKey.toLowerCase().includes('url')">
                      <template v-if="getGroupValue(key, 'type') === 'gif' || getGroupValue(key, 'type') === 'video'">
                        <MediaUpload
                          :model-value="(getGroupValue(key, nestedKey) as string) || ''"
                          @update:model-value="updateGroupValue(key, nestedKey, $event)"
                          :label="nestedField.label || nestedKey"
                          :media-type="nestedKey.toLowerCase().includes('sound') ? 'sound' : 'animation'"
                        />
                      </template>
                    </div>

                    <!-- Duration Slider -->
                    <div v-else-if="nestedField.type === 'number' && nestedKey === 'duration'">
                      <label class="block text-sm font-medium text-dark-200 mb-2">
                        {{ nestedField.label || nestedKey }}: {{ (Number(getGroupValue(key, nestedKey)) || Number(nestedField.default) || 3000) / 1000 }}s
                      </label>
                      <input
                        type="range"
                        :value="(getGroupValue(key, nestedKey) as number) || nestedField.default"
                        @input="updateGroupValue(key, nestedKey, Number(($event.target as HTMLInputElement).value))"
                        :min="nestedField.min ?? 500"
                        :max="nestedField.max ?? 10000"
                        :step="500"
                        class="w-full accent-autodarts-500"
                      />
                    </div>

                    <!-- Threshold Number -->
                    <div v-else-if="nestedField.type === 'number' && nestedKey === 'threshold'">
                      <label class="block text-sm font-medium text-dark-200 mb-2">
                        {{ nestedField.label || nestedKey }}: {{ getGroupValue(key, nestedKey) || nestedField.default }}
                      </label>
                      <input
                        type="range"
                        :value="(getGroupValue(key, nestedKey) as number) || nestedField.default"
                        @input="updateGroupValue(key, nestedKey, Number(($event.target as HTMLInputElement).value))"
                        :min="nestedField.min ?? 100"
                        :max="nestedField.max ?? 179"
                        :step="1"
                        class="w-full accent-autodarts-500"
                      />
                    </div>
                  </template>
                </template>

                <!-- Win Animation Settings Section (for all win animation types except 'none') -->
                <div
                  v-if="isWinAnimation(key) && getGroupValue(key, 'type') !== 'none'"
                  class="pt-4 mt-2 border-t border-dark-600 space-y-4"
                >
                  <h5 class="text-sm font-medium text-dark-300 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    {{ i18n.strings.winAnimationOptions }}
                  </h5>

                  <!-- Info for GIF/Video types -->
                  <p
                    v-if="getGroupValue(key, 'type') === 'gif' || getGroupValue(key, 'type') === 'video'"
                    class="text-xs text-dark-400 -mt-2"
                  >
                    {{ i18n.strings.winAnimationOverlayInfo }}
                  </p>

                  <!-- Win Animation specific fields -->
                  <template v-for="[nestedKey, nestedField] in Object.entries(field.fields)" :key="`${key}.win.${nestedKey}`">
                    <template v-if="['showPlayerName', 'showStats', 'effectType', 'backgroundColor', 'textColor'].includes(nestedKey)">
                      <!-- Boolean Field (showPlayerName, showStats) -->
                      <div v-if="nestedField.type === 'boolean'" class="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-700/30">
                        <span class="text-sm text-dark-200">{{ nestedField.label || nestedKey }}</span>
                        <button
                          type="button"
                          @click="updateGroupValue(key, nestedKey, !(getGroupValue(key, nestedKey) ?? nestedField.default))"
                          :class="[
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                            (getGroupValue(key, nestedKey) ?? nestedField.default) ? 'bg-autodarts-600' : 'bg-dark-600',
                          ]"
                        >
                          <span
                            :class="[
                              'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                              (getGroupValue(key, nestedKey) ?? nestedField.default) ? 'translate-x-5' : 'translate-x-1',
                            ]"
                          />
                        </button>
                      </div>

                      <!-- Select Field (effectType) - only show for builtin type -->
                      <div v-else-if="nestedField.type === 'select' && nestedKey === 'effectType' && getGroupValue(key, 'type') === 'builtin'">
                        <label class="block text-sm font-medium text-dark-200 mb-2">
                          {{ nestedField.label || nestedKey }}
                        </label>
                        <div class="grid grid-cols-4 gap-2">
                          <button
                            v-for="option in nestedField.options"
                            :key="option.value"
                            type="button"
                            @click="updateGroupValue(key, nestedKey, option.value)"
                            :class="[
                              'px-3 py-2 rounded-lg border text-sm transition-all',
                              (getGroupValue(key, nestedKey) ?? nestedField.default) === option.value
                                ? 'border-autodarts-500 bg-autodarts-500/20 text-white'
                                : 'border-dark-600 text-dark-400 hover:border-dark-500',
                            ]"
                          >
                            {{ option.label }}
                          </button>
                        </div>
                      </div>

                      <!-- Color Field (backgroundColor, textColor) -->
                      <div v-else-if="nestedField.type === 'color'">
                        <label class="block text-sm font-medium text-dark-200 mb-2">{{ nestedField.label || nestedKey }}</label>
                        <div class="flex items-center gap-2">
                          <input
                            type="color"
                            :value="(getGroupValue(key, nestedKey) as string) || nestedField.default"
                            @input="updateGroupValue(key, nestedKey, ($event.target as HTMLInputElement).value)"
                            class="w-10 h-8 rounded cursor-pointer border border-dark-600 bg-transparent"
                          />
                          <input
                            type="text"
                            :value="(getGroupValue(key, nestedKey) as string) || nestedField.default"
                            @input="updateGroupValue(key, nestedKey, ($event.target as HTMLInputElement).value)"
                            placeholder="#0a0a0f"
                            class="flex-1 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
            </div>

            <!-- Save Animations Button -->
            <div class="flex justify-end mt-6 pt-4 border-t border-dark-700">
              <BaseButton @click="saveConfig" :loading="isSaving">
                {{ i18n.strings.save }}
              </BaseButton>
            </div>
          </div>

          <!-- Info when disabled -->
          <div v-else class="text-center py-8">
            <svg class="w-12 h-12 mx-auto text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-dark-400 mt-3">{{ getConfigDescription('animationsEnabled') }}</p>
          </div>
        </BaseCard>

        <!-- AI Animation Generator -->
        <AnimationGenerator
          v-if="getValue('animationsEnabled')"
          @animation-ready="onAnimationReady"
        />
        </template>

        <!-- Players Tab -->
        <template v-if="activeTab === 'players'">
        <BaseCard :title="i18n.strings.playerAnimations" :subtitle="i18n.strings.playerAnimationsDesc">
          <div v-if="playersStore.players.length > 0" class="space-y-3">
            <div
              v-for="player in playersStore.players"
              :key="player.id"
              class="flex items-center justify-between p-4 rounded-lg border transition-all"
              :class="hasPlayerOverride(player.name)
                ? 'border-autodarts-500/50 bg-autodarts-500/5'
                : 'border-dark-600 bg-dark-700/30'"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-4 h-4 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: player.color || '#3b82f6' }"
                />
                <div>
                  <p class="text-white font-medium">{{ player.name }}</p>
                  <p v-if="hasPlayerOverride(player.name)" class="text-xs text-autodarts-400 mt-0.5">
                    {{ i18n.strings.customAnimationsActive }}
                  </p>
                  <p v-else class="text-xs text-dark-500 mt-0.5">
                    {{ i18n.strings.usingDefaultAnimations }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <BaseButton
                  variant="ghost"
                  size="sm"
                  @click="openPlayerOverrideEditor(player.name)"
                >
                  {{ hasPlayerOverride(player.name) ? 'Bearbeiten' : i18n.strings.configure }}
                </BaseButton>
                <BaseButton
                  v-if="hasPlayerOverride(player.name)"
                  variant="ghost"
                  size="sm"
                  @click="removePlayerOverride(player.name)"
                >
                  <svg class="w-4 h-4 text-dark-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </BaseButton>
              </div>
            </div>
          </div>

          <!-- No Players -->
          <div v-else class="text-center py-8">
            <svg class="w-12 h-12 mx-auto text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p class="text-dark-400 mt-3">
              {{ i18n.strings.noPlayers }}
              <router-link to="/players" class="text-autodarts-400 hover:underline">
                {{ i18n.strings.createPlayers }}
              </router-link>
            </p>
          </div>
        </BaseCard>
        </template>

        <!-- Player Override Modal -->
        <Teleport to="body">
          <div
            v-if="showPlayerOverrideModal && selectedPlayerOverride"
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              class="absolute inset-0 bg-black/70"
              @click="closePlayerOverrideModal"
            />
            <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 class="text-lg font-semibold text-white mb-4">
                {{ i18n.strings.playerSettings }}: {{ selectedPlayerOverride }}
              </h3>

              <!-- Animation Type Tabs -->
              <div class="flex gap-2 mb-6 border-b border-dark-700 pb-2">
                <button
                  v-for="animType in [
                    { id: 'throw180', label: i18n.strings.animation180 },
                    { id: 'legWin', label: i18n.strings.animationLegWin },
                    { id: 'matchWin', label: i18n.strings.animationMatchWin },
                    { id: 'checkout', label: i18n.strings.animationCheckout }
                  ]"
                  :key="animType.id"
                  @click="selectedAnimationType = animType.id as 'throw180' | 'legWin' | 'matchWin' | 'checkout'"
                  :class="[
                    'px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedAnimationType === animType.id
                      ? 'bg-autodarts-500/20 text-autodarts-400'
                      : 'text-dark-400 hover:text-white hover:bg-dark-700'
                  ]"
                >
                  {{ animType.label }}
                </button>
              </div>

              <div class="space-y-4">
                <!-- Animation Type Select -->
                <div>
                  <label class="block text-sm font-medium text-dark-200 mb-2">{{ i18n.strings.animationType }}</label>
                  <div class="grid grid-cols-4 gap-2">
                    <button
                      v-for="type in [
                        { value: 'builtin', label: i18n.strings.useBuiltin },
                        { value: 'gif', label: i18n.strings.useGif },
                        { value: 'video', label: i18n.strings.useVideo },
                        { value: 'none', label: i18n.strings.useNone }
                      ]"
                      :key="type.value"
                      type="button"
                      @click="updatePlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'type', type.value)"
                      :class="[
                        'px-3 py-2 rounded-lg border text-sm transition-all',
                        getPlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'type') === type.value
                          ? 'border-autodarts-500 bg-autodarts-500/20 text-white'
                          : 'border-dark-600 text-dark-400 hover:border-dark-500'
                      ]"
                    >
                      {{ type.label }}
                    </button>
                  </div>
                </div>

                <!-- Media URL (for gif/video) -->
                <template v-if="getPlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'type') === 'gif' || getPlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'type') === 'video'">
                  <MediaUpload
                    :model-value="(getPlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'mediaUrl') as string) || ''"
                    @update:model-value="updatePlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'mediaUrl', $event)"
                    :label="i18n.strings.mediaUrl"
                    media-type="animation"
                  />
                </template>

                <!-- Sound URL -->
                <MediaUpload
                  :model-value="(getPlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'soundUrl') as string) || ''"
                  @update:model-value="updatePlayerAnimationField(selectedPlayerOverride!, selectedAnimationType, 'soundUrl', $event)"
                  :label="i18n.strings.soundUrl"
                  media-type="sound"
                />
              </div>

              <div class="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-dark-700">
                <BaseButton variant="ghost" @click="closePlayerOverrideModal">
                  Abbrechen
                </BaseButton>
                <BaseButton @click="closePlayerOverrideModal(); saveConfig()">
                  {{ i18n.strings.save }}
                </BaseButton>
              </div>
            </div>
          </div>
        </Teleport>
      </template>
    </div>
  </AppLayout>
</template>
