import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import type { APIServer } from '../Server.js';
import { setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import type {
  LoginRequest,
  LoginResponse,
  SessionResponse,
} from '../../types/api.js';

/**
 * Register authentication routes
 */
export function registerAuthRoutes(
  fastify: FastifyInstance,
  server: APIServer
): void {
  /**
   * GET /api/auth/session - Check current session status
   */
  fastify.get<{
    Reply: SessionResponse;
  }>('/api/auth/session', async (request, _reply) => {
    const authRequired = server.isAuthEnabled();

    // If auth is not enabled, everyone is authenticated
    if (!authRequired) {
      return {
        authenticated: true,
        authRequired: false,
      };
    }

    // Check session
    const session = request.session;
    return {
      authenticated: session?.authenticated ?? false,
      username: session?.username,
      authRequired: true,
    };
  });

  /**
   * POST /api/auth/login - Login with username and password
   */
  fastify.post<{
    Body: LoginRequest;
    Reply: LoginResponse;
  }>('/api/auth/login', async (request, reply) => {
    // If auth is not enabled, login is not needed
    if (!server.isAuthEnabled()) {
      return {
        success: true,
        message: 'Authentication is not enabled',
      };
    }

    const { username, password } = request.body;

    if (!username || !password) {
      void reply.code(400);
      return {
        success: false,
        message: 'Username and password are required',
      };
    }

    const config = server.getConfig();
    if (!config) {
      void reply.code(500);
      return {
        success: false,
        message: 'Server not configured',
      };
    }

    // Check username
    if (username !== config.webAuth.username) {
      void reply.code(401);
      return {
        success: false,
        message: 'Invalid username or password',
      };
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, config.webAuth.passwordHash);
    if (!passwordValid) {
      void reply.code(401);
      return {
        success: false,
        message: 'Invalid username or password',
      };
    }

    // Create session
    const sessionId = server.createSession(username);
    setSessionCookie(reply, sessionId);

    return {
      success: true,
      message: 'Login successful',
    };
  });

  /**
   * POST /api/auth/logout - Logout and clear session
   */
  fastify.post<{
    Reply: LoginResponse;
  }>('/api/auth/logout', async (request, reply) => {
    // Get session ID from cookie and delete it
    const sessionCookie = request.cookies['autodarts_session'];
    if (sessionCookie) {
      server.deleteSession(sessionCookie);
    }

    clearSessionCookie(reply);

    return {
      success: true,
      message: 'Logout successful',
    };
  });

  /**
   * POST /api/auth/change-password - Change password
   */
  fastify.post<{
    Body: { currentPassword: string; newPassword: string };
    Reply: LoginResponse;
  }>('/api/auth/change-password', async (request, reply) => {
    // Require authentication
    if (!request.session?.authenticated) {
      void reply.code(401);
      return {
        success: false,
        message: 'Authentication required',
      };
    }

    // Auth must be enabled
    if (!server.isAuthEnabled()) {
      void reply.code(400);
      return {
        success: false,
        message: 'Authentication is not enabled',
      };
    }

    const { currentPassword, newPassword } = request.body;

    if (!currentPassword || !newPassword) {
      void reply.code(400);
      return {
        success: false,
        message: 'Current and new password are required',
      };
    }

    const config = server.getConfig();
    if (!config) {
      void reply.code(500);
      return {
        success: false,
        message: 'Server not configured',
      };
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, config.webAuth.passwordHash);
    if (!passwordValid) {
      void reply.code(401);
      return {
        success: false,
        message: 'Current password is incorrect',
      };
    }

    // Hash new password and update config
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    config.webAuth.passwordHash = newPasswordHash;

    // Note: Caller needs to save the config
    // This route emits an event that the hub can listen to

    return {
      success: true,
      message: 'Password changed successfully',
    };
  });
}
