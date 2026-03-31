/**
 * Game Display Module Event Handler
 *
 * Processes Autodarts events for the Game Display module.
 * The Game Display primarily uses WebSocket for real-time updates,
 * but this handler can be used for server-side event logging,
 * animation triggering, and statistics tracking.
 */

import type { ParsedEvent } from '../../../src/types/index.js';

/**
 * Animation configuration for an event
 */
export interface AnimationConfig {
  enabled?: boolean;
  type?: 'builtin' | 'gif' | 'video';
  url?: string;
  sound?: boolean;
  soundUrl?: string;
  duration?: number;
}

/**
 * Game Display animation settings
 */
export interface GameDisplayAnimations {
  enabled?: boolean;
  duration?: number;
  throw180?: AnimationConfig;
  bull?: AnimationConfig;
  doubleBull?: AnimationConfig;
  legWin?: AnimationConfig;
  matchWin?: AnimationConfig;
  highScore?: AnimationConfig & { threshold?: number };
  checkout?: AnimationConfig;
  bust?: AnimationConfig;
}

/**
 * Player-specific animation overrides
 */
export interface PlayerAnimationConfig {
  playerId?: string;
  playerName?: string;
  throw180?: AnimationConfig;
  legWin?: AnimationConfig;
  matchWin?: AnimationConfig;
}

/**
 * Game Display module configuration
 */
export interface GameDisplayConfig {
  displayName?: string;
  idleMode?: 'black' | 'image' | 'lastGame';
  idleImageUrl?: string;
  // Match started screen
  matchStartedMode?: 'default' | 'image';
  matchStartedImageUrl?: string;
  matchStartedDuration?: number;
  gameOnBackgroundColor?: string;
  // Match results
  matchResultsDuration?: number;
  matchResultsBackgroundColor?: string;
  showCheckouts?: boolean;
  checkoutThreshold?: number;
  animationSpeed?: 'slow' | 'normal' | 'fast';
  showOtherPlayers?: boolean;
  animations?: GameDisplayAnimations;
  playerAnimations?: PlayerAnimationConfig[];
}

/**
 * Animation event types
 */
export type AnimationEventType =
  | '180'
  | 'bull'
  | 'doubleBull'
  | 'highScore'
  | 'checkout'
  | 'bust'
  | 'legWin'
  | 'matchWin';

/**
 * Animation trigger result
 */
export interface AnimationTrigger {
  type: AnimationEventType;
  config: AnimationConfig;
  playerConfig?: AnimationConfig;
  playerIndex?: number;
  playerName?: string;
}

/**
 * Event callback type
 */
export type GameDisplayEventCallback = (
  event: ParsedEvent,
  trigger?: AnimationTrigger
) => void;

/**
 * Game Display Handler class
 */
export class GameDisplayHandler {
  private config: GameDisplayConfig;
  private eventCallbacks: GameDisplayEventCallback[] = [];

  // Statistics tracking
  private stats = {
    eventsProcessed: 0,
    animationsTriggered: 0,
    matchesStarted: 0,
    matchesFinished: 0,
    throw180s: 0,
    checkouts: 0,
  };

  constructor(config: GameDisplayConfig) {
    this.config = config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: GameDisplayConfig): void {
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): GameDisplayConfig {
    return this.config;
  }

  /**
   * Register event callback
   */
  onEvent(callback: GameDisplayEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove event callback
   */
  offEvent(callback: GameDisplayEventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      eventsProcessed: 0,
      animationsTriggered: 0,
      matchesStarted: 0,
      matchesFinished: 0,
      throw180s: 0,
      checkouts: 0,
    };
  }

  /**
   * Handle an event
   */
  async handleEvent(event: ParsedEvent): Promise<void> {
    this.stats.eventsProcessed++;

    // Check for animation triggers
    const trigger = this.checkAnimationTrigger(event);

    // Update statistics based on event
    this.updateStats(event);

    // Notify callbacks
    for (const callback of this.eventCallbacks) {
      try {
        callback(event, trigger || undefined);
      } catch (error) {
        console.error('Game Display callback error:', error);
      }
    }
  }

  /**
   * Check if event should trigger an animation
   */
  private checkAnimationTrigger(event: ParsedEvent): AnimationTrigger | null {
    const animations = this.config.animations;
    if (!animations?.enabled) {
      return null;
    }

    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    // Handle throw events
    if (eventType === 'throw.detected') {
      return this.checkThrowAnimation(eventData);
    }

    // Handle game finished (leg won)
    if (eventType === 'game.finished') {
      const config = animations.legWin;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        return {
          type: 'legWin',
          config: config || { enabled: true },
          playerIndex: eventData.winnerIndex as number,
          playerName: eventData.winner as string,
        };
      }
    }

    // Handle match finished
    if (eventType === 'match.finished') {
      const config = animations.matchWin;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        return {
          type: 'matchWin',
          config: config || { enabled: true },
          playerName: eventData.winner as string,
        };
      }
    }

    return null;
  }

  /**
   * Check throw event for animation triggers
   */
  private checkThrowAnimation(
    eventData: Record<string, unknown>
  ): AnimationTrigger | null {
    const animations = this.config.animations;
    if (!animations) return null;

    const turnPoints = (eventData.turnPoints as number) || 0;
    const segment = eventData.segment as Record<string, unknown>;
    const multiplier = (segment?.multiplier as number) || 0;
    const number = (segment?.number as number) || 0;
    const playerIndex = eventData.playerIndex as number;
    const playerName = eventData.playerName as string;

    // Check for 180
    if (turnPoints === 180) {
      const config = animations.throw180;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        this.stats.throw180s++;
        return {
          type: '180',
          config: config || { enabled: true },
          playerConfig: this.getPlayerAnimationConfig(playerIndex, 'throw180'),
          playerIndex,
          playerName,
        };
      }
    }

    // Check for bust
    if (eventData.busted) {
      const config = animations.bust;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        return {
          type: 'bust',
          config: config || { enabled: true },
          playerIndex,
          playerName,
        };
      }
    }

    // Check for double bull
    if (number === 25 && multiplier === 2) {
      const config = animations.doubleBull;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        return {
          type: 'doubleBull',
          config: config || { enabled: true },
          playerIndex,
          playerName,
        };
      }
    }

    // Check for single bull
    if (number === 25 && multiplier === 1) {
      const config = animations.bull;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        return {
          type: 'bull',
          config: config || { enabled: true },
          playerIndex,
          playerName,
        };
      }
    }

    // Check for high score
    const highScoreConfig = animations.highScore;
    const threshold = highScoreConfig?.threshold || 140;
    if (turnPoints >= threshold && turnPoints < 180) {
      if (highScoreConfig?.enabled !== false) {
        this.stats.animationsTriggered++;
        return {
          type: 'highScore',
          config: highScoreConfig || { enabled: true },
          playerIndex,
          playerName,
        };
      }
    }

    return null;
  }

  /**
   * Get player-specific animation config override
   */
  private getPlayerAnimationConfig(
    playerIndex: number,
    animationType: keyof PlayerAnimationConfig
  ): AnimationConfig | undefined {
    const playerAnimations = this.config.playerAnimations;
    if (!playerAnimations || playerAnimations.length === 0) {
      return undefined;
    }

    // Find config for this player
    const playerConfig = playerAnimations[playerIndex];
    if (!playerConfig) {
      return undefined;
    }

    return playerConfig[animationType] as AnimationConfig | undefined;
  }

  /**
   * Update statistics based on event
   */
  private updateStats(event: ParsedEvent): void {
    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    if (eventType === 'match.start' || eventType === 'match.started') {
      this.stats.matchesStarted++;
    }

    if (eventType === 'match.finished') {
      this.stats.matchesFinished++;
    }

    if (eventType === 'game.finished') {
      const checkoutPath = eventData.checkoutPath as unknown[];
      if (checkoutPath && checkoutPath.length > 0) {
        this.stats.checkouts++;
      }
    }
  }

  /**
   * Get animation duration based on speed setting
   */
  getAnimationDuration(baseDuration: number): number {
    const speed = this.config.animationSpeed || 'normal';
    switch (speed) {
      case 'slow':
        return baseDuration * 1.5;
      case 'fast':
        return baseDuration * 0.7;
      default:
        return baseDuration;
    }
  }

  /**
   * Check if checkout should be shown
   */
  shouldShowCheckout(remaining: number): boolean {
    if (!this.config.showCheckouts) {
      return false;
    }
    const threshold = this.config.checkoutThreshold || 170;
    return remaining <= threshold && remaining >= 2;
  }
}

/**
 * Create Game Display handler from module config
 */
export function createGameDisplayHandler(
  config: Record<string, unknown>
): GameDisplayHandler {
  return new GameDisplayHandler(config as GameDisplayConfig);
}
