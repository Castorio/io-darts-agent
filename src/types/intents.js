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
// ============================================================================
// Well-known Intent Categories
// ============================================================================
/**
 * Standard intent categories for organization
 */
export const IntentCategories = {
    PLAYER_ACHIEVEMENT: 'player.achievement',
    PLAYER_STATS: 'player.stats',
    MATCH_STATE: 'match.state',
    MATCH_MILESTONE: 'match.milestone',
    GAME_STATE: 'game.state',
    SYSTEM: 'system',
};
// ============================================================================
// Standard Intent IDs (for type safety)
// ============================================================================
/**
 * Well-known intent IDs that modules can use
 */
export const StandardIntents = {
    // Player achievements
    PLAYER_180: 'player.achievement.180',
    PLAYER_171: 'player.achievement.171',
    PLAYER_HIGH_SCORE: 'player.achievement.highScore',
    PLAYER_HIGH_CHECKOUT: 'player.achievement.highCheckout',
    PLAYER_CHECKOUT: 'player.achievement.checkout',
    PLAYER_BUST: 'player.achievement.bust',
    PLAYER_PERFECT_LEG: 'player.achievement.perfectLeg',
    // Match milestones
    MATCH_STARTED: 'match.milestone.started',
    MATCH_ENDED: 'match.milestone.ended',
    MATCH_LEG_WON: 'match.milestone.legWon',
    MATCH_GAME_WON: 'match.milestone.gameWon',
    MATCH_POINT: 'match.milestone.matchPoint',
    // Player stats
    PLAYER_STATS_UPDATED: 'player.stats.updated',
    PLAYER_NEW_RECORD: 'player.stats.newRecord',
    PLAYER_TREND_CHANGE: 'player.stats.trendChange',
    // System
    MODULE_STARTED: 'system.module.started',
    MODULE_STOPPED: 'system.module.stopped',
    HUB_CONNECTED: 'system.hub.connected',
    HUB_DISCONNECTED: 'system.hub.disconnected',
};
//# sourceMappingURL=intents.js.map