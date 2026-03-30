/**
 * Player Analytics Module
 *
 * Tracks player performance and provides AI-based training tips
 */

export {
  PlayerAnalyticsHandler,
  createPlayerAnalyticsHandler,
} from './PlayerAnalyticsHandler.js';

export { PlayerStore } from './PlayerStore.js';
export { EventMapper } from './EventMapper.js';
export { AITipsGenerator } from './AITipsGenerator.js';

// API Routes - can be registered by the core when module is loaded
export { registerAnalyticsRoutes } from './routes.js';
export type { AnalyticsDependencies } from './routes.js';

export type {
  PlayerAnalyticsConfig,
  Player,
  MatchData,
  GameData,
  LegData,
  TurnData,
  ThrowData,
  DartSegment,
  PlayerStatistics,
  SegmentStats,
  PlayerTrend,
  TrendDataPoint,
  TrainingTip,
  TipCategory,
  TrainingTipsRequest,
  TrainingTipsResponse,
} from './types.js';
