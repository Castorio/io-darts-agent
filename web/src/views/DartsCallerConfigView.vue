<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { usePlayersStore } from '../stores/players'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import MediaUpload from '../components/MediaUpload.vue'
import CallerEventConfig from '../components/CallerEventConfig.vue'

// ElevenLabs voice interface
interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels?: Record<string, string>
  preview_url?: string
}

const { t } = useI18n()

// Voice types
type VoiceType = 'system' | 'elevenlabs' | 'custom'
type CallerLanguage = 'de' | 'en'

// Caller event types
type CallerEventType =
  | 'score'
  | 'gameOn'
  | 'gameShot'
  | 'matchOn'
  | 'matchShot'
  | 'bust'
  | 'noScore'
  | '180'
  | 'ton80Plus'
  | 'ton40Plus'
  | 'highFinish'
  | 'checkout'
  | 'bull'
  | 'bullseye'
  | 'triple'
  | 'double'
  | 'playerChange'
  | 'requiresDouble'

interface CallerEventConfig {
  enabled: boolean
  soundUrl?: string
  textTemplate?: string
  useCustomSound: boolean
}

interface PlayerVoiceOverride {
  playerId?: string
  playerName: string
  voiceId?: string
  customGreeting?: string
  customSounds?: Partial<Record<CallerEventType, string>>
}

interface DartsCallerConfig {
  // Voice Settings
  voiceType: VoiceType
  language: CallerLanguage
  systemVoice: string
  elevenLabsApiKey: string
  elevenLabsVoiceId: string
  customVoiceUrl: string

  // Audio Settings
  volume: number
  pitch: number
  rate: number

  // Caller Behavior
  callScores: boolean
  callRemaining: boolean
  callCheckouts: boolean
  checkoutThreshold: number
  callPlayerNames: boolean
  usePlayerNicknames: boolean

  // Event Configurations
  events: Partial<Record<CallerEventType, CallerEventConfig>>

  // Player-specific overrides
  playerOverrides: PlayerVoiceOverride[]
}

// Caller event keys for UI (labels come from i18n)
const callerEventKeys: Array<{ key: CallerEventType; category: string }> = [
  // Game Events
  { key: 'gameOn', category: 'game' },
  { key: 'gameShot', category: 'game' },
  { key: 'matchOn', category: 'game' },
  { key: 'matchShot', category: 'game' },

  // Score Events
  { key: 'score', category: 'score' },
  { key: 'bust', category: 'score' },
  { key: 'noScore', category: 'score' },
  { key: 'requiresDouble', category: 'score' },

  // Special Scores
  { key: '180', category: 'special' },
  { key: 'ton80Plus', category: 'special' },
  { key: 'ton40Plus', category: 'special' },

  // Checkout Events
  { key: 'checkout', category: 'checkout' },
  { key: 'highFinish', category: 'checkout' },

  // Hit Events
  { key: 'bullseye', category: 'hits' },
  { key: 'bull', category: 'hits' },
  { key: 'triple', category: 'hits' },
  { key: 'double', category: 'hits' },

  // Player Events
  { key: 'playerChange', category: 'player' },
]

// Computed caller events with translated labels
const callerEvents = computed(() =>
  callerEventKeys.map((e) => ({
    ...e,
    label: t(`caller.events.${e.key}.label`),
    description: t(`caller.events.${e.key}.description`),
  }))
)

// Group events by category
const eventCategories = computed(() => [
  { id: 'game', title: t('caller.categories.game'), events: callerEvents.value.filter(e => e.category === 'game') },
  { id: 'score', title: t('caller.categories.score'), events: callerEvents.value.filter(e => e.category === 'score') },
  { id: 'special', title: t('caller.categories.special'), events: callerEvents.value.filter(e => e.category === 'special') },
  { id: 'checkout', title: t('caller.categories.checkout'), events: callerEvents.value.filter(e => e.category === 'checkout') },
  { id: 'hits', title: t('caller.categories.hits'), events: callerEvents.value.filter(e => e.category === 'hits') },
  { id: 'player', title: t('caller.categories.player'), events: callerEvents.value.filter(e => e.category === 'player') },
])

const route = useRoute()
const modulesStore = useModulesStore()
const playersStore = usePlayersStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Configuration state
const config = ref<DartsCallerConfig>({
  voiceType: 'system',
  language: 'de',
  systemVoice: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '',
  customVoiceUrl: '',
  volume: 100,
  pitch: 100,
  rate: 100,
  callScores: true,
  callRemaining: true,
  callCheckouts: true,
  checkoutThreshold: 170,
  callPlayerNames: true,
  usePlayerNicknames: false,
  events: {},
  playerOverrides: [],
})

// Available system voices
const systemVoices = ref<SpeechSynthesisVoice[]>([])
const availableVoices = computed(() => {
  const lang = config.value.language === 'de' ? 'de' : 'en'
  return systemVoices.value.filter(v => v.lang.toLowerCase().startsWith(lang))
})

// UI State
const activeTab = ref<'voice' | 'events' | 'players'>('voice')
const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const isTestingVoice = ref(false)

// Selected player for editing
const selectedPlayerOverride = ref<string | null>(null)
const showPlayerOverrideModal = ref(false)

// ElevenLabs state
const elevenlabsConfigured = ref(false)
const elevenlabsVoices = ref<ElevenLabsVoice[]>([])
const isLoadingVoices = ref(false)
const voicesError = ref<string | null>(null)
const previewingVoiceId = ref<string | null>(null)
const previewAudio = ref<HTMLAudioElement | null>(null)

// Voice Pack types
interface VoicePack {
  id: string
  name: string
  voiceId: string
  language: string
  totalFiles: number
  generatedAt: string
}

// Voice Pack Generation state
interface VoicePackStatus {
  status: 'idle' | 'generating' | 'completed' | 'failed'
  progress: number
  currentItem?: string
  totalItems?: number
  completedItems?: number
  error?: string
  packs: VoicePack[]
  generatingPackId?: string
}

const voicePackStatus = ref<VoicePackStatus>({
  status: 'idle',
  progress: 0,
  packs: [],
})
const isLoadingVoicePackStatus = ref(false)
const voicePackPollingInterval = ref<ReturnType<typeof setInterval> | null>(null)
const selectedVoicePackId = ref<string>('')

// Load system voices
function loadSystemVoices() {
  if ('speechSynthesis' in window) {
    const voices = speechSynthesis.getVoices()
    if (voices.length > 0) {
      systemVoices.value = voices
    } else {
      // Voices might not be loaded yet
      speechSynthesis.onvoiceschanged = () => {
        systemVoices.value = speechSynthesis.getVoices()
      }
    }
  }
}

// Load config from module
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      config.value = {
        voiceType: (values.voiceType as VoiceType) || 'system',
        language: (values.language as CallerLanguage) || 'de',
        systemVoice: (values.systemVoice as string) || '',
        elevenLabsApiKey: (values.elevenLabsApiKey as string) || '',
        elevenLabsVoiceId: (values.elevenLabsVoiceId as string) || '',
        customVoiceUrl: (values.customVoiceUrl as string) || '',
        volume: (values.volume as number) ?? 100,
        pitch: (values.pitch as number) ?? 100,
        rate: (values.rate as number) ?? 100,
        callScores: values.callScores !== false,
        callRemaining: values.callRemaining !== false,
        callCheckouts: values.callCheckouts !== false,
        checkoutThreshold: (values.checkoutThreshold as number) || 170,
        callPlayerNames: values.callPlayerNames !== false,
        usePlayerNicknames: (values.usePlayerNicknames as boolean) || false,
        events: (values.events as Partial<Record<CallerEventType, CallerEventConfig>>) || {},
        playerOverrides: (values.playerOverrides as PlayerVoiceOverride[]) || [],
      }
      // Load selected voice pack from config
      selectedVoicePackId.value = (values.selectedVoicePackId as string) || ''
    }
  },
  { immediate: true }
)

// Watch for voice pack selection changes and auto-save
watch(selectedVoicePackId, async (newId) => {
  if (module.value && newId !== undefined) {
    try {
      await modulesStore.updateConfig(module.value.id, {
        ...config.value,
        selectedVoicePackId: newId
      } as unknown as Record<string, unknown>)
    } catch (e) {
      console.error('Failed to save voice pack selection:', e)
    }
  }
})

// Test voice
async function testVoice() {
  isTestingVoice.value = true

  try {
    const testText = config.value.language === 'de'
      ? 'Einhundertachtzig! Game on!'
      : 'One hundred and eighty! Game on!'

    if (config.value.voiceType === 'system') {
      const utterance = new SpeechSynthesisUtterance(testText)
      utterance.volume = config.value.volume / 100
      utterance.pitch = config.value.pitch / 100
      utterance.rate = config.value.rate / 100

      const voice = systemVoices.value.find(v => v.name === config.value.systemVoice)
      if (voice) {
        utterance.voice = voice
      }

      utterance.onend = () => {
        isTestingVoice.value = false
      }
      utterance.onerror = () => {
        isTestingVoice.value = false
      }

      speechSynthesis.speak(utterance)
    } else {
      // For ElevenLabs or custom, we'd need to call the backend
      saveMessage.value = { type: 'info' as 'success', text: t('caller.testViaBackend') }
      isTestingVoice.value = false
    }
  } catch (e) {
    saveMessage.value = { type: 'error', text: t('caller.testFailed') }
    isTestingVoice.value = false
  }
}

// Event config helpers
function getEventConfig(eventKey: CallerEventType): CallerEventConfig {
  return config.value.events[eventKey] || { enabled: true, useCustomSound: false }
}

function updateEventConfig(eventKey: CallerEventType, eventConfig: CallerEventConfig) {
  config.value.events[eventKey] = eventConfig
}

// Player override helpers
function hasPlayerOverride(playerName: string): boolean {
  return config.value.playerOverrides.some(
    p => p.playerName.toLowerCase() === playerName.toLowerCase()
  )
}

function openPlayerOverrideEditor(playerName: string) {
  selectedPlayerOverride.value = playerName
  showPlayerOverrideModal.value = true
}

function closePlayerOverrideModal() {
  showPlayerOverrideModal.value = false
  selectedPlayerOverride.value = null
}

function ensurePlayerOverride(playerName: string): PlayerVoiceOverride {
  let override = config.value.playerOverrides.find(
    p => p.playerName.toLowerCase() === playerName.toLowerCase()
  )
  if (!override) {
    override = { playerName, customSounds: {} }
    config.value.playerOverrides.push(override)
  }
  return override
}

function removePlayerOverride(playerName: string) {
  config.value.playerOverrides = config.value.playerOverrides.filter(
    p => p.playerName.toLowerCase() !== playerName.toLowerCase()
  )
}

// Save configuration
async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    await modulesStore.updateConfig(module.value.id, config.value as unknown as Record<string, unknown>)
    saveMessage.value = { type: 'success', text: t('common.success') }
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (e) {
    saveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('errors.generic'),
    }
  } finally {
    isSaving.value = false
  }
}

// Check if ElevenLabs is configured
async function checkElevenLabsConfig() {
  try {
    const response = await api.getAIProviders()
    const elevenlabs = response.providers.find(p => p.id === 'elevenlabs')
    elevenlabsConfigured.value = elevenlabs?.configured ?? false
    if (elevenlabsConfigured.value) {
      loadElevenLabsVoices()
    }
  } catch (e) {
    console.error('Failed to check ElevenLabs config:', e)
  }
}

// Load ElevenLabs voices
async function loadElevenLabsVoices() {
  if (!elevenlabsConfigured.value) return

  isLoadingVoices.value = true
  voicesError.value = null

  try {
    const response = await api.getElevenLabsVoices()
    elevenlabsVoices.value = response.voices || []
  } catch (e) {
    voicesError.value = e instanceof Error ? e.message : t('errors.generic')
    elevenlabsVoices.value = []
  } finally {
    isLoadingVoices.value = false
  }
}

// Preview ElevenLabs voice
function previewVoice(voice: ElevenLabsVoice) {
  if (!voice.preview_url) return

  // Stop any existing preview
  if (previewAudio.value) {
    previewAudio.value.pause()
    previewAudio.value = null
  }

  if (previewingVoiceId.value === voice.voice_id) {
    previewingVoiceId.value = null
    return
  }

  previewingVoiceId.value = voice.voice_id
  previewAudio.value = new Audio(voice.preview_url)
  previewAudio.value.volume = config.value.volume / 100

  previewAudio.value.onended = () => {
    previewingVoiceId.value = null
  }

  previewAudio.value.onerror = () => {
    previewingVoiceId.value = null
  }

  previewAudio.value.play().catch(() => {
    previewingVoiceId.value = null
  })
}

// Get selected voice name
const selectedVoiceName = computed(() => {
  const voice = elevenlabsVoices.value.find(v => v.voice_id === config.value.elevenLabsVoiceId)
  return voice?.name || t('caller.selectVoice')
})

// Voice Pack functions
async function loadVoicePackStatus() {
  isLoadingVoicePackStatus.value = true
  try {
    const status = await api.getVoicePackStatus()
    voicePackStatus.value = status

    // Start polling if generation is in progress
    if (status.status === 'generating' && !voicePackPollingInterval.value) {
      startVoicePackPolling()
    }
    // Stop polling if no longer generating
    if (status.status !== 'generating' && voicePackPollingInterval.value) {
      stopVoicePackPolling()
    }
  } catch (e) {
    console.error('Failed to load voice pack status:', e)
  } finally {
    isLoadingVoicePackStatus.value = false
  }
}

function startVoicePackPolling() {
  if (voicePackPollingInterval.value) return
  voicePackPollingInterval.value = setInterval(async () => {
    try {
      const status = await api.getVoicePackStatus()
      voicePackStatus.value = status

      if (status.status !== 'generating') {
        stopVoicePackPolling()
      }
    } catch (e) {
      console.error('Polling error:', e)
    }
  }, 2000) // Poll every 2 seconds
}

function stopVoicePackPolling() {
  if (voicePackPollingInterval.value) {
    clearInterval(voicePackPollingInterval.value)
    voicePackPollingInterval.value = null
  }
}

async function startVoicePackGeneration() {
  if (!config.value.elevenLabsVoiceId) {
    saveMessage.value = { type: 'error', text: t('caller.voicePack.selectVoiceFirst') }
    return
  }

  try {
    // Get voice name for the pack
    const voice = elevenlabsVoices.value.find(v => v.voice_id === config.value.elevenLabsVoiceId)
    const voiceName = voice?.name

    const result = await api.generateVoicePack(config.value.elevenLabsVoiceId, config.value.language, voiceName)
    if (result.success) {
      saveMessage.value = { type: 'success', text: t('caller.voicePack.generationStarted') }
      startVoicePackPolling()
      loadVoicePackStatus()
    } else {
      saveMessage.value = { type: 'error', text: result.error || t('caller.voicePack.generationFailed') }
    }
  } catch (e) {
    saveMessage.value = { type: 'error', text: e instanceof Error ? e.message : t('caller.voicePack.generationFailed') }
  }
}

async function cancelVoicePackGeneration() {
  try {
    const result = await api.cancelVoicePackGeneration()
    if (result.success) {
      saveMessage.value = { type: 'success', text: t('caller.voicePack.generationCancelled') }
      stopVoicePackPolling()
      loadVoicePackStatus()
    } else {
      saveMessage.value = { type: 'error', text: result.error || t('errors.generic') }
    }
  } catch (e) {
    saveMessage.value = { type: 'error', text: e instanceof Error ? e.message : t('errors.generic') }
  }
}

async function deleteVoicePack(packId?: string) {
  const idToDelete = packId || selectedVoicePackId.value
  if (!idToDelete) {
    saveMessage.value = { type: 'error', text: t('caller.voicePack.selectPackFirst') }
    return
  }

  try {
    const result = await api.deleteVoicePack(idToDelete)
    if (result.success) {
      saveMessage.value = { type: 'success', text: t('caller.voicePack.deleted') }
      // Clear selection if we deleted the selected pack
      if (selectedVoicePackId.value === idToDelete) {
        selectedVoicePackId.value = ''
      }
      loadVoicePackStatus()
    } else {
      saveMessage.value = { type: 'error', text: result.error || t('errors.generic') }
    }
  } catch (e) {
    saveMessage.value = { type: 'error', text: e instanceof Error ? e.message : t('errors.generic') }
  }
}

// Voice Pack Upload
const isUploadingVoicePack = ref(false)
const voicePackFileInput = ref<HTMLInputElement | null>(null)

function triggerVoicePackUpload() {
  voicePackFileInput.value?.click()
}

async function handleVoicePackUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.zip')) {
    saveMessage.value = { type: 'error', text: t('caller.voicePack.invalidZipFile') }
    target.value = '' // Reset input
    return
  }

  isUploadingVoicePack.value = true
  saveMessage.value = null

  try {
    const result = await api.uploadVoicePack(file)
    if (result.success) {
      saveMessage.value = { type: 'success', text: t('caller.voicePack.uploadSuccess') }
      loadVoicePackStatus() // Refresh the list
    } else {
      saveMessage.value = { type: 'error', text: result.error || t('caller.voicePack.uploadFailed') }
    }
  } catch (e) {
    saveMessage.value = { type: 'error', text: e instanceof Error ? e.message : t('caller.voicePack.uploadFailed') }
  } finally {
    isUploadingVoicePack.value = false
    target.value = '' // Reset input for next upload
  }
}


// Cleanup on unmount
onUnmounted(() => {
  stopVoicePackPolling()
})

onMounted(() => {
  modulesStore.fetchModule(moduleId.value)
  playersStore.fetchPlayers()
  loadSystemVoices()
  checkElevenLabsConfig()
  loadVoicePackStatus()
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
        {{ t('common.back') }}
      </router-link>

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">{{ t('caller.title') }}</h1>
          <p class="text-dark-400 mt-1">{{ t('caller.subtitle') }}</p>
        </div>

        <BaseButton :loading="isSaving" @click="saveConfig">
          {{ t('common.save') }}
        </BaseButton>
      </div>

      <!-- Save Message -->
      <div
        v-if="saveMessage"
        :class="[
          'p-3 rounded-lg',
          saveMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
        ]"
      >
        {{ saveMessage.text }}
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 p-1 bg-dark-800 rounded-xl">
        <button
          v-for="tab in ['voice', 'events', 'players'] as const"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
            activeTab === tab
              ? 'bg-autodarts-600 text-white'
              : 'text-dark-400 hover:text-white hover:bg-dark-700',
          ]"
        >
          {{ t(`caller.tabs.${tab}`) }}
        </button>
      </div>

      <!-- Voice Settings Tab -->
      <template v-if="activeTab === 'voice'">
        <BaseCard :title="t('caller.voiceSettings')" :subtitle="t('caller.voiceSettingsDesc')">
          <div class="space-y-6">
            <!-- Voice Type Selection -->
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-3">{{ t('caller.voiceType') }}</label>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  v-for="type in ['system', 'elevenlabs', 'custom'] as const"
                  :key="type"
                  type="button"
                  @click="config.voiceType = type"
                  :class="[
                    'px-4 py-4 rounded-lg border-2 text-center transition-all',
                    config.voiceType === type
                      ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                      : 'border-dark-600 text-dark-400 hover:border-dark-500',
                  ]"
                >
                  <svg v-if="type === 'system'" class="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <svg v-else-if="type === 'elevenlabs'" class="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <svg v-else class="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
                  </svg>
                  {{ t(`caller.voiceTypes.${type}`) }}
                </button>
              </div>
            </div>

            <!-- Language -->
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">{{ t('caller.language') }}</label>
              <div class="flex gap-3">
                <button
                  v-for="lang in ['de', 'en'] as const"
                  :key="lang"
                  type="button"
                  @click="config.language = lang"
                  :class="[
                    'px-6 py-3 rounded-lg border-2 transition-all flex items-center gap-2',
                    config.language === lang
                      ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                      : 'border-dark-600 text-dark-400 hover:border-dark-500',
                  ]"
                >
                  <span class="text-xl">{{ lang === 'de' ? '🇩🇪' : '🇬🇧' }}</span>
                  {{ lang === 'de' ? 'Deutsch' : 'English' }}
                </button>
              </div>
            </div>

            <!-- System Voice Settings -->
            <template v-if="config.voiceType === 'system'">
              <div>
                <label class="block text-sm font-medium text-dark-200 mb-2">{{ t('caller.selectVoice') }}</label>
                <select
                  v-model="config.systemVoice"
                  class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                >
                  <option value="">{{ t('caller.defaultVoice') }}</option>
                  <option v-for="voice in availableVoices" :key="voice.name" :value="voice.name">
                    {{ voice.name }}
                  </option>
                </select>
                <p class="text-sm text-dark-400 mt-1">{{ t('caller.systemVoiceHint') }}</p>
              </div>
            </template>

            <!-- ElevenLabs Settings -->
            <template v-if="config.voiceType === 'elevenlabs'">
              <div class="space-y-4 p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <!-- Not configured warning -->
                <div v-if="!elevenlabsConfigured" class="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p class="text-amber-400 font-medium">{{ t('caller.elevenlabsNotConfigured') }}</p>
                      <p class="text-sm text-amber-300/70 mt-1">{{ t('caller.elevenlabsNotConfiguredDesc') }}</p>
                      <router-link to="/ai-settings" class="inline-flex items-center gap-1 text-sm text-autodarts-400 hover:underline mt-2">
                        {{ t('caller.goToSettings') }}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </router-link>
                    </div>
                  </div>
                </div>

                <!-- Voice Selection -->
                <template v-else>
                  <div>
                    <label class="block text-sm font-medium text-dark-200 mb-2">{{ t('caller.selectVoice') }}</label>

                    <!-- Loading -->
                    <div v-if="isLoadingVoices" class="flex items-center gap-2 text-dark-400 py-4">
                      <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {{ t('caller.loadingVoices') }}
                    </div>

                    <!-- Error -->
                    <div v-else-if="voicesError" class="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
                      {{ voicesError }}
                      <button @click="loadElevenLabsVoices" class="underline ml-2">{{ t('common.refresh') }}</button>
                    </div>

                    <!-- Voice Grid -->
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                      <button
                        v-for="voice in elevenlabsVoices"
                        :key="voice.voice_id"
                        type="button"
                        @click="config.elevenLabsVoiceId = voice.voice_id"
                        :class="[
                          'flex items-center justify-between p-3 rounded-lg border text-left transition-all group',
                          config.elevenLabsVoiceId === voice.voice_id
                            ? 'border-autodarts-500 bg-autodarts-500/10'
                            : 'border-dark-600 hover:border-dark-500 bg-dark-800',
                        ]"
                      >
                        <div class="min-w-0 flex-1">
                          <p :class="['font-medium truncate', config.elevenLabsVoiceId === voice.voice_id ? 'text-white' : 'text-dark-200']">
                            {{ voice.name }}
                          </p>
                          <p class="text-xs text-dark-500 truncate">
                            {{ voice.labels?.accent || voice.category }}
                          </p>
                        </div>
                        <button
                          v-if="voice.preview_url"
                          type="button"
                          @click.stop="previewVoice(voice)"
                          :class="[
                            'p-2 rounded-full transition-colors flex-shrink-0 ml-2',
                            previewingVoiceId === voice.voice_id
                              ? 'bg-autodarts-500 text-white'
                              : 'bg-dark-700 text-dark-400 hover:text-white opacity-0 group-hover:opacity-100',
                          ]"
                        >
                          <svg v-if="previewingVoiceId === voice.voice_id" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </button>
                    </div>

                    <!-- Selected voice info -->
                    <div v-if="config.elevenLabsVoiceId" class="mt-3 p-3 rounded-lg bg-autodarts-500/10 border border-autodarts-500/30">
                      <p class="text-sm text-dark-300">
                        {{ t('caller.selectedVoice') }}: <span class="text-white font-medium">{{ selectedVoiceName }}</span>
                      </p>
                    </div>
                  </div>
                </template>
              </div>
            </template>

            <!-- Custom Voice Settings -->
            <template v-if="config.voiceType === 'custom'">
              <div class="space-y-4 p-4 rounded-lg bg-dark-700/50 border border-dark-600">
                <BaseInput
                  v-model="config.customVoiceUrl"
                  :label="t('caller.customVoiceUrl')"
                  placeholder="http://localhost:5000/tts"
                />
                <p class="text-sm text-dark-400">{{ t('caller.customVoiceHint') }}</p>
              </div>
            </template>

            <!-- Audio Settings -->
            <div class="space-y-4 pt-4 border-t border-dark-700">
              <h4 class="text-white font-medium">{{ t('caller.audioSettings') }}</h4>

              <div>
                <label class="block text-sm font-medium text-dark-200 mb-2">
                  {{ t('caller.volume') }}: {{ config.volume }}%
                </label>
                <input
                  type="range"
                  v-model.number="config.volume"
                  min="0"
                  max="100"
                  class="w-full accent-autodarts-500"
                />
              </div>

              <div v-if="config.voiceType === 'system'">
                <label class="block text-sm font-medium text-dark-200 mb-2">
                  {{ t('caller.pitch') }}: {{ config.pitch }}%
                </label>
                <input
                  type="range"
                  v-model.number="config.pitch"
                  min="50"
                  max="200"
                  class="w-full accent-autodarts-500"
                />
              </div>

              <div v-if="config.voiceType === 'system'">
                <label class="block text-sm font-medium text-dark-200 mb-2">
                  {{ t('caller.rate') }}: {{ config.rate }}%
                </label>
                <input
                  type="range"
                  v-model.number="config.rate"
                  min="50"
                  max="200"
                  class="w-full accent-autodarts-500"
                />
              </div>
            </div>

            <!-- Test Voice Button -->
            <div class="flex justify-end pt-4">
              <BaseButton
                variant="secondary"
                :loading="isTestingVoice"
                @click="testVoice"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
                </svg>
                {{ t('caller.testVoice') }}
              </BaseButton>
            </div>
          </div>
        </BaseCard>

        <!-- Voice Pack Generation (ElevenLabs only) -->
        <BaseCard
          v-if="config.voiceType === 'elevenlabs' && elevenlabsConfigured"
          :title="t('caller.voicePack.title')"
          :subtitle="t('caller.voicePack.subtitle')"
        >
          <div class="space-y-4">
            <!-- Existing Voice Packs List -->
            <div v-if="voicePackStatus.packs.length > 0" class="space-y-3">
              <label class="block text-sm font-medium text-dark-200">{{ t('caller.voicePack.availablePacks') }}</label>
              <div class="space-y-2">
                <div
                  v-for="pack in voicePackStatus.packs"
                  :key="pack.id"
                  :class="[
                    'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all',
                    selectedVoicePackId === pack.id
                      ? 'border-autodarts-500 bg-autodarts-500/10'
                      : 'border-dark-600 bg-dark-800 hover:border-dark-500',
                  ]"
                  @click="selectedVoicePackId = pack.id"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div :class="[
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                      selectedVoicePackId === pack.id ? 'border-autodarts-500' : 'border-dark-500'
                    ]">
                      <div v-if="selectedVoicePackId === pack.id" class="w-2 h-2 rounded-full bg-autodarts-500" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-white font-medium truncate">{{ pack.name }}</p>
                      <p class="text-xs text-dark-400">
                        {{ pack.language.toUpperCase() }} • {{ pack.totalFiles }} {{ t('caller.voicePack.files') }} •
                        {{ new Date(pack.generatedAt).toLocaleDateString() }}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="p-2 text-dark-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    @click.stop="deleteVoicePack(pack.id)"
                    :title="t('common.delete')"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- No Packs Info -->
            <div v-else-if="voicePackStatus.status === 'idle'" class="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-dark-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <div>
                  <p class="text-dark-300 font-medium">{{ t('caller.voicePack.noPacks') }}</p>
                  <p class="text-sm text-dark-400 mt-1">{{ t('caller.voicePack.noPacksDesc') }}</p>
                </div>
              </div>
            </div>

            <!-- Generation Status (when generating) -->
            <div
              v-if="voicePackStatus.status === 'generating'"
              class="p-4 rounded-lg border bg-autodarts-500/10 border-autodarts-500/30"
            >
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-autodarts-400 animate-spin flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div class="flex-1 min-w-0">
                  <p class="text-autodarts-400 font-medium">{{ t('caller.voicePack.statusGenerating') }}</p>
                  <p class="text-sm text-dark-400 mt-1">
                    {{ t('caller.voicePack.generatingDesc', { current: voicePackStatus.completedItems || 0, total: voicePackStatus.totalItems || '?' }) }}
                    <span v-if="voicePackStatus.currentItem" class="block text-xs mt-0.5 text-dark-500">
                      {{ voicePackStatus.currentItem }}
                    </span>
                  </p>
                  <!-- Progress Bar -->
                  <div class="mt-3">
                    <div class="flex items-center justify-between text-xs text-dark-400 mb-1">
                      <span>{{ t('common.progress') }}</span>
                      <span>{{ Math.round(voicePackStatus.progress) }}%</span>
                    </div>
                    <div class="h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-autodarts-500 rounded-full transition-all duration-500"
                        :style="{ width: `${voicePackStatus.progress}%` }"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Generation Error -->
            <div
              v-if="voicePackStatus.status === 'failed'"
              class="p-4 rounded-lg border bg-red-500/10 border-red-500/30"
            >
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-red-400 font-medium">{{ t('caller.voicePack.statusFailed') }}</p>
                  <p class="text-sm text-red-300/70 mt-1">{{ voicePackStatus.error || t('caller.voicePack.failedDesc') }}</p>
                </div>
              </div>
            </div>

            <!-- Generation Completed -->
            <div
              v-if="voicePackStatus.status === 'completed'"
              class="p-4 rounded-lg border bg-green-500/10 border-green-500/30"
            >
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-green-400 font-medium">{{ t('caller.voicePack.statusCompleted') }}</p>
                  <p class="text-sm text-dark-400 mt-1">{{ t('caller.voicePack.completedDesc') }}</p>
                </div>
              </div>
            </div>

            <!-- Info Box -->
            <div class="p-3 rounded-lg bg-dark-700/50 border border-dark-600">
              <p class="text-sm text-dark-400">
                <svg class="w-4 h-4 inline-block mr-1.5 -mt-0.5 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ t('caller.voicePack.info') }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap items-center gap-3 pt-2">
              <!-- Generate New Button -->
              <BaseButton
                v-if="voicePackStatus.status !== 'generating'"
                :disabled="!config.elevenLabsVoiceId"
                @click="startVoicePackGeneration"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {{ t('caller.voicePack.generateNew') }}
              </BaseButton>

              <!-- Upload Voice Pack Button -->
              <BaseButton
                v-if="voicePackStatus.status !== 'generating'"
                variant="secondary"
                :loading="isUploadingVoicePack"
                @click="triggerVoicePackUpload"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {{ isUploadingVoicePack ? t('caller.voicePack.uploading') : t('caller.voicePack.upload') }}
              </BaseButton>
              <input
                ref="voicePackFileInput"
                type="file"
                accept=".zip"
                class="hidden"
                @change="handleVoicePackUpload"
              />

              <!-- Cancel Button -->
              <BaseButton
                v-if="voicePackStatus.status === 'generating'"
                variant="secondary"
                @click="cancelVoicePackGeneration"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                {{ t('common.cancel') }}
              </BaseButton>

              <!-- Refresh Button -->
              <BaseButton
                variant="ghost"
                :loading="isLoadingVoicePackStatus"
                @click="loadVoicePackStatus"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </BaseButton>
            </div>

            <!-- Voice Selection Warning -->
            <p v-if="!config.elevenLabsVoiceId" class="text-sm text-amber-400 flex items-center gap-2">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ t('caller.voicePack.selectVoiceFirst') }}
            </p>
          </div>
        </BaseCard>

        <!-- Caller Behavior -->
        <BaseCard :title="t('caller.behavior')" :subtitle="t('caller.behaviorDesc')">
          <div class="space-y-4">
            <!-- Call Scores -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <div>
                <p class="text-white font-medium">{{ t('caller.callScores') }}</p>
                <p class="text-sm text-dark-400 mt-1">{{ t('caller.callScoresDesc') }}</p>
              </div>
              <button
                type="button"
                @click="config.callScores = !config.callScores"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  config.callScores ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    config.callScores ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <!-- Call Remaining -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <div>
                <p class="text-white font-medium">{{ t('caller.callRemaining') }}</p>
                <p class="text-sm text-dark-400 mt-1">{{ t('caller.callRemainingDesc') }}</p>
              </div>
              <button
                type="button"
                @click="config.callRemaining = !config.callRemaining"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  config.callRemaining ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    config.callRemaining ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <!-- Call Checkouts -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <div>
                <p class="text-white font-medium">{{ t('caller.callCheckouts') }}</p>
                <p class="text-sm text-dark-400 mt-1">{{ t('caller.callCheckoutsDesc') }}</p>
              </div>
              <button
                type="button"
                @click="config.callCheckouts = !config.callCheckouts"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  config.callCheckouts ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    config.callCheckouts ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <!-- Checkout Threshold -->
            <div v-if="config.callCheckouts" class="pl-4 border-l-2 border-autodarts-500/30">
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.checkoutThreshold') }}: {{ config.checkoutThreshold }}
              </label>
              <input
                type="range"
                v-model.number="config.checkoutThreshold"
                min="2"
                max="170"
                class="w-full accent-autodarts-500"
              />
              <div class="flex justify-between text-sm text-dark-400 mt-1">
                <span>2</span>
                <span>170</span>
              </div>
            </div>

            <!-- Call Player Names -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <div>
                <p class="text-white font-medium">{{ t('caller.callPlayerNames') }}</p>
                <p class="text-sm text-dark-400 mt-1">{{ t('caller.callPlayerNamesDesc') }}</p>
              </div>
              <button
                type="button"
                @click="config.callPlayerNames = !config.callPlayerNames"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  config.callPlayerNames ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    config.callPlayerNames ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>
          </div>
        </BaseCard>
      </template>

      <!-- Events Tab -->
      <template v-if="activeTab === 'events'">
        <BaseCard :title="t('caller.eventConfig')" :subtitle="t('caller.eventConfigDesc')">
          <div class="space-y-6">
            <div v-for="category in eventCategories" :key="category.id" class="space-y-3">
              <h3 class="text-sm font-medium text-dark-300 uppercase tracking-wider">
                {{ category.title }}
              </h3>
              <div class="space-y-2">
                <CallerEventConfig
                  v-for="event in category.events"
                  :key="event.key"
                  :event-key="event.key"
                  :event-label="event.label"
                  :event-description="event.description"
                  :config="getEventConfig(event.key)"
                  @update="updateEventConfig(event.key, $event)"
                />
              </div>
            </div>
          </div>
        </BaseCard>
      </template>

      <!-- Players Tab -->
      <template v-if="activeTab === 'players'">
        <BaseCard :title="t('caller.playerOverrides')" :subtitle="t('caller.playerOverridesDesc')">
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
                    {{ t('caller.customSettingsActive') }}
                  </p>
                  <p v-else class="text-xs text-dark-500 mt-0.5">
                    {{ t('caller.usingDefaultSettings') }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <BaseButton
                  variant="ghost"
                  size="sm"
                  @click="openPlayerOverrideEditor(player.name)"
                >
                  {{ hasPlayerOverride(player.name) ? t('common.edit') : t('caller.configure') }}
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
              {{ t('caller.noPlayers') }}
              <router-link to="/players" class="text-autodarts-400 hover:underline">
                {{ t('caller.createPlayers') }}
              </router-link>
            </p>
          </div>
        </BaseCard>

        <!-- Custom Sound Packs -->
        <BaseCard :title="t('caller.soundPacks')" :subtitle="t('caller.soundPacksDesc')">
          <div class="space-y-4">
            <p class="text-dark-400">{{ t('caller.soundPacksInfo') }}</p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MediaUpload
                :model-value="getEventConfig('180').soundUrl || ''"
                :label="t('caller.sound180')"
                media-type="sound"
                accept="audio/mpeg,audio/wav,audio/ogg"
                @update:model-value="(v) => updateEventConfig('180', { ...getEventConfig('180'), soundUrl: v, useCustomSound: !!v })"
              />

              <MediaUpload
                :model-value="getEventConfig('gameOn').soundUrl || ''"
                :label="t('caller.soundGameOn')"
                media-type="sound"
                accept="audio/mpeg,audio/wav,audio/ogg"
                @update:model-value="(v) => updateEventConfig('gameOn', { ...getEventConfig('gameOn'), soundUrl: v, useCustomSound: !!v })"
              />
            </div>
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
          <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-lg w-full">
            <h3 class="text-lg font-semibold text-white mb-4">
              {{ t('caller.playerSettings') }}: {{ selectedPlayerOverride }}
            </h3>

            <div class="space-y-4">
              <!-- Custom Greeting -->
              <BaseInput
                :model-value="ensurePlayerOverride(selectedPlayerOverride!).customGreeting || ''"
                @update:model-value="ensurePlayerOverride(selectedPlayerOverride!).customGreeting = $event"
                :label="t('caller.customGreeting')"
                :placeholder="t('caller.customGreetingPlaceholder')"
              />

              <!-- Custom 180 Sound -->
              <MediaUpload
                :model-value="ensurePlayerOverride(selectedPlayerOverride!).customSounds?.['180'] || ''"
                @update:model-value="(v: string) => { const o = ensurePlayerOverride(selectedPlayerOverride!); if (!o.customSounds) o.customSounds = {}; o.customSounds['180'] = v; }"
                :label="t('caller.custom180Sound')"
                media-type="sound"
                accept="audio/mpeg,audio/wav,audio/ogg"
              />
            </div>

            <div class="flex items-center justify-end gap-3 mt-6">
              <BaseButton variant="ghost" @click="closePlayerOverrideModal">
                {{ t('common.cancel') }}
              </BaseButton>
              <BaseButton @click="closePlayerOverrideModal">
                {{ t('common.save') }}
              </BaseButton>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </AppLayout>
</template>
