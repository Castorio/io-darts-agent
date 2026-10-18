<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import {
  CALLER_LANGUAGES,
  CALLER_TYPES,
  DARTS_CALLER_DEFAULTS,
  toDartsCallerForm,
  type DartsCallerForm,
} from '../lib/dartsCallerConfig'
import { applyCallerTts } from '../lib/callerTts'

// ElevenLabs voice interface
interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels?: Record<string, string>
  preview_url?: string
}

const { t } = useI18n()

type CallToggle = Exclude<keyof DartsCallerForm['callSettings'], 'checkoutThreshold' | 'cricketMarksThreshold'>

// Every toggle maps 1:1 onto a callSettings field the handler reads
const callToggles: Array<{ key: CallToggle; label: string; desc: string; parent?: CallToggle }> = [
  { key: 'scores', label: 'caller.callScores', desc: 'caller.callScoresDesc' },
  { key: 'highScoresOnly', label: 'caller.highScoresOnly', desc: 'caller.highScoresOnlyDesc', parent: 'scores' },
  { key: 'special180', label: 'caller.call180', desc: 'caller.call180Desc' },
  { key: 'busts', label: 'caller.callBusts', desc: 'caller.callBustsDesc' },
  { key: 'bulls', label: 'caller.callBulls', desc: 'caller.callBullsDesc' },
  { key: 'doubleBulls', label: 'caller.callDoubleBulls', desc: 'caller.callDoubleBullsDesc' },
  { key: 'playerChange', label: 'caller.callPlayerNames', desc: 'caller.callPlayerNamesDesc' },
  { key: 'checkouts', label: 'caller.callCheckouts', desc: 'caller.callCheckoutsDesc' },
  { key: 'gameStart', label: 'caller.callGameStart', desc: 'caller.callGameStartDesc' },
  { key: 'gameOver', label: 'caller.callGameOver', desc: 'caller.callGameOverDesc' },
  { key: 'cricketClosed', label: 'caller.callCricketClosed', desc: 'caller.callCricketClosedDesc' },
  { key: 'cricketMarks', label: 'caller.callCricketMarks', desc: 'caller.callCricketMarksDesc' },
]

const route = useRoute()
const modulesStore = useModulesStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Configuration state (same shape as module.json and the hub handler)
const config = ref<DartsCallerForm>(toDartsCallerForm(DARTS_CALLER_DEFAULTS))

// Sliders show percent, the config stores factors (0.5 to 2.0)
const ratePercent = computed({
  get: () => Math.round(config.value.ttsSettings.rate * 100),
  set: (v: number) => { config.value.ttsSettings.rate = v / 100 },
})
const pitchPercent = computed({
  get: () => Math.round(config.value.ttsSettings.pitch * 100),
  set: (v: number) => { config.value.ttsSettings.pitch = v / 100 },
})

const usesElevenlabsVoice = computed(
  () => config.value.callerType === 'elevenlabs' || config.value.callerType === 'voicepack'
)

// Available system voices
const systemVoices = ref<SpeechSynthesisVoice[]>([])
const availableVoices = computed(() => {
  const lang = config.value.language
  return systemVoices.value.filter(v => v.lang.toLowerCase().startsWith(lang))
})

// UI State
const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const isTestingVoice = ref(false)

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

// Load config from module (the hub already migrated older shapes)
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      config.value = toDartsCallerForm(values)
    }
  },
  { immediate: true }
)

function setMessage(type: 'success' | 'error', text: string, autoHide = false) {
  saveMessage.value = { type, text }
  if (autoHide) {
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  }
}

async function persistConfig(): Promise<void> {
  if (!module.value) return
  await modulesStore.updateConfig(module.value.id, { ...config.value } as unknown as Record<string, unknown>)
}

// Save configuration
async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    await persistConfig()
    setMessage('success', t('common.success'), true)
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('errors.generic'))
  } finally {
    isSaving.value = false
  }
}

// Selecting a voice pack saves right away (as before)
async function selectVoicePack(packId: string) {
  config.value.voicepackSettings.packId = packId
  try {
    await persistConfig()
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('errors.generic'))
  }
}

// Test voice
async function testVoice() {
  isTestingVoice.value = true
  saveMessage.value = null

  // Browser TTS: speak right here with the current (unsaved) settings
  if (config.value.callerType === 'tts') {
    if (!('speechSynthesis' in window)) {
      setMessage('error', t('caller.testFailed'))
      isTestingVoice.value = false
      return
    }
    const utterance = new SpeechSynthesisUtterance('One hundred and eighty! Game on!')
    applyCallerTts(utterance, {
      voice: config.value.ttsSettings.voice,
      rate: config.value.ttsSettings.rate,
      pitch: config.value.ttsSettings.pitch,
      volume: config.value.volume,
      lang: config.value.language === 'de' ? 'de-DE' : 'en-GB',
    }, systemVoices.value, 1)
    utterance.onend = () => { isTestingVoice.value = false }
    utterance.onerror = () => {
      isTestingVoice.value = false
      setMessage('error', t('caller.testFailed'))
    }
    speechSynthesis.speak(utterance)
    return
  }

  // Server side caller types: trigger a real call with the saved settings
  try {
    await api.testCaller(180)
    setMessage('success', t('caller.testStarted'), true)
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('caller.testFailed'))
  } finally {
    isTestingVoice.value = false
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
  const voice = elevenlabsVoices.value.find(v => v.voice_id === config.value.elevenlabsSettings.voiceId)
  return voice?.name || config.value.elevenlabsSettings.voiceId || t('caller.selectVoice')
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
  const voiceId = config.value.elevenlabsSettings.voiceId
  if (!voiceId) {
    setMessage('error', t('caller.voicePack.selectVoiceFirst'))
    return
  }

  try {
    // Get voice name for the pack
    const voice = elevenlabsVoices.value.find(v => v.voice_id === voiceId)
    const result = await api.generateVoicePack(voiceId, config.value.language, voice?.name)
    if (result.success) {
      setMessage('success', t('caller.voicePack.generationStarted'))
      startVoicePackPolling()
      loadVoicePackStatus()
    } else {
      setMessage('error', result.error || t('caller.voicePack.generationFailed'))
    }
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('caller.voicePack.generationFailed'))
  }
}

// Generate only the audio files a pack is still missing (e.g. after adding
// new phrases). Per pack, only shown once ElevenLabs is configured.
const generatingMissingFor = ref<string | null>(null)

async function generateMissingAnnouncements(pack: VoicePack) {
  generatingMissingFor.value = pack.id
  try {
    const result = await api.generateVoicePack(pack.voiceId, pack.language as 'de' | 'en', pack.name, pack.id)
    if (result.success) {
      setMessage('success', t('caller.voicePack.generationStarted'))
      startVoicePackPolling()
      loadVoicePackStatus()
    } else {
      setMessage('error', result.error || t('caller.voicePack.generationFailed'))
    }
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('caller.voicePack.generationFailed'))
  } finally {
    generatingMissingFor.value = null
  }
}

async function cancelVoicePackGeneration() {
  try {
    const result = await api.cancelVoicePackGeneration()
    if (result.success) {
      setMessage('success', t('caller.voicePack.generationCancelled'))
      stopVoicePackPolling()
      loadVoicePackStatus()
    } else {
      setMessage('error', result.error || t('errors.generic'))
    }
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('errors.generic'))
  }
}

async function deleteVoicePack(packId: string) {
  try {
    const result = await api.deleteVoicePack(packId)
    if (result.success) {
      setMessage('success', t('caller.voicePack.deleted'))
      // Clear selection if we deleted the selected pack
      if (config.value.voicepackSettings.packId === packId) {
        await selectVoicePack('')
      }
      loadVoicePackStatus()
    } else {
      setMessage('error', result.error || t('errors.generic'))
    }
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('errors.generic'))
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
    setMessage('error', t('caller.voicePack.invalidZipFile'))
    target.value = '' // Reset input
    return
  }

  isUploadingVoicePack.value = true
  saveMessage.value = null

  try {
    const result = await api.uploadVoicePack(file)
    if (result.success) {
      setMessage('success', t('caller.voicePack.uploadSuccess'))
      loadVoicePackStatus() // Refresh the list
    } else {
      setMessage('error', result.error || t('caller.voicePack.uploadFailed'))
    }
  } catch (e) {
    setMessage('error', e instanceof Error ? e.message : t('caller.voicePack.uploadFailed'))
  } finally {
    isUploadingVoicePack.value = false
    target.value = '' // Reset input for next upload
  }
}

// Cleanup on unmount
onUnmounted(() => {
  stopVoicePackPolling()
  previewAudio.value?.pause()
})

onMounted(() => {
  modulesStore.fetchModule(moduleId.value)
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

      <BaseCard :title="t('caller.voiceSettings')" :subtitle="t('caller.voiceSettingsDesc')">
        <div class="space-y-6">
          <!-- Caller Type Selection -->
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-3">{{ t('caller.callerType') }}</label>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                v-for="type in CALLER_TYPES"
                :key="type"
                type="button"
                data-testid="caller-type"
                @click="config.callerType = type"
                :class="[
                  'px-4 py-4 rounded-lg border-2 text-center transition-all',
                  config.callerType === type
                    ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                    : 'border-dark-600 text-dark-400 hover:border-dark-500',
                ]"
              >
                {{ t(`caller.callerTypes.${type}`) }}
              </button>
            </div>
            <p class="text-sm text-dark-400 mt-2">{{ t(`caller.callerTypeHints.${config.callerType}`) }}</p>
          </div>

          <!-- Language -->
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-2">{{ t('caller.language') }}</label>
            <div class="flex gap-3">
              <button
                v-for="lang in CALLER_LANGUAGES"
                :key="lang"
                type="button"
                @click="config.language = lang"
                :class="[
                  'px-6 py-3 rounded-lg border-2 transition-all',
                  config.language === lang
                    ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                    : 'border-dark-600 text-dark-400 hover:border-dark-500',
                ]"
              >
                {{ lang === 'de' ? 'Deutsch' : 'English' }}
              </button>
            </div>
            <p class="text-sm text-dark-400 mt-2">{{ t('caller.languageHint') }}</p>
          </div>

          <!-- Browser TTS Settings -->
          <template v-if="config.callerType === 'tts'">
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">{{ t('caller.selectVoice') }}</label>
              <select
                v-model="config.ttsSettings.voice"
                class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
              >
                <option value="">{{ t('caller.defaultVoice') }}</option>
                <option v-for="voice in availableVoices" :key="voice.name" :value="voice.name">
                  {{ voice.name }}
                </option>
              </select>
              <p class="text-sm text-dark-400 mt-1">{{ t('caller.systemVoiceHint') }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.pitch') }}: {{ pitchPercent }}%
              </label>
              <input type="range" v-model.number="pitchPercent" min="50" max="200" class="w-full accent-autodarts-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.rate') }}: {{ ratePercent }}%
              </label>
              <input type="range" v-model.number="ratePercent" min="50" max="200" class="w-full accent-autodarts-500" />
            </div>
          </template>

          <!-- ElevenLabs voice (live calls and new voice packs) -->
          <template v-if="usesElevenlabsVoice">
            <div class="space-y-4 p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <!-- Not configured warning -->
              <div v-if="!elevenlabsConfigured" class="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p class="text-amber-400 font-medium">{{ t('caller.elevenlabsNotConfigured') }}</p>
                    <p class="text-sm text-amber-300/70 mt-1">
                      {{ config.callerType === 'voicepack' ? t('caller.voicePack.needsElevenlabs') : t('caller.elevenlabsNotConfiguredDesc') }}
                    </p>
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
                  <label class="block text-sm font-medium text-dark-200 mb-2">
                    {{ config.callerType === 'voicepack' ? t('caller.elevenlabsVoiceForPacks') : t('caller.selectVoice') }}
                  </label>

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
                    <div
                      v-for="voice in elevenlabsVoices"
                      :key="voice.voice_id"
                      role="button"
                      tabindex="0"
                      @click="config.elevenlabsSettings.voiceId = voice.voice_id"
                      @keydown.enter="config.elevenlabsSettings.voiceId = voice.voice_id"
                      :class="[
                        'flex items-center justify-between p-3 rounded-lg border text-left transition-all group cursor-pointer',
                        config.elevenlabsSettings.voiceId === voice.voice_id
                          ? 'border-autodarts-500 bg-autodarts-500/10'
                          : 'border-dark-600 hover:border-dark-500 bg-dark-800',
                      ]"
                    >
                      <div class="min-w-0 flex-1">
                        <p :class="['font-medium truncate', config.elevenlabsSettings.voiceId === voice.voice_id ? 'text-white' : 'text-dark-200']">
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
                    </div>
                  </div>

                  <!-- Selected voice info -->
                  <div v-if="config.elevenlabsSettings.voiceId" class="mt-3 p-3 rounded-lg bg-autodarts-500/10 border border-autodarts-500/30">
                    <p class="text-sm text-dark-300">
                      {{ t('caller.selectedVoice') }}: <span class="text-white font-medium">{{ selectedVoiceName }}</span>
                    </p>
                  </div>
                </div>

                <!-- Live voice parameters -->
                <template v-if="config.callerType === 'elevenlabs'">
                  <div>
                    <label class="block text-sm font-medium text-dark-200 mb-2">
                      {{ t('caller.stability') }}: {{ config.elevenlabsSettings.stability.toFixed(2) }}
                    </label>
                    <input type="range" v-model.number="config.elevenlabsSettings.stability" min="0" max="1" step="0.05" class="w-full accent-autodarts-500" />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-dark-200 mb-2">
                      {{ t('caller.similarity') }}: {{ config.elevenlabsSettings.similarity.toFixed(2) }}
                    </label>
                    <input type="range" v-model.number="config.elevenlabsSettings.similarity" min="0" max="1" step="0.05" class="w-full accent-autodarts-500" />
                  </div>
                </template>
              </template>
            </div>
          </template>

          <!-- Custom Audio Files -->
          <template v-if="config.callerType === 'audio'">
            <div class="space-y-2 p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <BaseInput
                v-model="config.audioSettings.packPath"
                :label="t('caller.audioPackPath')"
                placeholder="caller/default"
              />
              <p class="text-sm text-dark-400">{{ t('caller.audioPackPathHint') }}</p>
            </div>
          </template>

          <!-- Audio Settings -->
          <div class="space-y-4 pt-4 border-t border-dark-700">
            <h4 class="text-white font-medium">{{ t('caller.audioSettings') }}</h4>

            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.volume') }}: {{ config.volume }}%
              </label>
              <input type="range" v-model.number="config.volume" min="0" max="100" class="w-full accent-autodarts-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.delay') }}: {{ config.delayMs }} ms
              </label>
              <input type="range" v-model.number="config.delayMs" min="0" max="2000" step="50" class="w-full accent-autodarts-500" />
            </div>
          </div>

          <!-- Test Voice Button -->
          <div class="flex flex-col items-end gap-2 pt-4">
            <BaseButton variant="secondary" :loading="isTestingVoice" @click="testVoice">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
              </svg>
              {{ t('caller.testVoice') }}
            </BaseButton>
            <p v-if="config.callerType !== 'tts'" class="text-sm text-dark-400 text-right">{{ t('caller.testSavedHint') }}</p>
          </div>
        </div>
      </BaseCard>

      <!-- Voice Packs -->
      <BaseCard
        v-if="config.callerType === 'voicepack'"
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
                  'rounded-lg border transition-all',
                  config.voicepackSettings.packId === pack.id
                    ? 'border-autodarts-500 bg-autodarts-500/10'
                    : 'border-dark-600 bg-dark-800 hover:border-dark-500',
                ]"
              >
                <div
                  class="flex items-center justify-between p-3 cursor-pointer"
                  @click="selectVoicePack(pack.id)"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <div :class="[
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                      config.voicepackSettings.packId === pack.id ? 'border-autodarts-500' : 'border-dark-500'
                    ]">
                      <div v-if="config.voicepackSettings.packId === pack.id" class="w-2 h-2 rounded-full bg-autodarts-500" />
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

                <!-- Generate only the audio files this pack is still missing -->
                <div
                  v-if="elevenlabsConfigured && voicePackStatus.status !== 'generating'"
                  class="flex items-center gap-2 px-3 pb-3"
                  @click.stop
                >
                  <BaseButton
                    variant="ghost"
                    :loading="generatingMissingFor === pack.id"
                    @click="generateMissingAnnouncements(pack)"
                  >
                    {{ t('caller.voicePack.generateMissing') }}
                  </BaseButton>
                  <p class="text-xs text-dark-500">{{ t('caller.voicePack.generateMissingHint') }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- No Packs Info -->
          <div v-else-if="voicePackStatus.status === 'idle'" class="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
            <p class="text-dark-300 font-medium">{{ t('caller.voicePack.noPacks') }}</p>
            <p class="text-sm text-dark-400 mt-1">{{ t('caller.voicePack.noPacksDesc') }}</p>
          </div>

          <!-- Generation Status (when generating) -->
          <div
            v-if="voicePackStatus.status === 'generating'"
            class="p-4 rounded-lg border bg-autodarts-500/10 border-autodarts-500/30"
          >
            <p class="text-autodarts-400 font-medium">{{ t('caller.voicePack.statusGenerating') }}</p>
            <p class="text-sm text-dark-400 mt-1">
              {{ t('caller.voicePack.generatingDesc', { current: voicePackStatus.completedItems || 0, total: voicePackStatus.totalItems || '?' }) }}
              <span v-if="voicePackStatus.currentItem" class="block text-xs mt-0.5 text-dark-500">
                {{ voicePackStatus.currentItem }}
              </span>
            </p>
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

          <!-- Generation Error -->
          <div v-if="voicePackStatus.status === 'failed'" class="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
            <p class="text-red-400 font-medium">{{ t('caller.voicePack.statusFailed') }}</p>
            <p class="text-sm text-red-300/70 mt-1">{{ voicePackStatus.error || t('caller.voicePack.failedDesc') }}</p>
          </div>

          <!-- Generation Completed -->
          <div v-if="voicePackStatus.status === 'completed'" class="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
            <p class="text-green-400 font-medium">{{ t('caller.voicePack.statusCompleted') }}</p>
            <p class="text-sm text-dark-400 mt-1">{{ t('caller.voicePack.completedDesc') }}</p>
          </div>

          <!-- Info Box -->
          <div class="p-3 rounded-lg bg-dark-700/50 border border-dark-600">
            <p class="text-sm text-dark-400">{{ t('caller.voicePack.info') }}</p>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <BaseButton
              v-if="voicePackStatus.status !== 'generating' && elevenlabsConfigured"
              :disabled="!config.elevenlabsSettings.voiceId"
              @click="startVoicePackGeneration"
            >
              {{ t('caller.voicePack.generateNew') }}
            </BaseButton>

            <BaseButton
              v-if="voicePackStatus.status !== 'generating'"
              variant="secondary"
              :loading="isUploadingVoicePack"
              @click="triggerVoicePackUpload"
            >
              {{ isUploadingVoicePack ? t('caller.voicePack.uploading') : t('caller.voicePack.upload') }}
            </BaseButton>
            <input
              ref="voicePackFileInput"
              type="file"
              accept=".zip"
              class="hidden"
              @change="handleVoicePackUpload"
            />

            <BaseButton
              v-if="voicePackStatus.status === 'generating'"
              variant="secondary"
              @click="cancelVoicePackGeneration"
            >
              {{ t('common.cancel') }}
            </BaseButton>

            <BaseButton variant="ghost" :loading="isLoadingVoicePackStatus" @click="loadVoicePackStatus">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </BaseButton>
          </div>

          <p v-if="elevenlabsConfigured && !config.elevenlabsSettings.voiceId" class="text-sm text-amber-400">
            {{ t('caller.voicePack.selectVoiceFirst') }}
          </p>
        </div>
      </BaseCard>

      <!-- Caller Behavior -->
      <BaseCard :title="t('caller.behavior')" :subtitle="t('caller.behaviorDesc')">
        <div class="space-y-3">
          <template v-for="toggle in callToggles" :key="toggle.key">
            <div
              v-if="!toggle.parent || config.callSettings[toggle.parent]"
              :class="[
                'flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600',
                toggle.parent ? 'ml-4' : '',
              ]"
            >
              <div>
                <p class="text-white font-medium">{{ t(toggle.label) }}</p>
                <p class="text-sm text-dark-400 mt-1">{{ t(toggle.desc) }}</p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="config.callSettings[toggle.key]"
                :aria-label="t(toggle.label)"
                :data-testid="`toggle-${toggle.key}`"
                @click="config.callSettings[toggle.key] = !config.callSettings[toggle.key]"
                :class="[
                  'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
                  config.callSettings[toggle.key] ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    config.callSettings[toggle.key] ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <!-- Checkout Threshold -->
            <div
              v-if="toggle.key === 'checkouts' && config.callSettings.checkouts"
              class="ml-4 pl-4 border-l-2 border-autodarts-500/30"
            >
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.checkoutThreshold') }}: {{ config.callSettings.checkoutThreshold }}
              </label>
              <input
                type="range"
                v-model.number="config.callSettings.checkoutThreshold"
                min="2"
                max="170"
                class="w-full accent-autodarts-500"
              />
              <div class="flex justify-between text-sm text-dark-400 mt-1">
                <span>2</span>
                <span>170</span>
              </div>
            </div>

            <!-- Cricket Marks Threshold -->
            <div
              v-if="toggle.key === 'cricketMarks' && config.callSettings.cricketMarks"
              class="ml-4 pl-4 border-l-2 border-autodarts-500/30"
            >
              <label class="block text-sm font-medium text-dark-200 mb-2">
                {{ t('caller.cricketMarksThreshold') }}: {{ config.callSettings.cricketMarksThreshold }}
              </label>
              <input
                type="range"
                v-model.number="config.callSettings.cricketMarksThreshold"
                min="3"
                max="9"
                class="w-full accent-autodarts-500"
              />
              <div class="flex justify-between text-sm text-dark-400 mt-1">
                <span>3</span>
                <span>9</span>
              </div>
            </div>
          </template>
        </div>
      </BaseCard>
    </div>
  </AppLayout>
</template>
