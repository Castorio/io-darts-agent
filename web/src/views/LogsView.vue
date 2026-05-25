<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import { api, type LogEntry } from '../api/client'

const { t } = useI18n()

const logs = ref<LogEntry[]>([])
const isConnected = ref(false)
const isPaused = ref(false)
const filter = ref<'all' | 'event' | 'module' | 'system'>('all')
const searchQuery = ref('')
const autoScroll = ref(true)
const maxLogs = ref(500)
const selectedLog = ref<LogEntry | null>(null)

const logContainer = ref<HTMLElement | null>(null)
let ws: WebSocket | null = null
let reconnectTimeout: number | null = null

const filteredLogs = computed(() => {
  let result = logs.value

  if (filter.value !== 'all') {
    result = result.filter((log) => log.type === filter.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (log) =>
        log.message.toLowerCase().includes(query) ||
        log.source.toLowerCase().includes(query) ||
        JSON.stringify(log.data).toLowerCase().includes(query)
    )
  }

  return result
})

const stats = computed(() => ({
  total: logs.value.length,
  events: logs.value.filter((l) => l.type === 'event').length,
  modules: logs.value.filter((l) => l.type === 'module').length,
  system: logs.value.filter((l) => l.type === 'system').length,
}))

async function loadLogHistory() {
  try {
    const history = await api.getLogs()
    logs.value = history
    scrollToBottom()
  } catch (error) {
    console.error('Failed to load log history:', error)
  }
}

function connectToWebSocket() {
  if (ws) {
    ws.close()
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/api/events`

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    isConnected.value = true
    addLocalLog('system', 'Console', t('logs.wsConnected'))
  }

  ws.onmessage = (event) => {
    if (isPaused.value) return

    try {
      const data = JSON.parse(event.data)

      // Handle log messages
      if (data.type === 'log' && data.entry) {
        addLog(data.entry)
      }
    } catch {
      // Ignore parse errors
    }
  }

  ws.onclose = () => {
    isConnected.value = false
    addLocalLog('system', 'Console', t('logs.wsDisconnected'))

    // Reconnect after delay
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }
    reconnectTimeout = window.setTimeout(() => {
      connectToWebSocket()
    }, 3000)
  }

  ws.onerror = () => {
    isConnected.value = false
  }
}

function addLog(entry: LogEntry) {
  logs.value.push(entry)

  // Limit logs
  if (logs.value.length > maxLogs.value) {
    logs.value = logs.value.slice(-maxLogs.value)
  }

  if (autoScroll.value) {
    scrollToBottom()
  }
}

function addLocalLog(type: LogEntry['type'], source: string, message: string) {
  const entry: LogEntry = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now(),
    type,
    source,
    message,
  }
  addLog(entry)
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

function clearLogs() {
  logs.value = []
  addLocalLog('system', 'Console', t('logs.logsCleared'))
}

function togglePause() {
  isPaused.value = !isPaused.value
  addLocalLog('system', 'Console', isPaused.value ? t('logs.streamPaused') : t('logs.streamResumed'))
}

function exportLogs() {
  const data = JSON.stringify(filteredLogs.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `autodarts-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${time}.${ms}`
}

function getTypeColor(type: LogEntry['type']): string {
  switch (type) {
    case 'event':
      return 'text-blue-400'
    case 'module':
      return 'text-green-400'
    case 'system':
      return 'text-dark-400'
    default:
      return 'text-dark-400'
  }
}

function getTypeBadgeClass(type: LogEntry['type']): string {
  switch (type) {
    case 'event':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'module':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'system':
      return 'bg-dark-600 text-dark-300 border-dark-500'
    default:
      return 'bg-dark-600 text-dark-300 border-dark-500'
  }
}

function getTypeIcon(type: LogEntry['type']): string {
  switch (type) {
    case 'event':
      return '📥'
    case 'module':
      return '📤'
    case 'system':
      return '⚙️'
    default:
      return 'ℹ️'
  }
}

function getSourceColor(source: string): string {
  if (source === 'autodarts') return 'text-autodarts-400'
  if (source === 'wled') return 'text-yellow-400'
  if (source === 'hub') return 'text-purple-400'
  return 'text-orange-400'
}

onMounted(async () => {
  await loadLogHistory()
  connectToWebSocket()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
  }
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-white">{{ t('logs.title') }}</h1>
        <p class="text-dark-400 mt-1">{{ t('logs.subtitle') }}</p>
      </div>

      <!-- Connection Status -->
      <div class="flex items-center gap-2">
        <span
          :class="[
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500',
          ]"
        />
        <span class="text-sm text-dark-300">
          {{ isConnected ? t('logs.connected') : t('logs.disconnected') }}
        </span>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <BaseCard class="!p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center">
            <span class="text-lg">📊</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ stats.total }}</p>
            <p class="text-xs text-dark-400">{{ t('logs.total') }}</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard class="!p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <span class="text-lg">📥</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-blue-400">{{ stats.events }}</p>
            <p class="text-xs text-dark-400">{{ t('logs.events') }}</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard class="!p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <span class="text-lg">📤</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-green-400">{{ stats.modules }}</p>
            <p class="text-xs text-dark-400">{{ t('logs.moduleLogs') }}</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard class="!p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center">
            <span class="text-lg">⚙️</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-dark-300">{{ stats.system }}</p>
            <p class="text-xs text-dark-400">{{ t('logs.system') }}</p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Controls -->
    <BaseCard class="!p-4">
      <div class="flex flex-col lg:flex-row gap-4">
        <!-- Search -->
        <div class="flex-1">
          <div class="relative">
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('logs.searchPlaceholder')"
              class="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Filter -->
        <div class="flex items-center gap-2">
          <button
            v-for="f in ['all', 'event', 'module', 'system'] as const"
            :key="f"
            @click="filter = f"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f
                ? 'bg-autodarts-600 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600',
            ]"
          >
            {{ f === 'all' ? t('common.all') : f === 'event' ? t('logs.events') : f === 'module' ? t('logs.moduleLogs') : t('logs.system') }}
          </button>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <button
            @click="togglePause"
            :class="[
              'p-2 rounded-lg transition-colors',
              isPaused
                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600',
            ]"
            :title="isPaused ? t('logs.resume') : t('logs.pause')"
          >
            <svg v-if="isPaused" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <button
            @click="autoScroll = !autoScroll"
            :class="[
              'p-2 rounded-lg transition-colors',
              autoScroll
                ? 'bg-autodarts-600/20 text-autodarts-400 hover:bg-autodarts-600/30'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600',
            ]"
            :title="t('logs.autoScroll')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>

          <button
            @click="exportLogs"
            class="p-2 rounded-lg bg-dark-700 text-dark-300 hover:bg-dark-600 transition-colors"
            :title="t('logs.exportLogs')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>

          <button
            @click="clearLogs"
            class="p-2 rounded-lg bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-red-400 transition-colors"
            :title="t('logs.clearLogs')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </BaseCard>

    <!-- Log Output -->
    <BaseCard class="!p-0 overflow-hidden">
      <div
        ref="logContainer"
        class="h-[600px] overflow-y-auto font-mono text-sm bg-dark-900"
      >
        <!-- Empty State -->
        <div
          v-if="filteredLogs.length === 0"
          class="h-full flex flex-col items-center justify-center text-dark-400"
        >
          <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p class="text-lg font-medium">{{ t('logs.noLogs') }}</p>
          <p class="text-sm mt-1">{{ t('logs.waitingForEvents') }}</p>
        </div>

        <!-- Log Entries -->
        <div v-else class="divide-y divide-dark-800">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="px-4 py-2 hover:bg-dark-800/50 transition-colors cursor-pointer"
            @click="selectedLog = selectedLog?.id === log.id ? null : log"
          >
            <div class="flex items-start gap-3">
              <!-- Timestamp -->
              <span class="text-dark-500 whitespace-nowrap text-xs">
                {{ formatTimestamp(log.timestamp) }}
              </span>

              <!-- Type Badge -->
              <span
                :class="[
                  'px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap',
                  getTypeBadgeClass(log.type),
                ]"
              >
                {{ getTypeIcon(log.type) }}
                {{ log.type === 'event' ? 'EVT' : log.type === 'module' ? 'MOD' : 'SYS' }}
              </span>

              <!-- Source -->
              <span :class="['whitespace-nowrap text-xs font-medium', getSourceColor(log.source)]">
                [{{ log.source }}]
              </span>

              <!-- Message -->
              <span :class="['flex-1 break-all', getTypeColor(log.type)]">
                {{ log.message }}
              </span>

              <!-- Expand indicator -->
              <span v-if="log.data" class="text-dark-500 text-xs">
                {{ selectedLog?.id === log.id ? '▼' : '▶' }}
              </span>
            </div>

            <!-- Data (if selected) -->
            <div v-if="log.data && selectedLog?.id === log.id" class="mt-2 ml-[140px]">
              <pre
                class="p-3 bg-dark-800 rounded-lg text-xs text-dark-300 overflow-x-auto whitespace-pre-wrap"
              >{{ JSON.stringify(log.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-4 py-2 bg-dark-800 border-t border-dark-700 flex items-center justify-between text-xs text-dark-400"
      >
        <span>
          {{ filteredLogs.length }} / {{ logs.length }}
          <span v-if="isPaused" class="text-yellow-400 ml-2">⏸ {{ t('logs.paused') }}</span>
        </span>
        <span>{{ t('logs.maxEntries') }}: {{ maxLogs }}</span>
      </div>
    </BaseCard>

    <!-- Legend -->
    <div class="flex flex-wrap gap-4 text-sm text-dark-400">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
        <span>{{ t('logs.legend.event') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
        <span>{{ t('logs.legend.module') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded bg-dark-600 border border-dark-500" />
        <span>{{ t('logs.legend.system') }}</span>
      </div>
    </div>
    </div>
  </AppLayout>
</template>
