/**
 * Game Display Module Event Handler
 *
 * Processes Autodarts events for the Game Display module.
 * The Game Display gets every event over the WebSocket and decides its
 * animations in the browser (web/src/stores/gameDisplay.ts). This handler
 * only keeps statistics and small config helpers on the hub side.
 */

import type { ParsedEvent } from '../../../src/types/index.js';

/**
 * Animation configuration for an event
 */
export interface AnimationConfig {
  enabled?: boolean;
  type?: 'builtin' | 'gif' | 'video' | 'none';
  url?: string;
  mediaUrl?: string; // Alias for url (from module.json config)
  sound?: boolean;
  soundUrl?: string;
  duration?: number;
}

/**
 * Extended win animation configuration with additional options
 */
export interface WinAnimationConfig extends AnimationConfig {
  /** Custom message to display during animation */
  message?: string;
  /** Show player name in animation */
  showPlayerName?: boolean;
  /** Show final score in animation */
  showFinalScore?: boolean;
  /** Show statistics (average, checkout %) in animation */
  showStats?: boolean;
  /** Confetti/particle effect type */
  effectType?: 'none' | 'confetti' | 'fireworks' | 'sparkles';
  /** Background color for the win screen */
  backgroundColor?: string;
  /** Text color for win messages */
  textColor?: string;
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
  legWin?: WinAnimationConfig;
  setWin?: WinAnimationConfig;
  matchWin?: WinAnimationConfig;
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
  legWin?: WinAnimationConfig;
  setWin?: WinAnimationConfig;
  matchWin?: WinAnimationConfig;
  checkout?: AnimationConfig;
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
  | 'setWin'
  | 'matchWin';

/**
 * Game Display Handler class
 */
export class GameDisplayHandler {
  private config: GameDisplayConfig;

  // Statistics tracking
  private stats = {
    eventsProcessed: 0,
    matchesStarted: 0,
    matchesFinished: 0,
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
        matchesStarted: 0,
      matchesFinished: 0,
        checkouts: 0,
    };
  }

  /**
   * Handle an event. Processing is synchronous; the promise keeps the handler
   * interface and turns a throw into a rejection for the caller's catch.
   */
  handleEvent(event: ParsedEvent): Promise<void> {
    return new Promise<void>((resolve) => {
      this.processEvent(event);
      resolve();
    });
  }

  private processEvent(event: ParsedEvent): void {
    this.stats.eventsProcessed++;
    // Animations are decided in the display itself (web/src/stores/gameDisplay.ts),
    // which gets every event over the WebSocket; the hub side only keeps statistics.
    this.updateStats(event);
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
