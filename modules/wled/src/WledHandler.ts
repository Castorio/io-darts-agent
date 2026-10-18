/**
 * WLED Module Event Handler
 *
 * Processes Autodarts events and sends commands to WLED devices
 */

import type { ParsedEvent } from '../../../src/types/index.js';
import { FADE_TIME_UNIT, normalizeWledConfig, toWledTransition } from './fade.js';

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
  /** How long the action stays before the player color is restored, in ms (0 = until the next event). */
  duration?: number;
  /** Transition time in ms. Overrides the global fadeTime; 0 forces an instant change. */
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
  /** Global transition time in ms, used when an action has no own fadeTime. */
  fadeTime?: number;
  /** Unit marker for fadeTime values. Missing means a legacy config, see fade.ts. */
  fadeTimeUnit?: typeof FADE_TIME_UNIT;
  /** Marks in a Cricket turn from which the cricket.marks strong-turn effect fires (3-9, default 6). */
  cricketMarksThreshold?: number;
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

// The module must not import from the hub's src/, so Cricket mode detection is defined locally.
const isCricketMode = (mode: unknown): boolean => mode === 'cricket' || mode === 'tactics';

const DEFAULT_CRICKET_MARKS_THRESHOLD = 6;
const MIN_CRICKET_MARKS_THRESHOLD = 3;
const MAX_CRICKET_MARKS_THRESHOLD = 9;

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
  'cricket.closed': ['cricket.closed', 'cricketClosed'],
  'cricket.marks': ['cricket.marks', 'cricketMarks'],
};

/**
 * WLED Handler class
 */
export class WledHandler {
  private config: WledConfig;
  private playerService: PlayerServiceInterface | null = null;
  private logger: WledLoggerInterface | null = null;

  // Current match state for player info lookup
  // Player color waiting for the first match state of a new match. The board
  // often sends it only with the first dart, long after the start animation.
  private pendingStartColor: { action: WledAction; source: string } | null = null;
  private currentMatchState: {
    playerIndex: number;
    playerName: string;
    players: Array<{ name?: string; color?: string; index?: number }>;
  } | null = null;

  // turnIds for which the Cricket cricket.marks strong-turn action already fired.
  // Cleared on match.start/match.delete so a new match can fire again.
  private strongTurns = new Set<string>();

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
    this.config = normalizeWledConfig(config);
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
    this.config = normalizeWledConfig(config);
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

    // A new match never carries over Cricket strong-turn dedup from the previous one
    if (
      event.type === 'match.start' ||
      (event.type as string) === 'match.started' ||
      event.type === 'match.delete' ||
      (event.type as string) === 'match.deleted'
    ) {
      this.strongTurns.clear();
    }

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

      if (this.pendingStartColor) {
        const { action, source } = this.pendingStartColor;
        this.pendingStartColor = null;
        await this.applyPlayerColorNow(action, source);
      }
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
      // A new match: wait for its own state instead of using the previous one
      this.currentMatchState = null;
      this.pendingStartColor = null;
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
      this.pendingStartColor = null;
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

    // The timer ignores promises, so a failed WLED request is logged here
    // instead of becoming an unhandled rejection
    setTimeout(() => {
      this.applyPlayerColorWhenReady(action, source).catch((err) => {
        console.error(`🎨 WLED [${source}]: Applying player color failed:`, err);
      });
    }, delay);
  }

  private async applyPlayerColorWhenReady(action: WledAction, source: string): Promise<void> {
    if (this.currentMatchState) {
      await this.applyPlayerColorNow(action, source);
      return;
    }
    // Applied as soon as the first match state arrives
    console.log(`🎨 WLED [${source}]: Waiting for the first match state to apply the player color`);
    this.pendingStartColor = { action, source };
  }

  private async applyPlayerColorNow(action: WledAction, source: string): Promise<void> {
    const playerColor = await this.resolvePlayerColor({ source });
    if (playerColor) {
      console.log(`🎨 WLED [${source}]: Applying player color RGB(${playerColor.r}, ${playerColor.g}, ${playerColor.b})`);
      await this.executeAction(action, playerColor, source);
    }
  }

  /**
   * Schedule player color restore after an action duration
   */
  private schedulePlayerColorRestore(duration: number, eventType: string): void {
    console.log(`🎨 WLED [${eventType}]: Will restore to player color in ${duration}ms`);

    setTimeout(() => {
      this.restorePlayerColor(eventType).catch((err) => {
        console.error(`🎨 WLED [${eventType}]: Restoring player color failed:`, err);
      });
    }, duration);
  }

  private async restorePlayerColor(eventType: string): Promise<void> {
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
    const playerIdx = options.playerIndex ?? this.currentMatchState?.playerIndex ?? 0;
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
        this.log(`[${source}] Player service error: ${String(e)}`);
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
      const strongTurn = this.getStrongTurnAction(eventsConfig, eventData);
      if (strongTurn) return strongTurn;

      const eventKey = this.getThrowEventKey(eventData);
      const found = this.findActionByKey(eventsConfig, eventKey);
      if (found || (eventKey !== 'throw.180' && eventKey !== 'throw.bust')) return found;
      // Turn-level keys without an own action fall back to what the dart itself hit
      return this.findActionByKey(eventsConfig, this.getThrowEventKey({ ...eventData, turnPoints: 0, busted: false }));
    }

    // Map event type to canonical key
    const eventKey = this.getCanonicalEventKey(eventType);
    return eventKey ? this.findActionByKey(eventsConfig, eventKey) : null;
  }

  /**
   * Cricket "strong turn": once per turnId, when the running turn marks reach the
   * configured threshold, the cricket.marks action takes priority over the normal
   * throw action for that dart - but only if a cricket.marks action is configured.
   */
  private getStrongTurnAction(
    eventsConfig: Record<string, WledAction>,
    eventData: Record<string, unknown>,
  ): { action: WledAction; eventKey: string } | null {
    const game = eventData.game as { mode?: unknown } | undefined;
    if (!isCricketMode(game?.mode)) return null;

    const turnId = eventData.turnId;
    if (typeof turnId !== 'string' || !turnId) return null;
    if (this.strongTurns.has(turnId)) return null;

    const turnMarks = eventData.turnMarks;
    if (typeof turnMarks !== 'number' || turnMarks < this.getCricketMarksThreshold()) return null;

    const found = this.findActionByKey(eventsConfig, 'cricket.marks');
    if (!found) return null;

    this.strongTurns.add(turnId);
    return found;
  }

  /**
   * Cricket marks threshold from config, validated defensively (non-number or out of
   * range falls back to the default).
   */
  private getCricketMarksThreshold(): number {
    const value = this.config.cricketMarksThreshold;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < MIN_CRICKET_MARKS_THRESHOLD ||
      value > MAX_CRICKET_MARKS_THRESHOLD
    ) {
      return DEFAULT_CRICKET_MARKS_THRESHOLD;
    }
    return value;
  }

  /**
   * Determine the event key for throw events
   */
  private getThrowEventKey(eventData: Record<string, unknown>): string {
    const turnPoints = (eventData.turnPoints as number) || 0;
    const segment = eventData.segment as Record<string, unknown>;
    const multiplier = (segment?.multiplier as number) || 0;
    const number = (segment?.number as number) || 0;
    // Older payloads carry no points; derive them from the segment so a single hit is not a miss
    const points = typeof eventData.points === 'number' ? eventData.points : number * multiplier;
    // Cricket/Tactics have no 180 or bust concept the way X01 does: a triple 20 is a
    // triple regardless of turn total, and a "bust" throw still hit a real segment.
    const game = eventData.game as { mode?: unknown } | undefined;
    const cricket = isCricketMode(game?.mode);

    if (!cricket && turnPoints === 180) return 'throw.180';
    if (!cricket && eventData.busted) return 'throw.bust';
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
      'cricket.closed': 'cricket.closed',
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

    // Fade time in ms: action-specific, else global. Undefined leaves the device default untouched.
    const fadeTimeMs = action.fadeTime ?? this.config.fadeTime;

    switch (effectiveActionType) {
      case 'preset':
        payload = { ps: action.presetId || 1 };
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
        break;

      case 'brightness':
        payload = {
          on: true,
          bri: action.brightness ?? 255,
        };
        break;

      case 'off':
        payload = { on: false };
        break;
    }

    // tt applies to this call only; `transition` would change the device default for every later call.
    if (fadeTimeMs !== undefined) {
      payload.tt = toWledTransition(fadeTimeMs);
    }

    this.log(`Sending ${effectiveActionType} action for ${eventType}`, payload);
    console.log(`🎨 WLED [${eventType}]: Sending ${effectiveActionType} action${fadeTimeMs ? ` (fade: ${fadeTimeMs}ms)` : ''}`);

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
    const runTimed = async (timedAction: WledAction): Promise<void> => {
      await this.executeAction(timedAction, null, eventType);
      if (timedAction.duration && timedAction.duration > 0) {
        this.schedulePlayerColorRestore(timedAction.duration, eventType);
      }
    };

    switch (type) {
      case 'solidColor':
        await runTimed({
          actionType: 'solid',
          color: getColor(config.color, { r: 255, g: 0, b: 0 }),
          brightness: config.brightness as number ?? 255,
          duration: config.duration as number ?? 0,
        });
        break;

      case 'effect':
        await runTimed({
          actionType: 'effect',
          effectId: config.effectId as number ?? 0,
          speed: config.speed as number ?? 128,
          intensity: config.intensity as number ?? 128,
          color: config.color ? parseColor(config.color) : undefined,
          duration: config.duration as number ?? 2000,
        });
        break;

      case 'preset':
        await runTimed({
          actionType: 'preset',
          presetId: config.presetId as number ?? 1,
          duration: config.duration as number ?? 0,
        });
        break;

      case 'flash':
        await this.executeFlashAction(config, eventType);
        break;

      case 'rainbow':
        await runTimed({
          actionType: 'effect',
          effectId: 9,
          speed: config.speed as number ?? 200,
          intensity: 128,
          duration: config.duration as number ?? 3000,
        });
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
      // fadeTime 0: a global fade would smear the flash into a slow pulse
      await this.executeAction({ actionType: 'solid', color, brightness: 255, fadeTime: 0 }, null, `${eventType}.flash`);
      await new Promise(resolve => setTimeout(resolve, duration / 2));
      await this.executeAction({ actionType: 'off', fadeTime: 0 }, null, `${eventType}.off`);
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
