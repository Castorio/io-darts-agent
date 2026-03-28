// ============================================
// IO-Darts-Agent - API Type Definitions
// ============================================

import type { ModuleStatus, AutodartsEventType } from './index.js';

// ============================================
// Hub Configuration (stored in config file)
// ============================================

export interface HubConfiguration {
  setupCompleted: boolean;
  language: import('./i18n.js').SupportedLanguage;
  webAuth: WebAuthConfig;
  autodarts: AutodartsConfig;
  server: ServerConfig;
}

export interface WebAuthConfig {
  enabled: boolean;
  username: string;
  passwordHash: string;
}

export interface AutodartsConfig {
  email: string;
  password: string;
  boardId: string;
  clientId: string;
  clientSecret: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

// ============================================
// Setup Wizard Types
// ============================================

export interface SetupStatusResponse {
  setupRequired: boolean;
  version: string;
}

export interface SetupCompleteRequest {
  webAuth: {
    enabled: boolean;
    username?: string;
    password?: string;
  };
  autodarts: {
    email: string;
    password: string;
    boardId: string;
  };
}

export interface SetupCompleteResponse {
  success: boolean;
  message: string;
}

export interface TestConnectionRequest {
  email: string;
  password: string;
  boardId: string;
}

export interface TestConnectionResponse {
  success: boolean;
  userId?: string;
  boardName?: string;
  error?: string;
}

// ============================================
// Web Auth Types
// ============================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  username?: string;
  authRequired: boolean;
}

// ============================================
// Hub Status Types
// ============================================

export interface HubStatusResponse {
  version: string;
  uptime: number;
  setupCompleted: boolean;
  autodarts: {
    connected: boolean;
    userId?: string;
    boardId?: string;
  };
  modules: {
    total: number;
    running: number;
  };
}

// ============================================
// Module API Types
// ============================================

export interface ModuleListItem {
  id: string;
  name: string;
  version: string;
  description: string;
  status: ModuleStatus;
  events: AutodartsEventType[];
}

export interface ModuleDetailResponse {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  repository?: string;
  status: ModuleStatus;
  events: AutodartsEventType[];
  config: ModuleConfigResponse;
  stats: {
    startedAt?: string;
    stoppedAt?: string;
    restartCount: number;
    lastError?: string;
  };
}

export interface ModuleConfigResponse {
  schema: Record<string, ModuleConfigFieldSchema>;
  values: Record<string, unknown>;
}

export interface ModuleConfigFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  default?: string | number | boolean;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
}

export interface UpdateModuleConfigRequest {
  config: Record<string, unknown>;
}

export interface InstallModuleRequest {
  source: 'git' | 'local';
  url?: string;
  path?: string;
  branch?: string;
}

export interface InstallModuleResponse {
  success: boolean;
  moduleId?: string;
  error?: string;
}

export interface ModuleActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================
// Settings Types
// ============================================

export interface SettingsResponse {
  language: import('./i18n.js').SupportedLanguage;
  server: {
    port: number;
    host: string;
  };
  webAuth: {
    enabled: boolean;
    username: string;
  };
  autodarts: {
    email: string;
    boardId: string;
    // password not exposed
  };
}

export interface UpdateSettingsRequest {
  language?: import('./i18n.js').SupportedLanguage;
  server?: {
    port?: number;
    host?: string;
  };
  webAuth?: {
    enabled?: boolean;
    username?: string;
    password?: string;
  };
  autodarts?: {
    email?: string;
    password?: string;
    boardId?: string;
  };
}

// ============================================
// WebSocket Event Types
// ============================================

export interface WSEventMessage {
  type: 'event';
  event: {
    type: AutodartsEventType;
    timestamp: string;
    data: unknown;
  };
}

export interface WSStatusMessage {
  type: 'status';
  status: {
    connected: boolean;
    matchId?: string;
  };
}

export interface WSModuleMessage {
  type: 'module';
  moduleId: string;
  status: ModuleStatus;
  message?: string;
}

export type WSMessage = WSEventMessage | WSStatusMessage | WSModuleMessage;

// ============================================
// API Error Types
// ============================================

export interface APIError {
  statusCode: number;
  error: string;
  message: string;
}

// ============================================
// Session Data
// ============================================

export interface SessionData {
  authenticated: boolean;
  username?: string;
  createdAt: number;
}
