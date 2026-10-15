import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createAuthMiddleware, requireAuth, setSessionCookie, clearSessionCookie } from '../../../src/api/middleware/auth.js';
import type { APIServer } from '../../../src/api/Server.js';

describe('Auth Middleware', () => {
  let mockServer: Partial<APIServer>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockServer = {
      isSetupRequired: vi.fn().mockReturnValue(false),
      isAuthEnabled: vi.fn().mockReturnValue(true),
      isSessionValid: vi.fn().mockReturnValue(false),
      getSession: vi.fn().mockReturnValue(undefined),
    };

    mockRequest = {
      url: '/api/status',
      cookies: {},
      session: undefined,
    };

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
  });

  describe('createAuthMiddleware', () => {
    it('should allow access when setup is required and accessing setup routes', async () => {
      (mockServer.isSetupRequired as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockRequest.url = '/api/setup/status';

      const middleware = createAuthMiddleware(mockServer as APIServer);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it.each(['/', '/setup', '/assets/index-abc.js', '/favicon.ico'])(
      'serves the web UI at %s while setup is required so the wizard can load',
      async (url) => {
        (mockServer.isSetupRequired as ReturnType<typeof vi.fn>).mockReturnValue(true);
        mockRequest.url = url;

        const middleware = createAuthMiddleware(mockServer as APIServer);
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

        expect(mockReply.code).not.toHaveBeenCalled();
      }
    );

    it.each(['/api/settings', '/api', '/api/setupx', '/module-ui/../api/status', '/%61pi/settings', '/api%2Fsettings', '/%E0%A4%A'])(
      'still blocks the API at %s while setup is required',
      async (url) => {
        (mockServer.isSetupRequired as ReturnType<typeof vi.fn>).mockReturnValue(true);
        mockRequest.url = url;

        const middleware = createAuthMiddleware(mockServer as APIServer);
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

        expect(mockReply.code).toHaveBeenCalledWith(403);
      }
    );

    it('decides on the matched route when the router provides it', async () => {
      (mockServer.isSetupRequired as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockRequest.url = '/whatever';
      (mockRequest as { routeOptions?: unknown }).routeOptions = { url: '/api/settings' };

      const middleware = createAuthMiddleware(mockServer as APIServer);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });

    it('should block non-setup routes when setup is required', async () => {
      (mockServer.isSetupRequired as ReturnType<typeof vi.fn>).mockReturnValue(true);
      mockRequest.url = '/api/status';

      const middleware = createAuthMiddleware(mockServer as APIServer);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('Setup required'),
      }));
    });

    it('should allow all requests when auth is disabled', async () => {
      (mockServer.isAuthEnabled as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const middleware = createAuthMiddleware(mockServer as APIServer);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.session).toEqual({ authenticated: true });
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should allow request with valid session', async () => {
      mockRequest.cookies = { autodarts_session: 'valid-session-id' };
      (mockServer.isSessionValid as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (mockServer.getSession as ReturnType<typeof vi.fn>).mockReturnValue({
        username: 'testuser',
        authenticated: true,
        createdAt: Date.now(),
      });

      const middleware = createAuthMiddleware(mockServer as APIServer);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockRequest.session).toEqual({
        authenticated: true,
        username: 'testuser',
      });
    });

    it('should allow public routes without authentication', async () => {
      const publicRoutes = [
        '/api/auth/login',
        '/api/auth/session',
        '/api/setup/status',
        '/health',
      ];

      const middleware = createAuthMiddleware(mockServer as APIServer);

      for (const url of publicRoutes) {
        mockRequest.url = url;
        mockRequest.session = undefined;

        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

        expect(mockRequest.session).toEqual({ authenticated: false });
      }
    });

    it('should block protected routes without valid session', async () => {
      mockRequest.url = '/api/modules';

      const middleware = createAuthMiddleware(mockServer as APIServer);
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unauthorized',
      }));
    });
  });

  describe('requireAuth', () => {
    it('should call done() when authenticated', () => {
      const done = vi.fn();
      mockRequest.session = { authenticated: true, username: 'test' };

      requireAuth(mockRequest as FastifyRequest, mockReply as FastifyReply, done);

      expect(done).toHaveBeenCalled();
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should return 401 when not authenticated', () => {
      const done = vi.fn();
      mockRequest.session = { authenticated: false };

      requireAuth(mockRequest as FastifyRequest, mockReply as FastifyReply, done);

      expect(done).not.toHaveBeenCalled();
      expect(mockReply.code).toHaveBeenCalledWith(401);
    });

    it('should return 401 when no session', () => {
      const done = vi.fn();
      mockRequest.session = undefined;

      requireAuth(mockRequest as FastifyRequest, mockReply as FastifyReply, done);

      expect(done).not.toHaveBeenCalled();
      expect(mockReply.code).toHaveBeenCalledWith(401);
    });
  });

  describe('setSessionCookie', () => {
    it('should set cookie with correct options', () => {
      setSessionCookie(mockReply as FastifyReply, 'session-id-123');

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        'autodarts_session',
        'session-id-123',
        expect.objectContaining({
          path: '/',
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60,
        })
      );
    });
  });

  it.each([
    ['http', false],
    ['https', true],
  ])('marks the cookie secure only for %s requests, also in production', (protocol, secure) => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      (mockReply as { request?: unknown }).request = { protocol };
      setSessionCookie(mockReply as FastifyReply, 'session-id-123');

      expect(mockReply.setCookie).toHaveBeenCalledWith(
        'autodarts_session',
        'session-id-123',
        expect.objectContaining({ secure })
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  describe('clearSessionCookie', () => {
    it('should clear session cookie', () => {
      clearSessionCookie(mockReply as FastifyReply);

      expect(mockReply.clearCookie).toHaveBeenCalledWith('autodarts_session', {
        path: '/',
      });
    });
  });
});
