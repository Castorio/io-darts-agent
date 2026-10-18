/**
 * Type definitions imported from the main hub
 * These are the types needed by the darts-caller module
 */

// Throw segment information
export interface ThrowSegment {
  bed: SegmentBed;
  multiplier: number;
  name: string;
  number: number;
}

export type SegmentBed =
  | 'SingleInner'
  | 'SingleOuter'
  | 'Single'
  | 'Double'
  | 'Triple'
  | 'Bull'
  | 'DoubleBull'
  | 'Outside'
  | '';

export interface ThrowCoords {
  x: number;
  y: number;
}

// Match throw data
export interface MatchThrow {
  coords?: ThrowCoords;
  segment: ThrowSegment;
  throw: number;
}

// Autodarts event types
export type AutodartsEventType =
  | 'board.state'
  | 'board.event'
  | 'match.start'
  | 'match.delete'
  | 'match.finish'
  | 'match.state'
  | 'match.result'
  | 'throw.detected'
  | 'takeout.started'
  | 'takeout.finished'
  | 'player.change'
  | 'turn.finished'
  | 'game.finished'
  | 'match.finished'
  | 'cricket.state'
  | 'cricket.closed'
  | 'raw';

// WebSocket message from Autodarts
export interface AutodartsMessage {
  channel: string;
  topic: string;
  data: unknown;
}

// Parsed event structure
export interface ParsedEvent<T = unknown> {
  type: AutodartsEventType;
  timestamp: Date;
  raw: AutodartsMessage;
  data: T;
}

// Turn finished event data
export interface TurnFinishedData {
  matchId?: string;
  playerIndex?: number;
  playerName?: string;
  turnScore?: number;
  turnPoints?: number;
  remaining?: number;
  busted?: boolean;
  round?: number;
  throws?: MatchThrow[];
}

// Player change event data
export interface PlayerChangeData {
  previousPlayer?: number;
  currentPlayer?: number;
  playerName?: string;
  remaining?: number;
}

// Match event data
export interface MatchEventData {
  matchId?: string;
  winner?: {
    name?: string;
    index?: number;
  };
}

// Game finished event data
export interface GameFinishedData {
  winner?: {
    name?: string;
    index?: number;
  };
}
