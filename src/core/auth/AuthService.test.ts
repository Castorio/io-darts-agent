import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './AuthService.js';
import type { AuthConfig, TokenResponse } from '../../types/index.js';

// Mock JWT token (base64 encoded: {"sub": "test-user-id", "exp": 1234567890})
const MOCK_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjE3MTEyOTM2MDB9.fake-signature';

const mockConfig: AuthConfig = {
  email: 'test@example.com',
  password: 'password123',
};

const AUTH_BASE = 'https://api.autodarts.com/auth/v1';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function htmlResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    text: () => Promise.resolve('<!DOCTYPE html><html><title>522</title></html>'),
  } as unknown as Response;
}

function requestBody(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
}

function createMockTokenResponse(expiresIn = 300): TokenResponse {
  return {
    access_token: MOCK_JWT,
    refresh_token: 'mock-refresh-token',
    expires_in: expiresIn,
    token_type: 'Bearer',
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    authService = new AuthService(mockConfig);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
    authService.logout();
  });

  describe('login()', () => {
    it('posts username, password and default client id as JSON to the v1 login endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      const token = await authService.login();

      expect(token).toBe(MOCK_JWT);
      const call = fetchMock.mock.calls[0];
      expect(call[0]).toBe(`${AUTH_BASE}/login`);
      expect((call[1] as RequestInit).method).toBe('POST');
      expect((call[1] as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' });
      expect(requestBody(call)).toEqual({
        username: 'test@example.com',
        password: 'password123',
        client_id: 'autodarts-play',
      });
    });

    it('uses the configured client id instead of the default', async () => {
      authService = new AuthService({ ...mockConfig, clientId: 'my-client' });
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      await authService.login();

      expect(requestBody(fetchMock.mock.calls[0]).client_id).toBe('my-client');
    });

    it('reports invalid credentials in plain words', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(401, { statusCode: 401, error: { code: 'invalid_credentials' } })
      );

      await expect(authService.login()).rejects.toThrow('Login failed: invalid email or password');
    });

    it('reports the status but not an HTML error page', async () => {
      fetchMock.mockResolvedValueOnce(htmlResponse(522));

      const error = await authService.login().catch((e: Error) => e);

      expect(error.message).toContain('522');
      expect(error.message).not.toContain('<html');
    });

    it('extracts the user id from the JWT', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      await authService.login();

      expect(authService.getUserId()).toBe('test-user-id');
    });

    it('sets the expiry time from expires_in', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse(300)));

      const before = Date.now();
      await authService.login();
      const after = Date.now();

      const expiresAt = authService.getExpiresAt();
      expect(expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 300000);
      expect(expiresAt!.getTime()).toBeLessThanOrEqual(after + 300000);
    });

    it('defaults to 900 seconds when expires_in is missing', async () => {
      const { expires_in: _unused, ...withoutExpiry } = createMockTokenResponse();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, withoutExpiry));

      const before = Date.now();
      await authService.login();

      expect(authService.getExpiresAt()!.getTime()).toBeGreaterThanOrEqual(before + 900000);
    });
  });

  describe('refresh()', () => {
    it('posts the refresh token and client id to the v1 refresh endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));
      await authService.login();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      const token = await authService.refresh();

      expect(token).toBe(MOCK_JWT);
      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe(`${AUTH_BASE}/refresh`);
      expect(requestBody(call)).toEqual({
        refresh_token: 'mock-refresh-token',
        client_id: 'autodarts-play',
      });
    });

    it('uses the rotated refresh token on the next refresh', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));
      await authService.login();
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { ...createMockTokenResponse(), refresh_token: 'rotated-token' })
      );
      await authService.refresh();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      await authService.refresh();

      expect(requestBody(fetchMock.mock.calls[2]).refresh_token).toBe('rotated-token');
    });

    it('keeps the old refresh token when the response has none', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));
      await authService.login();
      const { refresh_token: _unused, ...withoutRefresh } = createMockTokenResponse();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, withoutRefresh));
      await authService.refresh();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      await authService.refresh();

      expect(requestBody(fetchMock.mock.calls[2]).refresh_token).toBe('mock-refresh-token');
    });

    it('logs in again with the password when the refresh is rejected', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));
      await authService.login();
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'invalid_token' } }));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      const token = await authService.refresh();

      expect(token).toBe(MOCK_JWT);
      expect(fetchMock.mock.calls[2][0]).toBe(`${AUTH_BASE}/login`);
    });

    it('throws and clears tokens when refresh and re-login both fail', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));
      await authService.login();
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'invalid_token' } }));
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: { code: 'invalid_credentials' } }));

      await expect(authService.refresh()).rejects.toThrow('invalid email or password');
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('throws if not logged in', async () => {
      await expect(authService.refresh()).rejects.toThrow('No refresh token available');
    });

    it('shares one request between concurrent refreshes', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));
      await authService.login();
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse()));

      await Promise.all([authService.refresh(), authService.refresh()]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('startAutoRefresh()', () => {
    it('does not leave an unhandled rejection when an immediate refresh fails', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, createMockTokenResponse(1)));
      await authService.login();
      fetchMock.mockResolvedValue(jsonResponse(503, {}));
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);

      try {
        authService.startAutoRefresh();
        await new Promise((r) => setTimeout(r, 20));
      } finally {
        process.off('unhandledRejection', unhandled);
      }

      expect(unhandled).not.toHaveBeenCalled();
    });
  });

  describe('getToken()', () => {
    it('should return token if valid', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(300)),
      });
      await authService.login();

      const token = await authService.getToken();
      expect(token).toBe(MOCK_JWT);
    });

    it('should throw if not authenticated', async () => {
      await expect(authService.getToken()).rejects.toThrow('Not authenticated');
    });

    it('should refresh token if expired', async () => {
      // Login with very short expiry
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(1)), // 1 second
      });
      await authService.login();

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 100));

      // Service should be using short buffer, simulate near-expiry
      const authServiceShortBuffer = new AuthService(mockConfig, { tokenRefreshBuffer: 5 });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(1)),
      });
      await authServiceShortBuffer.login();

      // Mock refresh
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(300)),
      });

      // Wait for token to be "about to expire"
      await new Promise((r) => setTimeout(r, 50));

      // getToken should try to refresh
      const token = await authServiceShortBuffer.getToken();
      expect(token).toBe(MOCK_JWT);
    });
  });

  describe('isTokenExpired()', () => {
    it('should return true if no token', () => {
      expect(authService.isTokenExpired()).toBe(true);
    });

    it('should return false for valid token', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(300)),
      });
      await authService.login();

      expect(authService.isTokenExpired()).toBe(false);
    });
  });

  describe('isAuthenticated()', () => {
    it('should return false initially', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return true after login', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(300)),
      });
      await authService.login();

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false after logout', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(300)),
      });
      await authService.login();
      authService.logout();

      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('logout()', () => {
    it('should clear all tokens', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse()),
      });
      await authService.login();

      authService.logout();

      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getUserId()).toBeNull();
      expect(authService.getExpiresAt()).toBeNull();
    });
  });

  describe('startAutoRefresh()', () => {
    it('should setup auto refresh timer', async () => {
      vi.useFakeTimers();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(120)), // 2 minutes
      });
      await authService.login();

      const onRefresh = vi.fn();
      authService.startAutoRefresh(onRefresh);

      // Fast forward to just before refresh time (120s - 60s buffer = 60s)
      vi.advanceTimersByTime(55000);
      expect(onRefresh).not.toHaveBeenCalled();

      // Mock refresh response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(300)),
      });

      // Fast forward past refresh time
      vi.advanceTimersByTime(10000);
      await vi.runAllTimersAsync();

      expect(onRefresh).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('stopAutoRefresh()', () => {
    it('should cancel auto refresh timer', async () => {
      vi.useFakeTimers();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse(120)),
      });
      await authService.login();

      const onRefresh = vi.fn();
      authService.startAutoRefresh(onRefresh);
      authService.stopAutoRefresh();

      vi.advanceTimersByTime(120000);
      expect(onRefresh).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
