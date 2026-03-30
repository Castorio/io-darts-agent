import type { ModuleStatus, AutodartsEventType } from './index.js';
export interface HubConfiguration {
    setupCompleted: boolean;
    language: import('./i18n.js').SupportedLanguage;
    webAuth: WebAuthConfig;
    autodarts: AutodartsConfig;
    server: ServerConfig;
    aiProviders?: AIProvidersConfig;
    developerMode?: boolean;
}
export interface AIProvidersConfig {
    runway?: {
        apiKey: string;
        model?: 'gen3a_turbo' | 'gen3a';
    };
    elevenlabs?: {
        apiKey: string;
    };
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
    options?: {
        value: string | number;
        label: string;
    }[];
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
    };
    aiProviders?: {
        runway?: {
            configured: boolean;
            model: 'gen3a_turbo' | 'gen3a';
        };
        elevenlabs?: {
            configured: boolean;
        };
    };
    developerMode?: boolean;
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
    aiProviders?: {
        runway?: {
            apiKey?: string;
            model?: 'gen3a_turbo' | 'gen3a';
        };
        elevenlabs?: {
            apiKey?: string;
        };
    };
    developerMode?: boolean;
}
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
export interface APIError {
    statusCode: number;
    error: string;
    message: string;
}
export interface SessionData {
    authenticated: boolean;
    username?: string;
    createdAt: number;
}
//# sourceMappingURL=api.d.ts.map