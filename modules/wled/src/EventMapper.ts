/**
 * Event Mapper - Maps Autodarts events to WLED actions
 */

import { WledClient } from './WledClient.js';
import type { WledColor } from './WledClient.js';
import type { ParsedEvent, ThrowData } from '@autodarts-hub/module-sdk';
import {
  type EventAction,
  type EventActionsConfig,
  type WledModuleConfig,
  DEFAULT_EVENT_ACTIONS,
  DEFAULT_PLAYER_COLORS,
} from './types.js';

export type WledActionType =
  | 'preset'
  | 'color'
  | 'effect'
  | 'flash'
  | 'solid'
  | 'off'
  | 'brightness'
  | 'playerColor'
  | 'none';

export interface WledAction {
  type: WledActionType;
  preset?: number;
  color?: WledColor;
  colors?: WledColor[];
  effect?: number;
  speed?: number;
  intensity?: number;
  brightness?: number;
  duration?: number;
  transition?: number;
  playerIndex?: number;
}

export interface ThrowCategory {
  type: 'miss' | 'single' | 'double' | 'triple' | 'bull' | 'doubleBull' | 'outside';
  score: number;
  isHighlight: boolean;
  is180: boolean;
  isBust: boolean;
}

/**
 * EventMapper - Maps Autodarts events to WLED actions using configurable event actions
 */
export class EventMapper {
  private eventActions: EventActionsConfig;
  private playerColors: WledColor[];
  // Stored for potential future use in brightness restoration
  // private _normalBrightness: number;
  private currentPlayer = 0;
  private turnThrows: ThrowCategory[] = [];
  private turnScore = 0;
  private inMatch = false;
  private lastTurnBusted = false;

  constructor(config?: Partial<WledModuleConfig>) {
    this.eventActions = config?.eventActions ?? { ...DEFAULT_EVENT_ACTIONS };
    this.playerColors = config?.playerColors ?? [...DEFAULT_PLAYER_COLORS];
    // Stored for potential future use in brightness restoration
    // this._normalBrightness = config?.normalBrightness ?? 255;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WledModuleConfig>): void {
    if (config.eventActions) {
      this.eventActions = { ...this.eventActions, ...config.eventActions };
    }
    if (config.playerColors) {
      this.playerColors = config.playerColors;
    }
    // Stored for potential future use in brightness restoration
    // if (config.normalBrightness !== undefined) {
    //   this._normalBrightness = config.normalBrightness;
    // }
  }

  /**
   * Get current event actions config
   */
  getEventActions(): EventActionsConfig {
    return { ...this.eventActions };
  }

  /**
   * Get player colors
   */
  getPlayerColors(): WledColor[] {
    return [...this.playerColors];
  }

  /**
   * Convert EventAction to WledAction
   */
  private eventActionToWledAction(eventAction: EventAction, playerIndex?: number): WledAction | null {
    if (!eventAction.enabled) {
      return null;
    }

    const baseAction: WledAction = {
      type: eventAction.actionType as WledActionType,
      color: eventAction.color,
      colors: [eventAction.color, eventAction.color2, eventAction.color3],
      preset: eventAction.presetId,
      effect: eventAction.effectId,
      speed: eventAction.speed,
      intensity: eventAction.intensity,
      brightness: eventAction.brightness,
      duration: eventAction.duration > 0 ? eventAction.duration : undefined,
      playerIndex,
    };

    return baseAction;
  }

  /**
   * Map an Autodarts event to WLED action(s)
   */
  mapEvent(event: ParsedEvent): WledAction[] {
    const actions: WledAction[] = [];

    switch (event.type) {
      case 'match.start':
        this.handleMatchStart();
        const matchStartAction = this.eventActionToWledAction(this.eventActions.matchStart);
        if (matchStartAction) actions.push(matchStartAction);
        break;

      case 'match.delete':
      case 'match.finished':
        if (this.inMatch) {
          const matchFinishedAction = this.eventActionToWledAction(this.eventActions.matchFinished);
          if (matchFinishedAction) actions.push(matchFinishedAction);
        }
        this.handleMatchEnd();
        break;

      case 'throw.detected':
        const throwData = event.data as ThrowData;
        const category = this.categorizeThrow(throwData);
        this.turnThrows.push(category);
        this.turnScore += category.score;

        const throwActions = this.mapThrow(category);
        actions.push(...throwActions);
        break;

      case 'player.change':
        const playerData = event.data as { currentPlayer: number; previousPlayer?: number };

        // Check if previous turn was busted
        if (this.lastTurnBusted) {
          const bustAction = this.eventActionToWledAction(this.eventActions.throwBust);
          if (bustAction) actions.push(bustAction);
          this.lastTurnBusted = false;
        }

        this.currentPlayer = playerData.currentPlayer;
        this.turnThrows = [];
        this.turnScore = 0;

        const playerChangeAction = this.eventActionToWledAction(
          this.eventActions.playerChange,
          this.currentPlayer
        );
        if (playerChangeAction) actions.push(playerChangeAction);
        break;

      case 'turn.finished':
        const turnData = event.data as { busted?: boolean; score?: number };

        // Check for 180
        if (this.is180()) {
          const action180 = this.eventActionToWledAction(this.eventActions.throw180);
          if (action180) actions.push(action180);
        }

        // Track bust for next player change
        if (turnData?.busted) {
          this.lastTurnBusted = true;
        }

        this.turnThrows = [];
        this.turnScore = 0;
        break;

      case 'takeout.started':
        const takeoutStartAction = this.eventActionToWledAction(this.eventActions.takeoutStarted);
        if (takeoutStartAction) actions.push(takeoutStartAction);
        break;

      case 'takeout.finished':
        const takeoutFinishAction = this.eventActionToWledAction(this.eventActions.takeoutFinished);
        if (takeoutFinishAction) actions.push(takeoutFinishAction);
        break;

      case 'game.finished':
        const gameFinishedAction = this.eventActionToWledAction(this.eventActions.gameFinished);
        if (gameFinishedAction) actions.push(gameFinishedAction);
        break;
    }

    return actions;
  }

  /**
   * Categorize a throw
   */
  private categorizeThrow(throwData: ThrowData): ThrowCategory {
    const segment = throwData.segment;
    const bed = segment.bed;
    const number = segment.number;
    const multiplier = segment.multiplier;
    const score = number * multiplier;

    let type: ThrowCategory['type'] = 'single';
    let isHighlight = false;

    switch (bed) {
      case 'Outside':
      case '':
        type = 'outside';
        break;
      case 'DoubleBull':
        type = 'doubleBull';
        isHighlight = true;
        break;
      case 'Bull':
        type = 'bull';
        isHighlight = true;
        break;
      case 'Triple':
        type = 'triple';
        isHighlight = number === 20 || number === 19 || number === 18;
        break;
      case 'Double':
        type = 'double';
        isHighlight = number === 20;
        break;
      default:
        type = multiplier === 0 ? 'miss' : 'single';
    }

    return {
      type,
      score,
      isHighlight,
      is180: false,
      isBust: false,
    };
  }

  /**
   * Map a throw category to WLED actions
   */
  private mapThrow(category: ThrowCategory): WledAction[] {
    const actions: WledAction[] = [];

    if (category.type === 'outside' || category.type === 'miss') {
      const missAction = this.eventActionToWledAction(this.eventActions.throwMiss);
      if (missAction) actions.push(missAction);
    } else if (category.isHighlight) {
      const highlightAction = this.eventActionToWledAction(this.eventActions.throwHighlight);
      if (highlightAction) actions.push(highlightAction);
    } else {
      const hitAction = this.eventActionToWledAction(this.eventActions.throwHit);
      if (hitAction) actions.push(hitAction);
    }

    return actions;
  }

  /**
   * Check if current turn is a 180
   */
  private is180(): boolean {
    if (this.turnThrows.length !== 3) return false;
    const totalScore = this.turnThrows.reduce((sum, t) => sum + t.score, 0);
    return totalScore === 180;
  }

  /**
   * Get player color
   */
  getPlayerColor(playerIndex: number): WledColor {
    return this.playerColors[playerIndex % this.playerColors.length];
  }

  /**
   * Handle match start
   */
  private handleMatchStart(): void {
    this.inMatch = true;
    this.currentPlayer = 0;
    this.turnThrows = [];
    this.turnScore = 0;
    this.lastTurnBusted = false;
  }

  /**
   * Handle match end
   */
  private handleMatchEnd(): void {
    this.inMatch = false;
    this.currentPlayer = 0;
    this.turnThrows = [];
    this.turnScore = 0;
    this.lastTurnBusted = false;
  }

  /**
   * Check if currently in a match
   */
  isInMatch(): boolean {
    return this.inMatch;
  }

  /**
   * Get current player index
   */
  getCurrentPlayer(): number {
    return this.currentPlayer;
  }
}

/**
 * Execute WLED actions
 */
export class WledActionExecutor {
  private client: WledClient;
  private actionQueue: Promise<void> = Promise.resolve();
  private playerColors: WledColor[];
  private normalBrightness: number;
  // Stored for potential future use in state restoration
  // private _lastState: { colors?: WledColor[]; brightness?: number } = {};

  constructor(client: WledClient, playerColors?: WledColor[], normalBrightness?: number) {
    this.client = client;
    this.playerColors = playerColors ?? DEFAULT_PLAYER_COLORS;
    this.normalBrightness = normalBrightness ?? 255;
  }

  /**
   * Update player colors
   */
  setPlayerColors(colors: WledColor[]): void {
    this.playerColors = colors;
  }

  /**
   * Update normal brightness
   */
  setNormalBrightness(brightness: number): void {
    this.normalBrightness = brightness;
  }

  /**
   * Execute a single action
   */
  async execute(action: WledAction): Promise<void> {
    this.actionQueue = this.actionQueue.then(async () => {
      await this.executeAction(action);
    }).catch(() => {
      // Continue with next action even if one fails
    });

    return this.actionQueue;
  }

  /**
   * Execute multiple actions
   */
  async executeAll(actions: WledAction[]): Promise<void> {
    for (const action of actions) {
      await this.execute(action);
    }
  }

  /**
   * Execute a test action (for UI testing)
   */
  async executeTest(action: WledAction): Promise<void> {
    await this.executeAction(action);
  }

  /**
   * Internal action execution
   */
  private async executeAction(action: WledAction): Promise<void> {
    if (action.transition !== undefined) {
      await this.client.setTransition(action.transition);
    }

    switch (action.type) {
      case 'preset':
        if (action.preset !== undefined) {
          await this.client.loadPreset(action.preset);
        }
        break;

      case 'solid':
      case 'color':
        if (action.color) {
          await this.client.setColor(action.color);
          if (action.duration && action.duration > 0) {
            await new Promise((r) => setTimeout(r, action.duration));
            // Restore to normal brightness after flash
            await this.client.setBrightness(this.normalBrightness);
          }
        }
        break;

      case 'effect':
        if (action.effect !== undefined) {
          const colors = action.colors ?? (action.color ? [action.color] : undefined);
          await this.client.setState({
            seg: [{
              fx: action.effect,
              sx: action.speed,
              ix: action.intensity,
              col: colors?.map(c => [c.r, c.g, c.b]) as [number, number, number][],
            }],
          });

          if (action.duration && action.duration > 0) {
            await new Promise((r) => setTimeout(r, action.duration));
          }
        }
        break;

      case 'flash':
        if (action.color) {
          await this.client.flash(action.color, action.duration ?? 500);
        }
        break;

      case 'brightness':
        if (action.brightness !== undefined) {
          await this.client.setBrightness(action.brightness);
        }
        break;

      case 'playerColor':
        const playerIndex = action.playerIndex ?? 0;
        const playerColor = this.playerColors[playerIndex % this.playerColors.length];
        await this.client.setColor(playerColor);
        break;

      case 'off':
        await this.client.turnOff();
        break;

      case 'none':
        // Do nothing
        break;
    }
  }

  /**
   * Get WLED client for direct access
   */
  getClient(): WledClient {
    return this.client;
  }
}

// Re-export for backwards compatibility
export { DEFAULT_EVENT_ACTIONS, DEFAULT_PLAYER_COLORS } from './types.js';
export type { EventAction, EventActionsConfig, WledModuleConfig } from './types.js';
