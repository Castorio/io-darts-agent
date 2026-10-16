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
 * Win event data for enhanced win animations
 */
export interface WinEventData {
  /** Index of the winning player */
  winnerIndex: number;
  /** Name of the winning player */
  winnerName: string;
  /** Player's ID (for player-specific animations) */
  playerId?: string;
  /** Final score (for checkout display) */
  finalScore?: number;
  /** Checkout path taken */
  checkoutPath?: string[];
  /** Player statistics */
  stats?: {
    average?: number;
    dartsThrown?: number;
    checkoutPercent?: number;
    highestCheckout?: number;
    first9Average?: number;
    total180s?: number;
  };
  /** Current leg number */
  leg?: number;
  /** Current set number */
  set?: number;
  /** Legs won by player */
  legsWon?: number;
  /** Sets won by player */
  setsWon?: number;
  /** Total legs to win */
  legsToWin?: number;
  /** Total sets to win */
  setsToWin?: number;
}

/**
 * Animation trigger result
 */
export interface AnimationTrigger {
  type: AnimationEventType;
  config: AnimationConfig | WinAnimationConfig;
  playerConfig?: AnimationConfig | WinAnimationConfig;
  playerIndex?: number;
  playerName?: string;
  playerId?: string;
  /** Extended win event data (for legWin, setWin, matchWin) */
  winData?: WinEventData;
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
    console.log('🎯 [GameDisplay] Handling event:', event.type, 'Data:', event.data);
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

    // High score: once per turn, when the turn is finished
    if (eventType === 'turn.finished') {
      return this.checkHighScoreAnimation(eventData);
    }

    // Handle game finished (leg won)
    if (eventType === 'game.finished') {
      return this.checkWinAnimation(eventData, 'legWin');
    }

    // Handle set finished (set won)
    if (eventType === 'set.finished') {
      return this.checkWinAnimation(eventData, 'setWin');
    }

    // Handle match finished
    if (eventType === 'match.finished') {
      return this.checkWinAnimation(eventData, 'matchWin');
    }

    return null;
  }

  /**
   * Check and create win animation trigger with full data
   */
  private checkWinAnimation(
    eventData: Record<string, unknown>,
    winType: 'legWin' | 'setWin' | 'matchWin'
  ): AnimationTrigger | null {
    const animations = this.config.animations;
    if (!animations) return null;

    const config = animations[winType];
    if (config?.enabled === false || config?.type === 'none') {
      return null;
    }

    this.stats.animationsTriggered++;

    // Extract winner info - handle both formats
    const winnerIndex =
      (eventData.winnerIndex as number) ??
      (eventData.winner as number) ??
      (eventData.gameWinner as number) ??
      0;
    const winnerName =
      (eventData.winnerName as string) ??
      (typeof eventData.winner === 'string' ? eventData.winner : undefined) ??
      `Player ${winnerIndex + 1}`;
    const playerId = eventData.playerId as string | undefined;

    // Build win event data
    const winData: WinEventData = {
      winnerIndex,
      winnerName,
      playerId,
      leg: eventData.leg as number | undefined,
      set: eventData.set as number | undefined,
    };

    // Extract checkout path if available
    const checkoutPath = eventData.checkoutPath as unknown[] | undefined;
    if (checkoutPath && checkoutPath.length > 0) {
      winData.checkoutPath = checkoutPath.map((dart) => {
        if (typeof dart === 'string') return dart;
        const segment = dart as Record<string, unknown>;
        return (segment.name as string) || `${segment.number}`;
      });
      this.stats.checkouts++;
    }

    // Extract final score if available
    winData.finalScore = (eventData.finalScore as number) ?? (eventData.checkout as number);

    // Extract statistics if available
    const stats = eventData.stats as Record<string, unknown> | undefined;
    const legStats = (stats?.legStats as Record<string, unknown>[]) || [];
    const matchStats = (stats?.matchStats as Record<string, unknown>[]) || [];
    const playerStats = matchStats[winnerIndex] || legStats[winnerIndex];

    if (playerStats) {
      winData.stats = {
        average: playerStats.average as number | undefined,
        dartsThrown: playerStats.dartsThrown as number | undefined,
        checkoutPercent: playerStats.checkoutPercent as number | undefined,
        highestCheckout: playerStats.checkoutPoints as number | undefined,
        first9Average: playerStats.first9Average as number | undefined,
        total180s: playerStats.total180 as number | undefined,
      };
    }

    // Extract score progress
    const scores = eventData.scores as number[] | undefined;
    if (scores && winnerIndex < scores.length) {
      if (winType === 'matchWin' || winType === 'setWin') {
        winData.setsWon = scores[winnerIndex];
      } else {
        winData.legsWon = scores[winnerIndex];
      }
    }

    // Get player-specific animation config (lookup by name/id first, then by index)
    const playerConfig = this.getPlayerAnimationConfig(winnerIndex, winType, winnerName, playerId);

    return {
      type: winType,
      config: config || { enabled: true },
      playerConfig,
      playerIndex: winnerIndex,
      playerName: winnerName,
      playerId,
      winData,
    };
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

    // DEBUG: Log segment data for bull detection
    console.log('🎯 [GameDisplay] checkThrowAnimation - segment:', JSON.stringify(segment));
    console.log('🎯 [GameDisplay] number:', number, 'multiplier:', multiplier, 'turnPoints:', turnPoints);

    // Check for 180
    if (turnPoints === 180) {
      const config = animations.throw180;
      if (config?.enabled !== false) {
        this.stats.animationsTriggered++;
        this.stats.throw180s++;
        return {
          type: '180',
          config: config || { enabled: true },
          playerConfig: this.getPlayerAnimationConfig(playerIndex, 'throw180', playerName),
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
      console.log('🎯 [GameDisplay] DOUBLE BULL DETECTED! Config:', JSON.stringify(animations.doubleBull));
      const config = animations.doubleBull;
      if (config?.enabled !== false) {
        console.log('🎯 [GameDisplay] Triggering doubleBull animation');
        this.stats.animationsTriggered++;
        return {
          type: 'doubleBull',
          config: config || { enabled: true },
          playerIndex,
          playerName,
        };
      } else {
        console.log('🎯 [GameDisplay] doubleBull animation DISABLED');
      }
    }

    // Check for single bull
    if (number === 25 && multiplier === 1) {
      console.log('🎯 [GameDisplay] SINGLE BULL DETECTED! Config:', JSON.stringify(animations.bull));
      const config = animations.bull;
      if (config?.enabled !== false) {
        console.log('🎯 [GameDisplay] Triggering bull animation');
        this.stats.animationsTriggered++;
        return {
          type: 'bull',
          config: config || { enabled: true },
          playerIndex,
          playerName,
        };
      } else {
        console.log('🎯 [GameDisplay] bull animation DISABLED');
      }
    }

    // High score is checked on turn.finished, once per turn: turnPoints here
    // is a running total and would cross the threshold on more than one dart.
    return null;
  }

  /**
   * Check a finished turn for the high score animation (once per turn)
   */
  private checkHighScoreAnimation(
    eventData: Record<string, unknown>
  ): AnimationTrigger | null {
    const highScoreConfig = this.config.animations?.highScore;
    if (eventData.busted) return null;
    const turnPoints = (eventData.turnPoints as number) ?? (eventData.turnScore as number) ?? 0;
    const threshold = highScoreConfig?.threshold || 140;
    // 180 has its own animation on the third dart
    if (turnPoints >= threshold && turnPoints < 180 && highScoreConfig?.enabled !== false) {
      this.stats.animationsTriggered++;
      return {
        type: 'highScore',
        config: highScoreConfig || { enabled: true },
        playerIndex: eventData.playerIndex as number,
        playerName: eventData.playerName as string,
      };
    }
    return null;
  }

  /**
   * Get player-specific animation config override
   * Looks up by playerName first (for system players), then falls back to playerIndex
   */
  private getPlayerAnimationConfig(
    playerIndex: number | undefined,
    animationType: keyof PlayerAnimationConfig,
    playerName?: string,
    playerId?: string
  ): AnimationConfig | undefined {
    const playerAnimations = this.config.playerAnimations;
    if (!playerAnimations || playerAnimations.length === 0) {
      return undefined;
    }

    // First try to find by playerId if provided
    if (playerId) {
      const byId = playerAnimations.find(p => p.playerId === playerId);
      if (byId && byId[animationType]) {
        console.log(`🎮 [GameDisplay] Found player animation by ID: ${playerId} -> ${animationType}`);
        return byId[animationType] as AnimationConfig | undefined;
      }
    }

    // Then try to find by playerName
    if (playerName) {
      const byName = playerAnimations.find(p => p.playerName === playerName);
      if (byName && byName[animationType]) {
        console.log(`🎮 [GameDisplay] Found player animation by name: ${playerName} -> ${animationType}`);
        return byName[animationType] as AnimationConfig | undefined;
      }
    }

    // Finally fall back to playerIndex
    if (playerIndex !== undefined && playerAnimations[playerIndex]) {
      const playerConfig = playerAnimations[playerIndex];
      if (playerConfig[animationType]) {
        console.log(`🎮 [GameDisplay] Found player animation by index: ${playerIndex} -> ${animationType}`);
        return playerConfig[animationType] as AnimationConfig | undefined;
      }
    }

    return undefined;
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
