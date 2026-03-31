import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import type { APIServer } from '../Server.js';
import type {
  SettingsResponse,
  UpdateSettingsRequest,
  HubConfiguration,
} from '../../types/api.js';

export interface SettingsDependencies {
  saveConfig: (config: HubConfiguration) => Promise<void>;
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
 * Register settings routes
 */
export function registerSettingsRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: SettingsDependencies
): void {
  /**
   * GET /api/settings - Get current settings (sensitive data masked)
   */
  fastify.get<{
    Reply: SettingsResponse | { error: string };
  }>('/api/settings', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const config = server.getConfig();
    if (!config) {
      reply.code(500);
      return { error: 'Server not configured' };
    }

    // Return settings with sensitive data masked
    return {
      language: config.language || 'en',
      server: {
        port: config.server.port,
        host: config.server.host,
      },
      webAuth: {
        enabled: config.webAuth.enabled,
        username: config.webAuth.username,
      },
      autodarts: {
        email: config.autodarts.email,
        boardId: config.autodarts.boardId,
      },
      aiProviders: {
        runway: {
          configured: !!(config.aiProviders?.runway?.apiKey),
          model: config.aiProviders?.runway?.model || 'gen3a_turbo',
        },
        elevenlabs: {
          configured: !!(config.aiProviders?.elevenlabs?.apiKey),
        },
      },
      developerMode: config.developerMode || false,
    };
  });

  /**
   * PUT /api/settings - Update settings
   */
  fastify.put<{
    Body: UpdateSettingsRequest;
    Reply: { success: boolean; message?: string; error?: string };
  }>('/api/settings', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const config = server.getConfig();
    if (!config) {
      reply.code(500);
      return { success: false, error: 'Server not configured' };
    }

    const updates = request.body;

    try {
      // Update language
      if (updates.language !== undefined) {
        config.language = updates.language;
      }

      // Update server settings
      if (updates.server) {
        if (updates.server.port !== undefined) {
          config.server.port = updates.server.port;
        }
        if (updates.server.host !== undefined) {
          config.server.host = updates.server.host;
        }
      }

      // Update web auth settings
      if (updates.webAuth) {
        if (updates.webAuth.enabled !== undefined) {
          config.webAuth.enabled = updates.webAuth.enabled;
        }
        if (updates.webAuth.username !== undefined) {
          config.webAuth.username = updates.webAuth.username;
        }
        if (updates.webAuth.password) {
          console.log('🔐 Hashing new password in settings...');
          try {
            config.webAuth.passwordHash = await bcrypt.hash(updates.webAuth.password, 10);
            console.log('✅ Password hashed successfully in settings');
          } catch (hashError) {
            console.error('❌ bcrypt hash error in settings:', hashError);
            throw hashError;
          }
        }
      }

      // Update autodarts settings
      if (updates.autodarts) {
        if (updates.autodarts.email !== undefined) {
          config.autodarts.email = updates.autodarts.email;
        }
        if (updates.autodarts.password !== undefined) {
          config.autodarts.password = updates.autodarts.password;
        }
        if (updates.autodarts.boardId !== undefined) {
          config.autodarts.boardId = updates.autodarts.boardId;
        }
      }

      // Update AI providers settings
      if (updates.aiProviders) {
        if (!config.aiProviders) {
          config.aiProviders = {};
        }
        if (updates.aiProviders.runway) {
          if (!config.aiProviders.runway) {
            config.aiProviders.runway = { apiKey: '' };
          }
          if (updates.aiProviders.runway.apiKey !== undefined) {
            config.aiProviders.runway.apiKey = updates.aiProviders.runway.apiKey;
          }
          if (updates.aiProviders.runway.model !== undefined) {
            config.aiProviders.runway.model = updates.aiProviders.runway.model;
          }
        }
        if (updates.aiProviders.elevenlabs) {
          if (!config.aiProviders.elevenlabs) {
            config.aiProviders.elevenlabs = { apiKey: '' };
          }
          if (updates.aiProviders.elevenlabs.apiKey !== undefined) {
            config.aiProviders.elevenlabs.apiKey = updates.aiProviders.elevenlabs.apiKey;
          }
        }
      }

      // Update developer mode
      if (updates.developerMode !== undefined) {
        config.developerMode = updates.developerMode;
      }

      // Save updated config
      await deps.saveConfig(config);

      // Update server reference
      server.setConfig(config);

      // Emit settings changed event
      server.emit('settingsChanged', config);

      return {
        success: true,
        message: 'Settings updated successfully',
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update settings',
      };
    }
  });

  /**
   * POST /api/settings/restart - Request server restart (for port changes)
   */
  fastify.post<{
    Reply: { success: boolean; message?: string };
  }>('/api/settings/restart', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, message: 'Authentication required' };
    }

    // Emit restart request event
    server.emit('restartRequested');

    return {
      success: true,
      message: 'Restart initiated. The server will restart shortly.',
    };
  });
}
