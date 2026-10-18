// ============================================
// IO-Darts-Agent - Type Definitions
// ============================================

// Auth Types
export interface AuthConfig {
  email: string;
  password: string;
  /** OAuth client id, defaults to the Autodarts web app client */
  clientId?: string;
  /** @deprecated Not used by the v1 auth service */
  clientSecret?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface DecodedToken {
  sub: string; // User ID
  exp: number;
  iat: number;
  [key: string]: unknown;
}

// Hub Config
export interface HubConfig {
  auth: AuthConfig;
  boardId: string;
  server?: {
    port: number;
    host: string;
  };
}

// WebSocket Message Types
export interface WSSubscribeMessage {
  type: 'subscribe';
  channel: string;
  topic: string;
}

export interface WSUnsubscribeMessage {
  type: 'unsubscribe';
  channel: string;
  topic: string;
}

export type WSOutgoingMessage = WSSubscribeMessage | WSUnsubscribeMessage;

// Autodarts Event Types
export interface AutodartsMessage {
  channel: string;
  topic: string;
  data: unknown;
}

// Board State Events
export interface BoardStateData {
  connected: boolean;
  event: BoardStateEvent;
  numThrows: number;
  status: BoardStatus;
}

export type BoardStateEvent =
  | 'Manual reset'
  | 'Starting'
  | 'Started'
  | 'Throw detected'
  | 'Takeout started'
  | 'Takeout finished'
  | 'Calibration started'
  | 'Calibration finished'
  | 'Stopped';

export type BoardStatus =
  | 'Stopped'
  | 'Starting'
  | 'Throw'
  | 'Takeout'
  | 'Takeout in progress';

// Match Events
export interface MatchStartData {
  event: 'start';
  id: string;
}

export interface MatchDeleteData {
  event: 'delete';
  id: string;
}

export interface MatchFinishData {
  event: 'finish';
  id: string;
}

export type MatchEventData = MatchStartData | MatchDeleteData | MatchFinishData;

// Throw Events
export interface ThrowCoords {
  x: number;
  y: number;
}

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

export interface ThrowData {
  coords?: ThrowCoords;
  segment: ThrowSegment;
}

export interface BoardEventData {
  boardId: string;
  event: string;
  throw: ThrowData;
  throwNumber?: number;
}

// Match State
export interface MatchPlayer {
  id: string;
  index: number;
  name: string;
  boardId: string;
  userId: string | null;
  refereeState?: string;
  avatarUrl?: string;
  host?: boolean;
}

export interface MatchSettings {
  baseScore: number;
  bullMode: string;
  inMode: string;
  maxRounds: number;
  outMode: string;
}

export interface MatchThrow {
  coords?: ThrowCoords;
  createdAt: string;
  detection?: {
    CalibrationID: string;
    ClientVersion: string;
    ConfigID: string;
    DistortionID: string | null;
    ID: string;
  };
  entry: 'detected' | 'manual_keyboard';
  id: string;
  marks: unknown; // null when absent
  segment: ThrowSegment;
  throw: number;
  bouncer?: boolean;
}

export interface MatchTurn {
  busted: boolean;
  createdAt: string;
  finishedAt: string;
  id: string;
  marks: unknown; // null when absent
  playerId: string;
  points: number;
  round: number;
  score: number;
  throws: MatchThrow[];
  turn: number;
}

export interface MatchStats {
  average: number;
  averageUntil170: number;
  checkoutPercent: number;
  checkoutPoints: number;
  checkoutPointsAverage: number;
  checkouts: number;
  checkoutsHit: number;
  dartsThrown: number;
  dartsUntil170: number;
  first9Average: number;
  first9Score: number;
  less60: number;
  plus60: number;
  plus100: number;
  plus140: number;
  plus170: number;
  score: number;
  scoreUntil170: number;
  total180: number;
}

export interface ChalkboardRow {
  isPointsStruck?: boolean;
  isScoreStruck?: boolean;
  points: number;
  round: number;
  score: number;
}

export interface Chalkboard {
  rows: ChalkboardRow[];
}

/**
 * Variant specific game state. For Cricket, segments maps each field
 * ("15".."20", "25" for Bull) to the marks per player array position.
 */
export interface MatchGameState {
  segments?: Record<string, number[]>;
}

export interface MatchStateData {
  id: string;
  createdAt: string;
  finished: boolean;
  gameFinished: boolean;
  gameWinner: number | null;
  hasReferee: boolean;
  leg: number;
  set: number;
  legs: number; // Number of legs to win (match configuration)
  sets: number; // Number of sets to win (match configuration)
  round: number;
  type: string;
  variant: string;
  winner: number | null;
  settings: MatchSettings;
  state?: MatchGameState | string | null;
  scores: number[];
  chalkboards: Chalkboard[];
  gameScores: number[];
  stats: {
    legStats: MatchStats[];
    matchStats: MatchStats[];
    setStats?: MatchStats[];
  };
  turnBusted: boolean;
  turnScore: number;
  turns: MatchTurn[];
  player: number;
  players: MatchPlayer[];
  host: unknown;
}

// Parsed Events for EventBus
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
  | 'raw';

export interface ParsedEvent<T = unknown> {
  type: AutodartsEventType;
  timestamp: Date;
  raw: AutodartsMessage;
  data: T;
}

// Specific Parsed Events
export interface ThrowDetectedEvent extends ParsedEvent<{
  segment: ThrowSegment;
  coords?: ThrowCoords;
  throwNumber: number;
  boardId: string;
}> {
  type: 'throw.detected';
}

export interface MatchStartEvent extends ParsedEvent<{
  matchId: string;
  boardId: string;
}> {
  type: 'match.start';
}

export interface MatchStateEvent extends ParsedEvent<{
  matchId: string;
  player: number;
  playerName: string;
  gameScores: number[];
  turnScore: number;
  round: number;
  finished: boolean;
  winner: number | null;
  variant?: string;
  segments?: Record<string, number[]> | null;
}> {
  type: 'match.state';
}

export interface PlayerChangeEvent extends ParsedEvent<{
  previousPlayer: number;
  currentPlayer: number;
  playerName: string;
}> {
  type: 'player.change';
}

export interface TurnFinishedEvent extends ParsedEvent<{
  matchId: string;
  playerIndex: number;
  playerName: string;
  turnScore: number;
  turnPoints: number;
  remaining: number;
  busted: boolean;
  round: number;
}> {
  type: 'turn.finished';
}

export interface MatchResultPlayerStats {
  legStats: MatchStats;
  matchStats: MatchStats;
  setStats?: MatchStats;
}

export interface MatchResultScore {
  legs: number;
  sets: number;
}

export interface MatchResultData {
  matchId: string;
  winner: number;
  winnerName: string;
  /** Stable player.index of the winner */
  winnerPlayerIndex: number | null;
  variant: string;
  type: string;
  leg: number;
  set: number;
  round: number;
  players: Array<{
    index: number;
    name: string;
    userId: string | null;
  }>;
  scores: MatchResultScore[];
  chalkboards: Chalkboard[];
  stats: MatchResultPlayerStats[];
  settings: MatchSettings;
}

export interface MatchResultEvent extends ParsedEvent<MatchResultData> {
  type: 'match.result';
}

// EventBus Types
export type EventHandler<T = unknown> = (event: ParsedEvent<T>) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

// Re-export module types
export * from './modules.js';

// Re-export API types
export * from './api.js';

// Re-export player types
export * from './player.js';

// Re-export i18n types
export * from './i18n.js';

// Re-export intent types
export * from './intents.js';
