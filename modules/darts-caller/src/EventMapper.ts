/**
 * Event Mapper
 *
 * Maps Autodarts events to caller actions
 */

import type { ParsedEvent } from '@autodarts-hub/module-sdk';
import { ScoreConverter } from './ScoreConverter.js';
import type { CallerModuleConfig, CallRequest, CallType } from './types.js';

/**
 * Mapped call result
 */
export interface MappedCall {
  type: CallType;
  text: string;
  audioFile?: string;
  priority: number;
}

export class EventMapper {
  private config: CallerModuleConfig;
  private scoreConverter: ScoreConverter;

  constructor(config: CallerModuleConfig) {
    this.config = config;
    this.scoreConverter = new ScoreConverter();
  }

  /**
   * Update configuration
   */
  updateConfig(config: CallerModuleConfig): void {
    this.config = config;
  }

  /**
   * Map an event to caller actions
   */
  mapEvent(event: ParsedEvent): MappedCall[] {
    if (!this.config.enabled) {
      return [];
    }

    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    switch (eventType) {
      case 'match.start':
      case 'match.started':
        return this.handleMatchStart(eventData);

      case 'match.finished':
        return this.handleMatchFinished(eventData);

      case 'game.finished':
        return this.handleGameFinished(eventData);

      case 'throw.detected':
        return this.handleThrow(eventData);

      case 'turn.finished':
        return this.handleTurnFinished(eventData);

      case 'player.change':
      case 'player.changed':
        return this.handlePlayerChange(eventData);

      default:
        return [];
    }
  }

  /**
   * Handle match start
   */
  private handleMatchStart(_eventData: Record<string, unknown>): MappedCall[] {
    if (!this.config.special.callGameStart) {
      return [];
    }

    return [{
      type: 'game',
      text: this.scoreConverter.getGameStartText(),
      audioFile: 'game_on',
      priority: 10,
    }];
  }

  /**
   * Handle match finished
   */
  private handleMatchFinished(eventData: Record<string, unknown>): MappedCall[] {
    if (!this.config.special.callGameOver) {
      return [];
    }

    const winner = eventData.winner as Record<string, unknown> | undefined;
    const winnerName = winner?.name as string | undefined;

    return [{
      type: 'game',
      text: this.scoreConverter.getMatchShotText(winnerName),
      audioFile: 'match_shot',
      priority: 10,
    }];
  }

  /**
   * Handle game finished (leg won)
   */
  private handleGameFinished(eventData: Record<string, unknown>): MappedCall[] {
    if (!this.config.special.callGameOver) {
      return [];
    }

    const winner = eventData.winner as Record<string, unknown> | undefined;
    const winnerName = winner?.name as string | undefined;

    return [{
      type: 'game',
      text: this.scoreConverter.getGameShotText(winnerName),
      audioFile: 'game_shot',
      priority: 9,
    }];
  }

  /**
   * Handle throw detected - check for busts
   */
  private handleThrow(eventData: Record<string, unknown>): MappedCall[] {
    const busted = eventData.busted as boolean;

    if (busted && this.config.special.callBust) {
      return [{
        type: 'special',
        text: this.scoreConverter.getBustText(),
        audioFile: 'bust',
        priority: 8,
      }];
    }

    return [];
  }

  /**
   * Handle turn finished - announce score
   */
  private handleTurnFinished(eventData: Record<string, unknown>): MappedCall[] {
    const calls: MappedCall[] = [];
    const turnPoints = (eventData.turnPoints as number) || 0;
    const remaining = (eventData.remaining as number) || 0;
    const busted = eventData.busted as boolean;

    // Don't announce if busted (already handled)
    if (busted) {
      return [];
    }

    // Check for 180
    if (turnPoints === 180 && this.config.special.call180) {
      calls.push({
        type: 'special',
        text: this.scoreConverter.get180Text(),
        audioFile: '180',
        priority: 10,
      });
      return calls; // 180 is the only call needed
    }

    // Announce score
    if (this.config.scores.enabled) {
      // Check high scores only filter
      if (this.config.scores.highScoresOnly && turnPoints < 100) {
        // Skip low scores
      } else if (turnPoints >= this.config.scores.minScore) {
        calls.push({
          type: 'score',
          text: this.scoreConverter.scoreToText(turnPoints),
          audioFile: this.scoreConverter.scoreToAudioFile(turnPoints),
          priority: 5,
        });
      }
    }

    // Announce checkout if applicable
    if (this.config.checkouts.enabled &&
        this.config.checkouts.announceRemaining &&
        this.scoreConverter.isCheckoutPossible(remaining)) {
      calls.push({
        type: 'checkout',
        text: this.scoreConverter.getRequireText(
          remaining,
          this.config.checkouts.announceCheckoutPath
        ),
        audioFile: `require_${remaining}`,
        priority: 4,
      });
    }

    return calls;
  }

  /**
   * Handle player change
   */
  private handlePlayerChange(eventData: Record<string, unknown>): MappedCall[] {
    if (!this.config.special.callPlayerChange) {
      return [];
    }

    const playerName = eventData.playerName as string | undefined;
    const remaining = eventData.remaining as number | undefined;

    if (!playerName) {
      return [];
    }

    const text = this.scoreConverter.getPlayerText(playerName, remaining);

    return [{
      type: 'player',
      text,
      audioFile: undefined, // Player names are TTS only
      priority: 3,
    }];
  }
}
