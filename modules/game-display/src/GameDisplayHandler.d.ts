/**
 * Game Display Module Event Handler
 *
 * Processes Autodarts events for the Game Display module.
 * The Game Display primarily uses WebSocket for real-time updates,
 * but this handler can be used for server-side event logging,
 * animation triggering, and statistics tracking.
 */
import type { ParsedEvent } from '../../../src/types/index.js';
/**
 * Animation configuration for an event
 */
export interface AnimationConfig {
    enabled?: boolean;
    type?: 'builtin' | 'gif' | 'video';
    url?: string;
    sound?: boolean;
    soundUrl?: string;
    duration?: number;
}
/**
 * Game Display animation settings
 */
export interface GameDisplayAnimations {
    enabled?: boolean;
    duration?: number;
    throw180?: AnimationConfig;
    bull?: AnimationConfig;
    doubleBull?: AnimationConfig;
    legWin?: AnimationConfig;
    matchWin?: AnimationConfig;
    highScore?: AnimationConfig & {
        threshold?: number;
    };
    checkout?: AnimationConfig;
    bust?: AnimationConfig;
}
/**
 * Player-specific animation overrides
 */
export interface PlayerAnimationConfig {
    playerId?: string;
    playerName?: string;
    throw180?: AnimationConfig;
    legWin?: AnimationConfig;
    matchWin?: AnimationConfig;
}
/**
 * Game Display module configuration
 */
export interface GameDisplayConfig {
    displayName?: string;
    idleMode?: 'black' | 'image' | 'lastGame';
    idleImageUrl?: string;
    showCheckouts?: boolean;
    checkoutThreshold?: number;
    animationSpeed?: 'slow' | 'normal' | 'fast';
    showOtherPlayers?: boolean;
    animations?: GameDisplayAnimations;
    playerAnimations?: PlayerAnimationConfig[];
}
/**
 * Animation event types
 */
export type AnimationEventType = '180' | 'bull' | 'doubleBull' | 'highScore' | 'checkout' | 'bust' | 'legWin' | 'matchWin';
/**
 * Animation trigger result
 */
export interface AnimationTrigger {
    type: AnimationEventType;
    config: AnimationConfig;
    playerConfig?: AnimationConfig;
    playerIndex?: number;
    playerName?: string;
}
/**
 * Event callback type
 */
export type GameDisplayEventCallback = (event: ParsedEvent, trigger?: AnimationTrigger) => void;
/**
 * Game Display Handler class
 */
export declare class GameDisplayHandler {
    private config;
    private eventCallbacks;
    private stats;
    constructor(config: GameDisplayConfig);
    /**
     * Update configuration
     */
    updateConfig(config: GameDisplayConfig): void;
    /**
     * Get current configuration
     */
    getConfig(): GameDisplayConfig;
    /**
     * Register event callback
     */
    onEvent(callback: GameDisplayEventCallback): void;
    /**
     * Remove event callback
     */
    offEvent(callback: GameDisplayEventCallback): void;
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
     * Check if event should trigger an animation
     */
    private checkAnimationTrigger;
    /**
     * Check throw event for animation triggers
     */
    private checkThrowAnimation;
    /**
     * Get player-specific animation config override
     */
    private getPlayerAnimationConfig;
    /**
     * Update statistics based on event
     */
    private updateStats;
    /**
     * Get animation duration based on speed setting
     */
    getAnimationDuration(baseDuration: number): number;
    /**
     * Check if checkout should be shown
     */
    shouldShowCheckout(remaining: number): boolean;
}
/**
 * Create Game Display handler from module config
 */
export declare function createGameDisplayHandler(config: Record<string, unknown>): GameDisplayHandler;
//# sourceMappingURL=GameDisplayHandler.d.ts.map