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
  usePlayerColor?: boolean
}

interface WledConfig {
  wledHost: string
  wledPort: number
  events: Record<string, EventConfig>
  playerColors?: string[]
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

// Fallback effects if WLED is not reachable (common WLED effects)
const fallbackEffects: WledEffect[] = [
  { id: 0, name: 'Solid' },
  { id: 1, name: 'Blink' },
  { id: 2, name: 'Breathe' },
  { id: 9, name: 'Rainbow' },
  { id: 12, name: 'Fade' },
  { id: 17, name: 'Twinkle' },
  { id: 20, name: 'Sparkle' },
  { id: 23, name: 'Strobe' },
  { id: 43, name: 'Gradient' },
  { id: 52, name: 'Fire 2012' },
  { id: 53, name: 'Colorwaves' },
  { id: 62, name: 'Meteor' },
  { id: 65, name: 'Ripple' },
  { id: 82, name: 'Fireworks' },
  { id: 83, name: 'Fireworks Starburst' },
]

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
      effects.value = fallbackEffects
      console.warn('Using fallback effects:', effectsResponse.error)
    }
  } catch (e) {
    wledDataError.value = e instanceof Error ? e.message : 'Fehler beim Laden der WLED-Daten'
    // Use fallback effects
    effects.value = fallbackEffects
  } finally {
    isLoadingWledData.value = false
  }
}

// Event configurations - Autodarts events
const eventConfigs = ref<Record<string, EventConfig>>({
  'match.started': { actionType: 'preset', presetId: 2 },
  'match.finished': { actionType: 'preset', presetId: 5 },
  'match.deleted': { actionType: 'solid', color1: '#333333', brightness: 50 },
  'turn.started': { actionType: 'none' },
  'turn.finished': { actionType: 'none' },
  'throw.detected': { actionType: 'effect', effectId: 1, color1: '#22c55e', speed: 200 },
  'throw.triple': { actionType: 'effect', effectId: 7, color1: '#8b5cf6', speed: 150 },
  'throw.double': { actionType: 'effect', effectId: 18, color1: '#f59e0b', speed: 180 },
  'throw.bull': { actionType: 'effect', effectId: 20, color1: '#ef4444', speed: 200 },
  'throw.bullseye': { actionType: 'effect', effectId: 40, color1: '#ef4444', color2: '#f59e0b', speed: 255 },
  'throw.180': { actionType: 'preset', presetId: 3 },
  'throw.highfinish': { actionType: 'effect', effectId: 40, color1: '#22c55e', color2: '#f59e0b', speed: 200 },
  'throw.miss': { actionType: 'solid', color1: '#ef4444', brightness: 100 },
  'player.changed': { actionType: 'effect', effectId: 3, color1: '#3b82f6', speed: 100 },
  'takeout.started': { actionType: 'solid', color1: '#333333', brightness: 30 },
  'takeout.finished': { actionType: 'solid', color1: '#22c55e', brightness: 200 },
})

// Event metadata for display
const eventMeta: Record<string, { label: string; description: string }> = {
  'match.started': { label: 'Match gestartet', description: 'Wird ausgelöst wenn ein neues Match beginnt' },
  'match.finished': { label: 'Match beendet', description: 'Wird ausgelöst wenn ein Match zu Ende ist' },
  'match.deleted': { label: 'Match abgebrochen', description: 'Wird ausgelöst wenn ein Match abgebrochen wird' },
  'turn.started': { label: 'Aufnahme gestartet', description: 'Ein Spieler beginnt seine Aufnahme' },
  'turn.finished': { label: 'Aufnahme beendet', description: 'Ein Spieler beendet seine Aufnahme' },
  'throw.detected': { label: 'Wurf erkannt', description: 'Ein normaler Wurf wurde erkannt' },
  'throw.triple': { label: 'Triple getroffen', description: 'Ein Triple-Feld wurde getroffen' },
  'throw.double': { label: 'Double getroffen', description: 'Ein Double-Feld wurde getroffen' },
  'throw.bull': { label: 'Single Bull', description: 'Das äußere Bull wurde getroffen (25)' },
  'throw.bullseye': { label: 'Bullseye!', description: 'Das Bullseye wurde getroffen (50)' },
  'throw.180': { label: '180!', description: 'Eine perfekte 180 wurde geworfen' },
  'throw.highfinish': { label: 'High Finish', description: 'Ein Checkout über 100 Punkte' },
  'throw.miss': { label: 'Fehlwurf', description: 'Die Scheibe wurde verfehlt' },
  'player.changed': { label: 'Spielerwechsel', description: 'Der aktive Spieler hat gewechselt' },
  'takeout.started': { label: 'Pfeile ziehen', description: 'Die Pfeile werden aus der Scheibe gezogen' },
  'takeout.finished': { label: 'Pfeile gezogen', description: 'Die Pfeile wurden aus der Scheibe gezogen' },
}

// Saving state
const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Action loading
const actionLoading = ref(false)

// Group events by category
const eventGroups = computed(() => [
  {
    title: 'Match Events',
    events: ['match.started', 'match.finished', 'match.deleted'],
  },
  {
    title: 'Wurf Events',
    events: ['throw.detected', 'throw.triple', 'throw.double', 'throw.bull', 'throw.bullseye', 'throw.180', 'throw.highfinish', 'throw.miss'],
  },
  {
    title: 'Spieler Events',
    events: ['player.changed', 'turn.started', 'turn.finished'],
  },
  {
    title: 'Board Events',
    events: ['takeout.started', 'takeout.finished'],
  },
])

// Load config from module
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      wledHost.value = (values.wledHost as string) || ''
      wledPort.value = (values.wledPort as number) || 80
      if (values.events) {
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
      throw new Error(response.error || 'Verbindung fehlgeschlagen')
    }
  } catch (e) {
    connectionError.value = e instanceof Error ? e.message : 'Verbindung fehlgeschlagen'
    isConnected.value = false
    // Use fallback effects even if connection fails
    effects.value = fallbackEffects
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
    saveMessage.value = { type: 'success', text: 'Konfiguration gespeichert' }
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (e) {
    saveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Fehler beim Speichern',
    }
  } finally {
    isSaving.value = false
  }
}

async function testEvent(_eventName: string, config: EventConfig) {
  if (!wledHost.value) {
    alert('Bitte erst WLED IP-Adresse eingeben')
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
      alert('Fehler: ' + (response.error || 'Unbekannter Fehler'))
    }
  } catch (e) {
    alert('Test fehlgeschlagen: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
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

onMounted(() => {
  modulesStore.fetchModule(moduleId.value)
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
        Zurück zu Module
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
                <h1 class="text-2xl font-bold text-white">WLED Modul</h1>
                <StatusBadge :status="module.status" />
              </div>
              <p class="text-dark-400 mt-1">Steuerung von WLED LED-Strips basierend auf Autodarts-Events</p>
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
              Stoppen
            </BaseButton>
            <BaseButton
              v-else
              :loading="actionLoading"
              @click="startModule"
            >
              Starten
            </BaseButton>
          </div>
        </div>

        <!-- Connection Settings -->
        <BaseCard title="WLED Verbindung" subtitle="Konfigurieren Sie die Verbindung zu Ihrem WLED Controller">
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <BaseInput
                  v-model="wledHost"
                  label="WLED IP-Adresse / Hostname"
                  placeholder="192.168.1.100 oder wled.local"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-dark-200 mb-1">Port</label>
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
                    {{ isConnected ? 'Verbunden' : 'Nicht verbunden' }}
                  </p>
                  <p v-if="connectionError" class="text-sm text-red-400">{{ connectionError }}</p>
                  <p v-else-if="isConnected" class="text-sm text-dark-400">
                    {{ presets.length }} Presets, {{ effects.length }} Effekte verfügbar
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
                {{ isConnected ? 'Neu verbinden' : 'Verbinden' }}
              </BaseButton>
            </div>
          </div>
        </BaseCard>

        <!-- Player Colors Configuration -->
        <BaseCard title="Spielerfarben" subtitle="Definieren Sie Farben für bis zu 6 Spieler (werden verwendet wenn 'Spielerfarbe verwenden' aktiviert ist)">
          <div class="space-y-4">
            <p class="text-sm text-dark-400">
              Diese Farben werden verwendet, wenn bei einem Event die Aktion "Spielerfarbe" gewählt wird.
              Bei einem Spielerwechsel wird die LED-Farbe entsprechend dem aktuellen Spieler gesetzt.
            </p>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div
                v-for="(color, index) in playerColors"
                :key="index"
                class="space-y-2"
              >
                <label class="block text-sm font-medium text-dark-200">
                  Spieler {{ index + 1 }}
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
              <p class="text-sm text-dark-400 mb-3">Spielerfarben testen:</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(color, index) in playerColors"
                  :key="index"
                  class="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:scale-105"
                  :style="{ backgroundColor: color }"
                  @click="testEvent(`player.${index}`, { actionType: 'solid', color1: color, brightness: 255 })"
                >
                  Spieler {{ index + 1 }}
                </button>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Event Configuration -->
        <BaseCard title="Event-Aktionen" subtitle="Konfigurieren Sie die WLED-Aktion für jedes Autodarts-Event">
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
                Konfiguration speichern
              </BaseButton>
            </div>
          </template>
        </BaseCard>

        <!-- Quick Actions -->
        <BaseCard title="Schnellaktionen">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.test', { actionType: 'effect', effectId: 7, speed: 200 })"
            >
              <svg class="w-8 h-8 mx-auto text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span class="text-sm text-white">Rainbow Test</span>
            </button>
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.off', { actionType: 'solid', color1: '#000000', brightness: 0 })"
            >
              <svg class="w-8 h-8 mx-auto text-dark-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span class="text-sm text-white">LEDs aus</span>
            </button>
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.green', { actionType: 'solid', color1: '#22c55e', brightness: 255 })"
            >
              <svg class="w-8 h-8 mx-auto text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span class="text-sm text-white">Grün</span>
            </button>
            <button
              class="p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors text-center"
              @click="testEvent('manual.red', { actionType: 'solid', color1: '#ef4444', brightness: 255 })"
            >
              <svg class="w-8 h-8 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span class="text-sm text-white">Rot</span>
            </button>
          </div>
        </BaseCard>
      </template>
    </div>
  </AppLayout>
</template>
