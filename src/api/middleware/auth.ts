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
 * Path the request is routed to
 *
 * Prefers the matched route pattern, since the router decodes the URL
 * (/%61pi/... reaches /api/...). Without a match the URL is normalized
 * and decoded the same way; an undecodable URL counts as an API path.
 */
function requestPath(request: FastifyRequest): string {
  const routeUrl = (request as { routeOptions?: { url?: string } }).routeOptions?.url;
  if (routeUrl) return routeUrl;
  try {
    return decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    return '/api';
  }
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(
  server: APIServer
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  // Registered as an onRequest hook without a done callback, so it must return
  // a promise; a thrown error becomes a rejection as with an async function.
  return function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    return new Promise<void>((resolve) => {
      authorize(server, request, reply);
      resolve();
    });
  };
}

/**
 * Let the request through, or answer it with 401/403
 */
function authorize(server: APIServer, request: FastifyRequest, reply: FastifyReply): void {
  // If setup not completed, the web UI loads but the API only answers setup routes
  if (server.isSetupRequired()) {
    const pathname = requestPath(request);
    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    const isSetupApi = pathname === '/api/setup' || pathname.startsWith('/api/setup/');
    if (isApi && !isSetupApi) {
      void reply.code(403).send({
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

  // Exact match on the routed path, so /healthz or /api/auth/sessionFoo are not public
  if (publicRoutes.includes(requestPath(request))) {
    request.session = { authenticated: false };
    return;
  }

  // Unauthorized
  void reply.code(401).send({
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Authentication required',
  });
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
    void reply.code(401).send({
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
  void reply.setCookie(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    // The hub serves plain HTTP in the LAN; a Secure cookie would never come back
    secure: reply.request?.protocol === 'https',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(reply: FastifyReply): void {
  void reply.clearCookie(SESSION_COOKIE, {
    path: '/',
  });
}
