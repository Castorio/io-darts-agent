<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../api/client'
import BaseCard from './BaseCard.vue'
import BaseButton from './BaseButton.vue'

// Types
interface AnimationStyle {
  id: string
  name: string
  prompt: string
  category: string
  colors?: string[]
}

interface AnimationJob {
  id: string
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  eventType: string
  style: { id: string; name: string }
  progress: number
  resultUrl?: string
  resultFilename?: string
  error?: string
  createdAt: string
  completedAt?: string
}

type DartEventType = '180' | 'bull' | 'doubleBull' | 'highScore' | 'checkout' | 'legWin' | 'setWin' | 'matchWin' | 'bust'

// Event definitions
const eventDefinitions: Record<DartEventType, { label: string; icon: string }> = {
  '180': { label: '180', icon: '🎯' },
  bull: { label: 'Bull', icon: '🎯' },
  doubleBull: { label: 'Double Bull', icon: '🎯' },
  highScore: { label: 'High Score', icon: '🔥' },
  checkout: { label: 'Checkout', icon: '✅' },
  legWin: { label: 'Leg Gewinn', icon: '🏆' },
  setWin: { label: 'Set Gewinn', icon: '🏆' },
  matchWin: { label: 'Match Gewinn', icon: '🥇' },
  bust: { label: 'Bust', icon: '💥' },
}

// Emit for when animation is generated
const emit = defineEmits<{
  (e: 'animation-ready', eventType: string, url: string): void
}>()

// State
const isAvailable = ref(false)
const isLoading = ref(true)
const styles = ref<AnimationStyle[]>([])
const jobs = ref<AnimationJob[]>([])
const selectedStyle = ref<string | null>(null)
const selectedEvents = ref<Set<DartEventType>>(new Set())
const isGenerating = ref(false)
const error = ref<string | null>(null)
const pollingInterval = ref<number | null>(null)

// Custom style mode
const useCustomStyle = ref(false)
const customStyleName = ref('')
const customStylePrompt = ref('')

// Computed
const canGenerate = computed(() => {
  if (selectedEvents.value.size === 0) return false
  if (useCustomStyle.value) {
    return customStyleName.value.trim() && customStylePrompt.value.trim()
  }
  return selectedStyle.value !== null
})

const activeJobs = computed(() => jobs.value.filter((j) => j.status === 'processing' || j.status === 'queued' || j.status === 'pending'))

const completedJobs = computed(() => jobs.value.filter((j) => j.status === 'completed'))

const failedJobs = computed(() => jobs.value.filter((j) => j.status === 'failed'))

// Methods
async function loadData() {
  isLoading.value = true
  error.value = null

  try {
    // Check if available
    const statusResponse = await api.getAnimationGeneratorStatus()
    isAvailable.value = statusResponse.available

    if (!isAvailable.value) {
      return
    }

    // Load styles
    const stylesResponse = await api.getAnimationStyles()
    styles.value = stylesResponse.styles

    // Select first style by default
    if (styles.value.length > 0 && !selectedStyle.value) {
      selectedStyle.value = styles.value[0].id
    }

    // Load jobs
    await loadJobs()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Laden'
  } finally {
    isLoading.value = false
  }
}

async function loadJobs() {
  try {
    const response = await api.getAnimationJobs()
    jobs.value = response.jobs
  } catch {
    // Ignore errors when loading jobs
  }
}

function toggleEvent(event: DartEventType) {
  if (selectedEvents.value.has(event)) {
    selectedEvents.value.delete(event)
  } else {
    selectedEvents.value.add(event)
  }
  // Trigger reactivity
  selectedEvents.value = new Set(selectedEvents.value)
}

function selectAllEvents() {
  selectedEvents.value = new Set(Object.keys(eventDefinitions) as DartEventType[])
}

function deselectAllEvents() {
  selectedEvents.value = new Set()
}

async function generateAnimations() {
  if (!canGenerate.value) return

  isGenerating.value = true
  error.value = null

  try {
    const eventTypes = Array.from(selectedEvents.value)

    if (useCustomStyle.value) {
      // Generate with custom style
      await api.generateAnimationBatch({
        customStyle: {
          name: customStyleName.value.trim(),
          prompt: customStylePrompt.value.trim(),
        },
        eventTypes,
      })
    } else {
      // Generate with preset style
      await api.generateAnimationBatch({
        styleId: selectedStyle.value!,
        eventTypes,
      })
    }

    // Clear selection
    selectedEvents.value = new Set()

    // Reload jobs
    await loadJobs()

    // Start polling
    startPolling()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Generieren'
  } finally {
    isGenerating.value = false
  }
}

async function cancelJob(jobId: string) {
  try {
    await api.cancelAnimationJob(jobId)
    await loadJobs()
  } catch {
    // Ignore
  }
}

async function clearFinished() {
  try {
    await api.clearFinishedAnimationJobs()
    await loadJobs()
  } catch {
    // Ignore
  }
}

function useAnimation(job: AnimationJob) {
  if (job.resultUrl) {
    emit('animation-ready', job.eventType, job.resultUrl)
  }
}

function startPolling() {
  if (pollingInterval.value) return

  pollingInterval.value = window.setInterval(async () => {
    await loadJobs()

    // Stop polling if no active jobs
    if (activeJobs.value.length === 0 && pollingInterval.value) {
      window.clearInterval(pollingInterval.value)
      pollingInterval.value = null
    }
  }, 3000)
}

function stopPolling() {
  if (pollingInterval.value) {
    window.clearInterval(pollingInterval.value)
    pollingInterval.value = null
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-400'
    case 'failed':
    case 'cancelled':
      return 'text-red-400'
    case 'processing':
      return 'text-yellow-400'
    default:
      return 'text-dark-400'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Wartend'
    case 'queued':
      return 'In Warteschlange'
    case 'processing':
      return 'Wird generiert...'
    case 'completed':
      return 'Fertig'
    case 'failed':
      return 'Fehlgeschlagen'
    case 'cancelled':
      return 'Abgebrochen'
    default:
      return status
  }
}

onMounted(() => {
  loadData()
  // Start polling if there are active jobs
  if (activeJobs.value.length > 0) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <BaseCard title="KI Animation Generator" subtitle="Generiere einzigartige Animationen mit KI">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-autodarts-500" />
    </div>

    <!-- Not Available -->
    <div v-else-if="!isAvailable" class="text-center py-8">
      <svg class="w-16 h-16 mx-auto text-dark-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h4 class="text-lg font-medium text-white mb-2">KI-Generierung nicht verfügbar</h4>
      <p class="text-dark-400 max-w-md mx-auto">
        Um KI-Animationen zu generieren, muss ein AI-Provider (z.B. Runway) in den
        <router-link to="/settings" class="text-autodarts-400 hover:underline">Einstellungen</router-link>
        konfiguriert werden.
      </p>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-6">
      <!-- Error -->
      <div v-if="error" class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
        {{ error }}
      </div>

      <!-- Style Selection -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="block text-sm font-medium text-dark-200">Stil wählen</label>
          <label class="flex items-center gap-2 text-sm text-dark-400">
            <input
              type="checkbox"
              v-model="useCustomStyle"
              class="rounded border-dark-500 bg-dark-700 text-autodarts-500 focus:ring-autodarts-500"
            />
            Eigener Stil
          </label>
        </div>

        <!-- Preset Styles Grid -->
        <div v-if="!useCustomStyle" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <button
            v-for="style in styles"
            :key="style.id"
            @click="selectedStyle = style.id"
            :class="[
              'relative p-4 rounded-lg border-2 text-center transition-all',
              selectedStyle === style.id
                ? 'border-autodarts-500 bg-autodarts-500/10'
                : 'border-dark-600 hover:border-dark-500',
            ]"
          >
            <!-- Color preview -->
            <div class="flex justify-center gap-1 mb-2">
              <div
                v-for="(color, i) in (style.colors || []).slice(0, 3)"
                :key="i"
                class="w-4 h-4 rounded-full"
                :style="{ backgroundColor: color }"
              />
            </div>
            <span class="text-sm font-medium text-white">{{ style.name }}</span>
          </button>
        </div>

        <!-- Custom Style Input -->
        <div v-else class="space-y-3 p-4 rounded-lg border border-dark-600 bg-dark-700/50">
          <input
            v-model="customStyleName"
            type="text"
            placeholder="Stil-Name (z.B. 'Galaxy')"
            class="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-400 focus:border-autodarts-500 focus:ring-1 focus:ring-autodarts-500"
          />
          <textarea
            v-model="customStylePrompt"
            placeholder="Beschreibung des Stils (z.B. 'Galaxie, Sterne, kosmische Nebel, lila und blau')"
            rows="3"
            class="w-full px-4 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white placeholder-dark-400 focus:border-autodarts-500 focus:ring-1 focus:ring-autodarts-500 resize-none"
          />
        </div>
      </div>

      <!-- Event Selection -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="block text-sm font-medium text-dark-200">Ereignisse wählen</label>
          <div class="flex items-center gap-2">
            <button @click="selectAllEvents" class="text-xs text-autodarts-400 hover:underline">Alle</button>
            <span class="text-dark-600">|</span>
            <button @click="deselectAllEvents" class="text-xs text-dark-400 hover:underline">Keine</button>
          </div>
        </div>

        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <button
            v-for="(def, key) in eventDefinitions"
            :key="key"
            @click="toggleEvent(key as DartEventType)"
            :class="[
              'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
              selectedEvents.has(key as DartEventType)
                ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                : 'border-dark-600 text-dark-400 hover:border-dark-500',
            ]"
          >
            <span class="mr-1">{{ def.icon }}</span>
            {{ def.label }}
          </button>
        </div>
      </div>

      <!-- Generate Button -->
      <div class="flex items-center justify-between pt-4 border-t border-dark-700">
        <p class="text-sm text-dark-400">
          <template v-if="selectedEvents.size > 0">
            {{ selectedEvents.size }} Ereignis{{ selectedEvents.size !== 1 ? 'se' : '' }} ausgewählt
          </template>
          <template v-else> Wähle mindestens ein Ereignis </template>
        </p>

        <BaseButton
          :disabled="!canGenerate || isGenerating"
          :loading="isGenerating"
          @click="generateAnimations"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Animationen generieren
        </BaseButton>
      </div>

      <!-- Jobs List -->
      <div v-if="jobs.length > 0" class="pt-6 border-t border-dark-700">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-lg font-medium text-white">Generierungs-Jobs</h4>
          <BaseButton
            v-if="completedJobs.length > 0 || failedJobs.length > 0"
            variant="ghost"
            size="sm"
            @click="clearFinished"
          >
            Abgeschlossene löschen
          </BaseButton>
        </div>

        <div class="space-y-2">
          <div
            v-for="job in jobs"
            :key="job.id"
            class="flex items-center justify-between p-3 rounded-lg border border-dark-600 bg-dark-700/30"
          >
            <div class="flex items-center gap-3">
              <!-- Event Icon -->
              <span class="text-lg">{{ eventDefinitions[job.eventType as DartEventType]?.icon || '🎯' }}</span>

              <div>
                <p class="text-white font-medium">
                  {{ eventDefinitions[job.eventType as DartEventType]?.label || job.eventType }}
                  <span class="text-dark-400 text-sm ml-2">({{ job.style.name }})</span>
                </p>
                <p :class="['text-sm', getStatusColor(job.status)]">
                  {{ getStatusLabel(job.status) }}
                  <span v-if="job.status === 'processing' && job.progress > 0" class="ml-1">
                    ({{ job.progress }}%)
                  </span>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Preview (if completed) -->
              <a
                v-if="job.status === 'completed' && job.resultUrl"
                :href="job.resultUrl"
                target="_blank"
                class="p-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-dark-300 hover:text-white transition-colors"
                title="Vorschau"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </a>

              <!-- Use Button (if completed) -->
              <BaseButton
                v-if="job.status === 'completed' && job.resultUrl"
                size="sm"
                @click="useAnimation(job)"
              >
                Verwenden
              </BaseButton>

              <!-- Cancel Button (if processing) -->
              <BaseButton
                v-if="job.status === 'pending' || job.status === 'queued' || job.status === 'processing'"
                variant="ghost"
                size="sm"
                @click="cancelJob(job.id)"
              >
                Abbrechen
              </BaseButton>

              <!-- Error message -->
              <span v-if="job.status === 'failed' && job.error" class="text-xs text-red-400 max-w-[200px] truncate">
                {{ job.error }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseCard>
</template>
