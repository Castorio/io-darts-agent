import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { WSMessage, WSEventMessage, WSCallerMessage, CallRequest } from '../types/api'
import { useModulesStore } from './modules'
import { applyCallerTts } from '../lib/callerTts'

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
      if (request.audioFile && !request.tts) {
        // Play audio file (base64 data URL or file path)
        await this.playAudio(request.audioFile)
      } else {
        // Browser TTS (audioFile is only a voice pack file name then)
        await this.speakTTS(request)
      }
    } catch (error) {
      console.error('Failed to play caller audio:', error)
      // Try TTS as fallback
      try {
        await this.speakTTS(request)
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

  private speakTTS(request: CallRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Speech synthesis not supported'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(request.text)
      applyCallerTts(utterance, request.tts, window.speechSynthesis.getVoices(), this.volume)

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
  // shallowRef: a reactive proxy would break the socket identity check in onclose
  const ws = shallowRef<WebSocket | null>(null)
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
  // One socket and one pending reconnect at most. Every failed attempt used to
  // schedule its own reconnect, so parallel loops could connect at once and
  // every event (also browser TTS calls) arrived twice.
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let shouldReconnect = true

  function scheduleReconnect() {
    if (!shouldReconnect || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  function connect() {
    shouldReconnect = true
    const current = ws.value
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
      return
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/events`

    const socket = new WebSocket(wsUrl)
    ws.value = socket

    socket.onopen = () => {
      isConnected.value = true
      connectionError.value = null
      console.log('WebSocket connected')
    }

    socket.onclose = () => {
      // A replaced socket must not start another reconnect loop
      if (ws.value !== socket) return
      isConnected.value = false
      ws.value = null
      console.log('WebSocket disconnected')
      scheduleReconnect()
    }

    socket.onerror = (event) => {
      connectionError.value = 'WebSocket error'
      console.error('WebSocket error:', event)
    }

    socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }
  }

  function disconnect() {
    shouldReconnect = false
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const socket = ws.value
    ws.value = null
    socket?.close()
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
    // Only play in browser if callerType is 'tts' (browser TTS)
    // Voice packs and ElevenLabs are played locally on the server
    const callerType = message.callerType || (message.request as { callerType?: string }).callerType || 'tts'
    if (callerType === 'tts') {
      callerAudioPlayer.enqueue(message.request)
    } else {
      console.log('🔇 Skipping browser playback - audio played on server (callerType:', callerType, ')')
    }
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
