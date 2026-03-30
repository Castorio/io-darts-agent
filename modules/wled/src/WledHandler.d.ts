/**
 * WLED Module Event Handler
 *
 * Processes Autodarts events and sends commands to WLED devices
 */
import type { ParsedEvent } from '../../../src/types/index.js';
/**
 * Player service interface for player color matching
 */
export interface PlayerServiceInterface {
    matchPlayer(name: string): Promise<{
        name: string;
        color?: string;
    } | null | undefined>;
}
/**
 * Logger interface for event logging
 */
export interface WledLoggerInterface {
    log(source: string, message: string, data?: unknown): void;
}
/**
 * WLED action types
 */
export type WledActionType = 'preset' | 'effect' | 'solid' | 'brightness' | 'off' | 'none';
/**
 * WLED action configuration
 */
export interface WledAction {
    enabled?: boolean;
    actionType?: WledActionType;
    presetId?: number;
    effectId?: number;
    color?: {
        r: number;
        g: number;
        b: number;
    } | string;
    color1?: {
        r: number;
        g: number;
        b: number;
    } | string;
    color2?: {
        r: number;
        g: number;
        b: number;
    } | string;
    color3?: {
        r: number;
        g: number;
        b: number;
    } | string;
    brightness?: number;
    speed?: number;
    intensity?: number;
    duration?: number;
    fadeTime?: number;
    usePlayerColor?: boolean;
}
/**
 * WLED module configuration
 */
export interface WledConfig {
    wledHost?: string;
    wledPort?: number;
    events?: Record<string, WledAction>;
    eventActions?: Record<string, WledAction>;
    defaultState?: WledAction;
    autoStart?: boolean;
    playerColors?: Array<string | {
        r: number;
        g: number;
        b: number;
    }>;
    fadeTime?: number;
}
/**
 * WLED Handler class
 */
export declare class WledHandler {
    private config;
    private playerService;
    private logger;
    private currentMatchState;
    private readonly defaultPlayerColors;
    private stats;
    constructor(config: WledConfig);
    /**
     * Set player service for color matching
     */
    setPlayerService(service: PlayerServiceInterface | null): void;
    /**
     * Set logger for event logging
     */
    setLogger(logger: WledLoggerInterface | null): void;
    /**
     * Log a message
     */
    private log;
    /**
     * Update configuration
     */
    updateConfig(config: WledConfig): void;
    /**
     * Get current configuration
     */
    getConfig(): WledConfig;
    /**
     * Get WLED host
     */
    getHost(): string | undefined;
    /**
     * Get WLED port
     */
    getPort(): number;
    /**
     * Check if handler is configured
     */
    isConfigured(): boolean;
    /**
     * Get statistics
     */
    getStats(): typeof this.stats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Handle an event
     */
    handleEvent(event: ParsedEvent): Promise<void>;
    /**
     * Apply player color after a delay, waiting for match state to be available
     */
    private applyPlayerColorAfterDelay;
    /**
     * Resolve player color from stored match state (for restore after duration)
     */
    private resolvePlayerColorFromMatchState;
    /**
     * Resolve player color from event data and player service
     */
    private resolvePlayerColor;
    /**
     * Get action configuration for an event
     */
    private getActionForEvent;
    /**
     * Find action by trying multiple keys
     */
    private findAction;
    /**
     * Execute a WLED action
     */
    private executeAction;
}
/**
 * Create WLED handler from module config
 */
export declare function createWledHandler(config: Record<string, unknown>): WledHandler;
//# sourceMappingURL=WledHandler.d.ts.map