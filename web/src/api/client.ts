// API Client for IO-Darts-Agent

const API_BASE = '/api'

class APIError extends Error {
  public statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
    this.name = 'APIError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })

  const data = await response.json()

  if (!response.ok) {
    throw new APIError(
      response.status,
      data.message || data.error || 'Request failed'
    )
  }

  return data as T
}

export const api = {
  // Setup
  async getSetupStatus() {
    return request<{ setupRequired: boolean; version: string }>(
      '/setup/status'
    )
  },

  async testConnection(email: string, password: string, boardId: string) {
    return request<{
      success: boolean
      userId?: string
      boardName?: string
      error?: string
    }>('/setup/test-connection', {
      method: 'POST',
      body: JSON.stringify({ email, password, boardId }),
    })
  },

  async completeSetup(data: {
    webAuth: { enabled: boolean; username?: string; password?: string }
    autodarts: { email: string; password: string; boardId: string }
  }) {
    return request<{ success: boolean; message: string }>('/setup/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Auth
  async getSession() {
    return request<{
      authenticated: boolean
      username?: string
      authRequired: boolean
    }>('/auth/session')
  },

  async login(username: string, password: string) {
    return request<{ success: boolean; message?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  async logout() {
    return request<{ success: boolean; message?: string }>('/auth/logout', {
      method: 'POST',
    })
  },

  // Status
  async getStatus() {
    return request<{
      version: string
      uptime: number
      setupCompleted: boolean
      autodarts: { connected: boolean; userId?: string; boardId?: string }
      modules: { total: number; running: number }
    }>('/status')
  },

  async connectAutodarts() {
    return request<{ success: boolean; message?: string; error?: string }>(
      '/autodarts/connect',
      { method: 'POST' }
    )
  },

  async disconnectAutodarts() {
    return request<{ success: boolean; message?: string; error?: string }>(
      '/autodarts/disconnect',
      { method: 'POST' }
    )
  },

  // Modules
  async listModules() {
    return request<
      Array<{
        id: string
        name: string
        version: string
        description: string
        status: string
        events: string[]
      }>
    >('/modules')
  },

  async getModule(id: string) {
    return request<{
      id: string
      name: string
      version: string
      description: string
      author?: string
      repository?: string
      status: string
      events: string[]
      config: {
        schema: Record<string, unknown>
        values: Record<string, unknown>
      }
      stats: {
        startedAt?: string
        stoppedAt?: string
        restartCount: number
        lastError?: string
      }
    }>(`/modules/${id}`)
  },

  async startModule(id: string) {
    return request<{ success: boolean; message?: string; error?: string }>(
      `/modules/${id}/start`,
      { method: 'POST' }
    )
  },

  async stopModule(id: string) {
    return request<{ success: boolean; message?: string; error?: string }>(
      `/modules/${id}/stop`,
      { method: 'POST' }
    )
  },

  async restartModule(id: string) {
    return request<{ success: boolean; message?: string; error?: string }>(
      `/modules/${id}/restart`,
      { method: 'POST' }
    )
  },

  async updateModuleConfig(id: string, config: Record<string, unknown>) {
    return request<{ success: boolean; message?: string; error?: string }>(
      `/modules/${id}/config`,
      {
        method: 'PUT',
        body: JSON.stringify({ config }),
      }
    )
  },

  async installModule(
    source: 'git' | 'local',
    url?: string,
    path?: string,
    branch?: string
  ) {
    return request<{ success: boolean; moduleId?: string; error?: string }>(
      '/modules/install',
      {
        method: 'POST',
        body: JSON.stringify({ source, url, path, branch }),
      }
    )
  },

  async uninstallModule(id: string) {
    return request<{ success: boolean; message?: string; error?: string }>(
      `/modules/${id}`,
      { method: 'DELETE' }
    )
  },

  // WLED specific
  async testWledConnection(host: string, port: number = 80) {
    return request<{
      success: boolean
      info?: Record<string, unknown>
      error?: string
    }>('/modules/wled/test-connection', {
      method: 'POST',
      body: JSON.stringify({ host, port }),
    })
  },

  async testWledAction(
    host: string,
    port: number = 80,
    action: {
      actionType: 'preset' | 'effect' | 'solid' | 'off'
      presetId?: number
      effectId?: number
      color?: { r: number; g: number; b: number }
      color2?: { r: number; g: number; b: number }
      color3?: { r: number; g: number; b: number }
      brightness?: number
      speed?: number
      intensity?: number
    }
  ) {
    return request<{ success: boolean; message?: string; error?: string }>(
      '/modules/wled/test-action',
      {
        method: 'POST',
        body: JSON.stringify({ host, port, ...action }),
      }
    )
  },

  async getWledPresets(host: string, port: number = 80) {
    return request<{
      success: boolean
      presets?: Array<{ id: number; name: string }>
      error?: string
    }>('/modules/wled/presets', {
      method: 'POST',
      body: JSON.stringify({ host, port }),
    })
  },

  async getWledEffects(host: string, port: number = 80) {
    return request<{
      success: boolean
      effects?: Array<{ id: number; name: string }>
      error?: string
    }>('/modules/wled/effects', {
      method: 'POST',
      body: JSON.stringify({ host, port }),
    })
  },

  async getWledPalettes(host: string, port: number = 80) {
    return request<{
      success: boolean
      palettes?: Array<{ id: number; name: string }>
      error?: string
    }>('/modules/wled/palettes', {
      method: 'POST',
      body: JSON.stringify({ host, port }),
    })
  },

  // Players
  async listPlayers() {
    const response = await request<{
      players: Array<{
        id: string
        name: string
        color: string
        avatar?: string
        autodartsUserId?: string
        createdAt: string
        updatedAt: string
      }>
      total: number
    }>('/players')
    return response.players
  },

  async getPlayer(id: string) {
    return request<{
      id: string
      name: string
      color: string
      avatar?: string
      autodartsUserId?: string
      createdAt: string
      updatedAt: string
    }>(`/players/${id}`)
  },

  async createPlayer(player: {
    name: string
    color: string
    avatar?: string
    autodartsUserId?: string
  }) {
    return request<{ success: boolean; player?: { id: string }; error?: string }>(
      '/players',
      {
        method: 'POST',
        body: JSON.stringify(player),
      }
    )
  },

  async updatePlayer(
    id: string,
    player: {
      name?: string
      color?: string
      avatar?: string
      autodartsUserId?: string
    }
  ) {
    return request<{ success: boolean; error?: string }>(`/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(player),
    })
  },

  async deletePlayer(id: string) {
    return request<{ success: boolean; error?: string }>(`/players/${id}`, {
      method: 'DELETE',
    })
  },

  // Settings
  async getSettings() {
    return request<{
      server: { port: number; host: string }
      webAuth: { enabled: boolean; username: string }
      autodarts: { email: string; boardId: string }
      aiProviders?: {
        runway?: {
          configured: boolean
          model: 'gen3a_turbo' | 'gen3a'
        }
        elevenlabs?: {
          configured: boolean
        }
      }
    }>('/settings')
  },

  async updateSettings(settings: {
    server?: { port?: number; host?: string }
    webAuth?: { enabled?: boolean; username?: string; password?: string }
    autodarts?: { email?: string; password?: string; boardId?: string }
    aiProviders?: Record<string, unknown>
  }) {
    return request<{ success: boolean; message?: string; error?: string }>(
      '/settings',
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      }
    )
  },

  // ElevenLabs
  async getElevenLabsVoices() {
    return request<{
      success: boolean
      voices: Array<{
        voice_id: string
        name: string
        category: string
        labels?: Record<string, string>
        preview_url?: string
      }>
    }>('/tts/elevenlabs/voices')
  },

  // Voice Pack Generation
  async getVoicePackStatus() {
    const response = await request<{
      success: boolean
      elevenLabsConfigured: boolean
      isGenerating: boolean
      progress: {
        status: 'idle' | 'generating' | 'completed' | 'error'
        packId?: string
        packName?: string
        totalFiles?: number
        completedFiles?: number
        currentFile?: string
        error?: string
        startedAt?: number
      }
      existingPacks: number
      packs: Array<{
        id: string
        name: string
        voiceId: string
        language: string
        totalFiles: number
        generatedAt: string
      }>
    }>('/tts/voicepacks/generation/status')

    // Transform to frontend format
    const pack = response.packs?.[0]
    const isGenerating = response.isGenerating || response.progress?.status === 'generating'

    let status: 'idle' | 'generating' | 'completed' | 'failed' = 'idle'
    if (isGenerating) {
      status = 'generating'
    } else if (response.progress?.status === 'error') {
      status = 'failed'
    } else if (response.progress?.status === 'completed') {
      status = 'completed'
    } else if (pack) {
      status = 'idle' // Has pack, but not generating
    }

    const totalFiles = response.progress?.totalFiles || 0
    const completedFiles = response.progress?.completedFiles || 0
    const progressPercent = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0

    return {
      status,
      progress: progressPercent,
      currentItem: response.progress?.currentFile,
      totalItems: totalFiles,
      completedItems: completedFiles,
      error: response.progress?.error,
      lastGeneratedAt: pack?.generatedAt,
      voicePackExists: !!pack,
      voiceId: pack?.voiceId,
      voiceName: pack?.name,
    }
  },

  async generateVoicePack(voiceId: string, language: 'de' | 'en' = 'de', voiceName?: string) {
    // Generate a packId based on voiceId and language
    const packId = `${voiceId}_${language}`
    const packName = voiceName ? `${voiceName} (${language.toUpperCase()})` : `Voice Pack (${language.toUpperCase()})`

    return request<{
      success: boolean
      message?: string
      error?: string
    }>('/tts/voicepacks/generate', {
      method: 'POST',
      body: JSON.stringify({
        packId,
        packName,
        voiceId,
        language
      }),
    })
  },

  async cancelVoicePackGeneration() {
    return request<{
      success: boolean
      message?: string
      error?: string
    }>('/tts/voicepacks/generation/cancel', {
      method: 'POST',
    })
  },

  async deleteVoicePack(packId: string = 'default') {
    return request<{
      success: boolean
      message?: string
      error?: string
    }>(`/tts/voicepacks/${packId}`, {
      method: 'DELETE',
    })
  },

  // Logs
  async getLogs() {
    return request<
      Array<{
        id: string
        timestamp: number
        type: 'event' | 'module' | 'system'
        source: string
        message: string
        data?: unknown
      }>
    >('/logs')
  },

  // Media upload - uses the existing media service API
  // mediaType: 'animation' | 'sound' | 'image'
  async uploadMedia(file: File, mediaType: 'animation' | 'sound' | 'image' = 'animation', folder?: string) {
    const formData = new FormData()
    formData.append('file', file)

    const params = folder ? `?folder=${encodeURIComponent(folder)}` : ''
    const response = await fetch(`${API_BASE}/media/${mediaType}/upload${params}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    const data = await response.json()

    if (!response.ok) {
      throw new APIError(
        response.status,
        data.message || data.error || 'Upload failed'
      )
    }

    // Transform response to include URL
    const fileInfo = data.file as { name: string; url: string; size: number; mimeType: string } | undefined
    return {
      success: data.success as boolean,
      url: fileInfo?.url || `/api/media/files/${mediaType}/${fileInfo?.name || ''}`,
      filename: fileInfo?.name || '',
      error: data.error as string | undefined,
    }
  },

  async listMedia(
    mediaType: 'animation' | 'sound' | 'image' = 'animation',
    options?: { folder?: string; recursive?: boolean }
  ) {
    const params = new URLSearchParams()
    if (options?.folder) params.set('folder', options.folder)
    if (options?.recursive) params.set('folder', '*') // Use '*' for recursive listing

    const query = params.toString() ? `?${params.toString()}` : ''
    const result = await request<{
      files: Array<{ filename: string; originalName: string; url: string; size: number; mimeType: string; folder?: string }>
      total: number
      folder?: string
    }>(`/media/${mediaType}${query}`)

    return {
      success: true,
      files: result.files.map((f) => ({
        name: f.originalName,
        filename: f.filename,
        url: f.url || `/api/media/files/${mediaType}/${f.folder ? f.folder + '/' : ''}${f.filename}`,
        size: f.size,
        type: f.mimeType,
        folder: f.folder,
      })),
      folder: result.folder,
    }
  },

  async deleteMedia(mediaType: 'animation' | 'sound' | 'image', filename: string, folder?: string) {
    const params = folder ? `?folder=${encodeURIComponent(folder)}` : ''
    return request<{ success: boolean; error?: string }>(
      `/media/${mediaType}/${encodeURIComponent(filename)}${params}`,
      { method: 'DELETE' }
    )
  },

  // Media folders
  async listMediaFolders(mediaType: 'animation' | 'sound' | 'image') {
    return request<{
      folders: Array<{ name: string; path: string; fileCount: number; createdAt: string }>
      total: number
    }>(`/media/${mediaType}/folders`)
  },

  async createMediaFolder(mediaType: 'animation' | 'sound' | 'image', folderPath: string) {
    return request<{ success: boolean; folder?: { name: string; path: string }; error?: string }>(
      `/media/${mediaType}/folders`,
      {
        method: 'POST',
        body: JSON.stringify({ path: folderPath }),
      }
    )
  },

  async deleteMediaFolder(mediaType: 'animation' | 'sound' | 'image', folderPath: string) {
    return request<{ success: boolean; error?: string }>(
      `/media/${mediaType}/folders/${encodeURIComponent(folderPath)}`,
      { method: 'DELETE' }
    )
  },

  async moveMediaFile(
    mediaType: 'animation' | 'sound' | 'image',
    filename: string,
    fromFolder?: string,
    toFolder?: string
  ) {
    return request<{ success: boolean; file?: { url: string }; error?: string }>(
      `/media/${mediaType}/move`,
      {
        method: 'POST',
        body: JSON.stringify({ filename, fromFolder, toFolder }),
      }
    )
  },

  // Animation Generator
  async getAnimationGeneratorStatus() {
    return request<{ available: boolean; provider: string | null }>('/animations/status')
  },

  async getAnimationStyles() {
    return request<{
      styles: Array<{
        id: string
        name: string
        prompt: string
        category: string
        colors?: string[]
      }>
    }>('/animations/styles')
  },

  async getAnimationEventTypes() {
    return request<{
      events: Array<'180' | 'bull' | 'doubleBull' | 'highScore' | 'checkout' | 'legWin' | 'setWin' | 'matchWin' | 'bust'>
    }>('/animations/events')
  },

  async generateAnimation(params: {
    eventType: string
    styleId?: string
    customStyle?: { name: string; prompt: string }
    customPrompt?: string
    options?: { duration?: number; resolution?: string }
  }) {
    return request<{
      success: boolean
      job?: {
        id: string
        status: string
        eventType: string
        progress: number
        resultUrl?: string
        error?: string
      }
      error?: string
    }>('/animations/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  async generateAnimationBatch(params: {
    styleId?: string
    customStyle?: { name: string; prompt: string }
    eventTypes?: string[]
    options?: { duration?: number; resolution?: string }
  }) {
    return request<{
      success: boolean
      jobs?: Array<{
        id: string
        status: string
        eventType: string
        progress: number
      }>
      error?: string
    }>('/animations/generate-batch', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },

  async getAnimationJobs(status?: string) {
    const query = status ? `?status=${status}` : ''
    return request<{
      jobs: Array<{
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
      }>
    }>(`/animations/jobs${query}`)
  },

  async getAnimationJob(jobId: string) {
    return request<{
      id: string
      status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
      eventType: string
      style: { id: string; name: string }
      progress: number
      resultUrl?: string
      error?: string
      createdAt: string
      completedAt?: string
    }>(`/animations/jobs/${jobId}`)
  },

  async cancelAnimationJob(jobId: string) {
    return request<{ success: boolean; error?: string }>(`/animations/jobs/${jobId}`, {
      method: 'DELETE',
    })
  },

  async clearFinishedAnimationJobs() {
    return request<{ success: boolean; cleared: number }>('/animations/jobs/clear', {
      method: 'POST',
    })
  },
}

export { APIError }

// Log entry type for frontend use
export interface LogEntry {
  id: string
  timestamp: number
  type: 'event' | 'module' | 'system'
  source: string
  message: string
  data?: unknown
}
