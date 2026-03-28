import type {
  AutodartsMessage,
  ParsedEvent,
  BoardStateData,
  BoardEventData,
  MatchStartData,
  MatchDeleteData,
  MatchStateData,
  ThrowSegment,
  ThrowCoords,
} from '../../types/index.js';

export class EventParser {
  private boardId: string;
  private currentMatchId: string | null = null;
  private lastPlayerIndex: number | null = null;

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
    }
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
   * Parse match start/delete events
   */
  private parseMatchEvent(
    raw: AutodartsMessage,
    data: MatchStartData | MatchDeleteData,
    timestamp: Date
  ): ParsedEvent {
    if (data.event === 'start') {
      this.currentMatchId = data.id;
      this.lastPlayerIndex = null;

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

    // Check for player change
    if (this.lastPlayerIndex !== null && this.lastPlayerIndex !== data.player) {
      events.push({
        type: 'player.change',
        timestamp,
        raw,
        data: {
          previousPlayer: this.lastPlayerIndex,
          currentPlayer: data.player,
          playerName: data.players[data.player]?.name ?? 'Unknown',
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
      this.currentMatchId = null;
      this.lastPlayerIndex = null;
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
