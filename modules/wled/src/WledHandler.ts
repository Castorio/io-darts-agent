/**
 * WLED Module Event Handler
 *
 * Processes Autodarts events and sends commands to WLED devices
 */

import type { ParsedEvent } from '../../../src/types/index.js';

// ============================================
// Types and Interfaces
// ============================================

export interface PlayerServiceInterface {
  matchPlayer(name: string): Promise<{ name: string; color?: string } | null | undefined>;
}

export interface WledLoggerInterface {
  log(source: string, message: string, data?: unknown): void;
}

export type WledActionType = 'preset' | 'effect' | 'solid' | 'brightness' | 'off' | 'none';

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
  fadeTime?: number;
  usePlayerColor?: boolean;
}

export interface WledConfig {
  wledHost?: string;
  wledPort?: number;
  events?: Record<string, WledAction>;
  eventActions?: Record<string, WledAction>;
  defaultState?: WledAction;
  autoStart?: boolean;
  playerColors?: Array<string | { r: number; g: number; b: number }>;
  fadeTime?: number;
}

type RGB = { r: number; g: number; b: number };

// ============================================
// Utility Functions
// ============================================

const DEFAULT_WHITE: RGB = { r: 255, g: 255, b: 255 };

function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace(/^#/, '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function parseColor(color: unknown, fallback: RGB = DEFAULT_WHITE): RGB {
  if (!color) return fallback;
  if (typeof color === 'object' && color !== null && 'r' in color) {
    return color as RGB;
  }
  if (typeof color === 'string' && color.startsWith('#')) {
    return hexToRgb(color);
  }
  return fallback;
}

// Event key mappings for findAction lookups
const EVENT_KEY_MAPPINGS: Record<string, string[]> = {
  'throw.180': ['throw.180', 'throw180'],
  'throw.bust': ['throw.bust', 'throwBust', 'bust'],
  'throw.bullseye': ['throw.bullseye', 'throwBullseye', 'throw.doubleBull', 'doubleBull'],
  'throw.bull': ['throw.bull', 'throwBull', 'throw.singleBull'],
  'throw.triple': ['throw.triple', 'throwTriple', 'throwHighlight'],
  'throw.double': ['throw.double', 'throwDouble'],
  'throw.miss': ['throw.miss', 'throwMiss'],
  'throw.detected': ['throw.detected', 'throwDetected', 'throwHit'],
  'player.changed': ['player.changed', 'player.change', 'playerChange'],
  'match.started': ['match.started', 'match.start', 'matchStart'],
  'match.finished': ['match.finished', 'matchFinished'],
  'match.deleted': ['match.deleted', 'match.delete', 'matchDeleted'],
  'match.finish': ['match.finish', 'matchFinish'],
  'game.finished': ['game.finished', 'gameFinished'],
  'turn.started': ['turn.started', 'turnStarted'],
  'turn.finished': ['turn.finished', 'turnFinished'],
  'takeout.started': ['takeout.started', 'takeoutStarted'],
  'takeout.finished': ['takeout.finished', 'takeoutFinished'],
};

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

    // Debug: Log throw events
    if (event.type === 'throw.detected') {
      console.log(`🎨 WLED [throw.detected]: Event received, host=${this.config.wledHost || 'NOT SET'}`);
    }

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

    // Update current match state from player.change events
    if ((event.type === 'player.change' || (event.type as string) === 'player.changed') && this.currentMatchState) {
      const eventData = event.data as Record<string, unknown>;
      const newPlayerIndex = (eventData.currentPlayer as number) ?? (eventData.player as number) ?? this.currentMatchState.playerIndex;
      const newPlayerName = (eventData.playerName as string) || '';

      // Update stored match state with new player index
      this.currentMatchState.playerIndex = newPlayerIndex;
      if (newPlayerName) {
        this.currentMatchState.playerName = newPlayerName;
      } else if (this.currentMatchState.players && this.currentMatchState.players[newPlayerIndex]) {
        this.currentMatchState.playerName = this.currentMatchState.players[newPlayerIndex].name || '';
      }

      this.log(`Player changed: player ${newPlayerIndex} (${this.currentMatchState.playerName})`);
      console.log(`🎨 WLED [player.change]: Updated to player ${newPlayerIndex} (${this.currentMatchState.playerName})`);

      // Execute player color action if configured
      const playerChangeAction = this.getPlayerChangeAction();
      if (playerChangeAction && playerChangeAction.actionType && playerChangeAction.actionType !== 'none') {
        this.log(`Player change - applying player color for ${this.currentMatchState.playerName}`);
        const playerColor = await this.resolvePlayerColor({ source: 'player.change' });
        console.log(`🎨 WLED [player.change]: Resolved player color: RGB(${playerColor?.r}, ${playerColor?.g}, ${playerColor?.b})`);
        await this.executeAction(playerChangeAction, playerColor, 'player.change.playerColor');
        // Skip further action processing for player.change since we handled it here
        return;
      }
    }

    // Note: match state will be cleared AFTER the action is executed (see below)
    // to allow match.finished to use player color

    // Debug: Check isConfigured
    if (event.type === 'throw.detected') {
      console.log(`🎨 WLED [throw.detected]: isConfigured=${this.isConfigured()}`);
    }

    if (!this.isConfigured()) {
      this.log('No host configured');
      if (event.type === 'throw.detected') {
        console.log(`🎨 WLED [throw.detected]: Returning - host not configured`);
      }
      return;
    }

    // Debug: After isConfigured check
    if (event.type === 'throw.detected') {
      console.log(`🎨 WLED [throw.detected]: Passed isConfigured check, continuing to getActionForEvent...`);
    }

    // Special handling for match.start: Apply player color after optional start animation
    if (event.type === 'match.start') {
      this.handleMatchStartPlayerColor(event);
    }

    // Special handling for takeout.finished: Apply player color
    // This ensures the player color is shown even in single-player mode where no player.change event occurs
    if (event.type === 'takeout.finished' && this.currentMatchState) {
      const actionToUse = this.getPlayerChangeAction();

      if (actionToUse && actionToUse.actionType && actionToUse.actionType !== 'none') {
        this.log(`Takeout finished - applying player color for ${this.currentMatchState.playerName}`);
        const playerColor = await this.resolvePlayerColor({ source: 'takeout.finished' });
        console.log(`🎨 WLED [takeout.finished]: Resolved player color: RGB(${playerColor?.r}, ${playerColor?.g}, ${playerColor?.b})`);
        await this.executeAction(actionToUse, playerColor, 'takeout.finished.playerColor');
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
    let playerColor: RGB | null = null;
    if (action.usePlayerColor) {
      playerColor = await this.resolvePlayerColorFromEvent(event);
    }

    // Execute the action
    await this.executeAction(action, playerColor, event.type);

    // Restore to player color after duration (not to previous WLED state)
    // Skip for certain events where restore doesn't make sense
    const skipRestoreEvents = ['match.start', 'match.finished', 'match.delete', 'match.finish'];
    if (action.duration && action.duration > 0 && actionType !== 'off' && !skipRestoreEvents.includes(event.type)) {
      this.log(`Will restore to player color in ${action.duration}ms`);
      this.schedulePlayerColorRestore(action.duration, event.type);
    }

    // Clear match state AFTER action execution for match end/delete
    // This ensures match.finished can use player color if usePlayerColor is enabled
    if (event.type === 'match.finished' || event.type === 'match.delete') {
      this.currentMatchState = null;
      this.log('Match state cleared after action execution');
    }
  }

  /**
   * Get the player change action configuration
   */
  private getPlayerChangeAction(): WledAction | undefined {
    const eventsConfig = this.getEventsConfig();
    return eventsConfig['player.change'] || eventsConfig['player.changed'] || eventsConfig['playerChange'] || this.config.defaultState;
  }

  /**
   * Get events configuration object
   */
  private getEventsConfig(): Record<string, WledAction> {
    return this.config.events || this.config.eventActions || {};
  }

  /**
   * Apply player color after a delay, waiting for match state to be available
   */
  private applyPlayerColorAfterDelay(delay: number, action: WledAction | undefined, source: string): void {
    if (!action) {
      console.log(`🎨 WLED [${source}]: No action provided, skipping`);
      return;
    }

    console.log(`🎨 WLED [${source}]: Scheduling player color application in ${delay}ms`);

    setTimeout(async () => {
      // Wait up to 2 seconds for match state to be available
      await this.waitForMatchState(2000);

      if (this.currentMatchState) {
        const playerColor = await this.resolvePlayerColor({ source });
        if (playerColor) {
          console.log(`🎨 WLED [${source}]: Applying player color RGB(${playerColor.r}, ${playerColor.g}, ${playerColor.b})`);
          await this.executeAction(action, playerColor, source);
        }
      } else {
        this.log(`${source}: No match state available after waiting`);
      }
    }, delay);
  }

  /**
   * Schedule player color restore after an action duration
   */
  private schedulePlayerColorRestore(duration: number, eventType: string): void {
    console.log(`🎨 WLED [${eventType}]: Will restore to player color in ${duration}ms`);

    setTimeout(async () => {
      const restoreAction = this.getPlayerChangeAction();
      if (restoreAction && this.currentMatchState) {
        const playerColor = await this.resolvePlayerColor({ source: `${eventType}.restore` });
        if (playerColor) {
          console.log(`🎨 WLED [${eventType}]: Restoring to player color RGB(${playerColor.r}, ${playerColor.g}, ${playerColor.b})`);
          await this.executeAction(restoreAction, playerColor, `${eventType}.restore`);
        }
      } else {
        this.log(`No action or match state for restore after duration`);
      }
    }, duration);
  }

  /**
   * Wait for match state to be available
   */
  private async waitForMatchState(timeoutMs: number): Promise<boolean> {
    const interval = 100;
    let elapsed = 0;
    while (!this.currentMatchState && elapsed < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;
    }
    return !!this.currentMatchState;
  }

  /**
   * Handle match start player color application
   */
  private handleMatchStartPlayerColor(event: ParsedEvent): void {
    const matchStartAction = this.getActionForEvent(event);
    const actionToUse = this.getPlayerChangeAction();

    if (!actionToUse || !actionToUse.actionType || actionToUse.actionType === 'none') {
      console.log(`🎨 WLED [match.start]: No player.change or defaultState action configured`);
      return;
    }

    // Determine delay based on whether there's a start animation
    let delay = 1000; // Default 1 second delay for match state to arrive
    if (matchStartAction?.action.actionType && matchStartAction.action.actionType !== 'none') {
      delay = matchStartAction.action.duration || 1000;
    }

    console.log(`🎨 WLED [match.start]: Will apply player color after ${delay}ms`);
    this.applyPlayerColorAfterDelay(delay, actionToUse, 'match.start.playerColor');
  }

  /**
   * Resolve player color - unified method for all color lookups
   * @param options.playerIndex - Player index to get color for (optional, uses match state if not provided)
   * @param options.playerName - Player name for service lookup (optional)
   * @param options.players - Players array (optional, uses match state if not provided)
   * @param options.source - Source identifier for logging
   */
  private async resolvePlayerColor(options: {
    playerIndex?: number;
    playerName?: string;
    players?: Array<{ name?: string; color?: string; index?: number }> | null;
    source?: string;
  } = {}): Promise<RGB | null> {
    const source = options.source || 'unknown';
    let playerIdx = options.playerIndex ?? this.currentMatchState?.playerIndex ?? 0;
    let playerName = options.playerName ?? this.currentMatchState?.playerName;
    const players = options.players ?? this.currentMatchState?.players ?? null;

    // Get player info from players array
    if (players && players[playerIdx]) {
      const player = players[playerIdx];
      if (!playerName) playerName = player.name;

      // Check for enriched color
      if (player.color) {
        this.log(`[${source}] Using enriched color for ${playerName}: ${player.color}`);
        return parseColor(player.color);
      }
    }

    // Try player service
    if (this.playerService && playerName) {
      try {
        const matched = await this.playerService.matchPlayer(playerName);
        if (matched?.color) {
          this.log(`[${source}] Matched player ${playerName} color: ${matched.color}`);
          return parseColor(matched.color);
        }
      } catch (e) {
        this.log(`[${source}] Player service error: ${e}`);
      }
    }

    // Fallback to default colors
    const defaultColors = this.config.playerColors || this.defaultPlayerColors;
    const colorConfig = defaultColors[playerIdx % defaultColors.length];
    const color = parseColor(colorConfig);
    this.log(`[${source}] Using default player ${playerIdx + 1} color: RGB(${color.r},${color.g},${color.b})`);
    return color;
  }

  /**
   * Resolve player color from event data
   */
  private async resolvePlayerColorFromEvent(event: ParsedEvent): Promise<RGB | null> {
    const eventData = event.data as Record<string, unknown>;
    const eventType = event.type as string;

    // Determine player index based on event type
    let playerIdx: number;
    let playerName: string | undefined = (eventData?.winnerName as string) ?? (eventData?.playerName as string) ?? undefined;

    if (eventType === 'match.finished' || eventType === 'game.finished') {
      playerIdx = (eventData?.winner as number) ?? 0;
    } else if (eventType === 'player.change' || eventType === 'player.changed') {
      playerIdx = (eventData?.currentPlayer as number) ?? (eventData?.player as number) ?? 0;
    } else {
      playerIdx = (eventData?.playerIndex as number) ?? (eventData?.player as number) ?? this.currentMatchState?.playerIndex ?? 0;
      if (!playerName) playerName = this.currentMatchState?.playerName ?? undefined;
    }

    // Get players array from event or match state
    const players = (eventData?.players as Array<{ name?: string; color?: string; index?: number }>) ?? this.currentMatchState?.players ?? null;

    return this.resolvePlayerColor({
      playerIndex: playerIdx,
      playerName,
      players,
      source: eventType,
    });
  }

  /**
   * Get action configuration for an event
   */
  private getActionForEvent(event: ParsedEvent): { action: WledAction; eventKey: string } | null {
    const eventsConfig = this.getEventsConfig();
    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    // Handle throw events with special conditions
    if (eventType === 'throw.detected') {
      const eventKey = this.getThrowEventKey(eventData);
      return this.findActionByKey(eventsConfig, eventKey);
    }

    // Map event type to canonical key
    const eventKey = this.getCanonicalEventKey(eventType);
    return eventKey ? this.findActionByKey(eventsConfig, eventKey) : null;
  }

  /**
   * Determine the event key for throw events
   */
  private getThrowEventKey(eventData: Record<string, unknown>): string {
    const turnPoints = (eventData.turnPoints as number) || 0;
    const segment = eventData.segment as Record<string, unknown>;
    const multiplier = (segment?.multiplier as number) || 0;
    const number = (segment?.number as number) || 0;
    const points = (eventData.points as number) || 0;

    if (turnPoints === 180) return 'throw.180';
    if (eventData.busted) return 'throw.bust';
    if (number === 25 && multiplier === 2) return 'throw.bullseye';
    if (number === 25 && multiplier === 1) return 'throw.bull';
    if (multiplier === 3) return 'throw.triple';
    if (multiplier === 2) return 'throw.double';
    if (points === 0) return 'throw.miss';
    return 'throw.detected';
  }

  /**
   * Map event type to canonical event key
   */
  private getCanonicalEventKey(eventType: string): string | null {
    const typeMapping: Record<string, string> = {
      'player.change': 'player.changed',
      'player.changed': 'player.changed',
      'match.start': 'match.started',
      'match.started': 'match.started',
      'match.finished': 'match.finished',
      'match.delete': 'match.deleted',
      'match.deleted': 'match.deleted',
      'match.finish': 'match.finish',
      'game.finished': 'game.finished',
      'turn.started': 'turn.started',
      'turn.finished': 'turn.finished',
      'takeout.started': 'takeout.started',
      'takeout.finished': 'takeout.finished',
    };
    return typeMapping[eventType] || null;
  }

  /**
   * Find action by event key using pre-defined mappings
   */
  private findActionByKey(config: Record<string, WledAction>, eventKey: string): { action: WledAction; eventKey: string } | null {
    const keys = EVENT_KEY_MAPPINGS[eventKey];
    if (!keys) return null;

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

  /**
   * Execute an intent action
   * Called when an intent subscription triggers for this module
   */
  async executeIntentAction(
    intent: { id: string; source: string; payload: Record<string, unknown> },
    action: { type: string; config?: Record<string, unknown> }
  ): Promise<void> {
    const { type, config = {} } = action;
    this.log(`Executing intent action: ${type} for intent ${intent.id}`, config);

    const eventType = `intent.${intent.id}`;
    const getColor = (color: unknown, fallback: RGB): RGB => color ? parseColor(color, fallback) : fallback;

    switch (type) {
      case 'solidColor':
        await this.executeAction({
          actionType: 'solid',
          color: getColor(config.color, { r: 255, g: 0, b: 0 }),
          brightness: config.brightness as number ?? 255,
          duration: config.duration as number ?? 0,
        }, null, eventType);
        break;

      case 'effect':
        await this.executeAction({
          actionType: 'effect',
          effectId: config.effectId as number ?? 0,
          speed: config.speed as number ?? 128,
          intensity: config.intensity as number ?? 128,
          color: config.color ? parseColor(config.color) : undefined,
          duration: config.duration as number ?? 2000,
        }, null, eventType);
        break;

      case 'preset':
        await this.executeAction({
          actionType: 'preset',
          presetId: config.presetId as number ?? 1,
          duration: config.duration as number ?? 0,
        }, null, eventType);
        break;

      case 'flash':
        await this.executeFlashAction(config, eventType);
        break;

      case 'rainbow':
        await this.executeAction({
          actionType: 'effect',
          effectId: 9,
          speed: config.speed as number ?? 200,
          intensity: 128,
          duration: config.duration as number ?? 3000,
        }, null, eventType);
        break;

      case 'off':
        await this.executeAction({ actionType: 'off' }, null, eventType);
        break;

      default:
        this.log(`Unknown intent action type: ${type}`);
    }
  }

  /**
   * Execute flash action with multiple on/off cycles
   */
  private async executeFlashAction(config: Record<string, unknown>, eventType: string): Promise<void> {
    const color = config.color ? parseColor(config.color) : DEFAULT_WHITE;
    const duration = config.duration as number ?? 500;
    const count = config.count as number ?? 3;

    for (let i = 0; i < count; i++) {
      await this.executeAction({ actionType: 'solid', color, brightness: 255 }, null, `${eventType}.flash`);
      await new Promise(resolve => setTimeout(resolve, duration / 2));
      await this.executeAction({ actionType: 'off' }, null, `${eventType}.off`);
      await new Promise(resolve => setTimeout(resolve, duration / 2));
    }
  }
}

/**
 * Create WLED handler from module config
 */
export function createWledHandler(config: Record<string, unknown>): WledHandler {
  return new WledHandler(config as WledConfig);
}
