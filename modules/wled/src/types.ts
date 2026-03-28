/**
 * WLED Module Types
 */

import type { WledColor } from './WledClient.js';
export type { WledColor } from './WledClient.js';

export type EventActionType = 'preset' | 'effect' | 'solid' | 'brightness' | 'playerColor' | 'off' | 'none';

export interface EventAction {
  enabled: boolean;
  actionType: EventActionType;
  presetId: number;
  effectId: number;
  color: WledColor;
  color2: WledColor;
  color3: WledColor;
  speed: number;
  intensity: number;
  duration: number;
  brightness: number;
}

export interface EventActionsConfig {
  matchStart: EventAction;
  matchFinished: EventAction;
  gameFinished: EventAction;
  throwHit: EventAction;
  throwMiss: EventAction;
  throwHighlight: EventAction;
  throw180: EventAction;
  throwBust: EventAction;
  playerChange: EventAction;
  takeoutStarted: EventAction;
  takeoutFinished: EventAction;
}

export interface WledModuleConfig {
  // Connection
  wledHost: string;
  wledPort: number;
  autoReconnect: boolean;
  reconnectInterval: number;
  normalBrightness: number;

  // Event Actions
  eventActions: EventActionsConfig;

  // Player Colors
  playerColors: WledColor[];
}

export const DEFAULT_EVENT_ACTION: EventAction = {
  enabled: true,
  actionType: 'solid',
  presetId: 1,
  effectId: 0,
  color: { r: 255, g: 255, b: 255 },
  color2: { r: 0, g: 0, b: 0 },
  color3: { r: 0, g: 0, b: 0 },
  speed: 128,
  intensity: 128,
  duration: 0,
  brightness: 255,
};

export const DEFAULT_EVENT_ACTIONS: EventActionsConfig = {
  matchStart: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'preset',
    presetId: 1,
  },
  matchFinished: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'effect',
    effectId: 82,
    color: { r: 255, g: 215, b: 0 },
    duration: 5000,
  },
  gameFinished: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'effect',
    effectId: 53,
    color: { r: 0, g: 255, b: 128 },
    duration: 3000,
  },
  throwHit: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'solid',
    color: { r: 0, g: 255, b: 0 },
    duration: 300,
  },
  throwMiss: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'solid',
    color: { r: 255, g: 0, b: 0 },
    duration: 300,
  },
  throwHighlight: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'effect',
    effectId: 9,
    color: { r: 255, g: 0, b: 255 },
    duration: 1000,
  },
  throw180: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'effect',
    effectId: 83,
    color: { r: 255, g: 215, b: 0 },
    duration: 4000,
  },
  throwBust: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'effect',
    effectId: 23,
    color: { r: 255, g: 0, b: 0 },
    duration: 1000,
  },
  playerChange: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'playerColor',
  },
  takeoutStarted: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'brightness',
    brightness: 50,
  },
  takeoutFinished: {
    ...DEFAULT_EVENT_ACTION,
    actionType: 'brightness',
    brightness: 255,
  },
};

export const DEFAULT_PLAYER_COLORS: WledColor[] = [
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 128, g: 0, b: 128 },
  { r: 255, g: 165, b: 0 },
];
