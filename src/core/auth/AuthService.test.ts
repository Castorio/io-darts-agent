import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './AuthService.js';
import type { AuthConfig, TokenResponse } from '../../types/index.js';

// Mock JWT token (base64 encoded: {"sub": "test-user-id", "exp": 1234567890})
const MOCK_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjE3MTEyOTM2MDB9.fake-signature';

const mockConfig: AuthConfig = {
  email: 'test@example.com',
  password: 'password123',
  clientId: 'test-client',
  clientSecret: 'test-secret',
};

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
    it('should login successfully and return access token', async () => {
      const tokenResponse = createMockTokenResponse();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const token = await authService.login();

      expect(token).toBe(MOCK_JWT);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should throw error on login failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid credentials'),
      });

      await expect(authService.login()).rejects.toThrow('Login failed: 401');
    });

    it('should extract userId from JWT', async () => {
      const tokenResponse = createMockTokenResponse();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      await authService.login();

      expect(authService.getUserId()).toBe('test-user-id');
    });

    it('should set expiry time', async () => {
      const tokenResponse = createMockTokenResponse(300); // 5 minutes
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(tokenResponse),
      });

      const before = Date.now();
      await authService.login();
      const after = Date.now();

      const expiresAt = authService.getExpiresAt();
      expect(expiresAt).not.toBeNull();
      expect(expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 300000);
      expect(expiresAt!.getTime()).toBeLessThanOrEqual(after + 300000);
    });
  });

  describe('refresh()', () => {
    it('should refresh token successfully', async () => {
      // First login
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse()),
      });
      await authService.login();

      // Then refresh
      const newTokenResponse = createMockTokenResponse();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newTokenResponse),
      });

      const token = await authService.refresh();

      expect(token).toBe(MOCK_JWT);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw error if not logged in', async () => {
      await expect(authService.refresh()).rejects.toThrow('No refresh token available');
    });

    it('should clear tokens on refresh failure', async () => {
      // First login
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockTokenResponse()),
      });
      await authService.login();

      // Refresh fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Refresh token expired'),
      });

      await expect(authService.refresh()).rejects.toThrow('Token refresh failed');
      expect(authService.isAuthenticated()).toBe(false);
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
