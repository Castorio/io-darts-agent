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
    eventMeta?: Record<string, {
        label: Record<string, string>;
        description: Record<string, string>;
    }>;
    eventGroups?: Array<{
        title: Record<string, string>;
        events: string[];
    }>;
    effects?: Array<{
        id: number;
        name: string;
    }>;
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
    type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'group';
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
    showIf?: {
        field: string;
        value: unknown;
    };
    fields?: Record<string, ModuleConfigField>;
    placeholder?: string;
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
export type IPCMessageType = 'init' | 'event' | 'config.update' | 'shutdown' | 'route.request' | 'ready' | 'status' | 'log' | 'error' | 'request' | 'routes.register' | 'route.response' | 'intent.emit' | 'ping' | 'pong';
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
export interface IntentEmitPayload {
    intentId: string;
    payload: Record<string, unknown>;
}
/** HTTP methods supported for module routes */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Module route definition */
export interface ModuleRouteDefinition {
    /** HTTP method */
    method: HttpMethod;
    /** Route path (relative to /api/modules/:moduleId/routes/) */
    path: string;
    /** Handler identifier for the module to match requests */
    handlerId: string;
    /** Optional route description */
    description?: string;
    /** Whether authentication is required (default: true) */
    requireAuth?: boolean;
    /** Optional JSON schema for validation */
    schema?: {
        body?: Record<string, unknown>;
        querystring?: Record<string, unknown>;
        params?: Record<string, unknown>;
        response?: Record<string, unknown>;
    };
}
/** Routes registration payload (Module → Hub) */
export interface RoutesRegisterPayload {
    routes: ModuleRouteDefinition[];
}
/** Route request payload (Hub → Module) */
export interface RouteRequestPayload {
    /** Handler ID to identify which route handler to invoke */
    handlerId: string;
    /** HTTP method */
    method: HttpMethod;
    /** Route path */
    path: string;
    /** URL params (from path like /users/:id) */
    params: Record<string, string>;
    /** Query string parameters */
    query: Record<string, unknown>;
    /** Request body */
    body: unknown;
    /** Request headers */
    headers: Record<string, string>;
}
/** Route response payload (Module → Hub) */
export interface RouteResponsePayload {
    /** HTTP status code (default: 200) */
    statusCode?: number;
    /** Response headers */
    headers?: Record<string, string>;
    /** Response body */
    body: unknown;
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
