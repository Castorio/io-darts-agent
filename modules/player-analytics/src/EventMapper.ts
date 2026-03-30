/**
 * Player Analytics - Event Mapper
 * Maps Autodarts events to player statistics updates
 */

import type { ParsedEvent } from '@autodarts-hub/module-sdk';
import {
  PlayerAnalyticsConfig,
  AutodartsMatchStartData,
  AutodartsThrowData,
  AutodartsTurnEndData,
  AutodartsGameEndData,
  AutodartsMatchEndData,
  ThrowData,
  TurnData,
  DartSegment,
} from './types.js';

export interface MatchState {
  matchId: string;
  autodartsMatchId: string;
  gameType: string;
  startingScore: number;
  players: Array<{
    id: string;
    name: string;
    autodartsId?: string;
  }>;
  currentGameIndex: number;
  currentLegIndex: number;
  currentTurnIndex: number;
  currentPlayerIndex: number;
  currentTurnThrows: ThrowData[];
  scores: number[]; // Current scores per player
}

export interface MappedAction {
  type:
    | 'match.start'
    | 'throw.record'
    | 'turn.end'
    | 'leg.end'
    | 'game.end'
    | 'match.end'
    | 'match.abort';
  matchId: string;
  data: unknown;
}

export class EventMapper {
  private currentMatch: MatchState | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: PlayerAnalyticsConfig) {
    // Config stored for future use (e.g., custom checkout rules)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateConfig(_config: PlayerAnalyticsConfig): void {
    // Config stored for future use
  }

  getCurrentMatch(): MatchState | null {
    return this.currentMatch;
  }

  mapEvent(event: ParsedEvent): MappedAction | null {
    switch (event.type) {
      case 'match.start':
        return this.handleMatchStart(event.data as AutodartsMatchStartData);

      case 'throw.detected':
        return this.handleThrow(event.data as AutodartsThrowData);

      case 'turn.finished':
        return this.handleTurnEnd(event.data as AutodartsTurnEndData);

      case 'game.finished':
        return this.handleGameEnd(event.data as AutodartsGameEndData);

      case 'match.finished':
        return this.handleMatchEnd(event.data as AutodartsMatchEndData);

      case 'match.delete':
        return this.handleMatchAbort(event.data as { matchId: string });

      default:
        return null;
    }
  }

  private handleMatchStart(data: AutodartsMatchStartData): MappedAction {
    const startingScore = data.settings?.baseScore || 501;

    this.currentMatch = {
      matchId: '', // Will be set by handler
      autodartsMatchId: data.id,
      gameType: data.variant || 'X01',
      startingScore,
      players: data.players.map((p) => ({
        id: '', // Will be mapped to internal player ID
        name: p.name,
        autodartsId: p.id,
      })),
      currentGameIndex: 0,
      currentLegIndex: 0,
      currentTurnIndex: 0,
      currentPlayerIndex: 0,
      currentTurnThrows: [],
      scores: data.players.map(() => startingScore),
    };

    return {
      type: 'match.start',
      matchId: data.id,
      data: {
        autodartsMatchId: data.id,
        gameType: this.currentMatch.gameType,
        startingScore,
        players: this.currentMatch.players,
      },
    };
  }

  private handleThrow(data: AutodartsThrowData): MappedAction | null {
    if (!this.currentMatch || this.currentMatch.autodartsMatchId !== data.matchId) {
      return null;
    }

    const segment = this.parseSegment(data.segment);
    const isCheckoutAttempt = this.isCheckoutAttempt(
      data.remaining + data.score,
      data.turnThrows
    );
    const isSuccessfulCheckout = data.remaining === 0 && segment.bed === 'double';

    const throwData: ThrowData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      matchId: this.currentMatch.matchId,
      playerId: '', // Will be resolved by handler
      turnIndex: this.currentMatch.currentTurnIndex,
      throwIndex: data.turnThrows,
      segment,
      score: data.score,
      multiplier: data.multiplier as 1 | 2 | 3,
      remainingScore: data.remaining,
      timestamp: new Date(),
      isCheckoutAttempt,
      isSuccessfulCheckout,
    };

    this.currentMatch.currentTurnThrows.push(throwData);
    this.currentMatch.scores[data.playerIndex] = data.remaining;

    return {
      type: 'throw.record',
      matchId: this.currentMatch.autodartsMatchId,
      data: {
        throwData,
        playerIndex: data.playerIndex,
        playerName: data.playerName,
      },
    };
  }

  private handleTurnEnd(data: AutodartsTurnEndData): MappedAction | null {
    if (!this.currentMatch || this.currentMatch.autodartsMatchId !== data.matchId) {
      return null;
    }

    const turnData: TurnData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      matchId: this.currentMatch.matchId,
      playerId: '', // Will be resolved by handler
      turnIndex: this.currentMatch.currentTurnIndex,
      throws: [...this.currentMatch.currentTurnThrows],
      totalScore: data.turnScore,
      startingScore: this.calculateStartingScore(data),
      endingScore: data.remaining,
      isBust: data.isBust,
      isCheckout: data.remaining === 0 && !data.isBust,
      timestamp: new Date(),
    };

    // Reset for next turn
    this.currentMatch.currentTurnThrows = [];
    this.currentMatch.currentTurnIndex++;
    this.currentMatch.currentPlayerIndex =
      (this.currentMatch.currentPlayerIndex + 1) % this.currentMatch.players.length;

    return {
      type: 'turn.end',
      matchId: this.currentMatch.autodartsMatchId,
      data: {
        turnData,
        playerIndex: data.playerIndex,
        playerName: data.playerName,
      },
    };
  }

  private handleGameEnd(data: AutodartsGameEndData): MappedAction | null {
    if (!this.currentMatch || this.currentMatch.autodartsMatchId !== data.matchId) {
      return null;
    }

    const action: MappedAction = {
      type: 'game.end',
      matchId: this.currentMatch.autodartsMatchId,
      data: {
        gameIndex: this.currentMatch.currentGameIndex,
        winnerIndex: data.winnerIndex,
        winnerName: data.winnerName,
      },
    };

    // Reset for next game
    this.currentMatch.currentGameIndex++;
    this.currentMatch.currentLegIndex = 0;
    this.currentMatch.currentTurnIndex = 0;
    this.currentMatch.scores = this.currentMatch.players.map(
      () => this.currentMatch!.startingScore
    );

    return action;
  }

  private handleMatchEnd(data: AutodartsMatchEndData): MappedAction | null {
    if (!this.currentMatch || this.currentMatch.autodartsMatchId !== data.matchId) {
      return null;
    }

    const action: MappedAction = {
      type: 'match.end',
      matchId: this.currentMatch.autodartsMatchId,
      data: {
        winnerIndex: data.winnerIndex,
        winnerName: data.winnerName,
        isAborted: data.isAborted,
      },
    };

    this.currentMatch = null;
    return action;
  }

  private handleMatchAbort(data: { matchId: string }): MappedAction | null {
    if (!this.currentMatch || this.currentMatch.autodartsMatchId !== data.matchId) {
      return null;
    }

    const action: MappedAction = {
      type: 'match.abort',
      matchId: this.currentMatch.autodartsMatchId,
      data: {},
    };

    this.currentMatch = null;
    return action;
  }

  private parseSegment(segment: { number: number; bed: string }): DartSegment {
    let bed: DartSegment['bed'];

    switch (segment.bed.toLowerCase()) {
      case 'd':
      case 'double':
        bed = 'double';
        break;
      case 't':
      case 'triple':
        bed = 'triple';
        break;
      case 'ob':
      case 'outer-bull':
      case 'outer bull':
        bed = 'outer-bull';
        break;
      case 'ib':
      case 'inner-bull':
      case 'inner bull':
      case 'bull':
      case 'bullseye':
        bed = 'inner-bull';
        break;
      case 'm':
      case 'miss':
      case 'outside':
        bed = 'miss';
        break;
      default:
        bed = 'single';
    }

    return {
      number: segment.number,
      bed,
    };
  }

  private isCheckoutAttempt(scoreBeforeThrow: number, _throwNumber: number): boolean {
    // A checkout attempt is when the remaining score is <= 170 (max checkout)
    // and we're on a double or attempting double
    // For simplicity, we consider any throw at <=170 remaining as potential checkout
    // More sophisticated logic would track the actual segment aimed at
    if (scoreBeforeThrow <= 170 && scoreBeforeThrow >= 2) {
      // Could be a checkout attempt if:
      // - Score is a valid checkout (can be finished with remaining darts)
      // - Last dart in turn often targets checkout
      return this.isValidCheckout(scoreBeforeThrow);
    }
    return false;
  }

  private isValidCheckout(score: number): boolean {
    // Valid X01 checkouts range from 2 to 170
    // Some scores are not checkable (169, 168, 166, 165, 163, 162, 159)
    const invalidCheckouts = [169, 168, 166, 165, 163, 162, 159];
    return score >= 2 && score <= 170 && !invalidCheckouts.includes(score);
  }

  private calculateStartingScore(data: AutodartsTurnEndData): number {
    // Starting score = remaining + turn score (accounting for bust)
    if (data.isBust) {
      return data.remaining; // On bust, remaining doesn't change
    }
    return data.remaining + data.turnScore;
  }
}
