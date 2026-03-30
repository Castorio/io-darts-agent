/**
 * Player Analytics Module - Type Definitions
 */

// ============================================================================
// Configuration
// ============================================================================

export interface PlayerAnalyticsConfig {
  dataRetentionDays: number;
  aiProvider: 'none' | 'openai' | 'anthropic' | 'ollama';
  aiApiKey?: string;
  ollamaHost?: string;
  ollamaModel?: string;
  trackAllPlayers: boolean;
  generateTipsAfterMatch: boolean;
  minMatchesForTips: number;
}

// ============================================================================
// Player Data Model
// ============================================================================

export interface Player {
  id: string;
  name: string;
  autodartsId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThrowData {
  id: string;
  matchId: string;
  playerId: string;
  turnIndex: number;
  throwIndex: number; // 1-3 within turn
  segment: DartSegment;
  score: number;
  multiplier: 1 | 2 | 3;
  remainingScore: number;
  timestamp: Date;
  isCheckoutAttempt: boolean;
  isSuccessfulCheckout: boolean;
}

export interface DartSegment {
  number: number; // 0-20 (0 = bull)
  bed: 'single' | 'double' | 'triple' | 'outer-bull' | 'inner-bull' | 'miss';
}

export interface TurnData {
  id: string;
  matchId: string;
  playerId: string;
  turnIndex: number;
  throws: ThrowData[];
  totalScore: number;
  startingScore: number;
  endingScore: number;
  isBust: boolean;
  isCheckout: boolean;
  timestamp: Date;
}

export interface LegData {
  id: string;
  matchId: string;
  gameIndex: number;
  legIndex: number;
  winnerId?: string;
  turns: TurnData[];
  startingScore: number;
  dartsThrown: number;
  timestamp: Date;
  endedAt?: Date;
}

export interface GameData {
  id: string;
  matchId: string;
  gameIndex: number;
  gameType: string;
  legs: LegData[];
  winnerId?: string;
  timestamp: Date;
  endedAt?: Date;
}

export interface MatchData {
  id: string;
  autodartsMatchId: string;
  players: MatchPlayer[];
  games: GameData[];
  gameType: string;
  startingScore: number;
  winnerId?: string;
  timestamp: Date;
  endedAt?: Date;
  isAborted: boolean;
}

export interface MatchPlayer {
  playerId: string;
  playerName: string;
  autodartsId?: string;
  position: number;
}

// ============================================================================
// Statistics
// ============================================================================

export interface PlayerStatistics {
  playerId: string;
  playerName: string;

  // Overall stats
  totalMatches: number;
  totalGames: number;
  totalLegs: number;
  totalTurns: number;
  totalDartsThrown: number;

  // Win rates
  matchesWon: number;
  gamesWon: number;
  legsWon: number;
  matchWinRate: number;
  gameWinRate: number;
  legWinRate: number;

  // Scoring
  totalScore: number;
  averagePerDart: number;
  averagePerTurn: number; // 3-dart average
  highestTurnScore: number;
  highestCheckout: number;

  // Accuracy
  singlesHit: number;
  doublesHit: number;
  triplesHit: number;
  bullsHit: number;
  misses: number;

  doublesAttempted: number;
  triplesAttempted: number;
  checkoutAttempts: number;
  successfulCheckouts: number;

  doublesHitRate: number;
  triplesHitRate: number;
  checkoutRate: number;

  // Segment analysis
  segmentAccuracy: Map<number, SegmentStats>;

  // Time-based
  averageDartsPerLeg: number;
  fastestLeg: number; // darts thrown

  // Special scores
  count180s: number;
  count140Plus: number;
  count100Plus: number;
  count60Plus: number;

  // Period
  periodStart: Date;
  periodEnd: Date;
  lastUpdated: Date;
}

export interface SegmentStats {
  segment: number;
  attempts: number;
  singleHits: number;
  doubleHits: number;
  tripleHits: number;
  totalScore: number;
  accuracy: number;
}

export interface PlayerTrend {
  playerId: string;
  period: 'daily' | 'weekly' | 'monthly';
  dataPoints: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: Date;
  averagePerTurn: number;
  checkoutRate: number;
  matchesPlayed: number;
  matchesWon: number;
}

// ============================================================================
// Training Tips
// ============================================================================

export interface TrainingTip {
  id: string;
  playerId: string;
  category: TipCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  practiceExercise?: string;
  basedOnData: string; // Description of what data led to this tip
  generatedAt: Date;
  acknowledged: boolean;
}

export type TipCategory =
  | 'doubles'
  | 'triples'
  | 'checkout'
  | 'consistency'
  | 'high-scoring'
  | 'mental'
  | 'technique'
  | 'segment-focus';

export interface TrainingTipsRequest {
  playerId: string;
  focusArea?: TipCategory;
  recentMatchesOnly?: boolean;
}

export interface TrainingTipsResponse {
  playerId: string;
  tips: TrainingTip[];
  generatedAt: Date;
  basedOnMatches: number;
  periodAnalyzed: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// Event Data (from Autodarts)
// ============================================================================

export interface AutodartsMatchStartData {
  id: string;
  variant: string;
  players: Array<{
    id?: string;
    name: string;
    boardId?: string;
  }>;
  settings?: {
    baseScore?: number;
    legs?: number;
    sets?: number;
  };
}

export interface AutodartsThrowData {
  matchId: string;
  playerId?: string;
  playerName?: string;
  playerIndex: number;
  segment: {
    number: number;
    bed: string;
  };
  score: number;
  multiplier: number;
  remaining: number;
  turnScore: number;
  turnThrows: number;
}

export interface AutodartsTurnEndData {
  matchId: string;
  playerId?: string;
  playerName?: string;
  playerIndex: number;
  turnScore: number;
  remaining: number;
  isBust: boolean;
  dartsThrown: number;
}

export interface AutodartsGameEndData {
  matchId: string;
  winnerId?: string;
  winnerName?: string;
  winnerIndex: number;
  gameIndex: number;
}

export interface AutodartsMatchEndData {
  matchId: string;
  winnerId?: string;
  winnerName?: string;
  winnerIndex?: number;
  isAborted: boolean;
}

// ============================================================================
// Storage
// ============================================================================

export interface PlayerAnalyticsStore {
  players: Map<string, Player>;
  matches: Map<string, MatchData>;
  statistics: Map<string, PlayerStatistics>;
  tips: Map<string, TrainingTip[]>;
  trends: Map<string, PlayerTrend[]>;
}

export interface StorageMetadata {
  version: string;
  lastSaved: Date;
  totalPlayers: number;
  totalMatches: number;
}
