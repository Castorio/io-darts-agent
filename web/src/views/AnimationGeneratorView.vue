<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'

const { t } = useI18n()

// Types
interface AnimationStyle {
  id: string
  name: string
  prompt: string
  colors?: string[]
  category?: string
}

interface AnimationJob {
  id: string
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  eventType: string
  style: AnimationStyle
  progress: number
  resultUrl?: string
  error?: string
  createdAt: string
}

// State
const isLoading = ref(false)
const isProviderConfigured = ref(false)
const providerName = ref<string | null>(null)
const styles = ref<AnimationStyle[]>([])
const events = ref<string[]>([])
const jobs = ref<AnimationJob[]>([])
const selectedStyle = ref<string | null>(null)
const selectedEvents = ref<string[]>([])
const customPrompt = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const isGenerating = ref(false)
const pollInterval = ref<number | null>(null)

// Computed
const canGenerate = computed(() => {
  return isProviderConfigured.value && selectedStyle.value && selectedEvents.value.length > 0
})

const pendingJobs = computed(() => {
  return jobs.value.filter((j) => j.status === 'pending' || j.status === 'queued' || j.status === 'processing')
})

const completedJobs = computed(() => {
  return jobs.value.filter((j) => j.status === 'completed')
})

const failedJobs = computed(() => {
  return jobs.value.filter((j) => j.status === 'failed' || j.status === 'cancelled')
})

// API calls
async function loadStatus() {
  try {
    const response = await fetch('/api/animations/status')
    const data = await response.json()
    isProviderConfigured.value = data.available
    providerName.value = data.provider
  } catch (e) {
    console.error('Failed to load status:', e)
  }
}

async function loadStyles() {
  try {
    const response = await fetch('/api/animations/styles')
    const data = await response.json()
    styles.value = data.styles || []
  } catch (e) {
    console.error('Failed to load styles:', e)
  }
}

async function loadEvents() {
  try {
    const response = await fetch('/api/animations/events')
    const data = await response.json()
    events.value = data.events || []
  } catch (e) {
    console.error('Failed to load events:', e)
  }
}

async function loadJobs() {
  try {
    const response = await fetch('/api/animations/jobs')
    const data = await response.json()
    jobs.value = data.jobs || []
  } catch (e) {
    console.error('Failed to load jobs:', e)
  }
}

async function generateSingle() {
  if (!selectedStyle.value || selectedEvents.value.length === 0) return

  isGenerating.value = true
  message.value = null

  try {
    const eventType = selectedEvents.value[0]
    const response = await fetch('/api/animations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        styleId: selectedStyle.value,
        customPrompt: customPrompt.value || undefined,
      }),
    })

    const data = await response.json()
    if (data.success) {
      message.value = { type: 'success', text: t('animations.generationStarted') }
      await loadJobs()
    } else {
      message.value = { type: 'error', text: data.error || t('animations.generationFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: t('animations.generationFailed') }
  } finally {
    isGenerating.value = false
  }
}

async function generateBatch() {
  if (!selectedStyle.value) return

  isGenerating.value = true
  message.value = null

  try {
    const response = await fetch('/api/animations/generate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        styleId: selectedStyle.value,
        eventTypes: selectedEvents.value.length > 0 ? selectedEvents.value : undefined,
      }),
    })

    const data = await response.json()
    if (data.success) {
      message.value = { type: 'success', text: t('animations.batchStarted', { count: data.jobs?.length || 0 }) }
      await loadJobs()
    } else {
      message.value = { type: 'error', text: data.error || t('animations.generationFailed') }
    }
  } catch (e) {
    message.value = { type: 'error', text: t('animations.generationFailed') }
  } finally {
    isGenerating.value = false
  }
}

async function deleteJob(jobId: string) {
  try {
    await fetch(`/api/animations/jobs/${jobId}`, { method: 'DELETE' })
    await loadJobs()
  } catch (e) {
    console.error('Failed to delete job:', e)
  }
}

async function clearFinishedJobs() {
  try {
    await fetch('/api/animations/jobs/clear', { method: 'POST' })
    await loadJobs()
  } catch (e) {
    console.error('Failed to clear jobs:', e)
  }
}

function selectAllEvents() {
  selectedEvents.value = [...events.value]
}

function deselectAllEvents() {
  selectedEvents.value = []
}

function toggleEvent(event: string) {
  const index = selectedEvents.value.indexOf(event)
  if (index === -1) {
    selectedEvents.value.push(event)
  } else {
    selectedEvents.value.splice(index, 1)
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400'
    case 'failed':
    case 'cancelled': return 'text-red-400'
    case 'processing': return 'text-blue-400'
    case 'queued': return 'text-yellow-400'
    default: return 'text-dark-400'
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✓'
    case 'failed':
    case 'cancelled': return '✕'
    case 'processing': return '⟳'
    case 'queued': return '⏳'
    default: return '○'
  }
}

function formatEventName(event: string): string {
  return event.replace(/-/g, ' ').replace(/\+/g, '+')
}

// Lifecycle
onMounted(async () => {
  isLoading.value = true
  await Promise.all([loadStatus(), loadStyles(), loadEvents(), loadJobs()])
  isLoading.value = false

  // Poll for job updates
  pollInterval.value = window.setInterval(() => {
    if (pendingJobs.value.length > 0) {
      loadJobs()
    }
  }, 5000)
})

onUnmounted(() => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
  }
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">{{ t('animations.title') }}</h1>
          <p class="text-dark-400">{{ t('animations.subtitle') }}</p>
        </div>

        <!-- Status Badge -->
        <div
          :class="[
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            isProviderConfigured
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400',
          ]"
        >
          <span class="w-2 h-2 rounded-full" :class="isProviderConfigured ? 'bg-green-400' : 'bg-yellow-400'" />
          {{ isProviderConfigured ? t('animations.providerConfigured', { name: providerName }) : t('animations.providerNotConfigured') }}
        </div>
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

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-autodarts-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>

      <template v-else>
        <!-- Style Selection -->
        <BaseCard :title="t('animations.selectStyle')">
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <button
              v-for="style in styles"
              :key="style.id"
              @click="selectedStyle = style.id"
              :class="[
                'relative p-4 rounded-xl border-2 transition-all text-left',
                selectedStyle === style.id
                  ? 'border-autodarts-500 bg-autodarts-500/10'
                  : 'border-dark-600 bg-dark-700/50 hover:border-dark-500',
              ]"
            >
              <!-- Color Preview -->
              <div class="flex gap-1 mb-2">
                <div
                  v-for="(color, i) in (style.colors || ['#888']).slice(0, 3)"
                  :key="i"
                  class="w-4 h-4 rounded-full"
                  :style="{ backgroundColor: color }"
                />
              </div>
              <span class="text-white font-medium text-sm">{{ style.name }}</span>

              <!-- Checkmark -->
              <div
                v-if="selectedStyle === style.id"
                class="absolute top-2 right-2 w-5 h-5 rounded-full bg-autodarts-500 flex items-center justify-center"
              >
                <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </button>
          </div>

          <!-- Custom Prompt -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-dark-300 mb-2">
              {{ t('animations.customPrompt') }}
            </label>
            <input
              v-model="customPrompt"
              type="text"
              :placeholder="t('animations.customPromptPlaceholder')"
              class="w-full px-4 py-2.5 rounded-lg bg-dark-700 border border-dark-600 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-autodarts-500"
            />
          </div>
        </BaseCard>

        <!-- Event Selection -->
        <BaseCard :title="t('animations.selectEvents')">
          <div class="flex gap-2 mb-4">
            <BaseButton variant="secondary" size="sm" @click="selectAllEvents">
              {{ t('animations.selectAll') }}
            </BaseButton>
            <BaseButton variant="secondary" size="sm" @click="deselectAllEvents">
              {{ t('animations.deselectAll') }}
            </BaseButton>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <button
              v-for="event in events"
              :key="event"
              @click="toggleEvent(event)"
              :class="[
                'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                selectedEvents.includes(event)
                  ? 'bg-autodarts-600 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white',
              ]"
            >
              {{ formatEventName(event) }}
            </button>
          </div>
        </BaseCard>

        <!-- Generate Buttons -->
        <div class="flex flex-wrap gap-4">
          <BaseButton
            :disabled="!canGenerate || isGenerating"
            @click="generateSingle"
          >
            <svg v-if="isGenerating" class="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <svg v-else class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {{ t('animations.generateSingle') }}
          </BaseButton>

          <BaseButton
            variant="secondary"
            :disabled="!selectedStyle || isGenerating"
            @click="generateBatch"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {{ t('animations.generateBatch') }}
          </BaseButton>
        </div>

        <!-- Jobs Queue -->
        <BaseCard :title="t('animations.jobQueue')">
          <template #actions>
            <BaseButton
              v-if="completedJobs.length > 0 || failedJobs.length > 0"
              variant="secondary"
              size="sm"
              @click="clearFinishedJobs"
            >
              {{ t('animations.clearFinished') }}
            </BaseButton>
          </template>

          <!-- Empty State -->
          <div v-if="jobs.length === 0" class="text-center py-8">
            <svg class="w-12 h-12 mx-auto text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p class="text-dark-400 mt-4">{{ t('animations.noJobs') }}</p>
          </div>

          <!-- Jobs List -->
          <div v-else class="space-y-3">
            <div
              v-for="job in jobs"
              :key="job.id"
              class="flex items-center gap-4 p-4 rounded-lg bg-dark-700/50 border border-dark-600"
            >
              <!-- Status Icon -->
              <div
                :class="[
                  'w-10 h-10 rounded-lg flex items-center justify-center text-lg',
                  job.status === 'completed' ? 'bg-green-500/20' :
                  job.status === 'failed' || job.status === 'cancelled' ? 'bg-red-500/20' :
                  job.status === 'processing' ? 'bg-blue-500/20' :
                  'bg-dark-600',
                ]"
              >
                <span :class="getStatusColor(job.status)">{{ getStatusIcon(job.status) }}</span>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-white font-medium">{{ formatEventName(job.eventType) }}</span>
                  <span class="text-dark-400 text-sm">• {{ job.style.name }}</span>
                </div>

                <!-- Progress Bar -->
                <div v-if="job.status === 'processing'" class="mt-2">
                  <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-autodarts-500 transition-all duration-300"
                      :style="{ width: `${job.progress}%` }"
                    />
                  </div>
                  <span class="text-xs text-dark-400 mt-1">{{ job.progress }}%</span>
                </div>

                <!-- Error -->
                <p v-if="job.error" class="text-red-400 text-sm mt-1 truncate">{{ job.error }}</p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2">
                <!-- Preview (for completed) -->
                <a
                  v-if="job.status === 'completed' && job.resultUrl"
                  :href="job.resultUrl"
                  target="_blank"
                  class="p-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white transition-colors"
                  :title="t('animations.preview')"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </a>

                <!-- Delete -->
                <button
                  @click="deleteJob(job.id)"
                  class="p-2 rounded-lg bg-dark-600 hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors"
                  :title="t('common.delete')"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Info Card -->
        <BaseCard v-if="!isProviderConfigured" :title="t('animations.setupTitle')">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="text-dark-300">{{ t('animations.setupDescription') }}</p>
              <router-link
                to="/settings"
                class="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-autodarts-600 hover:bg-autodarts-700 text-white rounded-lg transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ t('animations.goToSettings') }}
              </router-link>
              <p class="text-dark-400 text-sm mt-3">{{ t('animations.setupHint') }}</p>
            </div>
          </div>
        </BaseCard>
      </template>
    </div>
  </AppLayout>
</template>
