// API Types for Player Analytics Frontend

export interface Player {
  id: string
  name: string
  autodartsId?: string
  createdAt: string
  updatedAt: string
}

export interface PlayerStatistics {
  playerId: string
  playerName: string

  // Overall stats
  totalMatches: number
  totalGames: number
  totalLegs: number
  totalTurns: number
  totalDartsThrown: number

  // Win rates
  matchesWon: number
  gamesWon: number
  legsWon: number
  matchWinRate: number
  gameWinRate: number
  legWinRate: number

  // Scoring
  totalScore: number
  averagePerDart: number
  averagePerTurn: number
  highestTurnScore: number
  highestCheckout: number

  // Accuracy
  singlesHit: number
  doublesHit: number
  triplesHit: number
  bullsHit: number
  misses: number

  doublesAttempted: number
  triplesAttempted: number
  checkoutAttempts: number
  successfulCheckouts: number

  doublesHitRate: number
  triplesHitRate: number
  checkoutRate: number

  // Special scores
  count180s: number
  count140Plus: number
  count100Plus: number
  count60Plus: number

  // Efficiency
  averageDartsPerLeg: number
  fastestLeg: number

  // Period
  periodStart: string
  periodEnd: string
  lastUpdated: string
}

export interface TrainingTip {
  id: string
  playerId: string
  category: TipCategory
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  practiceExercise?: string
  basedOnData: string
  generatedAt: string
  acknowledged: boolean
}

export type TipCategory =
  | 'doubles'
  | 'triples'
  | 'checkout'
  | 'consistency'
  | 'high-scoring'
  | 'mental'
  | 'technique'
  | 'segment-focus'

export interface TrendDataPoint {
  date: string
  averagePerTurn: number
  checkoutRate: number
  matchesPlayed: number
  matchesWon: number
}

export interface PlayerTrend {
  playerId: string
  period: 'daily' | 'weekly' | 'monthly'
  dataPoints: TrendDataPoint[]
}

export interface MatchSummary {
  id: string
  autodartsMatchId: string
  players: MatchPlayer[]
  gameType: string
  startingScore: number
  winnerId?: string
  timestamp: string
  endedAt?: string
  isAborted: boolean
}

export interface MatchPlayer {
  playerId: string
  playerName: string
  position: number
}

export interface AnalyticsConfig {
  dataRetentionDays: number
  aiProvider: 'none' | 'openai' | 'anthropic' | 'ollama'
  trackAllPlayers: boolean
  generateTipsAfterMatch: boolean
  minMatchesForTips: number
}

export interface GenerateTipsRequest {
  focusArea?: TipCategory
}

export interface GenerateTipsResponse {
  success: boolean
  tips?: TrainingTip[]
  error?: string
}
