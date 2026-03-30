/**
 * Player Analytics Module - Main Handler
 *
 * Processes Autodarts events and manages player statistics
 */

import type { ParsedEvent } from '@autodarts-hub/module-sdk';
import { PlayerStore } from './PlayerStore.js';
import { EventMapper, MappedAction } from './EventMapper.js';
import { AITipsGenerator } from './AITipsGenerator.js';
import {
  PlayerAnalyticsConfig,
  MatchData,
  TurnData,
  GameData,
  LegData,
  PlayerStatistics,
  TrainingTip,
  TipCategory,
  Player,
} from './types.js';

/**
 * Logger interface
 */
export interface AnalyticsLoggerInterface {
  log(source: string, message: string, data?: unknown): void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PlayerAnalyticsConfig = {
  dataRetentionDays: 90,
  aiProvider: 'none',
  trackAllPlayers: true,
  generateTipsAfterMatch: true,
  minMatchesForTips: 5,
};

/**
 * Player Analytics Handler
 */
export class PlayerAnalyticsHandler {
  private config: PlayerAnalyticsConfig;
  private store: PlayerStore;
  private eventMapper: EventMapper;
  private tipsGenerator: AITipsGenerator;
  private logger: AnalyticsLoggerInterface | null = null;

  // Current active match tracking
  private activeMatchId: string | null = null;
  private currentGame: GameData | null = null;
  private currentLeg: LegData | null = null;

  // Statistics
  private stats = {
    eventsProcessed: 0,
    matchesTracked: 0,
    tipsGenerated: 0,
    errors: 0,
  };

  constructor(config: Partial<PlayerAnalyticsConfig>, dataDir: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = new PlayerStore(dataDir, this.config);
    this.eventMapper = new EventMapper(this.config);
    this.tipsGenerator = new AITipsGenerator(this.config);
  }

  /**
   * Set logger for event logging
   */
  setLogger(logger: AnalyticsLoggerInterface | null): void {
    this.logger = logger;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PlayerAnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
    this.store.updateConfig(this.config);
    this.eventMapper.updateConfig(this.config);
    this.tipsGenerator.updateConfig(this.config);
    this.log('Config updated', { config: this.config });
  }

  /**
   * Log a message
   */
  private log(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.log('player-analytics', message, data);
    } else {
      console.log(`[player-analytics] ${message}`, data || '');
    }
  }

  /**
   * Handle incoming event
   */
  async handleEvent(event: ParsedEvent): Promise<void> {
    this.stats.eventsProcessed++;

    try {
      const action = this.eventMapper.mapEvent(event);
      if (!action) {
        return;
      }

      await this.processAction(action);
    } catch (error) {
      this.stats.errors++;
      this.log('Error processing event', { error, event: event.type });
    }
  }

  /**
   * Process mapped action
   */
  private async processAction(action: MappedAction): Promise<void> {
    switch (action.type) {
      case 'match.start':
        await this.handleMatchStart(action);
        break;

      case 'throw.record':
        await this.handleThrowRecord(action);
        break;

      case 'turn.end':
        await this.handleTurnEnd(action);
        break;

      case 'game.end':
        await this.handleGameEnd(action);
        break;

      case 'match.end':
        await this.handleMatchEnd(action);
        break;

      case 'match.abort':
        await this.handleMatchAbort(action);
        break;
    }
  }

  /**
   * Handle match start
   */
  private async handleMatchStart(action: MappedAction): Promise<void> {
    const data = action.data as {
      autodartsMatchId: string;
      gameType: string;
      startingScore: number;
      players: Array<{ name: string; autodartsId?: string }>;
    };

    if (!this.config.trackAllPlayers && data.players.length === 0) {
      return;
    }

    const match = this.store.createMatch(
      data.autodartsMatchId,
      data.gameType,
      data.startingScore,
      data.players
    );

    this.activeMatchId = match.id;
    this.stats.matchesTracked++;

    // Update event mapper with internal match ID
    const matchState = this.eventMapper.getCurrentMatch();
    if (matchState) {
      matchState.matchId = match.id;
      // Map player IDs
      matchState.players = matchState.players.map((p, i) => ({
        ...p,
        id: match.players[i].playerId,
      }));
    }

    // Initialize first game and leg
    this.currentGame = {
      id: `${Date.now()}-game-0`,
      matchId: match.id,
      gameIndex: 0,
      gameType: data.gameType,
      legs: [],
      timestamp: new Date(),
    };

    this.currentLeg = {
      id: `${Date.now()}-leg-0`,
      matchId: match.id,
      gameIndex: 0,
      legIndex: 0,
      turns: [],
      startingScore: data.startingScore,
      dartsThrown: 0,
      timestamp: new Date(),
    };

    this.log('Match started', {
      matchId: match.id,
      players: match.players.map((p) => p.playerName),
    });
  }

  /**
   * Handle throw record
   */
  private async handleThrowRecord(_action: MappedAction): Promise<void> {
    // Throws are accumulated in turns, processed at turn end
    // We could track individual throws here for real-time stats
  }

  /**
   * Handle turn end
   */
  private async handleTurnEnd(action: MappedAction): Promise<void> {
    const data = action.data as {
      turnData: TurnData;
      playerIndex: number;
      playerName: string;
    };

    if (!this.activeMatchId || !this.currentLeg) {
      return;
    }

    const match = this.store.getMatch(this.activeMatchId);
    if (!match) {
      return;
    }

    // Resolve player ID
    const matchPlayer = match.players[data.playerIndex];
    if (matchPlayer) {
      data.turnData.playerId = matchPlayer.playerId;
      data.turnData.matchId = this.activeMatchId;

      // Update throws with player ID
      for (const throwData of data.turnData.throws) {
        throwData.playerId = matchPlayer.playerId;
        throwData.matchId = this.activeMatchId;
      }
    }

    // Add turn to current leg
    this.currentLeg.turns.push(data.turnData);
    this.currentLeg.dartsThrown += data.turnData.throws.length;

    // Check for leg end (checkout)
    if (data.turnData.isCheckout) {
      await this.handleLegEnd(matchPlayer?.playerId);
    }

    this.log('Turn recorded', {
      player: data.playerName,
      score: data.turnData.totalScore,
      remaining: data.turnData.endingScore,
    });
  }

  /**
   * Handle leg end
   */
  private async handleLegEnd(winnerId?: string): Promise<void> {
    if (!this.currentLeg || !this.currentGame || !this.activeMatchId) {
      return;
    }

    this.currentLeg.winnerId = winnerId;
    this.currentLeg.endedAt = new Date();
    this.currentGame.legs.push(this.currentLeg);

    this.log('Leg ended', {
      winner: winnerId,
      darts: this.currentLeg.dartsThrown,
    });

    // Start new leg
    const match = this.store.getMatch(this.activeMatchId);
    this.currentLeg = {
      id: `${Date.now()}-leg-${this.currentGame.legs.length}`,
      matchId: this.activeMatchId,
      gameIndex: this.currentGame.gameIndex,
      legIndex: this.currentGame.legs.length,
      turns: [],
      startingScore: match?.startingScore || 501,
      dartsThrown: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Handle game end
   */
  private async handleGameEnd(action: MappedAction): Promise<void> {
    const data = action.data as {
      gameIndex: number;
      winnerIndex: number;
      winnerName?: string;
    };

    if (!this.currentGame || !this.activeMatchId) {
      return;
    }

    const match = this.store.getMatch(this.activeMatchId);
    if (!match) {
      return;
    }

    // Set winner
    const winner = match.players[data.winnerIndex];
    this.currentGame.winnerId = winner?.playerId;
    this.currentGame.endedAt = new Date();

    // Add game to match
    match.games.push(this.currentGame);

    this.log('Game ended', {
      gameIndex: data.gameIndex,
      winner: data.winnerName || winner?.playerName,
    });

    // Start new game
    this.currentGame = {
      id: `${Date.now()}-game-${match.games.length}`,
      matchId: this.activeMatchId,
      gameIndex: match.games.length,
      gameType: match.gameType,
      legs: [],
      timestamp: new Date(),
    };

    this.currentLeg = {
      id: `${Date.now()}-leg-0`,
      matchId: this.activeMatchId,
      gameIndex: this.currentGame.gameIndex,
      legIndex: 0,
      turns: [],
      startingScore: match.startingScore,
      dartsThrown: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Handle match end
   */
  private async handleMatchEnd(action: MappedAction): Promise<void> {
    const data = action.data as {
      winnerIndex?: number;
      winnerName?: string;
      isAborted: boolean;
    };

    if (!this.activeMatchId) {
      return;
    }

    const match = this.store.getMatch(this.activeMatchId);
    if (!match) {
      return;
    }

    // Finalize current game/leg if in progress
    if (this.currentLeg && this.currentLeg.turns.length > 0) {
      this.currentLeg.endedAt = new Date();
      if (this.currentGame) {
        this.currentGame.legs.push(this.currentLeg);
      }
    }

    if (this.currentGame && this.currentGame.legs.length > 0) {
      this.currentGame.endedAt = new Date();
      match.games.push(this.currentGame);
    }

    // Set match winner
    if (data.winnerIndex !== undefined) {
      const winner = match.players[data.winnerIndex];
      match.winnerId = winner?.playerId;
    }

    match.endedAt = new Date();
    match.isAborted = data.isAborted;

    // Save data
    this.store.save();

    this.log('Match ended', {
      matchId: this.activeMatchId,
      winner: data.winnerName,
      isAborted: data.isAborted,
    });

    // Recalculate statistics for all players
    for (const player of match.players) {
      this.store.calculatePlayerStatistics(player.playerId);
    }

    // Generate tips if enabled
    if (this.config.generateTipsAfterMatch && !data.isAborted) {
      await this.generatePostMatchTips(match);
    }

    // Reset state
    this.activeMatchId = null;
    this.currentGame = null;
    this.currentLeg = null;
  }

  /**
   * Handle match abort
   */
  private async handleMatchAbort(_action: MappedAction): Promise<void> {
    if (!this.activeMatchId) {
      return;
    }

    const match = this.store.getMatch(this.activeMatchId);
    if (match) {
      match.isAborted = true;
      match.endedAt = new Date();
      this.store.save();
    }

    this.log('Match aborted', { matchId: this.activeMatchId });

    this.activeMatchId = null;
    this.currentGame = null;
    this.currentLeg = null;
  }

  /**
   * Generate training tips after match
   */
  private async generatePostMatchTips(match: MatchData): Promise<void> {
    for (const player of match.players) {
      const playerMatches = this.store.getPlayerMatches(player.playerId);

      if (playerMatches.length < this.config.minMatchesForTips) {
        this.log('Not enough matches for tips', {
          player: player.playerName,
          matches: playerMatches.length,
          required: this.config.minMatchesForTips,
        });
        continue;
      }

      try {
        const stats = this.store.getPlayerStatistics(player.playerId);
        if (!stats) {
          continue;
        }

        const tips = await this.tipsGenerator.generateTips(stats);
        if (tips.length > 0) {
          this.store.addPlayerTips(player.playerId, tips);
          this.stats.tipsGenerated += tips.length;
          this.log('Tips generated', {
            player: player.playerName,
            count: tips.length,
          });
        }
      } catch (error) {
        this.log('Failed to generate tips', { error, player: player.playerName });
      }
    }

    this.store.save();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get all tracked players
   */
  getAllPlayers(): Player[] {
    return this.store.getAllPlayers();
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId: string): Player | undefined {
    return this.store.getPlayer(playerId);
  }

  /**
   * Get player statistics
   */
  getPlayerStatistics(playerId: string): PlayerStatistics | undefined {
    return this.store.getPlayerStatistics(playerId);
  }

  /**
   * Calculate fresh statistics for a player
   */
  calculatePlayerStatistics(playerId: string): PlayerStatistics {
    return this.store.calculatePlayerStatistics(playerId);
  }

  /**
   * Get player matches
   */
  getPlayerMatches(playerId: string, limit?: number): MatchData[] {
    return this.store.getPlayerMatches(playerId, limit);
  }

  /**
   * Get player training tips
   */
  getPlayerTips(playerId: string): TrainingTip[] {
    return this.store.getPlayerTips(playerId);
  }

  /**
   * Generate training tips for a player
   */
  async generatePlayerTips(
    playerId: string,
    focusArea?: TipCategory
  ): Promise<TrainingTip[]> {
    const stats = this.store.calculatePlayerStatistics(playerId);
    const trends = [
      this.store.calculatePlayerTrends(playerId, 'weekly'),
      this.store.calculatePlayerTrends(playerId, 'monthly'),
    ];

    const tips = await this.tipsGenerator.generateTips(stats, trends, focusArea);

    if (tips.length > 0) {
      this.store.addPlayerTips(playerId, tips);
      this.stats.tipsGenerated += tips.length;
      this.store.save();
    }

    return tips;
  }

  /**
   * Acknowledge a tip
   */
  acknowledgeTip(playerId: string, tipId: string): void {
    this.store.acknowledgeTip(playerId, tipId);
    this.store.save();
  }

  /**
   * Get player trends
   */
  getPlayerTrends(
    playerId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): import('./types.js').PlayerTrend {
    return this.store.calculatePlayerTrends(playerId, period);
  }

  /**
   * Get handler statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Check if AI tips are enabled
   */
  isAIEnabled(): boolean {
    return this.tipsGenerator.isEnabled();
  }

  /**
   * Save data to disk
   */
  save(): void {
    this.store.save();
  }

  /**
   * Reload data from disk
   */
  reload(): void {
    this.store.load();
  }
}

/**
 * Factory function to create handler
 */
export function createPlayerAnalyticsHandler(
  config: Record<string, unknown>,
  dataDir: string
): PlayerAnalyticsHandler {
  return new PlayerAnalyticsHandler(config as Partial<PlayerAnalyticsConfig>, dataDir);
}
