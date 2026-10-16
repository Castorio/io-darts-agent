import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { HubStatusResponse } from '../../types/api.js';

const PACKAGE_VERSION = '1.0.0';

export interface StatusDependencies {
  getUptime: () => number;
  getAutodartsStatus: () => {
    connected: boolean;
    userId?: string;
    boardId?: string;
  };
  getModuleStats: () => {
    total: number;
    running: number;
  };
}

/**
 * Helper to check authentication
 * Returns true if request is authorized (auth disabled or session authenticated)
 */
function isAuthorized(server: APIServer, session: { authenticated?: boolean } | undefined): boolean {
  // If auth is disabled, always allow
  if (!server.isAuthEnabled()) {
    return true;
  }
  // Otherwise require authenticated session
  return session?.authenticated === true;
}

/**
 * Register hub status routes
 */
export function registerStatusRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: StatusDependencies
): void {
  /**
   * GET /api/status - Get hub status
   */
  fastify.get<{
    Reply: HubStatusResponse;
  }>('/api/status', async (_request, _reply) => {
    return {
      version: PACKAGE_VERSION,
      uptime: deps.getUptime(),
      setupCompleted: !server.isSetupRequired(),
      autodarts: deps.getAutodartsStatus(),
      modules: deps.getModuleStats(),
    };
  });

  /**
   * POST /api/autodarts/connect - Connect to Autodarts
   */
  fastify.post<{
    Reply: { success: boolean; message?: string; error?: string };
  }>('/api/autodarts/connect', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Check if setup is completed
    if (server.isSetupRequired()) {
      void reply.code(400);
      return {
        success: false,
        error: 'Setup not completed',
      };
    }

    // Connection is handled by the hub - emit event
    server.emit('connectAutodarts');

    return {
      success: true,
      message: 'Connection initiated',
    };
  });

  /**
   * POST /api/autodarts/disconnect - Disconnect from Autodarts
   */
  fastify.post<{
    Reply: { success: boolean; message?: string; error?: string };
  }>('/api/autodarts/disconnect', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Emit disconnect event
    server.emit('disconnectAutodarts');

    return {
      success: true,
      message: 'Disconnection initiated',
    };
  });
}
