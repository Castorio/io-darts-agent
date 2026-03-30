import type { AutodartsEventType, ParsedEvent } from './index.js';
import type { ModuleIntentsConfig } from './intents.js';
export interface ModuleManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    repository?: string;
    entry: string;
    events: AutodartsEventType[];
    config?: ModuleConfigSchema;
    i18n?: ModuleI18n;
    intents?: ModuleIntentsConfig;
}
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
    name?: string;
    description?: string;
    config?: {
        [fieldKey: string]: ConfigFieldTranslation;
    };
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
    options?: {
        value: string | number;
        label: string;
    }[];
    min?: number;
    max?: number;
}
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
export interface IPCMessage<T = unknown> {
    id: string;
    type: IPCMessageType;
    timestamp: number;
    payload: T;
}
export type IPCMessageType = 'init' | 'event' | 'config.update' | 'shutdown' | 'ready' | 'status' | 'log' | 'error' | 'request' | 'ping' | 'pong';
export interface InitPayload {
    moduleId: string;
    config: Record<string, unknown>;
    hubVersion: string;
    subscribedEvents: AutodartsEventType[];
    language: string;
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
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
export interface BridgeOptions {
    socketPath: string;
    pingInterval: number;
    pingTimeout: number;
    reconnectDelay: number;
}
export type MessageHandler<T = unknown> = (message: IPCMessage<T>) => void | Promise<void>;
export interface ModuleEventSubscription {
    moduleId: string;
    events: AutodartsEventType[];
    callback: (event: ParsedEvent) => Promise<void>;
}
//# sourceMappingURL=modules.d.ts.map