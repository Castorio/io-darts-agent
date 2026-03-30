/**
 * Local player stored in the hub
 */
export interface LocalPlayer {
    id: string;
    name: string;
    nickname?: string;
    color: string;
    avatar?: string;
    autodartsUserId?: string;
    createdAt: string;
    updatedAt: string;
    moduleSettings: PlayerModuleSettings;
    stats: PlayerStats;
}
/**
 * Module-specific player settings
 * Each module can have custom settings per player
 */
export interface PlayerModuleSettings {
    [moduleId: string]: Record<string, unknown>;
}
/**
 * Local player statistics
 */
export interface PlayerStats {
    gamesPlayed: number;
    gamesWon: number;
    legsPlayed: number;
    legsWon: number;
    averageScore: number;
    highestScore: number;
    total180s: number;
    totalCheckouts: number;
    bestCheckout: number;
    lastPlayed?: string;
}
/**
 * Request to create a new player
 */
export interface CreatePlayerRequest {
    name: string;
    nickname?: string;
    color: string;
    avatar?: string;
    autodartsUserId?: string;
}
/**
 * Request to update a player
 */
export interface UpdatePlayerRequest {
    name?: string;
    nickname?: string;
    color?: string;
    avatar?: string;
    autodartsUserId?: string;
}
/**
 * Request to update player module settings
 */
export interface UpdatePlayerModuleSettingsRequest {
    moduleId: string;
    settings: Record<string, unknown>;
}
/**
 * Player list response
 */
export interface PlayerListResponse {
    players: LocalPlayer[];
    total: number;
}
/**
 * Player action response
 */
export interface PlayerActionResponse {
    success: boolean;
    message?: string;
    player?: LocalPlayer;
    error?: string;
}
/**
 * Default stats for new players
 */
export declare const DEFAULT_PLAYER_STATS: PlayerStats;
//# sourceMappingURL=player.d.ts.map