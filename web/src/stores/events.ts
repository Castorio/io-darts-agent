import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WSMessage, WSEventMessage, WSCallerMessage, CallRequest } from '../types/api'
import { useModulesStore } from './modules'

interface EventLogEntry {
  id: number
  timestamp: Date
  type: string
  data: unknown
}

// Audio player for caller requests
class CallerAudioPlayer {
  private audioQueue: CallRequest[] = []
  private isPlaying = false
  private currentAudio: HTMLAudioElement | null = null
  private volume = 0.8

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol / 100))
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume
    }
  }

  enqueue(request: CallRequest) {
    // Insert based on priority (higher priority first)
    const insertIndex = this.audioQueue.findIndex(r => r.priority < request.priority)
    if (insertIndex === -1) {
      this.audioQueue.push(request)
    } else {
      this.audioQueue.splice(insertIndex, 0, request)
    }
    this.processQueue()
  }

  private async processQueue() {
    if (this.isPlaying || this.audioQueue.length === 0) {
      return
    }

    const request = this.audioQueue.shift()
    if (!request) return

    this.isPlaying = true

    try {
      if (request.audioFile) {
        // Play audio file (base64 data URL or file path)
        await this.playAudio(request.audioFile)
      } else {
        // Use browser TTS as fallback
        await this.speakTTS(request.text)
      }
    } catch (error) {
      console.error('Failed to play caller audio:', error)
      // Try TTS as fallback
      try {
        await this.speakTTS(request.text)
      } catch (e) {
        console.error('TTS fallback also failed:', e)
      }
    }

    this.isPlaying = false
    this.processQueue()
  }

  private playAudio(audioSource: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioSource)
      this.currentAudio = audio
      audio.volume = this.volume

      audio.onended = () => {
        this.currentAudio = null
        resolve()
      }

      audio.onerror = (e) => {
        this.currentAudio = null
        reject(e)
      }

      audio.play().catch(reject)
    })
  }

  private speakTTS(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = this.volume
      utterance.rate = 1.0
      utterance.pitch = 1.0

      utterance.onend = () => resolve()
      utterance.onerror = (e) => reject(e)

      window.speechSynthesis.speak(utterance)
    })
  }

  stop() {
    this.audioQueue = []
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    window.speechSynthesis?.cancel()
    this.isPlaying = false
  }
}

const callerAudioPlayer = new CallerAudioPlayer()

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
      case 'caller':
        handleCallerMessage(message)
        break
    }
  }

  function handleCallerMessage(message: WSCallerMessage) {
    console.log('🎙️ Caller request received:', message.request)
    callerAudioPlayer.enqueue(message.request)
  }

  function setCallerVolume(volume: number) {
    callerAudioPlayer.setVolume(volume)
  }

  function stopCaller() {
    callerAudioPlayer.stop()
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
    setCallerVolume,
    stopCaller,
  }
})
