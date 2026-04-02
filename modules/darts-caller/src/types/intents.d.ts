/**
 * Intent System Type Definitions
 *
 * Intents are high-level semantic messages that modules can emit and handle.
 * Unlike raw events, intents represent meaningful actions that other modules
 * can react to based on their configuration.
 *
 * Examples:
 * - "player.achievement.180" - Player scored 180
 * - "match.milestone.checkout" - High checkout achieved
 * - "game.state.won" - A player won a game
 */
/**
 * Payload field definition for an intent
 */
export interface IntentPayloadField {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    optional?: boolean;
}
/**
 * Intent definition that a module can emit
 */
export interface IntentEmitDefinition {
    /** Unique intent ID using dot notation (e.g., "player.achievement.180") */
    id: string;
    /** Human-readable description */
    description: string;
    /** Payload schema */
    payload?: Record<string, IntentPayloadField>;
    /** Category for UI grouping */
    category?: string;
}
/**
 * Intent handler definition - how a module responds to an intent
 */
export interface IntentHandleDefinition {
    /** Intent ID or pattern to handle (supports wildcards like "player.achievement.*") */
    id: string;
    /** Action type specific to the module */
    action: string;
    /** Default configuration for this handler */
    defaultConfig?: Record<string, unknown>;
    /** Description of what happens when handling this intent */
    description?: string;
    /** Whether this subscription is enabled by default */
    enabledByDefault?: boolean;
}
/**
 * Intent subscription configuration - user-configurable reactions to intents
 * This is stored in the module's config, not in module.json
 */
export interface IntentSubscriptionConfig {
    /** Intent ID or pattern to subscribe to */
    intentId: string;
    /** Whether this subscription is enabled */
    enabled: boolean;
    /** Action to perform when intent is received */
    action: IntentActionConfig;
}
/**
 * Action configuration for intent handlers
 * Each module defines its own action types
 */
export interface IntentActionConfig {
    /** Action type (module-specific, e.g., "playSound", "setColor", "showAnimation") */
    type: string;
    /** Action-specific configuration */
    config?: Record<string, unknown>;
}
/**
 * Available actions that a module can perform in response to intents
 * Defined in module.json
 */
export interface ModuleIntentAction {
    /** Action type identifier */
    type: string;
    /** Human-readable label */
    label: string;
    /** Description of what the action does */
    description?: string;
    /** Configuration schema for this action */
    configSchema?: Record<string, IntentActionConfigField>;
}
/**
 * Configuration field for an intent action
 */
export interface IntentActionConfigField {
    type: 'string' | 'number' | 'boolean' | 'select' | 'color';
    label: string;
    description?: string;
    default?: unknown;
    options?: Array<{
        value: string;
        label: string;
    }>;
    min?: number;
    max?: number;
}
/**
 * Module intent configuration in module.json
 */
export interface ModuleIntentsConfig {
    /** Intents this module can emit */
    emits?: IntentEmitDefinition[];
    /** Intents this module can handle (static definitions) */
    handles?: IntentHandleDefinition[];
    /** Actions this module can perform in response to intents */
    actions?: ModuleIntentAction[];
    /** Default intent subscriptions (can be overridden by user config) */
    defaultSubscriptions?: IntentSubscriptionConfig[];
}
/**
 * Intent instance - an actual intent being sent
 */
export interface Intent {
    /** Intent ID */
    id: string;
    /** Source module that emitted this intent */
    source: string;
    /** Intent payload data */
    payload: Record<string, unknown>;
    /** Timestamp when intent was emitted */
    timestamp: number;
    /** Optional correlation ID for tracking */
    correlationId?: string;
}
/**
 * Intent handler callback
 */
export type IntentHandler = (intent: Intent) => Promise<void> | void;
/**
 * Registered intent handler with metadata
 */
export interface RegisteredIntentHandler {
    /** Module ID that registered this handler */
    moduleId: string;
    /** Intent ID pattern (supports wildcards like "player.achievement.*") */
    intentPattern: string;
    /** Handler function */
    handler: IntentHandler;
    /** Handler configuration */
    config?: Record<string, unknown>;
    /** Priority (higher = called first) */
    priority?: number;
}
/**
 * Intent subscription options
 */
export interface IntentSubscriptionOptions {
    /** Priority for handler execution order */
    priority?: number;
    /** Configuration passed to handler */
    config?: Record<string, unknown>;
    /** Only handle intents from specific modules */
    sourceFilter?: string[];
}
/**
 * Registered intent definition with source module
 */
export interface RegisteredIntent {
    /** Intent definition */
    definition: IntentEmitDefinition;
    /** Module that can emit this intent */
    sourceModule: string;
}
/**
 * Intent registry state
 */
export interface IntentRegistry {
    /** All registered intents by ID */
    intents: Map<string, RegisteredIntent>;
    /** All registered handlers by intent pattern */
    handlers: Map<string, RegisteredIntentHandler[]>;
}
/**
 * Standard intent categories for organization
 */
export declare const IntentCategories: {
    readonly PLAYER_ACHIEVEMENT: "player.achievement";
    readonly PLAYER_STATS: "player.stats";
    readonly MATCH_STATE: "match.state";
    readonly MATCH_MILESTONE: "match.milestone";
    readonly GAME_STATE: "game.state";
    readonly SYSTEM: "system";
};
/**
 * Well-known intent IDs that modules can use
 */
export declare const StandardIntents: {
    readonly PLAYER_180: "player.achievement.180";
    readonly PLAYER_171: "player.achievement.171";
    readonly PLAYER_HIGH_SCORE: "player.achievement.highScore";
    readonly PLAYER_HIGH_CHECKOUT: "player.achievement.highCheckout";
    readonly PLAYER_CHECKOUT: "player.achievement.checkout";
    readonly PLAYER_BUST: "player.achievement.bust";
    readonly PLAYER_PERFECT_LEG: "player.achievement.perfectLeg";
    readonly MATCH_STARTED: "match.milestone.started";
    readonly MATCH_ENDED: "match.milestone.ended";
    readonly MATCH_LEG_WON: "match.milestone.legWon";
    readonly MATCH_GAME_WON: "match.milestone.gameWon";
    readonly MATCH_POINT: "match.milestone.matchPoint";
    readonly PLAYER_STATS_UPDATED: "player.stats.updated";
    readonly PLAYER_NEW_RECORD: "player.stats.newRecord";
    readonly PLAYER_TREND_CHANGE: "player.stats.trendChange";
    readonly MODULE_STARTED: "system.module.started";
    readonly MODULE_STOPPED: "system.module.stopped";
    readonly HUB_CONNECTED: "system.hub.connected";
    readonly HUB_DISCONNECTED: "system.hub.disconnected";
};
export interface PlayerAchievementPayload {
    playerId: string;
    playerName: string;
    matchId: string;
    gameType?: string;
}
export interface Player180Payload extends PlayerAchievementPayload {
}
export interface PlayerHighScorePayload extends PlayerAchievementPayload {
    score: number;
    previousHigh?: number;
}
export interface PlayerCheckoutPayload extends PlayerAchievementPayload {
    checkout: number;
    darts: number;
    isDoubleOut: boolean;
}
export interface MatchMilestonePayload {
    matchId: string;
    playerName?: string;
    playerId?: string;
}
export interface LegWonPayload extends MatchMilestonePayload {
    legNumber: number;
    totalLegs: number;
    dartsThrown: number;
    average: number;
}
export interface GameWonPayload extends MatchMilestonePayload {
    gameNumber: number;
    totalGames: number;
    legsWon: number;
    legsLost: number;
}
export interface MatchEndedPayload extends MatchMilestonePayload {
    winnerId?: string;
    winnerName?: string;
    isAborted: boolean;
    duration?: number;
}
export interface PlayerStatsPayload {
    playerId: string;
    playerName: string;
    statType: string;
    oldValue?: number;
    newValue: number;
}
