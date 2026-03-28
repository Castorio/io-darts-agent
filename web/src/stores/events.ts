import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WSMessage, WSEventMessage } from '../types/api'
import { useModulesStore } from './modules'

interface EventLogEntry {
  id: number
  timestamp: Date
  type: string
  data: unknown
}

export const useEventsStore = defineStore('events', () => {
  // State
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)
  const eventLog = ref<EventLogEntry[]>([])
  const autodartsConnected = ref(false)
  const currentMatchId = ref<string | null>(null)

  let eventIdCounter = 0
  const MAX_LOG_ENTRIES = 100

  // Computed
  const recentEvents = computed(() => eventLog.value.slice(-20))

  // Actions
  function connect() {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/events`

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      isConnected.value = true
      connectionError.value = null
      console.log('WebSocket connected')
    }

    ws.value.onclose = () => {
      isConnected.value = false
      console.log('WebSocket disconnected')
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (!isConnected.value) {
          connect()
        }
      }, 3000)
    }

    ws.value.onerror = (event) => {
      connectionError.value = 'WebSocket error'
      console.error('WebSocket error:', event)
    }

    ws.value.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
  }

  function handleMessage(message: WSMessage) {
    switch (message.type) {
      case 'event':
        handleEventMessage(message)
        break
      case 'status':
        autodartsConnected.value = message.status.connected
        currentMatchId.value = message.status.matchId ?? null
        break
      case 'module':
        const modulesStore = useModulesStore()
        modulesStore.updateModuleStatus(message.moduleId, message.status)
        break
    }
  }

  function handleEventMessage(message: WSEventMessage) {
    const entry: EventLogEntry = {
      id: ++eventIdCounter,
      timestamp: new Date(message.event.timestamp),
      type: message.event.type,
      data: message.event.data,
    }

    eventLog.value.push(entry)

    // Keep log size manageable
    if (eventLog.value.length > MAX_LOG_ENTRIES) {
      eventLog.value = eventLog.value.slice(-MAX_LOG_ENTRIES)
    }
  }

  function clearLog() {
    eventLog.value = []
  }

  return {
    // State
    isConnected,
    connectionError,
    eventLog,
    autodartsConnected,
    currentMatchId,
    // Computed
    recentEvents,
    // Actions
    connect,
    disconnect,
    clearLog,
  }
})
