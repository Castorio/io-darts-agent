import type {
  MatchStateData,
  MatchSettings,
  MatchStats,
  ParsedEvent,
} from '../../types/index.js';

/**
 * Represents the current match status
 */
export interface MatchStatus {
  /** Whether a match is currently active */
  active: boolean;
  /** The match ID */
  matchId: string | null;
  /** Match variant (e.g., "X01") */
  variant: string | null;
  /** Match type (e.g., "Local", "Online") */
  type: string | null;
  /** Current leg number */
  leg: number;
  /** Current set number */
  set: number;
  /** Current round number */
  round: number;
  /** Index of the current player */
  currentPlayerIndex: number;
  /** Name of the current player */
  currentPlayerName: string;
  /** All players in the match */
  players: MatchPlayerStatus[];
  /** Overall match scores (legs/sets won) */
  scores: number[];
  /** Current game scores (remaining points) */
  gameScores: number[];
  /** Current turn score */
  turnScore: number;
  /** Whether the current turn is busted */
  turnBusted: boolean;
  /** Whether the match is finished */
  finished: boolean;
  /** Whether the current game (leg) is finished */
  gameFinished: boolean;
  /** Index of the match winner (null if not finished) */
  winner: number | null;
  /** Index of the game winner (null if game not finished) */
  gameWinner: number | null;
  /** Match settings */
  settings: MatchSettings | null;
  /** Match statistics */
  stats: {
    legStats: MatchStats[];
    matchStats: MatchStats[];
    setStats?: MatchStats[];
  } | null;
  /** When the status was last updated */
  lastUpdated: Date | null;
}

/**
 * Player status within a match
 */
export interface MatchPlayerStatus {
  id: string;
  index: number;
  name: string;
  /** Current remaining score */
  score: number;
  /** Current leg average */
  average: number;
  /** Color assigned to this player (from PlayerService) */
  color?: string;
}

/**
 * Listener callback for match status changes
 */
export type MatchStatusListener = (status: MatchStatus) => void;

/**
 * Central service for tracking match status
 *
 * This service maintains the current match state and provides:
 * - Current match status queries
 * - Status change notifications
 * - Helper methods for common queries (isMatchActive, getCurrentPlayer, etc.)
 */
export class MatchStatusService {
  private currentMatchState: MatchStateData | null = null;
  private lastUpdated: Date | null = null;
  private listeners: Set<MatchStatusListener> = new Set();
  private playerColorResolver: ((playerName: string) => string | undefined) | null = null;

  /**
   * Set a function to resolve player colors
   */
  setPlayerColorResolver(resolver: (playerName: string) => string | undefined): void {
    this.playerColorResolver = resolver;
  }

  /**
   * Register a listener for status changes
   */
  addListener(listener: MatchStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: MatchStatusListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Handle incoming events to update match status
   */
  handleEvent(event: ParsedEvent): void {
    switch (event.type) {
      case 'match.start':
        // Reset state for new match
        this.currentMatchState = null;
        this.lastUpdated = event.timestamp;
        this.notifyListeners();
        break;

      case 'match.state':
        // Update full match state
        if (event.raw?.data) {
          this.currentMatchState = event.raw.data as MatchStateData;
          this.lastUpdated = event.timestamp;
          this.notifyListeners();
        }
        break;

      case 'match.finished':
      case 'match.result':
        // Match ended - keep state for results display
        this.lastUpdated = event.timestamp;
        this.notifyListeners();
        break;

      case 'match.finish':
      case 'match.delete':
        // Match dismissed or deleted - clear state
        this.currentMatchState = null;
        this.lastUpdated = event.timestamp;
        this.notifyListeners();
        break;
    }
  }

  /**
   * Get the current match status
   */
  getStatus(): MatchStatus {
    const match = this.currentMatchState;

    if (!match) {
      return this.getEmptyStatus();
    }

    const players = this.buildPlayerStatuses(match);

    return {
      active: !match.finished,
      matchId: match.id,
      variant: match.variant,
      type: match.type,
      leg: match.leg,
      set: match.set,
      round: match.round,
      currentPlayerIndex: match.player,
      currentPlayerName: match.players[match.player]?.name ?? 'Unknown',
      players,
      scores: match.scores,
      gameScores: match.gameScores,
      turnScore: match.turnScore,
      turnBusted: match.turnBusted,
      finished: match.finished,
      gameFinished: match.gameFinished,
      winner: match.winner,
      gameWinner: match.gameWinner,
      settings: match.settings,
      stats: match.stats,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Check if a match is currently active
   */
  isMatchActive(): boolean {
    return this.currentMatchState !== null && !this.currentMatchState.finished;
  }

  /**
   * Check if a match exists (active or finished but not dismissed)
   */
  hasMatch(): boolean {
    return this.currentMatchState !== null;
  }

  /**
   * Get the current match ID
   */
  getMatchId(): string | null {
    return this.currentMatchState?.id ?? null;
  }

  /**
   * Get the current player index
   */
  getCurrentPlayerIndex(): number {
    return this.currentMatchState?.player ?? 0;
  }

  /**
   * Get the current player name
   */
  getCurrentPlayerName(): string {
    const match = this.currentMatchState;
    if (!match) return 'Unknown';
    return match.players[match.player]?.name ?? 'Unknown';
  }

  /**
   * Get a player by index
   */
  getPlayer(index: number): MatchPlayerStatus | null {
    const match = this.currentMatchState;
    if (!match || index < 0 || index >= match.players.length) {
      return null;
    }

    const player = match.players[index];
    const color = this.playerColorResolver?.(player.name);

    return {
      id: player.id,
      index: player.index,
      name: player.name,
      score: match.gameScores[index] ?? 0,
      average: match.stats?.legStats[index]?.average ?? 0,
      color,
    };
  }

  /**
   * Get the current player
   */
  getCurrentPlayer(): MatchPlayerStatus | null {
    return this.getPlayer(this.getCurrentPlayerIndex());
  }

  /**
   * Get all players
   */
  getPlayers(): MatchPlayerStatus[] {
    const match = this.currentMatchState;
    if (!match) return [];
    return this.buildPlayerStatuses(match);
  }

  /**
   * Get the number of players
   */
  getPlayerCount(): number {
    return this.currentMatchState?.players.length ?? 0;
  }

  /**
   * Check if this is a single-player match
   */
  isSinglePlayer(): boolean {
    return this.getPlayerCount() === 1;
  }

  /**
   * Get the remaining score for a player
   */
  getPlayerScore(index: number): number {
    return this.currentMatchState?.gameScores[index] ?? 0;
  }

  /**
   * Get the current player's remaining score
   */
  getCurrentPlayerScore(): number {
    return this.getPlayerScore(this.getCurrentPlayerIndex());
  }

  /**
   * Get the raw match state data
   */
  getRawMatchState(): MatchStateData | null {
    return this.currentMatchState;
  }

  /**
   * Get the last update timestamp
   */
  getLastUpdated(): Date | null {
    return this.lastUpdated;
  }

  /**
   * Manually set the match state (for testing or initialization)
   */
  setMatchState(state: MatchStateData | null): void {
    this.currentMatchState = state;
    this.lastUpdated = state ? new Date() : null;
    this.notifyListeners();
  }

  /**
   * Clear the match state
   */
  clear(): void {
    this.currentMatchState = null;
    this.lastUpdated = null;
    this.notifyListeners();
  }

  /**
   * Build player statuses from match data
   */
  private buildPlayerStatuses(match: MatchStateData): MatchPlayerStatus[] {
    return match.players.map((player, index) => {
      const color = this.playerColorResolver?.(player.name);
      // Safely access legStats - it might be undefined, empty, or have fewer entries than players
      const legStats = match.stats?.legStats;
      const playerLegStats = legStats && Array.isArray(legStats) && legStats.length > index
        ? legStats[index]
        : null;
      return {
        id: player.id,
        index: player.index,
        name: player.name,
        score: match.gameScores?.[index] ?? 0,
        average: playerLegStats?.average ?? 0,
        color,
      };
    });
  }

  /**
   * Get an empty status object
   */
  private getEmptyStatus(): MatchStatus {
    return {
      active: false,
      matchId: null,
      variant: null,
      type: null,
      leg: 0,
      set: 0,
      round: 0,
      currentPlayerIndex: 0,
      currentPlayerName: '',
      players: [],
      scores: [],
      gameScores: [],
      turnScore: 0,
      turnBusted: false,
      finished: false,
      gameFinished: false,
      winner: null,
      gameWinner: null,
      settings: null,
      stats: null,
      lastUpdated: null,
    };
  }

  /**
   * Notify all listeners of a status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in MatchStatusService listener:', error);
      }
    }
  }
}

// Singleton instance
let instance: MatchStatusService | null = null;

/**
 * Get the singleton MatchStatusService instance
 */
export function getMatchStatusService(): MatchStatusService {
  if (!instance) {
    instance = new MatchStatusService();
  }
  return instance;
}

/**
 * Create a new MatchStatusService instance (for testing)
 */
export function createMatchStatusService(): MatchStatusService {
  return new MatchStatusService();
}
