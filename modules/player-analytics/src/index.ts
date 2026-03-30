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
