// ============================================
// IO-Darts-Agent - Module System Type Definitions
// ============================================

import type { AutodartsEventType, ParsedEvent } from './index.js';
import type { ModuleIntentsConfig } from './intents.js';

// ============================================
// Module Manifest (module.json)
// ============================================

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  repository?: string;
  entry: string; // Main file (e.g., "index.js")
  events: AutodartsEventType[]; // Events this module subscribes to
  config?: ModuleConfigSchema;
  i18n?: ModuleI18n; // Multi-language support
  intents?: ModuleIntentsConfig; // Intent system configuration
}

// ============================================
// Module Internationalization
// ============================================

/**
 * Module i18n configuration
 * Keys are language codes (en, de, es, etc.)
 */
export interface ModuleI18n {
  [languageCode: string]: ModuleTranslations;
}

/**
 * Translations for a single language
 */
export interface ModuleTranslations {
  // Module metadata translations
  name?: string;
  description?: string;

  // Config field translations
  config?: {
    [fieldKey: string]: ConfigFieldTranslation;
  };

  // Custom strings used by the module
  strings?: {
    [key: string]: string;
  };
}

/**
 * Translation for a config field
 */
export interface ConfigFieldTranslation {
  label?: string;
  description?: string;
  // For select type options
  options?: {
    [value: string]: string;
  };
}

export interface ModuleConfigSchema {
  [key: string]: ModuleConfigField;
}

export interface ModuleConfigField {
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  default?: string | number | boolean;
  required?: boolean;
  options?: { value: string | number; label: string }[]; // For select type
  min?: number; // For number type
  max?: number; // For number type
}

// ============================================
// Module State & Status
// ============================================

export type ModuleStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'crashed';

export interface ModuleState {
  id: string;
  status: ModuleStatus;
  pid?: number;
  startedAt?: Date;
  stoppedAt?: Date;
  lastError?: string;
  restartCount: number;
}

export interface ModuleInfo {
  manifest: ModuleManifest;
  state: ModuleState;
  config: Record<string, unknown>;
  path: string;
  installed: boolean;
}

// ============================================
// IPC Protocol - Messages between Hub and Module
// ============================================

// Message envelope for all IPC communication
export interface IPCMessage<T = unknown> {
  id: string; // Message ID for request/response matching
  type: IPCMessageType;
  timestamp: number;
  payload: T;
}

export type IPCMessageType =
  // Hub → Module
  | 'init' // Module initialization
  | 'event' // Autodarts event
  | 'config.update' // Config change
  | 'shutdown' // Graceful shutdown request
  // Module → Hub
  | 'ready' // Module is ready to receive events
  | 'status' // Status update from module
  | 'log' // Log message from module
  | 'error' // Error from module
  | 'request' // Generic request from module
  // Bidirectional
  | 'ping' // Health check
  | 'pong'; // Health check response

// ============================================
// Hub → Module Messages
// ============================================

export interface InitPayload {
  moduleId: string;
  config: Record<string, unknown>;
  hubVersion: string;
  subscribedEvents: AutodartsEventType[];
  language: string; // Current language setting
}

export interface EventPayload {
  event: ParsedEvent;
}

export interface ConfigUpdatePayload {
  config: Record<string, unknown>;
  changedKeys: string[];
}

export interface ShutdownPayload {
  reason: 'user' | 'update' | 'hub-shutdown' | 'error';
  gracePeriodMs: number;
}

// ============================================
// Module → Hub Messages
// ============================================

export interface ReadyPayload {
  moduleId: string;
  version: string;
  capabilities?: string[];
}

export interface StatusPayload {
  status: ModuleStatus;
  message?: string;
  data?: Record<string, unknown>;
}

export interface LogPayload {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface ErrorPayload {
  code: string;
  message: string;
  stack?: string;
  fatal: boolean;
}

export interface RequestPayload {
  action: string;
  data?: Record<string, unknown>;
}

// ============================================
// Module Manager Types
// ============================================

export interface ModuleManagerOptions {
  modulesDir: string;
  socketDir: string;
  maxRestarts: number;
  restartDelay: number;
  shutdownTimeout: number;
}

export interface SpawnOptions {
  env?: Record<string, string>;
  cwd?: string;
}

// ============================================
// Module Installer Types
// ============================================

export interface InstallSource {
  type: 'git' | 'local' | 'npm';
  url?: string;
  path?: string;
  package?: string;
  branch?: string;
  tag?: string;
}

export interface InstallResult {
  success: boolean;
  moduleId: string;
  path: string;
  manifest?: ModuleManifest;
  error?: string;
}

export interface UpdateResult {
  success: boolean;
  moduleId: string;
  previousVersion?: string;
  newVersion?: string;
  error?: string;
}

// ============================================
// Module Bridge Types
// ============================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface BridgeOptions {
  socketPath: string;
  pingInterval: number;
  pingTimeout: number;
  reconnectDelay: number;
}

// ============================================
// Helper Types
// ============================================

export type MessageHandler<T = unknown> = (message: IPCMessage<T>) => void | Promise<void>;

export interface ModuleEventSubscription {
  moduleId: string;
  events: AutodartsEventType[];
  callback: (event: ParsedEvent) => Promise<void>;
}
