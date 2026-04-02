<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

// Provider type definitions
interface AIProvider {
  id: string
  type: string
  name: string
  enabled: boolean
  configured: boolean
  capabilities: string[]
  hasApiKey: boolean
  baseUrl?: string
  defaultModel?: string
  options?: Record<string, unknown>
}

interface ModelOption {
  id: string
  name: string
  category?: string
}

interface ProviderConfig {
  icon: string
  gradient: string
  description: string
  capabilities: string[]
  requiresApiKey: boolean
  hasBaseUrl: boolean
  defaultBaseUrl?: string
  models?: ModelOption[]
}

// Provider configurations
const providerConfigs: Record<string, ProviderConfig> = {
  openai: {
    icon: '🤖',
    gradient: 'from-green-500 to-emerald-600',
    description: 'GPT-4, DALL-E, Whisper, TTS',
    capabilities: ['text-generation', 'image-generation', 'audio-tts', 'embeddings'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', category: 'Text' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'Text' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', category: 'Text' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'Text' },
      { id: 'dall-e-3', name: 'DALL-E 3', category: 'Bild' },
      { id: 'dall-e-2', name: 'DALL-E 2', category: 'Bild' },
    ],
  },
  anthropic: {
    icon: '🧠',
    gradient: 'from-orange-500 to-amber-600',
    description: 'Claude 3 Opus, Sonnet, Haiku',
    capabilities: ['text-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
  },
  ollama: {
    icon: '🦙',
    gradient: 'from-blue-500 to-indigo-600',
    description: 'Lokale LLMs (Llama, Mistral, etc.)',
    capabilities: ['text-generation', 'embeddings'],
    requiresApiKey: false,
    hasBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'llama3.1', name: 'Llama 3.1' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'codellama', name: 'Code Llama' },
      { id: 'gemma2', name: 'Gemma 2' },
    ],
  },
  elevenlabs: {
    icon: '🎙️',
    gradient: 'from-cyan-500 to-blue-600',
    description: 'Text-to-Speech mit natürlichen Stimmen',
    capabilities: ['audio-tts'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
      { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5' },
      { id: 'eleven_monolingual_v1', name: 'Monolingual v1' },
    ],
  },
  stability: {
    icon: '🎨',
    gradient: 'from-violet-500 to-purple-600',
    description: 'Stable Diffusion XL, Stable Image',
    capabilities: ['image-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'sd3-large', name: 'SD3 Large' },
      { id: 'sd3-medium', name: 'SD3 Medium' },
      { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1.0' },
      { id: 'stable-image-core', name: 'Stable Image Core' },
    ],
  },
  runway: {
    icon: '🎬',
    gradient: 'from-purple-500 to-pink-600',
    description: 'Gen-3 Alpha Video-Generierung',
    capabilities: ['video-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'gen3a_turbo', name: 'Gen-3 Alpha Turbo' },
      { id: 'gen-3', name: 'Gen-3' },
    ],
  },
  replicate: {
    icon: '🔄',
    gradient: 'from-rose-500 to-red-600',
    description: 'Zugriff auf tausende AI-Modelle',
    capabilities: ['text-generation', 'image-generation', 'video-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'black-forest-labs/flux-schnell', name: 'Flux Schnell', category: 'Bild' },
      { id: 'black-forest-labs/flux-dev', name: 'Flux Dev', category: 'Bild' },
      { id: 'stability-ai/sdxl', name: 'SDXL', category: 'Bild' },
      { id: 'meta/llama-2-70b-chat', name: 'Llama 2 70B', category: 'Text' },
    ],
  },
}

const capabilityLabels: Record<string, string> = {
  'text-generation': 'Text',
  'image-generation': 'Bild',
  'video-generation': 'Video',
  'audio-tts': 'Sprache',
  'audio-music': 'Musik',
  'embeddings': 'Embeddings',
  'transcription': 'Transkription',
}

// State
const providers = ref<AIProvider[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const expandedProvider = ref<string | null>(null)
const testingProvider = ref<string | null>(null)

// Form state for each provider
const providerForms = ref<Record<string, { apiKey: string; baseUrl: string; defaultModel: string }>>({})

// Computed
const sortedProviders = computed(() => {
  const order = ['openai', 'anthropic', 'ollama', 'elevenlabs', 'stability', 'runway', 'replicate']
  return [...providers.value].sort((a, b) => {
    const aIndex = order.indexOf(a.type)
    const bIndex = order.indexOf(b.type)
    return aIndex - bIndex
  })
})

// API Functions
async function fetchProviders() {
  isLoading.value = true
  try {
    const response = await fetch('/api/ai/providers')
    if (!response.ok) throw new Error('Failed to fetch providers')
    const data = await response.json()
    providers.value = data.providers || []

    // Initialize form state for each provider
    for (const provider of providers.value) {
      const config = providerConfigs[provider.type]
      // Get defaultModel from provider options or API response
      const savedModel = provider.defaultModel ||
        (provider.options?.defaultModel as string) ||
        config?.models?.[0]?.id || ''

      providerForms.value[provider.id] = {
        apiKey: '',
        baseUrl: provider.baseUrl || config?.defaultBaseUrl || '',
        defaultModel: savedModel,
      }
    }
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Fehler beim Laden der Provider',
    }
  } finally {
    isLoading.value = false
  }
}

async function updateProvider(providerId: string) {
  const form = providerForms.value[providerId]
  if (!form) return

  isSaving.value = true
  message.value = null

  try {
    const updates: Record<string, unknown> = {}

    if (form.apiKey) {
      updates.apiKey = form.apiKey
    }

    const provider = providers.value.find(p => p.id === providerId)
    if (provider && providerConfigs[provider.type]?.hasBaseUrl) {
      updates.baseUrl = form.baseUrl
    }

    // Save default model if provider has models
    if (provider && providerConfigs[provider.type]?.models?.length && form.defaultModel) {
      updates.options = { defaultModel: form.defaultModel }
    }

    const response = await fetch(`/api/ai/providers/${providerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) throw new Error('Failed to update provider')

    message.value = { type: 'success', text: 'Provider aktualisiert' }
    form.apiKey = '' // Clear API key field
    await fetchProviders() // Reload
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Fehler beim Speichern',
    }
  } finally {
    isSaving.value = false
  }
}

async function toggleProvider(providerId: string, enabled: boolean) {
  try {
    const endpoint = enabled ? 'enable' : 'disable'
    const response = await fetch(`/api/ai/providers/${providerId}/${endpoint}`, {
      method: 'POST',
    })

    if (!response.ok) throw new Error('Failed to toggle provider')
    await fetchProviders()
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Fehler beim Umschalten',
    }
  }
}

async function testProvider(providerId: string) {
  testingProvider.value = providerId
  try {
    const response = await fetch(`/api/ai/providers/${providerId}/status`)
    if (!response.ok) throw new Error('Provider nicht erreichbar')

    const data = await response.json()
    if (data.available) {
      message.value = { type: 'success', text: 'Verbindung erfolgreich!' }
    } else {
      message.value = { type: 'error', text: data.error || 'Provider nicht verfügbar' }
    }
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Verbindungstest fehlgeschlagen',
    }
  } finally {
    testingProvider.value = null
  }
}

function toggleExpanded(providerId: string) {
  expandedProvider.value = expandedProvider.value === providerId ? null : providerId
}

function getProviderConfig(type: string): ProviderConfig {
  return providerConfigs[type] || {
    icon: '🔌',
    gradient: 'from-gray-500 to-gray-600',
    description: 'Custom Provider',
    capabilities: [],
    requiresApiKey: true,
    hasBaseUrl: true,
  }
}

onMounted(fetchProviders)
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-3xl">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-white">AI Provider</h1>
        <p class="text-dark-400">Konfiguriere AI-Dienste für Text, Bild, Video und Audio-Generierung</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-autodarts-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <!-- Message -->
      <div
        v-if="message"
        :class="[
          'p-4 rounded-lg',
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400',
        ]"
      >
        {{ message.text }}
      </div>

      <!-- Provider List -->
      <div v-if="!isLoading" class="space-y-4">
        <div
          v-for="provider in sortedProviders"
          :key="provider.id"
          class="rounded-xl border border-dark-600 bg-dark-800/50 overflow-hidden"
        >
          <!-- Provider Header -->
          <div
            class="p-4 cursor-pointer hover:bg-dark-700/50 transition-colors"
            @click="toggleExpanded(provider.id)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <!-- Icon -->
                <div
                  :class="[
                    'w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br',
                    getProviderConfig(provider.type).gradient,
                  ]"
                >
                  {{ getProviderConfig(provider.type).icon }}
                </div>

                <!-- Info -->
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-lg font-semibold text-white">{{ provider.name }}</h3>
                    <!-- Status Badge -->
                    <span
                      :class="[
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        provider.configured
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-dark-600 text-dark-400',
                      ]"
                    >
                      {{ provider.configured ? 'Konfiguriert' : 'Nicht konfiguriert' }}
                    </span>
                  </div>
                  <p class="text-sm text-dark-400">{{ getProviderConfig(provider.type).description }}</p>

                  <!-- Current Model Badge -->
                  <span
                    v-if="providerForms[provider.id]?.defaultModel && getProviderConfig(provider.type).models?.length"
                    class="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-autodarts-500/20 text-autodarts-400"
                  >
                    Modell: {{ getProviderConfig(provider.type).models?.find(m => m.id === providerForms[provider.id]?.defaultModel)?.name || providerForms[provider.id]?.defaultModel }}
                  </span>

                  <!-- Capabilities -->
                  <div class="flex flex-wrap gap-1 mt-2">
                    <span
                      v-for="cap in provider.capabilities"
                      :key="cap"
                      class="px-2 py-0.5 rounded text-xs bg-dark-700 text-dark-300"
                    >
                      {{ capabilityLabels[cap] || cap }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <!-- Enable/Disable Toggle -->
                <button
                  type="button"
                  @click.stop="toggleProvider(provider.id, !provider.enabled)"
                  :disabled="!provider.configured"
                  :class="[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    provider.enabled && provider.configured ? 'bg-autodarts-600' : 'bg-dark-600',
                    !provider.configured ? 'opacity-50 cursor-not-allowed' : '',
                  ]"
                >
                  <span
                    :class="[
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      provider.enabled && provider.configured ? 'translate-x-6' : 'translate-x-1',
                    ]"
                  />
                </button>

                <!-- Expand Arrow -->
                <svg
                  :class="[
                    'w-5 h-5 text-dark-400 transition-transform',
                    expandedProvider === provider.id ? 'rotate-180' : '',
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Expanded Configuration -->
          <div
            v-if="expandedProvider === provider.id"
            class="p-4 border-t border-dark-600 bg-dark-900/50"
          >
            <form @submit.prevent="updateProvider(provider.id)" class="space-y-4">
              <!-- API Key Input -->
              <div v-if="getProviderConfig(provider.type).requiresApiKey">
                <BaseInput
                  v-model="providerForms[provider.id].apiKey"
                  type="password"
                  label="API Key"
                  :placeholder="provider.hasApiKey ? 'Bereits konfiguriert - leer lassen zum Behalten' : 'API Key eingeben'"
                />
              </div>

              <!-- Base URL Input (for Ollama etc.) -->
              <div v-if="getProviderConfig(provider.type).hasBaseUrl">
                <BaseInput
                  v-model="providerForms[provider.id].baseUrl"
                  label="Base URL"
                  :placeholder="getProviderConfig(provider.type).defaultBaseUrl || 'https://...'"
                />
                <p v-if="provider.type === 'ollama'" class="text-xs text-dark-400 mt-1">
                  Standard: http://localhost:11434 - Ollama muss lokal laufen
                </p>
              </div>

              <!-- Model Selection -->
              <div v-if="getProviderConfig(provider.type).models?.length">
                <label class="block text-sm font-medium text-dark-200 mb-1.5">
                  Standard-Modell
                </label>
                <select
                  v-model="providerForms[provider.id].defaultModel"
                  class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white focus:border-autodarts-500 focus:ring-1 focus:ring-autodarts-500 outline-none"
                >
                  <option
                    v-for="model in getProviderConfig(provider.type).models"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name }}{{ model.category ? ` (${model.category})` : '' }}
                  </option>
                </select>
                <p class="text-xs text-dark-400 mt-1">
                  Wird für neue Generierungen verwendet
                </p>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-3 pt-2">
                <BaseButton type="submit" :loading="isSaving" size="sm">
                  Speichern
                </BaseButton>
                <BaseButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  :loading="testingProvider === provider.id"
                  @click="testProvider(provider.id)"
                >
                  Verbindung testen
                </BaseButton>
              </div>

              <!-- Provider-specific hints -->
              <div v-if="provider.type === 'openai'" class="text-sm text-dark-400 pt-2">
                API Key erhältlich auf <a href="https://platform.openai.com/api-keys" target="_blank" class="text-autodarts-400 hover:underline">platform.openai.com</a>
              </div>
              <div v-else-if="provider.type === 'anthropic'" class="text-sm text-dark-400 pt-2">
                API Key erhältlich auf <a href="https://console.anthropic.com/" target="_blank" class="text-autodarts-400 hover:underline">console.anthropic.com</a>
              </div>
              <div v-else-if="provider.type === 'elevenlabs'" class="text-sm text-dark-400 pt-2">
                API Key erhältlich auf <a href="https://elevenlabs.io" target="_blank" class="text-autodarts-400 hover:underline">elevenlabs.io</a>
              </div>
              <div v-else-if="provider.type === 'stability'" class="text-sm text-dark-400 pt-2">
                API Key erhältlich auf <a href="https://platform.stability.ai/" target="_blank" class="text-autodarts-400 hover:underline">platform.stability.ai</a>
              </div>
              <div v-else-if="provider.type === 'runway'" class="text-sm text-dark-400 pt-2">
                API Key erhältlich auf <a href="https://runwayml.com/" target="_blank" class="text-autodarts-400 hover:underline">runwayml.com</a>
              </div>
              <div v-else-if="provider.type === 'replicate'" class="text-sm text-dark-400 pt-2">
                API Key erhältlich auf <a href="https://replicate.com/" target="_blank" class="text-autodarts-400 hover:underline">replicate.com</a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Info Card -->
      <BaseCard title="Über AI Provider" class="mt-8">
        <div class="space-y-3 text-sm text-dark-300">
          <p>
            AI Provider ermöglichen verschiedene KI-Funktionen für Module. Du kannst mehrere Provider
            gleichzeitig konfigurieren - Module wählen automatisch den passenden Provider.
          </p>
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="p-3 rounded-lg bg-dark-700/50">
              <p class="font-medium text-white mb-1">🦙 Ollama (Empfohlen)</p>
              <p class="text-xs">Kostenlos, lokal, datenschutzfreundlich. Ideal für Text-Generierung.</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-700/50">
              <p class="font-medium text-white mb-1">🤖 OpenAI</p>
              <p class="text-xs">Beste Qualität für alle Funktionen, kostenpflichtig.</p>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </AppLayout>
</template>
