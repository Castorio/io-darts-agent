import type {
  AutodartsMessage,
  ParsedEvent,
  BoardStateData,
  BoardEventData,
  MatchStartData,
  MatchDeleteData,
  MatchFinishData,
  MatchStateData,
  MatchResultData,
  ThrowSegment,
  ThrowCoords,
} from '../../types/index.js';

export class EventParser {
  private boardId: string;
  private currentMatchId: string | null = null;
  private lastPlayerIndex: number | null = null;
  private currentMatchState: MatchStateData | null = null;
  private lastMatchUpdate: Date | null = null;
  private lastRound: number | null = null;
  private lastTurnScore: number | null = null;
  private lastTurnBusted: boolean = false;
  private lastGameScores: number[] = [];
  private lastDartsInTurn: number = 0;

  constructor(boardId: string) {
    this.boardId = boardId;
  }

  /**
   * Get the current match ID (if any)
   */
  getMatchId(): string | null {
    return this.currentMatchId;
  }

  /**
   * Set the current match ID manually
   */
  setMatchId(matchId: string | null): void {
    this.currentMatchId = matchId;
    if (!matchId) {
      this.lastPlayerIndex = null;
      this.currentMatchState = null;
      this.lastMatchUpdate = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
    }
  }

  /**
   * Get the current match state (if any)
   */
  getCurrentMatchState(): MatchStateData | null {
    return this.currentMatchState;
  }

  /**
   * Get the timestamp of the last match update
   */
  getLastMatchUpdate(): Date | null {
    return this.lastMatchUpdate;
  }

  /**
   * Parse a raw WebSocket message into a typed event
   */
  parse(raw: AutodartsMessage): ParsedEvent | ParsedEvent[] | null {
    const { channel, topic, data } = raw;
    const timestamp = new Date();

    // Board State events
    if (channel === 'autodarts.boards' && topic === `${this.boardId}.state`) {
      return this.parseBoardState(raw, data as BoardStateData, timestamp);
    }

    // Board Matches events (match start/delete)
    if (channel === 'autodarts.boards' && topic === `${this.boardId}.matches`) {
      return this.parseMatchEvent(raw, data as MatchStartData | MatchDeleteData, timestamp);
    }

    // Board Events (throws, takeouts, etc.)
    if (channel === 'autodarts.boards' && topic === `${this.boardId}.events`) {
      return this.parseBoardEvent(raw, data as BoardEventData, timestamp);
    }

    // Match State
    if (channel === 'autodarts.matches' && this.currentMatchId && topic === `${this.currentMatchId}.state`) {
      return this.parseMatchState(raw, data as MatchStateData, timestamp);
    }

    // Unknown event - return as raw
    return {
      type: 'raw',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse board state events
   */
  private parseBoardState(
    raw: AutodartsMessage,
    data: BoardStateData,
    timestamp: Date
  ): ParsedEvent<BoardStateData> {
    return {
      type: 'board.state',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse match start/delete/finish events
   */
  private parseMatchEvent(
    raw: AutodartsMessage,
    data: MatchStartData | MatchDeleteData | MatchFinishData,
    timestamp: Date
  ): ParsedEvent {
    if (data.event === 'start') {
      this.currentMatchId = data.id;
      this.lastPlayerIndex = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;

      return {
        type: 'match.start',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          boardId: this.boardId,
        },
      };
    }

    if (data.event === 'delete') {
      this.currentMatchId = null;
      this.lastPlayerIndex = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;

      return {
        type: 'match.delete',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          boardId: this.boardId,
        },
      };
    }

    // User clicked "Finish" after match ended (dismisses results screen)
    if (data.event === 'finish') {
      this.currentMatchId = null;
      this.lastPlayerIndex = null;
      this.currentMatchState = null;
      this.lastMatchUpdate = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;

      return {
        type: 'match.finish',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          boardId: this.boardId,
        },
      };
    }

    return {
      type: 'raw',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse board events (throws, takeouts, etc.)
   */
  private parseBoardEvent(
    raw: AutodartsMessage,
    data: BoardEventData,
    timestamp: Date
  ): ParsedEvent {
    const event = data.event;

    if (event === 'Throw detected') {
      return {
        type: 'throw.detected',
        timestamp,
        raw,
        data: {
          segment: data.throw.segment,
          coords: data.throw.coords,
          throwNumber: data.throwNumber ?? 0,
          boardId: data.boardId,
        },
      };
    }

    if (event === 'Takeout started') {
      return {
        type: 'takeout.started',
        timestamp,
        raw,
        data: {
          boardId: data.boardId,
        },
      };
    }

    if (event === 'Takeout finished') {
      return {
        type: 'takeout.finished',
        timestamp,
        raw,
        data: {
          boardId: data.boardId,
        },
      };
    }

    // Other board events
    return {
      type: 'board.event',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse match state events
   */
  private parseMatchState(
    raw: AutodartsMessage,
    data: MatchStateData,
    timestamp: Date
  ): ParsedEvent | ParsedEvent[] {
    const events: ParsedEvent[] = [];

    // Store the current match state
    this.currentMatchState = data;
    this.lastMatchUpdate = timestamp;

    // Check for turn finished
    // Option 1: Round increased (takeout finished - new round started)
    // Option 2: 3 darts thrown in current turn (third dart detected)
    const currentTurn = data.turns?.[data.turns.length - 1];
    const dartsInCurrentTurn = currentTurn?.throws?.length ?? 0;
    const isThirdDart = dartsInCurrentTurn === 3 && this.lastDartsInTurn !== 3;
    const isRoundChanged = this.lastRound !== null && data.round > this.lastRound;

    console.log(`🔍 EventParser: round=${data.round}, lastRound=${this.lastRound}, darts=${dartsInCurrentTurn}, lastDarts=${this.lastDartsInTurn}, turnScore=${data.turnScore}`);

    // Check for bust (turnBusted changed from false to true)
    const justBusted = data.turnBusted && !this.lastTurnBusted;
    if (justBusted) {
      const playerIndex = data.player;
      console.log(`💥 EventParser: BUST detected for player ${data.players[playerIndex]?.name}`);
      events.push({
        type: 'turn.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          playerIndex: playerIndex,
          playerName: data.players[playerIndex]?.name ?? 'Unknown',
          turnScore: 0, // Bust means 0 points
          turnPoints: 0,
          remaining: this.lastGameScores[playerIndex] ?? data.gameScores[playerIndex] ?? 0, // Score before bust
          busted: true,
          round: data.round,
        },
      });
    }

    // Emit turn.finished when third dart is thrown (score announcement)
    // Skip if we just busted (already handled above)
    if (isThirdDart && !data.turnBusted && !justBusted) {
      const playerIndex = data.player;
      const remainingScore = data.gameScores[playerIndex] ?? 0;
      console.log(`✅ EventParser: Third dart - Emitting turn.finished - turnScore=${data.turnScore}, remaining=${remainingScore}`);
      events.push({
        type: 'turn.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          playerIndex: playerIndex,
          playerName: data.players[playerIndex]?.name ?? 'Unknown',
          turnScore: data.turnScore,
          turnPoints: data.turnScore,
          remaining: remainingScore,
          busted: false,
          round: data.round,
        },
      });
    }

    // Also emit turn.finished on round change if we didn't emit on third dart
    // This handles cases where takeout happens before 3 darts (e.g., checkout)
    // Skip if we already emitted a bust event (justBusted)
    if (isRoundChanged && this.lastTurnScore !== null && this.lastDartsInTurn !== 3 && !justBusted) {
      const previousPlayerIndex = this.lastPlayerIndex ?? data.player;
      const remainingScore = this.lastGameScores[previousPlayerIndex] ?? data.gameScores[previousPlayerIndex] ?? 0;
      console.log(`✅ EventParser: Round change - Emitting turn.finished - turnScore=${this.lastTurnScore}, remaining=${remainingScore}`);
      events.push({
        type: 'turn.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          playerIndex: previousPlayerIndex,
          playerName: data.players[previousPlayerIndex]?.name ?? 'Unknown',
          turnScore: this.lastTurnScore,
          turnPoints: this.lastTurnScore,
          remaining: remainingScore,
          busted: this.lastTurnBusted,
          round: this.lastRound!,
        },
      });
    }

    this.lastRound = data.round;
    this.lastTurnScore = data.turnScore;
    this.lastTurnBusted = data.turnBusted;
    this.lastGameScores = [...data.gameScores];
    this.lastDartsInTurn = dartsInCurrentTurn;

    // Check for player change
    if (this.lastPlayerIndex !== null && this.lastPlayerIndex !== data.player) {
      // Get the remaining score for the NEW player (the one who is now up)
      const newPlayerRemaining = data.gameScores[data.player] ?? 0;
      events.push({
        type: 'player.change',
        timestamp,
        raw,
        data: {
          previousPlayer: this.lastPlayerIndex,
          currentPlayer: data.player,
          playerName: data.players[data.player]?.name ?? 'Unknown',
          remaining: newPlayerRemaining, // Remaining score of the player who is now up
        },
      });
    }
    this.lastPlayerIndex = data.player;

    // Check for game finished
    if (data.gameFinished && data.gameWinner !== null) {
      events.push({
        type: 'game.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          winner: data.gameWinner,
          winnerName: data.players[data.gameWinner]?.name ?? 'Unknown',
          leg: data.leg,
          set: data.set,
        },
      });
    }

    // Check for match finished
    if (data.finished && data.winner !== null) {
      events.push({
        type: 'match.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          winner: data.winner,
          winnerName: data.players[data.winner]?.name ?? 'Unknown',
        },
      });

      // Also emit match.result with full result data (chalkboards, stats, scores)
      const matchResultData: MatchResultData = {
        matchId: data.id,
        winner: data.winner,
        winnerName: data.players[data.winner]?.name ?? 'Unknown',
        variant: data.variant,
        type: data.type,
        leg: data.leg,
        set: data.set,
        round: data.round,
        players: data.players.map((p) => ({
          index: p.index,
          name: p.name,
          userId: p.userId,
        })),
        scores: (data.scores as unknown as Array<{ legs: number; sets: number }>)?.map((s) => ({
          legs: s.legs ?? 0,
          sets: s.sets ?? 0,
        })) ?? [],
        chalkboards: data.chalkboards ?? [],
        stats: data.stats?.legStats?.map((legStat, idx) => ({
          legStats: legStat,
          matchStats: data.stats.matchStats[idx] ?? legStat,
          setStats: data.stats.setStats?.[idx],
        })) ?? [],
        settings: data.settings,
      };
      events.push({
        type: 'match.result',
        timestamp,
        raw,
        data: matchResultData,
      });

      this.currentMatchId = null;
      this.lastPlayerIndex = null;
      this.currentMatchState = null;
      this.lastMatchUpdate = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
    }

    // Always emit match state event
    events.push({
      type: 'match.state',
      timestamp,
      raw,
      data: {
        matchId: data.id,
        player: data.player,
        playerName: data.players[data.player]?.name ?? 'Unknown',
        gameScores: data.gameScores,
        turnScore: data.turnScore,
        round: data.round,
        finished: data.finished,
        winner: data.winner,
        leg: data.leg,
        set: data.set,
        players: data.players.map((p) => ({
          index: p.index,
          name: p.name,
          userId: p.userId,
        })),
        turns: data.turns,
        settings: data.settings,
      },
    });

    return events.length === 1 ? events[0] : events;
  }
}

/**
 * Extract the last throw from a match state
 */
export function getLastThrow(matchState: MatchStateData): {
  segment: ThrowSegment;
  coords?: ThrowCoords;
  throwNumber: number;
  playerId: string;
} | null {
  if (!matchState.turns || matchState.turns.length === 0) {
    return null;
  }

  const lastTurn = matchState.turns[matchState.turns.length - 1];
  if (!lastTurn.throws || lastTurn.throws.length === 0) {
    return null;
  }

  const lastThrow = lastTurn.throws[lastTurn.throws.length - 1];
  return {
    segment: lastThrow.segment,
    coords: lastThrow.coords,
    throwNumber: lastThrow.throw,
    playerId: lastTurn.playerId,
  };
}

/**
 * Calculate score for a segment
 */
export function calculateSegmentScore(segment: ThrowSegment): number {
  if (segment.multiplier === 0) return 0;
  return segment.number * segment.multiplier;
}

/**
 * Check if a segment is a special scoring segment (T20, D20, Bull, etc.)
 */
export function isHighValueSegment(segment: ThrowSegment): boolean {
  // Triple 20, Double 20, Bull, Double Bull
  if (segment.multiplier === 3 && segment.number === 20) return true; // T20
  if (segment.multiplier === 2 && segment.number === 20) return true; // D20
  if (segment.bed === 'Bull' || segment.bed === 'DoubleBull') return true;
  return false;
}

/**
 * Check if throw is a miss
 */
export function isMiss(segment: ThrowSegment): boolean {
  return segment.multiplier === 0 || segment.bed === 'Outside';
}
