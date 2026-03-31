import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import type { APIServer } from '../Server.js';
import type {
  SetupStatusResponse,
  SetupCompleteRequest,
  SetupCompleteResponse,
  TestConnectionRequest,
  TestConnectionResponse,
  HubConfiguration,
} from '../../types/api.js';

const PACKAGE_VERSION = '1.0.0';

/**
 * Register setup wizard routes
 */
export function registerSetupRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: {
    saveConfig: (config: HubConfiguration) => Promise<void>;
    testAutodartsConnection: (email: string, password: string, boardId: string) => Promise<{
      success: boolean;
      userId?: string;
      boardName?: string;
      error?: string;
    }>;
  }
): void {
  /**
   * GET /api/setup/status - Check if setup is required
   */
  fastify.get<{
    Reply: SetupStatusResponse;
  }>('/api/setup/status', async (_request, _reply) => {
    return {
      setupRequired: server.isSetupRequired(),
      version: PACKAGE_VERSION,
    };
  });

  /**
   * POST /api/setup/test-connection - Test Autodarts connection
   */
  fastify.post<{
    Body: TestConnectionRequest;
    Reply: TestConnectionResponse;
  }>('/api/setup/test-connection', async (request, reply) => {
    const { email, password, boardId } = request.body;

    if (!email || !password || !boardId) {
      reply.code(400);
      return {
        success: false,
        error: 'Missing required fields: email, password, boardId',
      };
    }

    try {
      const result = await deps.testAutodartsConnection(email, password, boardId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  });

  /**
   * POST /api/setup/complete - Complete setup wizard
   */
  fastify.post<{
    Body: SetupCompleteRequest;
    Reply: SetupCompleteResponse;
  }>('/api/setup/complete', async (request, reply) => {
    // Check if setup is actually required
    if (!server.isSetupRequired()) {
      reply.code(400);
      return {
        success: false,
        message: 'Setup has already been completed',
      };
    }

    const { webAuth, autodarts } = request.body;

    // Validate autodarts credentials
    if (!autodarts?.email || !autodarts?.password || !autodarts?.boardId) {
      reply.code(400);
      return {
        success: false,
        message: 'Missing required Autodarts credentials',
      };
    }

    // Validate web auth if enabled
    if (webAuth?.enabled) {
      if (!webAuth.username || !webAuth.password) {
        reply.code(400);
        return {
          success: false,
          message: 'Web authentication enabled but username/password missing',
        };
      }
    }

    try {
      // Hash password if web auth is enabled
      let passwordHash = '';
      if (webAuth?.enabled && webAuth.password) {
        console.log('🔐 Hashing password for web auth...');
        try {
          passwordHash = await bcrypt.hash(webAuth.password, 10);
          console.log('✅ Password hashed successfully');
        } catch (hashError) {
          console.error('❌ bcrypt hash error:', hashError);
          throw hashError;
        }
      }

      // Create configuration
      const config: HubConfiguration = {
        setupCompleted: true,
        language: 'en',
        webAuth: {
          enabled: webAuth?.enabled ?? false,
          username: webAuth?.username ?? '',
          passwordHash,
        },
        autodarts: {
          email: autodarts.email,
          password: autodarts.password,
          boardId: autodarts.boardId,
          clientId: '',
          clientSecret: '',
        },
        server: {
          port: 3000,
          host: '0.0.0.0',
        },
      };

      // Save configuration
      await deps.saveConfig(config);

      // Update server config
      server.setConfig(config);

      return {
        success: true,
        message: 'Setup completed successfully',
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete setup',
      };
    }
  });
}
