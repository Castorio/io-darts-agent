/**
 * WLED Module Event Handler
 *
 * Processes Autodarts events and sends commands to WLED devices
 */

import type { ParsedEvent } from '../../../src/types/index.js';

/**
 * Player service interface for player color matching
 */
export interface PlayerServiceInterface {
  matchPlayer(name: string): Promise<{ name: string; color?: string } | null | undefined>;
}

/**
 * Logger interface for event logging
 */
export interface WledLoggerInterface {
  log(source: string, message: string, data?: unknown): void;
}

/**
 * WLED action types
 */
export type WledActionType = 'preset' | 'effect' | 'solid' | 'brightness' | 'off' | 'none';

/**
 * WLED action configuration
 */
export interface WledAction {
  enabled?: boolean;
  actionType?: WledActionType;
  presetId?: number;
  effectId?: number;
  color?: { r: number; g: number; b: number } | string;
  color1?: { r: number; g: number; b: number } | string;
  color2?: { r: number; g: number; b: number } | string;
  color3?: { r: number; g: number; b: number } | string;
  brightness?: number;
  speed?: number;
  intensity?: number;
  duration?: number;
  fadeTime?: number; // Transition time in ms for fading between states
  usePlayerColor?: boolean;
}

/**
 * WLED module configuration
 */
export interface WledConfig {
  wledHost?: string;
  wledPort?: number;
  events?: Record<string, WledAction>;
  eventActions?: Record<string, WledAction>;
  defaultState?: WledAction;
  autoStart?: boolean;
  playerColors?: Array<string | { r: number; g: number; b: number }>;
  fadeTime?: number; // Global transition time in ms for fading between states (default: 0)
}

/**
 * Convert hex color string to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace(/^#/, '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Parse color from config - supports both hex strings and RGB objects
 */
function parseColor(
  color: unknown,
  fallback: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
): { r: number; g: number; b: number } {
  if (!color) return fallback;

  if (typeof color === 'object' && color !== null && 'r' in color) {
    return color as { r: number; g: number; b: number };
  }

  if (typeof color === 'string' && color.startsWith('#')) {
    return hexToRgb(color);
  }

  return fallback;
}

/**
 * WLED Handler class
 */
export class WledHandler {
  private config: WledConfig;
  private playerService: PlayerServiceInterface | null = null;
  private logger: WledLoggerInterface | null = null;

  // Current match state for player info lookup
  private currentMatchState: {
    playerIndex: number;
    playerName: string;
    players: Array<{ name?: string; color?: string; index?: number }>;
  } | null = null;

  // Default player colors for fallback
  private readonly defaultPlayerColors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#22c55e', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ];

  // Statistics
  private stats = {
    eventsProcessed: 0,
    commandsSent: 0,
    errors: 0,
  };

  constructor(config: WledConfig) {
    this.config = config;
  }

  /**
   * Set player service for color matching
   */
  setPlayerService(service: PlayerServiceInterface | null): void {
    this.playerService = service;
  }

  /**
   * Set logger for event logging
   */
  setLogger(logger: WledLoggerInterface | null): void {
    this.logger = logger;
  }

  /**
   * Log a message
   */
  private log(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.log('wled', message, data);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: WledConfig): void {
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): WledConfig {
    return this.config;
  }

  /**
   * Get WLED host
   */
  getHost(): string | undefined {
    return this.config.wledHost;
  }

  /**
   * Get WLED port
   */
  getPort(): number {
    return this.config.wledPort || 80;
  }

  /**
   * Check if handler is configured
   */
  isConfigured(): boolean {
    return !!this.config.wledHost;
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
      commandsSent: 0,
      errors: 0,
    };
  }

  /**
   * Handle an event
   */
  async handleEvent(event: ParsedEvent): Promise<void> {
    this.stats.eventsProcessed++;

    // Update current match state from match.state events
    if (event.type === 'match.state') {
      const eventData = event.data as Record<string, unknown>;
      const playerIndex = (eventData.player as number) ?? 0;
      const players = eventData.players as Array<{ name?: string; color?: string; index?: number }> || [];
      const currentPlayer = players[playerIndex];
      this.currentMatchState = {
        playerIndex,
        playerName: currentPlayer?.name || eventData.playerName as string || '',
        players,
      };
      this.log(`Updated match state: player ${playerIndex} (${this.currentMatchState.playerName})`);
    }

    // Clear match state on match end/delete
    if (event.type === 'match.finished' || event.type === 'match.delete') {
      this.currentMatchState = null;
    }

    if (!this.isConfigured()) {
      this.log('No host configured');
      return;
    }

    // Special handling for match.start: Apply player color after optional start animation
    // Note: currentMatchState will be set by the first match.state event that follows
    if (event.type === 'match.start') {
      const matchStartAction = this.getActionForEvent(event);

      // Get player change action config to use for setting player color
      const eventsConfig = this.config.events || this.config.eventActions || {};
      const playerChangeAction = eventsConfig['player.change'] || eventsConfig['player.changed'] || eventsConfig['playerChange'];
      const defaultState = this.config.defaultState;
      const actionToUse = playerChangeAction || defaultState;

      if (matchStartAction && matchStartAction.action.actionType && matchStartAction.action.actionType !== 'none') {
        // If there's a start animation with duration, apply player color after its duration
        // Don't use the default restore logic - handle it here explicitly
        const delay = matchStartAction.action.duration || 0;
        if (delay > 0) {
          this.log(`Match start - will apply player color after ${delay}ms`);
          console.log(`🎨 WLED [match.start]: Will apply player color after ${delay}ms`);
          this.applyPlayerColorAfterDelay(delay, actionToUse, 'match.start.playerColor');
        } else {
          // No duration configured - apply player color immediately after a short delay for match state
          this.log(`Match start - will apply player color after 1000ms (no duration set)`);
          console.log(`🎨 WLED [match.start]: Will apply player color after 1000ms (no duration set)`);
          this.applyPlayerColorAfterDelay(1000, actionToUse, 'match.start.playerColor');
        }
      } else if (actionToUse && actionToUse.actionType && actionToUse.actionType !== 'none') {
        // No start animation, apply player color directly after 1 second
        this.log(`Match start - applying player color after 1 second`);
        console.log(`🎨 WLED [match.start]: Will apply player color after 1000ms (no start animation)`);
        this.applyPlayerColorAfterDelay(1000, actionToUse, 'match.start.playerColor');
      } else {
        console.log(`🎨 WLED [match.start]: No player.change or defaultState action configured for player color`);
      }
    }

    // Special handling for takeout.finished: Apply player color
    // This ensures the player color is shown even in single-player mode where no player.change event occurs
    if (event.type === 'takeout.finished' && this.currentMatchState) {
      // Try to get the player.change action configuration (which should have usePlayerColor)
      const eventsConfig = this.config.events || this.config.eventActions || {};
      const playerChangeAction = eventsConfig['player.change'] || eventsConfig['player.changed'] || eventsConfig['playerChange'];

      // Also check defaultState as fallback
      const defaultState = this.config.defaultState;
      const actionToUse = playerChangeAction || defaultState;

      if (actionToUse && actionToUse.actionType && actionToUse.actionType !== 'none') {
        this.log(`Takeout finished - applying player color for ${this.currentMatchState.playerName}`);
        console.log(`🎨 WLED [takeout.finished]: Applying player color for ${this.currentMatchState.playerName}`);
        // Create event with current match state data
        const eventWithPlayerData = { ...event, data: { ...this.currentMatchState } };
        const playerColor = await this.resolvePlayerColor(eventWithPlayerData as ParsedEvent);
        console.log(`🎨 WLED [takeout.finished]: Resolved player color: RGB(${playerColor?.r}, ${playerColor?.g}, ${playerColor?.b})`);
        await this.executeAction(actionToUse, playerColor, 'takeout.finished.playerColor');
        // Don't return - continue to process normal takeout.finished action if configured
      } else {
        console.log(`🎨 WLED [takeout.finished]: No player.change or defaultState action configured`);
      }
    }

    const actionResult = this.getActionForEvent(event);
    if (!actionResult) {
      this.log(`No config for event: ${event.type}`);
      return;
    }

    const { action, eventKey } = actionResult;

    // Check action type
    const actionType = action.actionType;
    if (!actionType || actionType === 'none') {
      this.log(`Action type is none for ${eventKey}`);
      return;
    }

    // Get player color if needed
    let playerColor: { r: number; g: number; b: number } | null = null;
    if (action.usePlayerColor) {
      playerColor = await this.resolvePlayerColor(event);
    }

    // Execute the action
    await this.executeAction(action, playerColor, event.type);

    // Restore to player color after duration (not to previous WLED state)
    // Skip for match.start as we handle player color separately via applyPlayerColorAfterDelay
    if (action.duration && action.duration > 0 && actionType !== 'off' && event.type !== 'match.start') {
      this.log(`Will restore to player color in ${action.duration}ms`);
      console.log(`🎨 WLED [${event.type}]: Will restore to player color in ${action.duration}ms`);

      setTimeout(async () => {
        // Get the player.change action to use for restoring player color
        const eventsConfig = this.config.events || this.config.eventActions || {};
        const playerChangeAction = eventsConfig['player.change'] || eventsConfig['player.changed'] || eventsConfig['playerChange'];
        const defaultState = this.config.defaultState;
        const restoreAction = playerChangeAction || defaultState;

        if (restoreAction && this.currentMatchState) {
          // Resolve current player color
          const currentPlayerColor = await this.resolvePlayerColorFromMatchState();
          if (currentPlayerColor) {
            this.log(`Restoring to player color after duration`);
            console.log(`🎨 WLED [${event.type}]: Restoring to player color RGB(${currentPlayerColor.r}, ${currentPlayerColor.g}, ${currentPlayerColor.b})`);
            await this.executeAction(restoreAction, currentPlayerColor, `${event.type}.restore`);
          }
        } else {
          this.log(`No action or match state for restore after duration`);
        }
      }, action.duration);
    }
  }

  /**
   * Apply player color after a delay, waiting for match state to be available
   */
  private applyPlayerColorAfterDelay(
    delay: number,
    action: WledAction | undefined,
    source: string
  ): void {
    if (!action) {
      console.log(`🎨 WLED [${source}]: No action provided, skipping`);
      return;
    }

    console.log(`🎨 WLED [${source}]: Scheduling player color application in ${delay}ms`);

    setTimeout(async () => {
      console.log(`🎨 WLED [${source}]: Timer fired, checking for match state...`);
      // Wait up to 2 seconds for match state to be available
      let attempts = 0;
      while (!this.currentMatchState && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      console.log(`🎨 WLED [${source}]: Match state available: ${!!this.currentMatchState}, attempts: ${attempts}`);

      if (this.currentMatchState) {
        // Resolve player color using stored match state
        const playerIdx = this.currentMatchState.playerIndex;
        const players = this.currentMatchState.players;
        let playerColor: { r: number; g: number; b: number } | null = null;

        console.log(`🎨 WLED [${source}]: Player ${playerIdx} (${this.currentMatchState.playerName}), ${players?.length || 0} players in match`);

        // Check for enriched color in players array
        if (players && players[playerIdx]?.color) {
          playerColor = parseColor(players[playerIdx].color!);
          this.log(`Using enriched player color: ${players[playerIdx].color}`);
          console.log(`🎨 WLED [${source}]: Using enriched player color: ${players[playerIdx].color}`);
        } else if (this.playerService && this.currentMatchState.playerName) {
          // Try player service
          try {
            const matched = await this.playerService.matchPlayer(this.currentMatchState.playerName);
            if (matched?.color) {
              playerColor = parseColor(matched.color);
              this.log(`Matched player color: ${matched.color}`);
              console.log(`🎨 WLED [${source}]: Matched player color via service: ${matched.color}`);
            }
          } catch (e) {
            this.log(`Could not match player: ${e}`);
            console.log(`🎨 WLED [${source}]: Could not match player: ${e}`);
          }
        }

        // Fallback to default colors
        if (!playerColor) {
          const defaultColors = this.config.playerColors || this.defaultPlayerColors;
          const colorConfig = defaultColors[playerIdx % defaultColors.length];
          playerColor = parseColor(colorConfig);
          this.log(`Using default player ${playerIdx + 1} color`);
          console.log(`🎨 WLED [${source}]: Using default player ${playerIdx + 1} color`);
        }

        this.log(`${source}: Applying player color for ${this.currentMatchState.playerName}`);
        console.log(`🎨 WLED [${source}]: Applying player color RGB(${playerColor.r}, ${playerColor.g}, ${playerColor.b}) for ${this.currentMatchState.playerName}`);
        await this.executeAction(action, playerColor, source);
      } else {
        this.log(`${source}: No match state available after waiting`);
        console.log(`🎨 WLED [${source}]: No match state available after waiting ${attempts * 100}ms`);
      }
    }, delay);
  }

  /**
   * Resolve player color from stored match state (for restore after duration)
   */
  private async resolvePlayerColorFromMatchState(): Promise<{ r: number; g: number; b: number } | null> {
    if (!this.currentMatchState) return null;

    const playerIdx = this.currentMatchState.playerIndex;
    const players = this.currentMatchState.players;

    // Check for enriched color in players array
    if (players && players[playerIdx]?.color) {
      return parseColor(players[playerIdx].color!);
    }

    // Try player service
    if (this.playerService && this.currentMatchState.playerName) {
      try {
        const matched = await this.playerService.matchPlayer(this.currentMatchState.playerName);
        if (matched?.color) {
          return parseColor(matched.color);
        }
      } catch (e) {
        this.log(`Could not match player: ${e}`);
      }
    }

    // Fallback to default colors
    const defaultColors = this.config.playerColors || this.defaultPlayerColors;
    const colorConfig = defaultColors[playerIdx % defaultColors.length];
    return parseColor(colorConfig);
  }

  /**
   * Resolve player color from event data and player service
   */
  private async resolvePlayerColor(
    event: ParsedEvent
  ): Promise<{ r: number; g: number; b: number } | null> {
    const eventData = event.data as Record<string, unknown>;

    // Try to get player info from various event formats
    let playerIdx = (eventData?.playerIndex as number) ?? (eventData?.player as number) ?? 0;
    let currentPlayerName = eventData?.playerName as string;
    let players: Array<{ name?: string; color?: string; index?: number }> | null = null;

    // For match.state events, get current player from players array
    if (eventData?.players) {
      players = eventData.players as Array<{ name?: string; color?: string; index?: number }>;
    }

    // Fallback to stored match state for events without player info (like throw.detected)
    if (!currentPlayerName && !players && this.currentMatchState) {
      playerIdx = this.currentMatchState.playerIndex;
      currentPlayerName = this.currentMatchState.playerName;
      players = this.currentMatchState.players;
      this.log(`Using stored match state: player ${playerIdx} (${currentPlayerName})`);
    }

    // Try to get player name and color from players array
    if (!currentPlayerName && players && players.length > 0) {
      const currentPlayer = players[playerIdx];
      if (currentPlayer) {
        currentPlayerName = currentPlayer.name || '';
        // If the player already has a color from enrichment, use it directly
        if (currentPlayer.color) {
          this.log(`Using enriched player color for ${currentPlayerName}: ${currentPlayer.color}`);
          return parseColor(currentPlayer.color);
        }
      }
    }

    // Check if player has enriched color in stored match state
    if (players && players.length > 0) {
      const currentPlayer = players[playerIdx];
      if (currentPlayer?.color) {
        this.log(`Using enriched player color for ${currentPlayer.name}: ${currentPlayer.color}`);
        return parseColor(currentPlayer.color);
      }
    }

    // Try to match the player by name using player service
    if (this.playerService && currentPlayerName) {
      try {
        const matchedPlayer = await this.playerService.matchPlayer(currentPlayerName);
        if (matchedPlayer && matchedPlayer.color) {
          this.log(`Matched known player: ${matchedPlayer.name} with color ${matchedPlayer.color}`);
          return parseColor(matchedPlayer.color);
        }
      } catch (e) {
        this.log(`Could not match player: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Fallback to generic player colors from config or defaults
    const playerColorsConfig = this.config.playerColors || this.defaultPlayerColors;
    const playerColorsRgb = playerColorsConfig.map((c) => parseColor(c));
    const color = playerColorsRgb[playerIdx % playerColorsRgb.length];
    this.log(`Using generic player ${playerIdx + 1} color: RGB(${color.r},${color.g},${color.b})`);
    return color;
  }

  /**
   * Get action configuration for an event
   */
  private getActionForEvent(
    event: ParsedEvent
  ): { action: WledAction; eventKey: string } | null {
    const eventsConfig = this.config.events || this.config.eventActions || {};

    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    // Handle throw events with special conditions
    if (eventType === 'throw.detected') {
      const turnPoints = (eventData.turnPoints as number) || 0;
      const segment = eventData.segment as Record<string, unknown>;
      const multiplier = (segment?.multiplier as number) || 0;
      const number = (segment?.number as number) || 0;
      const points = (eventData.points as number) || 0;

      if (turnPoints === 180) {
        return this.findAction(eventsConfig, 'throw.180', [
          'throw.180',
          'throw180',
        ]);
      }
      if (eventData.busted) {
        return this.findAction(eventsConfig, 'throw.bust', [
          'throw.bust',
          'throwBust',
          'bust',
        ]);
      }
      if (number === 25 && multiplier === 2) {
        return this.findAction(eventsConfig, 'throw.bullseye', [
          'throw.bullseye',
          'throwBullseye',
          'throw.doubleBull',
          'doubleBull',
        ]);
      }
      if (number === 25 && multiplier === 1) {
        return this.findAction(eventsConfig, 'throw.bull', [
          'throw.bull',
          'throwBull',
          'throw.singleBull',
        ]);
      }
      if (multiplier === 3) {
        return this.findAction(eventsConfig, 'throw.triple', [
          'throw.triple',
          'throwTriple',
          'throwHighlight',
        ]);
      }
      if (multiplier === 2) {
        return this.findAction(eventsConfig, 'throw.double', [
          'throw.double',
          'throwDouble',
        ]);
      }
      // Check for miss
      if (points === 0) {
        return this.findAction(eventsConfig, 'throw.miss', [
          'throw.miss',
          'throwMiss',
        ]);
      }
      // Default throw
      return this.findAction(eventsConfig, 'throw.detected', [
        'throw.detected',
        'throwDetected',
        'throwHit',
      ]);
    }

    // Handle player change
    if (eventType === 'player.change' || eventType === 'player.changed') {
      return this.findAction(eventsConfig, 'player.changed', [
        'player.changed',
        'player.change',
        'playerChange',
      ]);
    }

    // Handle match events
    if (eventType === 'match.start' || eventType === 'match.started') {
      return this.findAction(eventsConfig, 'match.started', [
        'match.started',
        'match.start',
        'matchStart',
      ]);
    }
    if (eventType === 'match.finished') {
      return this.findAction(eventsConfig, 'match.finished', [
        'match.finished',
        'matchFinished',
      ]);
    }
    if (eventType === 'match.delete' || eventType === 'match.deleted') {
      return this.findAction(eventsConfig, 'match.deleted', [
        'match.deleted',
        'match.delete',
        'matchDeleted',
      ]);
    }
    if (eventType === 'game.finished') {
      return this.findAction(eventsConfig, 'game.finished', [
        'game.finished',
        'gameFinished',
      ]);
    }

    // Handle turn events
    if (eventType === 'turn.started') {
      return this.findAction(eventsConfig, 'turn.started', [
        'turn.started',
        'turnStarted',
      ]);
    }
    if (eventType === 'turn.finished') {
      return this.findAction(eventsConfig, 'turn.finished', [
        'turn.finished',
        'turnFinished',
      ]);
    }

    // Handle takeout events
    if (eventType === 'takeout.started') {
      return this.findAction(eventsConfig, 'takeout.started', [
        'takeout.started',
        'takeoutStarted',
      ]);
    }
    if (eventType === 'takeout.finished') {
      return this.findAction(eventsConfig, 'takeout.finished', [
        'takeout.finished',
        'takeoutFinished',
      ]);
    }

    return null;
  }

  /**
   * Find action by trying multiple keys
   */
  private findAction(
    config: Record<string, WledAction>,
    eventKey: string,
    keys: string[]
  ): { action: WledAction; eventKey: string } | null {
    for (const key of keys) {
      if (config[key]) {
        return { action: config[key], eventKey };
      }
    }
    return null;
  }

  /**
   * Execute a WLED action
   */
  private async executeAction(
    action: WledAction,
    playerColor: { r: number; g: number; b: number } | null,
    eventType: string
  ): Promise<void> {
    const host = this.config.wledHost;
    const port = this.config.wledPort || 80;

    if (!host) return;

    const wledUrl = `http://${host}:${port}/json/state`;
    let payload: Record<string, unknown> = { on: true };

    // Get colors from config (support both color and color1)
    const color1 =
      playerColor ||
      parseColor(action.color1 || action.color, { r: 255, g: 255, b: 255 });
    const color2 = parseColor(action.color2, { r: 0, g: 0, b: 0 });
    const color3 = parseColor(action.color3, { r: 0, g: 0, b: 0 });

    // Check if a color is configured
    const hasColor = action.color1 || action.color || playerColor;

    // If a color is selected but no preset or effect, default to solid
    const effectiveActionType =
      (action.actionType === 'none' || !action.actionType) && hasColor
        ? 'solid'
        : action.actionType;

    // Get fade/transition time (action-specific or global config, in 100ms units for WLED)
    const fadeTimeMs = action.fadeTime ?? this.config.fadeTime ?? 0;
    const transitionTime = Math.round(fadeTimeMs / 100); // WLED uses 100ms units

    switch (effectiveActionType) {
      case 'preset':
        payload = { ps: action.presetId || 1 };
        if (transitionTime > 0) {
          payload.transition = transitionTime;
        }
        break;

      case 'effect':
        payload = {
          on: true,
          bri: action.brightness ?? 255,
          seg: [
            {
              fx: action.effectId ?? 0,
              sx: action.speed ?? 128,
              ix: action.intensity ?? 128,
              col: [
                [color1.r, color1.g, color1.b],
                [color2.r, color2.g, color2.b],
                [color3.r, color3.g, color3.b],
              ],
            },
          ],
        };
        if (transitionTime > 0) {
          payload.transition = transitionTime;
        }
        break;

      case 'solid':
        payload = {
          on: true,
          bri: action.brightness ?? 255,
          seg: [
            {
              fx: 0,
              col: [[color1.r, color1.g, color1.b]],
            },
          ],
        };
        if (transitionTime > 0) {
          payload.transition = transitionTime;
        }
        break;

      case 'brightness':
        payload = {
          on: true,
          bri: action.brightness ?? 255,
        };
        if (transitionTime > 0) {
          payload.transition = transitionTime;
        }
        break;

      case 'off':
        payload = { on: false };
        if (transitionTime > 0) {
          payload.transition = transitionTime;
        }
        break;
    }

    this.log(`Sending ${effectiveActionType} action for ${eventType}`, payload);
    console.log(`🎨 WLED [${eventType}]: Sending ${effectiveActionType} action${transitionTime > 0 ? ` (fade: ${fadeTimeMs}ms)` : ''}`);

    try {
      const response = await fetch(wledUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.stats.errors++;
        this.log(`HTTP Error: ${response.status}`);
        console.error(`WLED: HTTP ${response.status}`);
      } else {
        this.stats.commandsSent++;
        this.log(`Command sent successfully to ${host}:${port}`);
      }
    } catch (error) {
      this.stats.errors++;
      this.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('WLED request failed:', error);
    }
  }
}

/**
 * Create WLED handler from module config
 */
export function createWledHandler(config: Record<string, unknown>): WledHandler {
  return new WledHandler(config as WledConfig);
}
