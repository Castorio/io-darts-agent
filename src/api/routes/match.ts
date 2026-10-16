import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { MatchStateData, MatchPlayer, MatchStats, MatchSettings } from '../../types/index.js';
import { getMatchStatusService, type MatchStatus } from '../../core/match/index.js';

/**
 * Current match response
 */
export interface CurrentMatchResponse {
  active: boolean;
  matchId: string | null;
  variant: string | null;
  type: string | null;
  leg: number;
  set: number;
  round: number;
  player: number;
  players: MatchPlayerInfo[];
  scores: number[];
  gameScores: number[];
  turnScore: number;
  turnBusted: boolean;
  finished: boolean;
  gameFinished: boolean;
  winner: number | null;
  gameWinner: number | null;
  stats: {
    legStats: MatchStats[];
    matchStats: MatchStats[];
  };
  settings: MatchSettings | null;
  lastUpdated: string | null;
}

export interface MatchPlayerInfo {
  id: string;
  index: number;
  name: string;
  score: number;
  average: number;
}

export interface MatchDependencies {
  getCurrentMatch: () => MatchStateData | null;
  getLastMatchUpdate: () => Date | null;
}

/**
 * Helper to check authentication
 */
function isAuthorized(server: APIServer, session: { authenticated?: boolean } | undefined): boolean {
  if (!server.isAuthEnabled()) {
    return true;
  }
  return session?.authenticated === true;
}

/**
 * Build player info from match state
 */
function buildPlayerInfo(players: MatchPlayer[], scores: number[], stats: MatchStats[]): MatchPlayerInfo[] {
  return players.map((player, index) => ({
    id: player.id,
    index: player.index,
    name: player.name,
    score: scores[index] ?? 0,
    average: stats[index]?.average ?? 0,
  }));
}

/**
 * Register match routes
 */
export function registerMatchRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: MatchDependencies
): void {
  /**
   * GET /api/match/current - Get current match state
   *
   * Returns the current match state if a match is active,
   * or indicates no active match.
   */
  fastify.get<{
    Reply: CurrentMatchResponse;
  }>('/api/match/current', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return {
        active: false,
        matchId: null,
        variant: null,
        type: null,
        leg: 0,
        set: 0,
        round: 0,
        player: 0,
        players: [],
        scores: [],
        gameScores: [],
        turnScore: 0,
        turnBusted: false,
        finished: false,
        gameFinished: false,
        winner: null,
        gameWinner: null,
        stats: { legStats: [], matchStats: [] },
        settings: null,
        lastUpdated: null,
      };
    }

    const match = deps.getCurrentMatch();
    const lastUpdated = deps.getLastMatchUpdate();

    if (!match) {
      return {
        active: false,
        matchId: null,
        variant: null,
        type: null,
        leg: 0,
        set: 0,
        round: 0,
        player: 0,
        players: [],
        scores: [],
        gameScores: [],
        turnScore: 0,
        turnBusted: false,
        finished: false,
        gameFinished: false,
        winner: null,
        gameWinner: null,
        stats: { legStats: [], matchStats: [] },
        settings: null,
        lastUpdated: null,
      };
    }

    // Build player info with scores and averages
    // match.stats may be undefined at the start of a match
    const playerInfo = buildPlayerInfo(
      match.players,
      match.scores,
      match.stats?.legStats ?? []
    );

    return {
      active: !match.finished,
      matchId: match.id,
      variant: match.variant,
      type: match.type,
      leg: match.leg,
      set: match.set,
      round: match.round,
      player: match.player,
      players: playerInfo,
      scores: match.scores,
      gameScores: match.gameScores,
      turnScore: match.turnScore,
      turnBusted: match.turnBusted,
      finished: match.finished,
      gameFinished: match.gameFinished,
      winner: match.winner,
      gameWinner: match.gameWinner,
      stats: {
        legStats: match.stats?.legStats ?? [],
        matchStats: match.stats?.matchStats ?? [],
      },
      settings: match.settings,
      lastUpdated: lastUpdated?.toISOString() ?? null,
    };
  });

  /**
   * GET /api/match/current/players - Get current match players only
   * Lightweight endpoint for just player information
   */
  fastify.get<{
    Reply: { active: boolean; players: MatchPlayerInfo[] };
  }>('/api/match/current/players', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { active: false, players: [] };
    }

    const match = deps.getCurrentMatch();

    if (!match || match.finished) {
      return { active: false, players: [] };
    }

    const playerInfo = buildPlayerInfo(
      match.players,
      match.scores,
      match.stats?.legStats ?? []
    );

    return { active: true, players: playerInfo };
  });

  /**
   * GET /api/match/current/scores - Get current scores only
   * Lightweight endpoint for just scores
   */
  fastify.get<{
    Reply: {
      active: boolean;
      scores: number[];
      gameScores: number[];
      turnScore: number;
      currentPlayer: number;
    };
  }>('/api/match/current/scores', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return {
        active: false,
        scores: [],
        gameScores: [],
        turnScore: 0,
        currentPlayer: 0,
      };
    }

    const match = deps.getCurrentMatch();

    if (!match || match.finished) {
      return {
        active: false,
        scores: [],
        gameScores: [],
        turnScore: 0,
        currentPlayer: 0,
      };
    }

    return {
      active: true,
      scores: match.scores,
      gameScores: match.gameScores,
      turnScore: match.turnScore,
      currentPlayer: match.player,
    };
  });

  /**
   * GET /api/match/status - Get match status from the centralized service
   *
   * This endpoint uses the MatchStatusService which provides:
   * - Consistent state across all modules
   * - Player colors from the local player database
   * - Structured player data with colors and averages
   */
  fastify.get<{
    Reply: MatchStatus;
  }>('/api/match/status', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return getMatchStatusService().getStatus();
    }

    return getMatchStatusService().getStatus();
  });

  /**
   * GET /api/match/status/active - Check if a match is active (lightweight)
   */
  fastify.get<{
    Reply: { active: boolean; matchId: string | null };
  }>('/api/match/status/active', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { active: false, matchId: null };
    }

    const service = getMatchStatusService();
    return {
      active: service.isMatchActive(),
      matchId: service.getMatchId(),
    };
  });

  /**
   * GET /api/match/status/player - Get current player info
   */
  fastify.get<{
    Reply: {
      hasMatch: boolean;
      currentPlayer: {
        index: number;
        name: string;
        score: number;
        average: number;
        color?: string;
      } | null;
    };
  }>('/api/match/status/player', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { hasMatch: false, currentPlayer: null };
    }

    const service = getMatchStatusService();
    const player = service.getCurrentPlayer();

    return {
      hasMatch: service.hasMatch(),
      currentPlayer: player,
    };
  });
}
