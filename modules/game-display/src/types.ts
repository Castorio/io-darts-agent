/**
 * Game Display Module - Animation Types
 */

/**
 * Animation type options
 */
export type AnimationType = 'builtin' | 'gif' | 'video';

/**
 * Base animation configuration
 */
export interface AnimationConfig {
  enabled: boolean;
  type: AnimationType;
  url: string;
  sound: boolean;
  soundUrl: string;
  duration: number;
}

/**
 * High score animation with threshold
 */
export interface HighScoreAnimationConfig extends AnimationConfig {
  threshold: number;
}

/**
 * Player-specific animation (simplified, inherits duration from global)
 */
export interface PlayerAnimationConfig {
  enabled: boolean;
  type: AnimationType;
  url: string;
  soundUrl: string;
}

/**
 * Player animations override
 */
export interface PlayerAnimations {
  playerId: string;
  playerName: string;
  throw180?: PlayerAnimationConfig;
  legWin?: PlayerAnimationConfig;
  matchWin?: PlayerAnimationConfig;
}

/**
 * Global animations configuration
 */
export interface AnimationsConfig {
  enabled: boolean;
  duration: number;
  throw180: AnimationConfig;
  bull: AnimationConfig;
  doubleBull: AnimationConfig;
  legWin: AnimationConfig;
  matchWin: AnimationConfig;
  highScore: HighScoreAnimationConfig;
  checkout: AnimationConfig;
  bust: AnimationConfig;
}

/**
 * Complete Game Display configuration
 */
export interface GameDisplayConfig {
  displayName: string;
  idleMode: 'black' | 'image' | 'lastGame';
  idleImageUrl: string;
  showCheckouts: boolean;
  checkoutThreshold: number;
  animationSpeed: 'slow' | 'normal' | 'fast';
  showOtherPlayers: boolean;
  animations: AnimationsConfig;
  playerAnimations: PlayerAnimations[];
}

/**
 * Animation event types
 */
export type AnimationEventType =
  | 'throw180'
  | 'bull'
  | 'doubleBull'
  | 'legWin'
  | 'matchWin'
  | 'highScore'
  | 'checkout'
  | 'bust';

/**
 * Animation trigger event
 */
export interface AnimationTriggerEvent {
  type: AnimationEventType;
  playerId?: string;
  playerName?: string;
  score?: number;
  timestamp: Date;
}

/**
 * Resolved animation (after player override check)
 */
export interface ResolvedAnimation {
  enabled: boolean;
  type: AnimationType;
  url: string;
  sound: boolean;
  soundUrl: string;
  duration: number;
  isPlayerSpecific: boolean;
}

/**
 * Default animation configurations
 */
export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  enabled: true,
  type: 'builtin',
  url: '',
  sound: false,
  soundUrl: '',
  duration: 3000,
};

export const DEFAULT_ANIMATIONS_CONFIG: AnimationsConfig = {
  enabled: true,
  duration: 3000,
  throw180: {
    ...DEFAULT_ANIMATION_CONFIG,
    sound: true,
    duration: 4000,
  },
  bull: {
    ...DEFAULT_ANIMATION_CONFIG,
    sound: true,
    duration: 2000,
  },
  doubleBull: {
    ...DEFAULT_ANIMATION_CONFIG,
    sound: true,
    duration: 2500,
  },
  legWin: {
    ...DEFAULT_ANIMATION_CONFIG,
    sound: true,
    duration: 3000,
  },
  matchWin: {
    ...DEFAULT_ANIMATION_CONFIG,
    sound: true,
    duration: 5000,
  },
  highScore: {
    ...DEFAULT_ANIMATION_CONFIG,
    threshold: 140,
    duration: 2000,
  },
  checkout: {
    ...DEFAULT_ANIMATION_CONFIG,
    sound: true,
    duration: 2500,
  },
  bust: {
    ...DEFAULT_ANIMATION_CONFIG,
    duration: 1500,
  },
};

/**
 * Resolve animation config for a specific event and player
 * Player-specific animations override global animations
 */
export function resolveAnimation(
  config: GameDisplayConfig,
  eventType: AnimationEventType,
  playerId?: string
): ResolvedAnimation | null {
  // Check if animations are globally disabled
  if (!config.animations.enabled) {
    return null;
  }

  // Get global animation config
  const globalConfig = config.animations[eventType] as AnimationConfig | HighScoreAnimationConfig;
  if (!globalConfig || !globalConfig.enabled) {
    return null;
  }

  // Check for player-specific override
  if (playerId && ['throw180', 'legWin', 'matchWin'].includes(eventType)) {
    const playerConfig = config.playerAnimations.find(
      (p) => p.playerId === playerId
    );

    if (playerConfig) {
      const playerAnimation = playerConfig[eventType as 'throw180' | 'legWin' | 'matchWin'];
      if (playerAnimation?.enabled) {
        return {
          enabled: true,
          type: playerAnimation.type,
          url: playerAnimation.url,
          sound: !!playerAnimation.soundUrl,
          soundUrl: playerAnimation.soundUrl,
          duration: globalConfig.duration,
          isPlayerSpecific: true,
        };
      }
    }
  }

  // Return global config
  return {
    enabled: globalConfig.enabled,
    type: globalConfig.type,
    url: globalConfig.url,
    sound: globalConfig.sound,
    soundUrl: globalConfig.soundUrl,
    duration: globalConfig.duration,
    isPlayerSpecific: false,
  };
}

/**
 * Check if a score triggers high score animation
 */
export function shouldTriggerHighScore(
  config: GameDisplayConfig,
  score: number
): boolean {
  const highScoreConfig = config.animations.highScore;
  return (
    config.animations.enabled &&
    highScoreConfig.enabled &&
    score >= highScoreConfig.threshold &&
    score < 180
  );
}
