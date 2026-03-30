/**
 * Player Analytics - Data Store
 * Handles persistence and retrieval of player data, matches, and statistics
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  Player,
  MatchData,
  PlayerStatistics,
  TrainingTip,
  PlayerTrend,
  StorageMetadata,
  ThrowData,
  SegmentStats,
  TrendDataPoint,
  PlayerAnalyticsConfig,
} from './types.js';

const STORE_VERSION = '1.0.0';

export class PlayerStore {
  private dataDir: string;
  private players: Map<string, Player> = new Map();
  private matches: Map<string, MatchData> = new Map();
  private statistics: Map<string, PlayerStatistics> = new Map();
  private tips: Map<string, TrainingTip[]> = new Map();
  private trends: Map<string, PlayerTrend[]> = new Map();
  private config: PlayerAnalyticsConfig;

  constructor(dataDir: string, config: PlayerAnalyticsConfig) {
    this.dataDir = dataDir;
    this.config = config;
    this.ensureDataDir();
    this.load();
  }

  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(filename: string): string {
    return join(this.dataDir, filename);
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  load(): void {
    try {
      // Load players
      const playersPath = this.getFilePath('players.json');
      if (existsSync(playersPath)) {
        const data = JSON.parse(readFileSync(playersPath, 'utf-8'));
        this.players = new Map(
          data.map((p: Player) => [
            p.id,
            { ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) },
          ])
        );
      }

      // Load matches
      const matchesPath = this.getFilePath('matches.json');
      if (existsSync(matchesPath)) {
        const data = JSON.parse(readFileSync(matchesPath, 'utf-8'));
        this.matches = new Map(
          data.map((m: MatchData) => [m.id, this.deserializeMatch(m)])
        );
      }

      // Load statistics
      const statsPath = this.getFilePath('statistics.json');
      if (existsSync(statsPath)) {
        const data = JSON.parse(readFileSync(statsPath, 'utf-8'));
        this.statistics = new Map(
          data.map((s: PlayerStatistics) => [s.playerId, this.deserializeStatistics(s)])
        );
      }

      // Load tips
      const tipsPath = this.getFilePath('tips.json');
      if (existsSync(tipsPath)) {
        const data = JSON.parse(readFileSync(tipsPath, 'utf-8'));
        this.tips = new Map(
          Object.entries(data).map(([playerId, tips]) => [
            playerId,
            (tips as TrainingTip[]).map((t) => ({
              ...t,
              generatedAt: new Date(t.generatedAt),
            })),
          ])
        );
      }

      // Load trends
      const trendsPath = this.getFilePath('trends.json');
      if (existsSync(trendsPath)) {
        const data = JSON.parse(readFileSync(trendsPath, 'utf-8'));
        this.trends = new Map(
          Object.entries(data).map(([playerId, trends]) => [
            playerId,
            (trends as PlayerTrend[]).map((t) => ({
              ...t,
              dataPoints: t.dataPoints.map((dp) => ({
                ...dp,
                date: new Date(dp.date),
              })),
            })),
          ])
        );
      }

      // Apply data retention policy
      this.applyDataRetention();
    } catch (error) {
      console.error('Failed to load player analytics data:', error);
    }
  }

  save(): void {
    try {
      // Save players
      writeFileSync(
        this.getFilePath('players.json'),
        JSON.stringify(Array.from(this.players.values()), null, 2)
      );

      // Save matches
      writeFileSync(
        this.getFilePath('matches.json'),
        JSON.stringify(Array.from(this.matches.values()), null, 2)
      );

      // Save statistics
      writeFileSync(
        this.getFilePath('statistics.json'),
        JSON.stringify(Array.from(this.statistics.values()), null, 2)
      );

      // Save tips
      writeFileSync(
        this.getFilePath('tips.json'),
        JSON.stringify(Object.fromEntries(this.tips), null, 2)
      );

      // Save trends
      writeFileSync(
        this.getFilePath('trends.json'),
        JSON.stringify(Object.fromEntries(this.trends), null, 2)
      );

      // Save metadata
      const metadata: StorageMetadata = {
        version: STORE_VERSION,
        lastSaved: new Date(),
        totalPlayers: this.players.size,
        totalMatches: this.matches.size,
      };
      writeFileSync(this.getFilePath('metadata.json'), JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('Failed to save player analytics data:', error);
    }
  }

  private deserializeMatch(m: MatchData): MatchData {
    return {
      ...m,
      timestamp: new Date(m.timestamp),
      endedAt: m.endedAt ? new Date(m.endedAt) : undefined,
      games: m.games.map((g) => ({
        ...g,
        timestamp: new Date(g.timestamp),
        endedAt: g.endedAt ? new Date(g.endedAt) : undefined,
        legs: g.legs.map((l) => ({
          ...l,
          timestamp: new Date(l.timestamp),
          endedAt: l.endedAt ? new Date(l.endedAt) : undefined,
          turns: l.turns.map((t) => ({
            ...t,
            timestamp: new Date(t.timestamp),
            throws: t.throws.map((th) => ({
              ...th,
              timestamp: new Date(th.timestamp),
            })),
          })),
        })),
      })),
    };
  }

  private deserializeStatistics(s: PlayerStatistics): PlayerStatistics {
    return {
      ...s,
      periodStart: new Date(s.periodStart),
      periodEnd: new Date(s.periodEnd),
      lastUpdated: new Date(s.lastUpdated),
      segmentAccuracy: new Map(
        Object.entries(s.segmentAccuracy || {}).map(([key, val]) => [
          parseInt(key),
          val as SegmentStats,
        ])
      ),
    };
  }

  private applyDataRetention(): void {
    if (this.config.dataRetentionDays <= 0) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.dataRetentionDays);

    // Remove old matches
    for (const [id, match] of this.matches) {
      if (match.timestamp < cutoffDate) {
        this.matches.delete(id);
      }
    }

    // Remove old tips
    for (const [playerId, playerTips] of this.tips) {
      const filteredTips = playerTips.filter((t) => t.generatedAt >= cutoffDate);
      if (filteredTips.length === 0) {
        this.tips.delete(playerId);
      } else {
        this.tips.set(playerId, filteredTips);
      }
    }
  }

  // ============================================================================
  // Player Management
  // ============================================================================

  getOrCreatePlayer(name: string, autodartsId?: string): Player {
    // Try to find by Autodarts ID first
    if (autodartsId) {
      for (const player of this.players.values()) {
        if (player.autodartsId === autodartsId) {
          return player;
        }
      }
    }

    // Try to find by name
    for (const player of this.players.values()) {
      if (player.name.toLowerCase() === name.toLowerCase()) {
        // Update Autodarts ID if we have one now
        if (autodartsId && !player.autodartsId) {
          player.autodartsId = autodartsId;
          player.updatedAt = new Date();
        }
        return player;
      }
    }

    // Create new player
    const player: Player = {
      id: this.generateId(),
      name,
      autodartsId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.players.set(player.id, player);
    return player;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  // ============================================================================
  // Match Management
  // ============================================================================

  createMatch(
    autodartsMatchId: string,
    gameType: string,
    startingScore: number,
    players: Array<{ name: string; autodartsId?: string }>
  ): MatchData {
    const matchPlayers = players.map((p, index) => {
      const player = this.getOrCreatePlayer(p.name, p.autodartsId);
      return {
        playerId: player.id,
        playerName: player.name,
        autodartsId: p.autodartsId,
        position: index,
      };
    });

    const match: MatchData = {
      id: this.generateId(),
      autodartsMatchId,
      players: matchPlayers,
      games: [],
      gameType,
      startingScore,
      timestamp: new Date(),
      isAborted: false,
    };

    this.matches.set(match.id, match);
    return match;
  }

  getMatchByAutodartsId(autodartsMatchId: string): MatchData | undefined {
    for (const match of this.matches.values()) {
      if (match.autodartsMatchId === autodartsMatchId) {
        return match;
      }
    }
    return undefined;
  }

  getMatch(id: string): MatchData | undefined {
    return this.matches.get(id);
  }

  getPlayerMatches(playerId: string, limit?: number): MatchData[] {
    const playerMatches = Array.from(this.matches.values())
      .filter((m) => m.players.some((p) => p.playerId === playerId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? playerMatches.slice(0, limit) : playerMatches;
  }

  updateMatch(matchId: string, updates: Partial<MatchData>): void {
    const match = this.matches.get(matchId);
    if (match) {
      Object.assign(match, updates);
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getPlayerStatistics(playerId: string): PlayerStatistics | undefined {
    return this.statistics.get(playerId);
  }

  calculatePlayerStatistics(playerId: string): PlayerStatistics {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error(`Player not found: ${playerId}`);
    }

    const matches = this.getPlayerMatches(playerId);
    const stats = this.initializeStatistics(playerId, player.name);

    for (const match of matches) {
      this.aggregateMatchStats(stats, match, playerId);
    }

    this.calculateDerivedStats(stats);
    stats.lastUpdated = new Date();

    this.statistics.set(playerId, stats);
    return stats;
  }

  private initializeStatistics(playerId: string, playerName: string): PlayerStatistics {
    return {
      playerId,
      playerName,
      totalMatches: 0,
      totalGames: 0,
      totalLegs: 0,
      totalTurns: 0,
      totalDartsThrown: 0,
      matchesWon: 0,
      gamesWon: 0,
      legsWon: 0,
      matchWinRate: 0,
      gameWinRate: 0,
      legWinRate: 0,
      totalScore: 0,
      averagePerDart: 0,
      averagePerTurn: 0,
      highestTurnScore: 0,
      highestCheckout: 0,
      singlesHit: 0,
      doublesHit: 0,
      triplesHit: 0,
      bullsHit: 0,
      misses: 0,
      doublesAttempted: 0,
      triplesAttempted: 0,
      checkoutAttempts: 0,
      successfulCheckouts: 0,
      doublesHitRate: 0,
      triplesHitRate: 0,
      checkoutRate: 0,
      segmentAccuracy: new Map(),
      averageDartsPerLeg: 0,
      fastestLeg: Infinity,
      count180s: 0,
      count140Plus: 0,
      count100Plus: 0,
      count60Plus: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
      lastUpdated: new Date(),
    };
  }

  private aggregateMatchStats(
    stats: PlayerStatistics,
    match: MatchData,
    playerId: string
  ): void {
    stats.totalMatches++;

    if (match.winnerId === playerId) {
      stats.matchesWon++;
    }

    if (match.timestamp < stats.periodStart) {
      stats.periodStart = match.timestamp;
    }
    if (match.endedAt && match.endedAt > stats.periodEnd) {
      stats.periodEnd = match.endedAt;
    }

    for (const game of match.games) {
      stats.totalGames++;
      if (game.winnerId === playerId) {
        stats.gamesWon++;
      }

      for (const leg of game.legs) {
        stats.totalLegs++;
        if (leg.winnerId === playerId) {
          stats.legsWon++;
          if (leg.dartsThrown < stats.fastestLeg) {
            stats.fastestLeg = leg.dartsThrown;
          }
        }

        for (const turn of leg.turns) {
          const matchPlayer = match.players.find((p) => p.playerId === playerId);
          if (!matchPlayer) continue;

          // Check if this turn belongs to this player
          // We need to determine based on turn index and player position
          const playerPosition = matchPlayer.position;
          const numPlayers = match.players.length;
          if (turn.turnIndex % numPlayers !== playerPosition) continue;

          stats.totalTurns++;
          stats.totalScore += turn.totalScore;

          if (turn.totalScore > stats.highestTurnScore) {
            stats.highestTurnScore = turn.totalScore;
          }

          if (turn.totalScore === 180) stats.count180s++;
          else if (turn.totalScore >= 140) stats.count140Plus++;
          else if (turn.totalScore >= 100) stats.count100Plus++;
          else if (turn.totalScore >= 60) stats.count60Plus++;

          for (const throwData of turn.throws) {
            stats.totalDartsThrown++;
            this.aggregateThrowStats(stats, throwData);
          }

          if (turn.isCheckout && !turn.isBust) {
            const checkoutScore = turn.startingScore;
            if (checkoutScore > stats.highestCheckout) {
              stats.highestCheckout = checkoutScore;
            }
          }
        }
      }
    }
  }

  private aggregateThrowStats(stats: PlayerStatistics, throwData: ThrowData): void {
    const segment = throwData.segment;

    // Update segment accuracy
    if (!stats.segmentAccuracy.has(segment.number)) {
      stats.segmentAccuracy.set(segment.number, {
        segment: segment.number,
        attempts: 0,
        singleHits: 0,
        doubleHits: 0,
        tripleHits: 0,
        totalScore: 0,
        accuracy: 0,
      });
    }

    const segStats = stats.segmentAccuracy.get(segment.number)!;
    segStats.attempts++;
    segStats.totalScore += throwData.score;

    switch (segment.bed) {
      case 'miss':
        stats.misses++;
        break;
      case 'single':
        stats.singlesHit++;
        segStats.singleHits++;
        break;
      case 'double':
        stats.doublesHit++;
        stats.doublesAttempted++;
        segStats.doubleHits++;
        break;
      case 'triple':
        stats.triplesHit++;
        stats.triplesAttempted++;
        segStats.tripleHits++;
        break;
      case 'outer-bull':
      case 'inner-bull':
        stats.bullsHit++;
        break;
    }

    if (throwData.isCheckoutAttempt) {
      stats.checkoutAttempts++;
      if (throwData.isSuccessfulCheckout) {
        stats.successfulCheckouts++;
      }
    }
  }

  private calculateDerivedStats(stats: PlayerStatistics): void {
    // Win rates
    stats.matchWinRate =
      stats.totalMatches > 0 ? (stats.matchesWon / stats.totalMatches) * 100 : 0;
    stats.gameWinRate =
      stats.totalGames > 0 ? (stats.gamesWon / stats.totalGames) * 100 : 0;
    stats.legWinRate =
      stats.totalLegs > 0 ? (stats.legsWon / stats.totalLegs) * 100 : 0;

    // Averages
    stats.averagePerDart =
      stats.totalDartsThrown > 0 ? stats.totalScore / stats.totalDartsThrown : 0;
    stats.averagePerTurn =
      stats.totalTurns > 0 ? stats.totalScore / stats.totalTurns : 0;

    // Hit rates
    stats.doublesHitRate =
      stats.doublesAttempted > 0
        ? (stats.doublesHit / stats.doublesAttempted) * 100
        : 0;
    stats.triplesHitRate =
      stats.triplesAttempted > 0
        ? (stats.triplesHit / stats.triplesAttempted) * 100
        : 0;
    stats.checkoutRate =
      stats.checkoutAttempts > 0
        ? (stats.successfulCheckouts / stats.checkoutAttempts) * 100
        : 0;

    // Average darts per leg
    stats.averageDartsPerLeg =
      stats.legsWon > 0
        ? stats.totalDartsThrown / stats.legsWon
        : stats.totalDartsThrown / Math.max(stats.totalLegs, 1);

    // Segment accuracy
    for (const [, segStats] of stats.segmentAccuracy) {
      const hits = segStats.singleHits + segStats.doubleHits + segStats.tripleHits;
      segStats.accuracy = segStats.attempts > 0 ? (hits / segStats.attempts) * 100 : 0;
    }

    // Handle infinite fastest leg
    if (stats.fastestLeg === Infinity) {
      stats.fastestLeg = 0;
    }
  }

  // ============================================================================
  // Trends
  // ============================================================================

  calculatePlayerTrends(
    playerId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): PlayerTrend {
    const matches = this.getPlayerMatches(playerId);
    const dataPoints: TrendDataPoint[] = [];

    // Group matches by period
    const grouped = this.groupMatchesByPeriod(matches, playerId, period);

    for (const [dateKey, periodMatches] of grouped) {
      const totalTurns = this.countPlayerTurns(periodMatches, playerId);
      const totalScore = this.sumPlayerScore(periodMatches, playerId);
      const checkouts = this.countCheckouts(periodMatches, playerId);
      const checkoutAttempts = this.countCheckoutAttempts(periodMatches, playerId);

      dataPoints.push({
        date: new Date(dateKey),
        averagePerTurn: totalTurns > 0 ? totalScore / totalTurns : 0,
        checkoutRate:
          checkoutAttempts > 0 ? (checkouts / checkoutAttempts) * 100 : 0,
        matchesPlayed: periodMatches.length,
        matchesWon: periodMatches.filter((m) => m.winnerId === playerId).length,
      });
    }

    const trend: PlayerTrend = {
      playerId,
      period,
      dataPoints: dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime()),
    };

    // Store trend
    const playerTrends = this.trends.get(playerId) || [];
    const existingIndex = playerTrends.findIndex((t) => t.period === period);
    if (existingIndex >= 0) {
      playerTrends[existingIndex] = trend;
    } else {
      playerTrends.push(trend);
    }
    this.trends.set(playerId, playerTrends);

    return trend;
  }

  private groupMatchesByPeriod(
    matches: MatchData[],
    _playerId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Map<string, MatchData[]> {
    const grouped = new Map<string, MatchData[]>();

    for (const match of matches) {
      const date = match.timestamp;
      let key: string;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      const existing = grouped.get(key) || [];
      existing.push(match);
      grouped.set(key, existing);
    }

    return grouped;
  }

  private countPlayerTurns(matches: MatchData[], playerId: string): number {
    let count = 0;
    for (const match of matches) {
      const playerPosition = match.players.find((p) => p.playerId === playerId)?.position;
      if (playerPosition === undefined) continue;

      for (const game of match.games) {
        for (const leg of game.legs) {
          for (const turn of leg.turns) {
            if (turn.turnIndex % match.players.length === playerPosition) {
              count++;
            }
          }
        }
      }
    }
    return count;
  }

  private sumPlayerScore(matches: MatchData[], playerId: string): number {
    let total = 0;
    for (const match of matches) {
      const playerPosition = match.players.find((p) => p.playerId === playerId)?.position;
      if (playerPosition === undefined) continue;

      for (const game of match.games) {
        for (const leg of game.legs) {
          for (const turn of leg.turns) {
            if (turn.turnIndex % match.players.length === playerPosition) {
              total += turn.totalScore;
            }
          }
        }
      }
    }
    return total;
  }

  private countCheckouts(matches: MatchData[], playerId: string): number {
    let count = 0;
    for (const match of matches) {
      const playerPosition = match.players.find((p) => p.playerId === playerId)?.position;
      if (playerPosition === undefined) continue;

      for (const game of match.games) {
        for (const leg of game.legs) {
          for (const turn of leg.turns) {
            if (
              turn.turnIndex % match.players.length === playerPosition &&
              turn.isCheckout &&
              !turn.isBust
            ) {
              count++;
            }
          }
        }
      }
    }
    return count;
  }

  private countCheckoutAttempts(matches: MatchData[], playerId: string): number {
    let count = 0;
    for (const match of matches) {
      const playerPosition = match.players.find((p) => p.playerId === playerId)?.position;
      if (playerPosition === undefined) continue;

      for (const game of match.games) {
        for (const leg of game.legs) {
          for (const turn of leg.turns) {
            if (turn.turnIndex % match.players.length === playerPosition) {
              for (const throwData of turn.throws) {
                if (throwData.isCheckoutAttempt) {
                  count++;
                }
              }
            }
          }
        }
      }
    }
    return count;
  }

  // ============================================================================
  // Training Tips
  // ============================================================================

  getPlayerTips(playerId: string): TrainingTip[] {
    return this.tips.get(playerId) || [];
  }

  addPlayerTips(playerId: string, newTips: TrainingTip[]): void {
    const existing = this.tips.get(playerId) || [];
    this.tips.set(playerId, [...existing, ...newTips]);
  }

  acknowledgeTip(playerId: string, tipId: string): void {
    const tips = this.tips.get(playerId);
    if (tips) {
      const tip = tips.find((t) => t.id === tipId);
      if (tip) {
        tip.acknowledged = true;
      }
    }
  }

  // ============================================================================
  // Utility
  // ============================================================================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  updateConfig(config: PlayerAnalyticsConfig): void {
    this.config = config;
  }
}
