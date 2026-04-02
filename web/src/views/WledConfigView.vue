<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import StatusBadge from '../components/StatusBadge.vue'
import WledEventConfig from '../components/WledEventConfig.vue'

// Types
interface WledPreset {
  id: number
  name: string
}

interface WledEffect {
  id: number
  name: string
}

interface EventConfig {
  actionType: 'preset' | 'effect' | 'solid' | 'off' | 'none'
  presetId?: number
  effectId?: number
  color1?: string
  color2?: string
  color3?: string
  brightness?: number
  speed?: number
  intensity?: number
  fadeTime?: number // Fade/transition time in seconds (0-10)
  usePlayerColor?: boolean
}

interface WledConfig {
  wledHost: string
  wledPort: number
  events: Record<string, EventConfig>
  playerColors?: string[]
}

// Available intent from other modules
interface AvailableIntent {
  id: string
  description: string
  category?: string
  sourceModule: string
  sourceModuleName: string
}

const route = useRoute()
const modulesStore = useModulesStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Configuration state
const wledHost = ref('')
const wledPort = ref(80)
const isConnected = ref(false)
const isConnecting = ref(false)
const connectionError = ref<string | null>(null)

// Player colors for player.changed event (6 generic players)
const playerColors = ref<string[]>([
  '#3b82f6', // Blue - Player 1
  '#ef4444', // Red - Player 2
  '#22c55e', // Green - Player 3
  '#f59e0b', // Amber - Player 4
  '#8b5cf6', // Purple - Player 5
  '#ec4899', // Pink - Player 6
])

// WLED data from device (will be loaded dynamically)
const presets = ref<WledPreset[]>([])
const effects = ref<WledEffect[]>([])
const isLoadingWledData = ref(false)
const wledDataError = ref<string | null>(null)

// Fallback effects from module.json (loaded dynamically)
const fallbackEffects = computed<WledEffect[]>(() => {
  return (module.value?.effects as WledEffect[]) || []
})

// Available intents from other modules
const availableIntents = ref<AvailableIntent[]>([])
const isLoadingIntents = ref(false)

/**
 * Load available intents from all modules
 */
async function loadAvailableIntents() {
  isLoadingIntents.value = true
  try {
    const response = await fetch('/api/intents/available')
    const data = await response.json()
    if (data.success && data.intents) {
      availableIntents.value = data.intents
      console.log(`Loaded ${availableIntents.value.length} available intents`)

      // Initialize event configs for intents
      for (const intent of availableIntents.value) {
        const intentKey = `intent:${intent.id}`
        if (!eventConfigs.value[intentKey]) {
          eventConfigs.value[intentKey] = { actionType: 'none' }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load available intents:', e)
  } finally {
    isLoadingIntents.value = false
  }
}

/**
 * Load presets and effects from WLED device
 */
async function loadWledData() {
  if (!wledHost.value) return

  isLoadingWledData.value = true
  wledDataError.value = null

  try {
    // Load presets and effects in parallel
    const [presetsResponse, effectsResponse] = await Promise.all([
      api.getWledPresets(wledHost.value, wledPort.value),
      api.getWledEffects(wledHost.value, wledPort.value),
    ])

    if (presetsResponse.success && presetsResponse.presets) {
      presets.value = presetsResponse.presets
      console.log(`Loaded ${presets.value.length} presets from WLED`)
    } else {
      console.warn('Could not load presets:', presetsResponse.error)
    }

    if (effectsResponse.success && effectsResponse.effects) {
      effects.value = effectsResponse.effects
      console.log(`Loaded ${effects.value.length} effects from WLED`)
    } else {
      // Use fallback effects
      effects.value = fallbackEffects.value
      console.warn('Using fallback effects:', effectsResponse.error)
    }
  } catch (e) {
    wledDataError.value = e instanceof Error ? e.message : (currentLang.value === 'de' ? 'Fehler beim Laden der WLED-Daten' : currentLang.value === 'es' ? 'Error al cargar datos WLED' : 'Error loading WLED data')
    // Use fallback effects
    effects.value = fallbackEffects.value
  } finally {
    isLoadingWledData.value = false
  }
}

// Event configurations - starts empty, loaded from module config
const eventConfigs = ref<Record<string, EventConfig>>({})

// Current language for i18n
const currentLang = computed(() => {
  // Try to get browser language, fallback to 'de'
  const browserLang = navigator.language.split('-')[0]
  return ['de', 'en', 'es'].includes(browserLang) ? browserLang : 'de'
})

// i18n translations from module.json
const i18n = computed(() => {
  const translations = module.value?.i18n as Record<string, {
    name?: string
    description?: string
    config?: Record<string, { label?: string; description?: string }>
    strings?: Record<string, string>
  }> | undefined

  const lang = currentLang.value
  const t = translations?.[lang] || translations?.['en'] || {}

  return {
    // Module info
    name: t.name || module.value?.name || 'WLED Modul',
    description: t.description || module.value?.description || '',

    // Config fields
    config: t.config || {},

    // UI strings with defaults
    strings: {
      connectionSuccess: t.strings?.connectionSuccess || 'Successfully connected to WLED!',
      connectionFailed: t.strings?.connectionFailed || 'Failed to connect to WLED',
      testConnection: t.strings?.testConnection || 'Test Connection',
      eventActions: t.strings?.eventActions || 'Event Actions',
      playerColors: t.strings?.playerColors || 'Player Colors',
      // Additional strings with multi-language defaults
      backToModules: lang === 'de' ? 'Zurück zu Module' : lang === 'es' ? 'Volver a Módulos' : 'Back to Modules',
      wledConnection: lang === 'de' ? 'WLED Verbindung' : lang === 'es' ? 'Conexión WLED' : 'WLED Connection',
      wledConnectionDesc: lang === 'de' ? 'Konfigurieren Sie die Verbindung zu Ihrem WLED Controller' : lang === 'es' ? 'Configure la conexión a su controlador WLED' : 'Configure the connection to your WLED controller',
      connected: lang === 'de' ? 'Verbunden' : lang === 'es' ? 'Conectado' : 'Connected',
      notConnected: lang === 'de' ? 'Nicht verbunden' : lang === 'es' ? 'No conectado' : 'Not connected',
      connect: lang === 'de' ? 'Verbinden' : lang === 'es' ? 'Conectar' : 'Connect',
      reconnect: lang === 'de' ? 'Neu verbinden' : lang === 'es' ? 'Reconectar' : 'Reconnect',
      presetsEffectsAvailable: lang === 'de' ? 'Presets, Effekte verfügbar' : lang === 'es' ? 'Presets, efectos disponibles' : 'presets, effects available',
      playerColorsDesc: lang === 'de' ? 'Definieren Sie Farben für bis zu 6 Spieler (werden verwendet wenn \'Spielerfarbe verwenden\' aktiviert ist)' : lang === 'es' ? 'Defina colores para hasta 6 jugadores' : 'Define colors for up to 6 players (used when \'Use player color\' is enabled)',
      playerColorsInfo: lang === 'de' ? 'Diese Farben werden verwendet, wenn bei einem Event die Aktion "Spielerfarbe" gewählt wird. Bei einem Spielerwechsel wird die LED-Farbe entsprechend dem aktuellen Spieler gesetzt.' : lang === 'es' ? 'Estos colores se usan cuando se selecciona la acción "Color del jugador".' : 'These colors are used when "Player color" action is selected. On player change, the LED color will be set according to the current player.',
      player: lang === 'de' ? 'Spieler' : lang === 'es' ? 'Jugador' : 'Player',
      testPlayerColors: lang === 'de' ? 'Spielerfarben testen:' : lang === 'es' ? 'Probar colores de jugadores:' : 'Test player colors:',
      eventActionsDesc: lang === 'de' ? 'Konfigurieren Sie die WLED-Aktion für jedes Autodarts-Event' : lang === 'es' ? 'Configure la acción WLED para cada evento de Autodarts' : 'Configure the WLED action for each Autodarts event',
      saveConfig: lang === 'de' ? 'Konfiguration speichern' : lang === 'es' ? 'Guardar configuración' : 'Save Configuration',
      configSaved: lang === 'de' ? 'Konfiguration gespeichert' : lang === 'es' ? 'Configuración guardada' : 'Configuration saved',
      saveError: lang === 'de' ? 'Fehler beim Speichern' : lang === 'es' ? 'Error al guardar' : 'Error saving',
      quickActions: lang === 'de' ? 'Schnellaktionen' : lang === 'es' ? 'Acciones Rápidas' : 'Quick Actions',
      rainbowTest: lang === 'de' ? 'Rainbow Test' : lang === 'es' ? 'Prueba Arcoíris' : 'Rainbow Test',
      ledsOff: lang === 'de' ? 'LEDs aus' : lang === 'es' ? 'LEDs apagados' : 'LEDs off',
      green: lang === 'de' ? 'Grün' : lang === 'es' ? 'Verde' : 'Green',
      red: lang === 'de' ? 'Rot' : lang === 'es' ? 'Rojo' : 'Red',
      start: lang === 'de' ? 'Starten' : lang === 'es' ? 'Iniciar' : 'Start',
      stop: lang === 'de' ? 'Stoppen' : lang === 'es' ? 'Detener' : 'Stop',
      loadingIntents: lang === 'de' ? 'Lade Modul-Intents...' : lang === 'es' ? 'Cargando intents de módulos...' : 'Loading module intents...',
    }
  }
})

// Get translated config field label/description
const getConfigLabel = (fieldKey: string) => {
  return i18n.value.config[fieldKey]?.label || fieldKey
}
// Event metadata from module.json (with i18n support)
const eventMeta = computed<Record<string, { label: string; description: string }>>(() => {
  const meta = module.value?.eventMeta as Record<string, { label: Record<string, string>; description: Record<string, string> }> || {}
  const result: Record<string, { label: string; description: string }> = {}

  for (const [key, value] of Object.entries(meta)) {
    result[key] = {
      label: value.label?.[currentLang.value] || value.label?.['en'] || key,
      description: value.description?.[currentLang.value] || value.description?.['en'] || ''
    }
  }
  return result
})

// Saving state
const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Action loading
const actionLoading = ref(false)

// Event groups from module.json (with i18n support)
const eventGroups = computed(() => {
  const groups = module.value?.eventGroups as Array<{ title: Record<string, string>; events: string[] }> || []
  return groups.map(group => ({
    title: group.title?.[currentLang.value] || group.title?.['en'] || 'Events',
    events: group.events || []
  }))
})

// Intent group (dynamically loaded from other modules)
const intentGroup = computed(() => {
  if (availableIntents.value.length === 0) return null

  // Group intents by source module
  const intentsByModule = new Map<string, AvailableIntent[]>()
  for (const intent of availableIntents.value) {
    const existing = intentsByModule.get(intent.sourceModuleName) || []
    existing.push(intent)
    intentsByModule.set(intent.sourceModuleName, existing)
  }

  return {
    title: currentLang.value === 'de' ? 'Modul-Intents' : currentLang.value === 'es' ? 'Intents de Módulos' : 'Module Intents',
    subtitle: currentLang.value === 'de'
      ? 'Reagiere auf Ereignisse von anderen Modulen'
      : currentLang.value === 'es'
      ? 'Reaccionar a eventos de otros módulos'
      : 'React to events from other modules',
    intents: availableIntents.value,
    intentsByModule
  }
})

// Initialize event configs for all events from eventGroups
watch(
  () => module.value?.eventGroups,
  (groups) => {
    if (groups && Array.isArray(groups)) {
      const allEvents = (groups as Array<{ events: string[] }>).flatMap(g => g.events || [])
      for (const eventName of allEvents) {
        if (!eventConfigs.value[eventName]) {
          // Initialize with default 'none' action
          eventConfigs.value[eventName] = { actionType: 'none' }
        }
      }
    }
  },
  { immediate: true }
)

// Load config from module
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      wledHost.value = (values.wledHost as string) || ''
      wledPort.value = (values.wledPort as number) || 80
      if (values.events) {
        // Merge saved events with initialized events
        eventConfigs.value = { ...eventConfigs.value, ...(values.events as Record<string, EventConfig>) }
      }
      if (values.playerColors && Array.isArray(values.playerColors)) {
        playerColors.value = values.playerColors as string[]
      }
    }
  },
  { immediate: true }
)

async function connectToWled() {
  isConnecting.value = true
  connectionError.value = null

  try {
    const response = await api.testWledConnection(wledHost.value, wledPort.value)

    if (response.success) {
      isConnected.value = true
      console.log('WLED Info:', response.info)

      // Load presets and effects from WLED
      await loadWledData()
    } else {
      throw new Error(response.error || i18n.value.strings.connectionFailed)
    }
  } catch (e) {
    connectionError.value = e instanceof Error ? e.message : i18n.value.strings.connectionFailed
    isConnected.value = false
    // Use fallback effects from module.json if connection fails
    effects.value = fallbackEffects.value
  } finally {
    isConnecting.value = false
  }
}

async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    const config: WledConfig = {
      wledHost: wledHost.value,
      wledPort: wledPort.value,
      events: eventConfigs.value,
      playerColors: playerColors.value,
    }

    await modulesStore.updateConfig(module.value.id, config as unknown as Record<string, unknown>)
    saveMessage.value = { type: 'success', text: i18n.value.strings.configSaved }
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

async function testEvent(_eventName: string, config: EventConfig) {
  if (!wledHost.value) {
    alert(currentLang.value === 'de' ? 'Bitte erst WLED IP-Adresse eingeben' : currentLang.value === 'es' ? 'Por favor, ingrese primero la dirección IP de WLED' : 'Please enter WLED IP address first')
    return
  }

  try {
    // Convert hex colors to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 255, b: 255 }
    }

    // Map action type for test
    let testActionType: 'preset' | 'effect' | 'solid' | 'off' = 'off'
    if (config.actionType === 'none') {
      testActionType = 'off'
    } else {
      testActionType = config.actionType
    }

    const response = await api.testWledAction(
      wledHost.value,
      wledPort.value,
      {
        actionType: testActionType,
        presetId: config.presetId,
        effectId: config.effectId,
        color: config.color1 ? hexToRgb(config.color1) : undefined,
        color2: config.color2 ? hexToRgb(config.color2) : undefined,
        color3: config.color3 ? hexToRgb(config.color3) : undefined,
        brightness: config.brightness,
        speed: config.speed,
        intensity: config.intensity,
      }
    )

    if (!response.success) {
      const errorLabel = currentLang.value === 'de' ? 'Fehler' : currentLang.value === 'es' ? 'Error' : 'Error'
      const unknownError = currentLang.value === 'de' ? 'Unbekannter Fehler' : currentLang.value === 'es' ? 'Error desconocido' : 'Unknown error'
      alert(errorLabel + ': ' + (response.error || unknownError))
    }
  } catch (e) {
    const testFailed = currentLang.value === 'de' ? 'Test fehlgeschlagen' : currentLang.value === 'es' ? 'Prueba fallida' : 'Test failed'
    const unknownError = currentLang.value === 'de' ? 'Unbekannter Fehler' : currentLang.value === 'es' ? 'Error desconocido' : 'Unknown error'
    alert(testFailed + ': ' + (e instanceof Error ? e.message : unknownError))
  }
}

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

onMounted(async () => {
  await modulesStore.fetchModule(moduleId.value)
  // Load available intents from other modules
  await loadAvailableIntents()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Back Link -->
      <router-link
        to="/modules"
        class="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        {{ i18n.strings.backToModules }}
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
                module.status === 'running' ? 'bg-amber-500/20' : 'bg-dark-700',
              ]"
            >
              <!-- WLED Icon -->
              <svg
                :class="['w-8 h-8', module.status === 'running' ? 'text-amber-400' : 'text-dark-400']"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-9h10v2H7z"/>
                <circle cx="12" cy="12" r="3"/>
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
          <div class="flex items-center gap-2">
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

        <!-- Connection Settings -->
        <BaseCard :title="i18n.strings.wledConnection" :subtitle="i18n.strings.wledConnectionDesc">
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <BaseInput
                  v-model="wledHost"
                  :label="getConfigLabel('wledHost')"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-dark-200 mb-1">{{ getConfigLabel('wledPort') }}</label>
                <input
                  type="number"
                  v-model.number="wledPort"
                  min="1"
                  max="65535"
                  class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                />
              </div>
            </div>

            <!-- Connection Status -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'w-3 h-3 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-dark-500',
                  ]"
                />
                <div>
                  <p class="text-white font-medium">
                    {{ isConnected ? i18n.strings.connected : i18n.strings.notConnected }}
                  </p>
                  <p v-if="connectionError" class="text-sm text-red-400">{{ connectionError }}</p>
                  <p v-else-if="isConnected" class="text-sm text-dark-400">
                    {{ presets.length }} Presets, {{ effects.length }} {{ i18n.strings.presetsEffectsAvailable }}
                  </p>
                </div>
              </div>
              <BaseButton
                variant="secondary"
                size="sm"
                :loading="isConnecting"
                :disabled="!wledHost"
                @click="connectToWled"
              >
                {{ isConnected ? i18n.strings.reconnect : i18n.strings.connect }}
              </BaseButton>
            </div>
          </div>
        </BaseCard>

        <!-- Player Colors Configuration -->
        <BaseCard :title="i18n.strings.playerColors" :subtitle="i18n.strings.playerColorsDesc">
          <div class="space-y-4">
            <p class="text-sm text-dark-400">
              {{ i18n.strings.playerColorsInfo }}
            </p>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div
                v-for="(color, index) in playerColors"
                :key="index"
                class="space-y-2"
              >
                <label class="block text-sm font-medium text-dark-200">
                  {{ i18n.strings.player }} {{ index + 1 }}
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="color"
                    v-model="playerColors[index]"
                    class="w-12 h-10 rounded-lg cursor-pointer bg-dark-800 border border-dark-600"
                  />
                  <input
                    type="text"
                    :value="playerColors[index]"
                    @input="playerColors[index] = ($event.target as HTMLInputElement).value"
                    class="flex-1 px-2 py-2 text-xs rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 uppercase"
                    maxlength="7"
                    placeholder="#FFFFFF"
                  />
                </div>
                <!-- Color Preview -->
                <div
                  class="h-2 rounded-full"
                  :style="{ backgroundColor: color }"
                />
              </div>
            </div>

            <!-- Test Player Colors -->
            <div class="pt-4 border-t border-dark-700">
              <p class="text-sm text-dark-400 mb-3">{{ i18n.strings.testPlayerColors }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(color, index) in playerColors"
                  :key="index"
                  class="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:scale-105"
                  :style="{ backgroundColor: color }"
                  @click="testEvent(`player.${index}`, { actionType: 'solid', color1: color, brightness: 255 })"
                >
                  {{ i18n.strings.player }} {{ index + 1 }}
                </button>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Event Configuration -->
        <BaseCard :title="i18n.strings.eventActions" :subtitle="i18n.strings.eventActionsDesc">
          <div class="space-y-6">
            <div v-for="group in eventGroups" :key="group.title" class="space-y-3">
              <h3 class="text-sm font-medium text-dark-300 uppercase tracking-wider">
                {{ group.title }}
              </h3>
              <div class="space-y-2">
                <WledEventConfig
                  v-for="eventName in group.events"
                  :key="eventName"
                  :event-name="eventName"
                  :event-label="eventMeta[eventName]?.label || eventName"
                  :event-description="eventMeta[eventName]?.description"
                  v-model="eventConfigs[eventName]"
                  :presets="presets"
                  :effects="effects"
                  @test="testEvent"
                />
              </div>
            </div>

            <!-- Module Intents Section -->
            <div v-if="intentGroup && intentGroup.intents.length > 0" class="space-y-3 pt-4 border-t border-dark-700">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-medium text-dark-300 uppercase tracking-wider">
                  {{ intentGroup.title }}
                </h3>
                <span class="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                  {{ intentGroup.intents.length }}
                </span>
              </div>
              <p class="text-xs text-dark-400">{{ intentGroup.subtitle }}</p>

              <!-- Group by source module -->
              <div v-for="[moduleName, intents] in intentGroup.intentsByModule" :key="moduleName" class="space-y-2">
                <p class="text-xs text-dark-500 font-medium pl-2">{{ moduleName }}</p>
                <WledEventConfig
                  v-for="intent in intents"
                  :key="`intent:${intent.id}`"
                  :event-name="`intent:${intent.id}`"
                  :event-label="intent.id"
                  :event-description="intent.description"
                  v-model="eventConfigs[`intent:${intent.id}`]"
                  :presets="presets"
                  :effects="effects"
                  @test="testEvent"
                />
              </div>
            </div>

            <!-- Loading intents indicator -->
            <div v-else-if="isLoadingIntents" class="flex items-center gap-2 text-dark-400 text-sm py-4">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ i18n.strings.loadingIntents }}
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-between">
              <!-- Save Message -->
              <div
                v-if="saveMessage"
                :class="[
                  'text-sm',
                  saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400',
                ]"
              >
                {{ saveMessage.text }}
              </div>
              <div v-else />

              <BaseButton :loading="isSaving" @click="saveConfig">
                {{ i18n.strings.saveConfig }}
              </BaseButton>
            </div>
          </template>
        </BaseCard>

        <!-- Quick Actions -->
        <BaseCard :title="i18n.strings.quickActions">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.test', { actionType: 'effect', effectId: 7, speed: 200 })"
            >
              <svg class="w-8 h-8 mx-auto text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span class="text-sm text-white">{{ i18n.strings.rainbowTest }}</span>
            </button>
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.off', { actionType: 'solid', color1: '#000000', brightness: 0 })"
            >
              <svg class="w-8 h-8 mx-auto text-dark-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span class="text-sm text-white">{{ i18n.strings.ledsOff }}</span>
            </button>
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.green', { actionType: 'solid', color1: '#22c55e', brightness: 255 })"
            >
              <svg class="w-8 h-8 mx-auto text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span class="text-sm text-white">{{ i18n.strings.green }}</span>
            </button>
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.red', { actionType: 'solid', color1: '#ef4444', brightness: 255 })"
            >
              <svg class="w-8 h-8 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span class="text-sm text-white">{{ i18n.strings.red }}</span>
            </button>
          </div>
        </BaseCard>
      </template>
    </div>
  </AppLayout>
</template>
