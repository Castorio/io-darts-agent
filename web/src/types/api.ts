// API Types for Frontend
// Mirrored from backend types

export interface SetupStatusResponse {
  setupRequired: boolean
  version: string
}

export interface SetupCompleteRequest {
  webAuth: {
    enabled: boolean
    username?: string
    password?: string
  }
  autodarts: {
    email: string
    password: string
    boardId: string
  }
}

export interface SetupCompleteResponse {
  success: boolean
  message: string
}

export interface TestConnectionRequest {
  email: string
  password: string
  boardId: string
}

export interface TestConnectionResponse {
  success: boolean
  userId?: string
  boardName?: string
  error?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  success: boolean
  message?: string
}

export interface SessionResponse {
  authenticated: boolean
  username?: string
  authRequired: boolean
}

export interface HubStatusResponse {
  version: string
  uptime: number
  setupCompleted: boolean
  autodarts: {
    connected: boolean
    userId?: string
    boardId?: string
  }
  modules: {
    total: number
    running: number
  }
}

export type ModuleStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface ModuleListItem {
  id: string
  name: string
  version: string
  description: string
  status: ModuleStatus
  events: string[]
}

export interface ModuleConfigFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  description?: string
  default?: string | number | boolean
  required?: boolean
  options?: { value: string | number; label: string }[]
  min?: number
  max?: number
}

export interface ModuleConfigResponse {
  schema: Record<string, ModuleConfigFieldSchema>
  values: Record<string, unknown>
}

export interface ModuleDetailResponse {
  id: string
  name: string
  version: string
  description: string
  author?: string
  repository?: string
  status: ModuleStatus
  events: string[]
  config: ModuleConfigResponse
  stats: {
    startedAt?: string
    stoppedAt?: string
    restartCount: number
    lastError?: string
  }
}

export interface InstallModuleRequest {
  source: 'git' | 'local'
  url?: string
  path?: string
  branch?: string
}

export interface InstallModuleResponse {
  success: boolean
  moduleId?: string
  error?: string
}

export interface ModuleActionResponse {
  success: boolean
  message?: string
  error?: string
}

export interface SettingsResponse {
  server: {
    port: number
    host: string
  }
  webAuth: {
    enabled: boolean
    username: string
  }
  autodarts: {
    email: string
    boardId: string
  }
}

export interface UpdateSettingsRequest {
  server?: {
    port?: number
    host?: string
  }
  webAuth?: {
    enabled?: boolean
    username?: string
    password?: string
  }
  autodarts?: {
    email?: string
    password?: string
    boardId?: string
  }
}

// WebSocket message types
export interface WSEventMessage {
  type: 'event'
  event: {
    type: string
    timestamp: string
    data: unknown
  }
}

export interface WSStatusMessage {
  type: 'status'
  status: {
    connected: boolean
    matchId?: string
  }
}

export interface WSModuleMessage {
  type: 'module'
  moduleId: string
  status: ModuleStatus
  message?: string
}

export interface CallRequest {
  id: string
  type: 'score' | 'checkout' | 'player' | 'game' | 'special'
  text: string
  audioFile?: string
  priority: number
  timestamp: number
}

export interface WSCallerMessage {
  type: 'caller'
  request: CallRequest
}

export type WSMessage = WSEventMessage | WSStatusMessage | WSModuleMessage | WSCallerMessage
