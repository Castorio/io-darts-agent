import type { FastifyRequest, FastifyReply } from 'fastify';
import type { APIServer } from '../Server.js';

const SESSION_COOKIE = 'autodarts_session';

declare module 'fastify' {
  interface FastifyRequest {
    session?: {
      authenticated: boolean;
      username?: string;
    };
  }
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(server: APIServer) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // If setup not completed, the web UI loads but the API only answers setup routes
    if (server.isSetupRequired()) {
      // Resolve dot segments so /x/../api/... cannot pass as a UI path
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const isApi = pathname === '/api' || pathname.startsWith('/api/');
      const isSetupApi = pathname === '/api/setup' || pathname.startsWith('/api/setup/');
      if (isApi && !isSetupApi) {
        reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Setup required. Please complete the setup wizard.',
        });
        return;
      }
      return;
    }

    // If auth is not enabled, allow all requests
    if (!server.isAuthEnabled()) {
      request.session = { authenticated: true };
      return;
    }

    // Check for session cookie
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId && server.isSessionValid(sessionId)) {
      const session = server.getSession(sessionId);
      request.session = {
        authenticated: true,
        username: session?.username,
      };
      return;
    }

    // Allow public routes
    const publicRoutes = [
      '/api/auth/login',
      '/api/auth/session',
      '/api/setup/status',
      '/health',
    ];

    if (publicRoutes.some((route) => request.url.startsWith(route))) {
      request.session = { authenticated: false };
      return;
    }

    // Unauthorized
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  };
}

/**
 * Require authentication decorator
 */
export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
): void {
  if (!request.session?.authenticated) {
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }
  done();
}

/**
 * Set session cookie
 */
export function setSessionCookie(
  reply: FastifyReply,
  sessionId: string
): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
  });
}
