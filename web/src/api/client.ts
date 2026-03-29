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
    }>('/settings')
  },

  async updateSettings(settings: {
    server?: { port?: number; host?: string }
    webAuth?: { enabled?: boolean; username?: string; password?: string }
    autodarts?: { email?: string; password?: string; boardId?: string }
  }) {
    return request<{ success: boolean; message?: string; error?: string }>(
      '/settings',
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      }
    )
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
  async uploadMedia(file: File, mediaType: 'animation' | 'sound' | 'image' = 'animation') {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/media/${mediaType}/upload`, {
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

  async listMedia(mediaType: 'animation' | 'sound' | 'image' = 'animation') {
    const result = await request<{
      files: Array<{ name: string; url: string; size: number; mimeType: string }>
      total: number
    }>(`/media/${mediaType}`)

    return {
      success: true,
      files: result.files.map((f) => ({
        name: f.name,
        url: f.url || `/api/media/files/${mediaType}/${f.name}`,
        size: f.size,
        type: f.mimeType,
      })),
    }
  },

  async deleteMedia(mediaType: 'animation' | 'sound' | 'image', filename: string) {
    return request<{ success: boolean; error?: string }>(
      `/media/${mediaType}/${filename}`,
      { method: 'DELETE' }
    )
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
