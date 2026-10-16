import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { PlayerService } from '../../core/players/PlayerService.js';
import type {
  LocalPlayer,
  CreatePlayerRequest,
  UpdatePlayerRequest,
  PlayerListResponse,
  PlayerActionResponse,
} from '../../types/player.js';

export interface PlayerDependencies {
  playerService: PlayerService;
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
 * Register player management routes
 */
export function registerPlayerRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: PlayerDependencies
): void {
  const { playerService } = deps;

  /**
   * GET /api/players - List all players
   */
  fastify.get<{
    Querystring: { search?: string };
    Reply: PlayerListResponse;
  }>('/api/players', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { players: [], total: 0 };
    }

    const { search } = request.query;
    const players = search
      ? await playerService.searchPlayers(search)
      : await playerService.getAllPlayers();

    return {
      players,
      total: players.length,
    };
  });

  /**
   * GET /api/players/:id - Get player by ID
   */
  fastify.get<{
    Params: { id: string };
    Reply: LocalPlayer | { error: string };
  }>('/api/players/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { error: 'Authentication required' };
    }

    const player = await playerService.getPlayer(request.params.id);
    if (!player) {
      void reply.code(404);
      return { error: 'Player not found' };
    }

    return player;
  });

  /**
   * POST /api/players - Create a new player
   */
  fastify.post<{
    Body: CreatePlayerRequest;
    Reply: PlayerActionResponse;
  }>('/api/players', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { name, nickname, color, avatar, autodartsUserId } = request.body;

    if (!name || name.trim().length === 0) {
      void reply.code(400);
      return { success: false, error: 'Player name is required' };
    }

    try {
      const player = await playerService.createPlayer({
        name,
        nickname,
        color: color || '#3B82F6',
        avatar,
        autodartsUserId,
      });

      void reply.code(201);
      return {
        success: true,
        message: 'Player created',
        player,
      };
    } catch (error) {
      // Check for duplicate name error
      if (error instanceof Error && error.message.includes('already exists')) {
        void reply.code(409);
        return { success: false, error: error.message };
      }

      void reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create player',
      };
    }
  });

  /**
   * PUT /api/players/:id - Update a player
   */
  fastify.put<{
    Params: { id: string };
    Body: UpdatePlayerRequest;
    Reply: PlayerActionResponse;
  }>('/api/players/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;
    const { name, nickname, color, avatar, autodartsUserId } = request.body;

    try {
      const player = await playerService.updatePlayer(id, {
        name,
        nickname,
        color,
        avatar,
        autodartsUserId,
      });

      return {
        success: true,
        message: 'Player updated',
        player,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        void reply.code(404);
        return { success: false, error: error.message };
      }

      if (error instanceof Error && error.message.includes('already exists')) {
        void reply.code(409);
        return { success: false, error: error.message };
      }

      void reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update player',
      };
    }
  });

  /**
   * DELETE /api/players/:id - Delete a player
   */
  fastify.delete<{
    Params: { id: string };
    Reply: PlayerActionResponse;
  }>('/api/players/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const deleted = await playerService.deletePlayer(request.params.id);
    if (!deleted) {
      void reply.code(404);
      return { success: false, error: 'Player not found' };
    }

    return {
      success: true,
      message: 'Player deleted',
    };
  });

  /**
   * GET /api/players/:id/module-settings/:moduleId - Get player module settings
   */
  fastify.get<{
    Params: { id: string; moduleId: string };
    Reply: Record<string, unknown> | { error: string };
  }>('/api/players/:id/module-settings/:moduleId', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { error: 'Authentication required' };
    }

    try {
      const settings = await playerService.getModuleSettings(
        request.params.id,
        request.params.moduleId
      );

      return settings ?? {};
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        void reply.code(404);
        return { error: error.message };
      }

      void reply.code(500);
      return { error: error instanceof Error ? error.message : 'Failed to get settings' };
    }
  });

  /**
   * PUT /api/players/:id/module-settings/:moduleId - Update player module settings
   */
  fastify.put<{
    Params: { id: string; moduleId: string };
    Body: { settings: Record<string, unknown> };
    Reply: PlayerActionResponse;
  }>('/api/players/:id/module-settings/:moduleId', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id, moduleId } = request.params;
    const { settings } = request.body;

    if (!settings || typeof settings !== 'object') {
      void reply.code(400);
      return { success: false, error: 'Settings object is required' };
    }

    try {
      const player = await playerService.updateModuleSettings(id, moduleId, settings);

      return {
        success: true,
        message: 'Module settings updated',
        player,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        void reply.code(404);
        return { success: false, error: error.message };
      }

      void reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update settings',
      };
    }
  });

  /**
   * POST /api/players/match - Match an Autodarts player name to a local player
   */
  fastify.post<{
    Body: { name: string };
    Reply: { matched: boolean; player?: LocalPlayer };
  }>('/api/players/match', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { matched: false };
    }

    const { name } = request.body;
    if (!name) {
      void reply.code(400);
      return { matched: false };
    }

    const player = await playerService.matchPlayer(name);
    return {
      matched: !!player,
      player: player ?? undefined,
    };
  });

  /**
   * GET /api/players/:id/stats - Get player statistics
   */
  fastify.get<{
    Params: { id: string };
    Reply: LocalPlayer['stats'] | { error: string };
  }>('/api/players/:id/stats', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { error: 'Authentication required' };
    }

    const player = await playerService.getPlayer(request.params.id);
    if (!player) {
      void reply.code(404);
      return { error: 'Player not found' };
    }

    return player.stats;
  });
}
