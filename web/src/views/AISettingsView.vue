<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

const { t } = useI18n()

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
    description: 'GPT-6, GPT Image, TTS',
    capabilities: ['text-generation', 'image-generation', 'audio-tts', 'embeddings'],
    requiresApiKey: true,
    hasBaseUrl: false,
    // Text models only: the default model is used for text generation; image and
    // speech models are picked by the provider. Built-in list until the key's own
    // models are loaded (see loadLiveModels).
    models: [
      { id: 'gpt-6-luna', name: 'GPT-6 Luna (schnell, günstig)', category: 'Text' },
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', category: 'Text' },
      { id: 'gpt-6-astra', name: 'GPT-6 Astra (am stärksten)', category: 'Text' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', category: 'Text' },
    ],
  },
  anthropic: {
    icon: '🧠',
    gradient: 'from-orange-500 to-amber-600',
    description: 'Claude Opus 5, Sonnet 5, Haiku 4.5',
    capabilities: ['text-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    models: [
      { id: 'claude-opus-5', name: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (schnell, günstig)' },
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
    description: 'Text-zu-Video (Gen-4.5, Veo, Kling, Seedance, WAN)',
    capabilities: ['video-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    // Fallback only; the full catalog comes from the hub
    models: [
      { id: 'gen4.5', name: 'Gen-4.5' },
    ],
  },
  higgsfield: {
    icon: '🎞️',
    gradient: 'from-fuchsia-500 to-indigo-600',
    description: 'Video (Kling, Hailuo) und Bild (Soul)',
    capabilities: ['video-generation', 'image-generation'],
    requiresApiKey: true,
    hasBaseUrl: false,
    // Default video model; images use Soul Standard
    models: [
      { id: 'kling-video/v3.0/std/text-to-video', name: 'Kling 3.0 Standard', category: 'Video' },
      { id: 'kling-video/v2.5-turbo/pro/text-to-video', name: 'Kling 2.5 Turbo Pro', category: 'Video' },
      { id: 'minimax/hailuo-2.3/standard/text-to-video', name: 'Hailuo 2.3', category: 'Video' },
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
const providerForms = ref<Record<string, { apiKey: string; baseUrl: string; defaultModel: string; imageModel?: string }>>({})

// Models the configured API key can actually use, loaded from the provider API
const LIVE_MODEL_TYPES = ['openai', 'anthropic', 'higgsfield', 'runway']
// Higgsfield and Runway serve a fixed catalog that needs no key
const KEYLESS_MODEL_TYPES = ['higgsfield', 'runway']
const liveModels = ref<Record<string, ModelOption[]>>({})
// Model id as saved on the server, per provider
const savedModels = ref<Record<string, string>>({})
// Form value right after loading, to tell a user's own pick from the initial value
const initialModels = ref<Record<string, string>>({})
// Saved model ids that are no longer offered, per provider (shown as a hint)
const replacedModels = ref<Record<string, string>>({})

// Model the server falls back to when the saved one is retired
const SERVER_FALLBACK_MODEL: Record<string, string> = {
  anthropic: 'claude-opus-5',
  // Only used when nothing is saved; a saved Higgsfield id is kept (see below)
  higgsfield: 'kling-video/v3.0/std/text-to-video',
  // Retired ids (Gen-3) and ids outside the catalog are replaced by Gen-4.5
  runway: 'gen4.5',
}
// Higgsfield sends any saved model id as is, so the UI keeps it too
const KEEP_SAVED_MODEL_TYPES = ['higgsfield']
const HIGGSFIELD_DEFAULT_IMAGE_MODEL = 'higgsfield-ai/soul/standard'

// Models for the default model select; Higgsfield lists its video models here
function modelsFor(provider: AIProvider): ModelOption[] | undefined {
  const models = liveModels.value[provider.id] ?? providerConfigs[provider.type]?.models
  // Runway lists video models only, so the category label would be noise
  if (provider.type === 'runway') return models?.map(m => ({ id: m.id, name: m.name }))
  if (provider.type !== 'higgsfield') return models
  // Only video models here, so the category label would be noise
  return withSavedModel(
    models?.filter(m => m.category !== 'image').map(m => ({ id: m.id, name: m.name })) ?? [],
    savedModels.value[provider.id]
  )
}

// A saved id outside the catalog stays selectable instead of showing a blank select
function withSavedModel(models: ModelOption[], saved?: string): ModelOption[] {
  return saved && !models.some(m => m.id === saved) ? [...models, { id: saved, name: saved }] : models
}

// Higgsfield image models for the second select
function imageModelsFor(provider: AIProvider): ModelOption[] {
  if (provider.type !== 'higgsfield') return []
  const images = (liveModels.value[provider.id] ?? []).filter(m => m.category === 'image')
  return images.length ? withSavedModel(images, provider.options?.imageModel as string | undefined) : []
}

// Cloud providers retire models; a saved model that is no longer offered is replaced
// server-side, so preselect the first offered model instead of an empty selection
// Always compares against the saved model, so running it again for the live list
// cannot replace a choice that only the built-in list lacked
function ensureOfferedModel(provider: AIProvider) {
  const form = providerForms.value[provider.id]
  const models = modelsFor(provider)
  if (!form || !LIVE_MODEL_TYPES.includes(provider.type) || !models?.length) return
  if (KEEP_SAVED_MODEL_TYPES.includes(provider.type) && savedModels.value[provider.id]) return
  const saved = savedModels.value[provider.id]
  // Keep a model the user picked while the live list was loading
  if (form.defaultModel !== initialModels.value[provider.id] &&
    models.some(m => m.id === form.defaultModel)) return
  if (models.some(m => m.id === saved)) {
    form.defaultModel = saved
    delete replacedModels.value[provider.id]
    return
  }
  if (saved) replacedModels.value[provider.id] = saved
  const serverFallback = SERVER_FALLBACK_MODEL[provider.type]
  // OpenAI live lists are ordered like the server's own preference
  form.defaultModel = models.find(m => m.id === serverFallback)?.id ?? models[0].id
}

async function loadLiveModels(provider: AIProvider) {
  if (!LIVE_MODEL_TYPES.includes(provider.type)) return
  if (!provider.hasApiKey && !KEYLESS_MODEL_TYPES.includes(provider.type)) return
  try {
    const response = await fetch(`/api/ai/providers/${provider.id}/models`)
    if (response.ok) {
      const data = await response.json() as { models?: ModelOption[] }
      if (data.models?.length) liveModels.value[provider.id] = data.models
    }
  } catch {
    // Keep the built-in list when the provider cannot be reached
  }
  ensureOfferedModel(provider)
}

// Computed
const sortedProviders = computed(() => {
  const order = ['openai', 'anthropic', 'ollama', 'elevenlabs', 'stability', 'runway', 'higgsfield', 'replicate']
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
        imageModel: provider.type === 'higgsfield'
          ? ((provider.options?.imageModel as string) || HIGGSFIELD_DEFAULT_IMAGE_MODEL)
          : undefined,
      }
      savedModels.value[provider.id] = (provider.defaultModel ||
        (provider.options?.defaultModel as string) || '')
      initialModels.value[provider.id] = savedModel
      if (LIVE_MODEL_TYPES.includes(provider.type) &&
        (provider.hasApiKey || KEYLESS_MODEL_TYPES.includes(provider.type))) {
        void loadLiveModels(provider)
      } else {
        ensureOfferedModel(provider)
      }
    }
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : t('ai.loadError'),
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
    if (provider && modelsFor(provider)?.length && form.defaultModel) {
      const options: Record<string, string> = { defaultModel: form.defaultModel }
      if (provider.type === 'higgsfield' && form.imageModel) {
        options.imageModel = form.imageModel
      }
      updates.options = options
    }

    const response = await fetch(`/api/ai/providers/${providerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (!response.ok) throw new Error('Failed to update provider')

    message.value = { type: 'success', text: t('ai.updated') }
    form.apiKey = '' // Clear API key field
    await fetchProviders() // Reload
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : t('ai.saveError'),
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
      text: error instanceof Error ? error.message : t('ai.toggleError'),
    }
  }
}

async function testProvider(providerId: string) {
  testingProvider.value = providerId
  try {
    const response = await fetch(`/api/ai/providers/${providerId}/status`)
    if (!response.ok) throw new Error(t('ai.unreachable'))

    const data = await response.json()
    if (data.available) {
      message.value = { type: 'success', text: t('ai.connectionSuccess') }
    } else {
      message.value = { type: 'error', text: data.error || t('ai.unreachable') }
    }
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : t('ai.testFailed'),
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
        <h1 class="text-2xl font-bold text-white">{{ t('ai.title') }}</h1>
        <p class="text-dark-400">{{ t('ai.subtitle') }}</p>
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
                      {{ provider.configured ? t('ai.configured') : t('ai.notConfigured') }}
                    </span>
                  </div>
                  <p class="text-sm text-dark-400">{{ getProviderConfig(provider.type).description }}</p>

                  <!-- Current Model Badge -->
                  <span
                    v-if="providerForms[provider.id]?.defaultModel && modelsFor(provider)?.length"
                    class="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-autodarts-500/20 text-autodarts-400"
                  >
                    Modell: {{ modelsFor(provider)?.find(m => m.id === providerForms[provider.id]?.defaultModel)?.name || providerForms[provider.id]?.defaultModel }}
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
                  :label="t('settings.apiKey')"
                  :placeholder="provider.hasApiKey ? t('ai.alreadyConfigured') : t('settings.enterApiKey')"
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
                  {{ t('ai.ollamaHint') }}
                </p>
              </div>

              <!-- Model Selection -->
              <div v-if="modelsFor(provider)?.length">
                <label class="block text-sm font-medium text-dark-200 mb-1.5">
                  {{ t('ai.defaultModel') }}
                </label>
                <select
                  v-model="providerForms[provider.id].defaultModel"
                  class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white focus:border-autodarts-500 focus:ring-1 focus:ring-autodarts-500 outline-none"
                >
                  <option
                    v-for="model in modelsFor(provider)"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name }}{{ model.category ? ` (${model.category})` : '' }}
                  </option>
                </select>
                <p v-if="replacedModels[provider.id]" class="text-xs text-amber-400 mt-1">
                  {{ t('ai.modelReplaced', { model: replacedModels[provider.id] }) }}
                </p>
                <p class="text-xs text-dark-400 mt-1">
                  {{ t('ai.usedForGeneration') }}
                </p>
              </div>

              <!-- Higgsfield image model -->
              <div v-if="imageModelsFor(provider).length">
                <label class="block text-sm font-medium text-dark-200 mb-1.5" :for="`image-model-${provider.id}`">
                  {{ t('ai.imageModel') }}
                </label>
                <select
                  :id="`image-model-${provider.id}`"
                  v-model="providerForms[provider.id].imageModel"
                  class="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-white focus:border-autodarts-500 focus:ring-1 focus:ring-autodarts-500 outline-none"
                >
                  <option v-for="model in imageModelsFor(provider)" :key="model.id" :value="model.id">
                    {{ model.name }}
                  </option>
                </select>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-3 pt-2">
                <BaseButton type="submit" :loading="isSaving" size="sm">
                  {{ t('common.save') }}
                </BaseButton>
                <BaseButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  :loading="testingProvider === provider.id"
                  @click="testProvider(provider.id)"
                >
                  {{ t('ai.testConnection') }}
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
              <div v-else-if="provider.type === 'higgsfield'" class="text-sm text-dark-400 pt-2">
                {{ t('ai.higgsfieldKeyHint') }}
                <a href="https://console.higgsfield.ai" target="_blank" rel="noopener noreferrer" class="text-autodarts-400 hover:underline">console.higgsfield.ai</a>
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
