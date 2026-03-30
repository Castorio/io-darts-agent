/**
 * Player Analytics API Routes
 *
 * Provides endpoints for accessing player statistics, match history,
 * and AI-generated training tips.
 *
 * These routes are registered by the module itself, not by the core.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PlayerAnalyticsHandler } from './PlayerAnalyticsHandler.js';
import type { PlayerStatistics, PlayerTrend, TipCategory, MatchData, TrainingTip } from './types.js';

/**
 * Analytics route dependencies
 */
export interface AnalyticsDependencies {
  getAnalyticsHandler: () => PlayerAnalyticsHandler | null;
}

/**
 * Player summary for list view
 */
interface PlayerSummary {
  id: string;
  name: string;
  autodartsId?: string;
  matchCount: number;
  lastPlayed?: string;
  average?: number;
}

/**
 * Player detail response
 */
interface PlayerDetailResponse {
  id: string;
  name: string;
  autodartsId?: string;
  statistics: PlayerStatistics | null;
  recentMatches: MatchData[];
  tips: TrainingTip[];
}

/**
 * Trends response
 */
interface TrendsResponse {
  playerId: string;
  period: 'daily' | 'weekly' | 'monthly';
  trends: PlayerTrend;
}

/**
 * Generate tips request body
 */
interface GenerateTipsBody {
  focusArea?: TipCategory;
}

/**
 * Register analytics routes
 */
export function registerAnalyticsRoutes(
  fastify: FastifyInstance,
  deps: AnalyticsDependencies
): void {
  // Helper to get handler or return 503
  const getHandler = (reply: FastifyReply): PlayerAnalyticsHandler | null => {
    const handler = deps.getAnalyticsHandler();
    if (!handler) {
      reply.status(503).send({
        error: 'Player Analytics module not available',
        message: 'The module is not installed or not running',
      });
      return null;
    }
    return handler;
  };

  // ==========================================================================
  // Players Endpoints
  // ==========================================================================

  /**
   * GET /api/analytics/players
   * List all tracked players with summary stats
   */
  fastify.get('/api/analytics/players', async (_request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const players = handler.getAllPlayers();
    const summaries: PlayerSummary[] = players.map((player) => {
      const stats = handler.getPlayerStatistics(player.id);
      const matches = handler.getPlayerMatches(player.id, 1);

      return {
        id: player.id,
        name: player.name,
        autodartsId: player.autodartsId,
        matchCount: stats?.totalMatches ?? 0,
        lastPlayed: matches[0]?.timestamp?.toISOString(),
        average: stats?.averagePerTurn,
      };
    });

    // Sort by match count (most active first)
    summaries.sort((a, b) => b.matchCount - a.matchCount);

    return reply.send({
      players: summaries,
      total: summaries.length,
    });
  });

  /**
   * GET /api/analytics/players/:playerId
   * Get detailed player information
   */
  fastify.get<{
    Params: { playerId: string };
    Querystring: { recentMatches?: string };
  }>('/api/analytics/players/:playerId', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId } = request.params;
    const recentMatchCount = parseInt(request.query.recentMatches || '10', 10);

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    const response: PlayerDetailResponse = {
      id: player.id,
      name: player.name,
      autodartsId: player.autodartsId,
      statistics: handler.getPlayerStatistics(playerId) ?? null,
      recentMatches: handler.getPlayerMatches(playerId, recentMatchCount),
      tips: handler.getPlayerTips(playerId),
    };

    return reply.send(response);
  });

  // ==========================================================================
  // Statistics Endpoints
  // ==========================================================================

  /**
   * GET /api/analytics/players/:playerId/statistics
   * Get player statistics
   */
  fastify.get<{
    Params: { playerId: string };
    Querystring: { recalculate?: string };
  }>('/api/analytics/players/:playerId/statistics', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId } = request.params;
    const recalculate = request.query.recalculate === 'true';

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    const statistics = recalculate
      ? handler.calculatePlayerStatistics(playerId)
      : handler.getPlayerStatistics(playerId);

    if (!statistics) {
      return reply.status(404).send({
        error: 'No statistics available',
        playerId,
      });
    }

    return reply.send(statistics);
  });

  /**
   * GET /api/analytics/players/:playerId/trends
   * Get player trends over time
   */
  fastify.get<{
    Params: { playerId: string };
    Querystring: { period?: 'daily' | 'weekly' | 'monthly' };
  }>('/api/analytics/players/:playerId/trends', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId } = request.params;
    const period = request.query.period || 'weekly';

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    const trends = handler.getPlayerTrends(playerId, period);

    const response: TrendsResponse = {
      playerId,
      period,
      trends,
    };

    return reply.send(response);
  });

  // ==========================================================================
  // Match History Endpoints
  // ==========================================================================

  /**
   * GET /api/analytics/players/:playerId/matches
   * Get player match history
   */
  fastify.get<{
    Params: { playerId: string };
    Querystring: { limit?: string; offset?: string };
  }>('/api/analytics/players/:playerId/matches', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId } = request.params;
    const limit = parseInt(request.query.limit || '20', 10);
    const offset = parseInt(request.query.offset || '0', 10);

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    const allMatches = handler.getPlayerMatches(playerId);
    const paginatedMatches = allMatches.slice(offset, offset + limit);

    return reply.send({
      matches: paginatedMatches,
      total: allMatches.length,
      limit,
      offset,
    });
  });

  // ==========================================================================
  // Training Tips Endpoints
  // ==========================================================================

  /**
   * GET /api/analytics/players/:playerId/tips
   * Get player training tips
   */
  fastify.get<{
    Params: { playerId: string };
  }>('/api/analytics/players/:playerId/tips', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId } = request.params;

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    const tips = handler.getPlayerTips(playerId);

    return reply.send({
      tips,
      aiEnabled: handler.isAIEnabled(),
    });
  });

  /**
   * POST /api/analytics/players/:playerId/tips/generate
   * Generate new training tips for player
   */
  fastify.post<{
    Params: { playerId: string };
    Body: GenerateTipsBody;
  }>('/api/analytics/players/:playerId/tips/generate', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId } = request.params;
    const { focusArea } = request.body || {};

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    if (!handler.isAIEnabled()) {
      return reply.status(400).send({
        error: 'AI tips disabled',
        message: 'Configure an AI provider in module settings to enable tip generation',
      });
    }

    try {
      const tips = await handler.generatePlayerTips(playerId, focusArea);
      return reply.send({
        tips,
        generated: tips.length,
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to generate tips',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/analytics/players/:playerId/tips/:tipId/acknowledge
   * Mark a tip as acknowledged
   */
  fastify.post<{
    Params: { playerId: string; tipId: string };
  }>('/api/analytics/players/:playerId/tips/:tipId/acknowledge', async (request, reply) => {
    const handler = getHandler(reply);
    if (!handler) return;

    const { playerId, tipId } = request.params;

    const player = handler.getPlayer(playerId);
    if (!player) {
      return reply.status(404).send({
        error: 'Player not found',
        playerId,
      });
    }

    handler.acknowledgeTip(playerId, tipId);

    return reply.send({ success: true });
  });

  // ==========================================================================
  // Module Status Endpoint
  // ==========================================================================

  /**
   * GET /api/analytics/status
   * Get analytics module status
   */
  fastify.get('/api/analytics/status', async (_request, reply) => {
    const handler = deps.getAnalyticsHandler();

    if (!handler) {
      return reply.send({
        available: false,
        message: 'Player Analytics module not installed or not running',
      });
    }

    const stats = handler.getStats();
    const players = handler.getAllPlayers();

    return reply.send({
      available: true,
      aiEnabled: handler.isAIEnabled(),
      stats: {
        ...stats,
        trackedPlayers: players.length,
      },
    });
  });
}
