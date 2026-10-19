import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { APIServer } from '../../../src/api/Server.js';
import { registerAuthRoutes } from '../../../src/api/routes/auth.js';
import { createAuthMiddleware } from '../../../src/api/middleware/auth.js';
import type { HubConfiguration } from '../../../src/types/api.js';
import { serverUrl } from '../../helpers/serverUrl.js';

describe('Auth Routes', () => {
  let server: APIServer;
  let passwordHash: string;
  let saveConfig: ReturnType<typeof vi.fn<[HubConfiguration], Promise<void>>>;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash('testpassword', 10);
    server = new APIServer({ port: 0, logger: false });

    await server.initialize({
      setupCompleted: true,
      webAuth: {
        enabled: true,
        username: 'admin',
        passwordHash,
      },
      autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
      server: { port: 3000, host: '0.0.0.0' },
    });

    const fastify = server.getInstance();

    // Register auth middleware
    fastify.addHook('preHandler', createAuthMiddleware(server));

    // Register routes; the save stub mirrors main.ts (persist, then swap the live config)
    saveConfig = vi.fn(async (newConfig: HubConfiguration) => {
      server.setConfig(newConfig);
    });
    registerAuthRoutes(fastify, server, { saveConfig });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /api/auth/session', () => {
    it('should return unauthenticated when no session', async () => {
      const response = await fetch(`${serverUrl(server)}/api/auth/session`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.authenticated).toBe(false);
      expect(data.authRequired).toBe(true);
    });

    it('should return authenticated when valid session', async () => {
      // First login
      const loginResponse = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'testpassword' }),
      });

      const setCookie = loginResponse.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();

      // Check session with cookie
      const sessionResponse = await fetch(`${serverUrl(server)}/api/auth/session`, {
        headers: { Cookie: setCookie! },
      });

      const data = await sessionResponse.json();
      expect(data.authenticated).toBe(true);
      expect(data.username).toBe('admin');
    });

    it('should report auth not required when disabled', async () => {
      // Disable auth
      server.setConfig({
        setupCompleted: true,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });

      const response = await fetch(`${serverUrl(server)}/api/auth/session`);
      const data = await response.json();
      expect(data.authenticated).toBe(true);
      expect(data.authRequired).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const response = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'testpassword' }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should set session cookie
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('autodarts_session=');
    });

    it('should reject incorrect username', async () => {
      const response = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'wrong', password: 'testpassword' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject incorrect password', async () => {
      const response = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject missing credentials', async () => {
      const response = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin' }),
      });

      expect(response.status).toBe(400);
    });

    it('should succeed without credentials when auth disabled', async () => {
      server.setConfig({
        setupCompleted: true,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });

      const response = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear session', async () => {
      // First login
      const loginResponse = await fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'testpassword' }),
      });

      const setCookie = loginResponse.headers.get('set-cookie');

      // Logout
      const logoutResponse = await fetch(`${serverUrl(server)}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: setCookie! },
      });

      expect(logoutResponse.ok).toBe(true);
      const data = await logoutResponse.json();
      expect(data.success).toBe(true);

      // Session should be invalid now
      const sessionResponse = await fetch(`${serverUrl(server)}/api/auth/session`, {
        headers: { Cookie: setCookie! },
      });

      const sessionData = await sessionResponse.json();
      expect(sessionData.authenticated).toBe(false);
    });
  });
  describe('POST /api/auth/change-password', () => {
    const login = async (password: string): Promise<Response> =>
      fetch(`${serverUrl(server)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password }),
      });

    const changePassword = async (
      cookie: string,
      currentPassword: string,
      newPassword: string
    ): Promise<Response> =>
      fetch(`${serverUrl(server)}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

    it('persists the new password hash through saveConfig', async () => {
      const cookie = (await login('testpassword')).headers.get('set-cookie')!;

      const response = await changePassword(cookie, 'testpassword', 'newsecret');

      expect(response.status).toBe(200);
      expect((await response.json()).success).toBe(true);
      expect(saveConfig).toHaveBeenCalledTimes(1);
      const saved = saveConfig.mock.calls[0]![0];
      expect(await bcrypt.compare('newsecret', saved.webAuth.passwordHash)).toBe(true);
      expect(saved.webAuth.username).toBe('admin');
      expect(saved.webAuth.enabled).toBe(true);

      expect((await login('newsecret')).status).toBe(200);
      expect((await login('testpassword')).status).toBe(401);
    });

    it('keeps the old password and returns 500 when saving fails', async () => {
      const cookie = (await login('testpassword')).headers.get('set-cookie')!;
      saveConfig.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const response = await changePassword(cookie, 'testpassword', 'newsecret');

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(server.getConfig()!.webAuth.passwordHash).toBe(passwordHash);
      expect((await login('testpassword')).status).toBe(200);
      expect((await login('newsecret')).status).toBe(401);
    });

    it('does not save when the current password is wrong', async () => {
      const cookie = (await login('testpassword')).headers.get('set-cookie')!;

      const response = await changePassword(cookie, 'wrong', 'newsecret');

      expect(response.status).toBe(401);
      expect(saveConfig).not.toHaveBeenCalled();
    });

    it('keeps existing sessions valid after a password change', async () => {
      const cookie = (await login('testpassword')).headers.get('set-cookie')!;

      await changePassword(cookie, 'testpassword', 'newsecret');

      const session = await fetch(`${serverUrl(server)}/api/auth/session`, {
        headers: { Cookie: cookie },
      });
      expect((await session.json()).authenticated).toBe(true);
    });
  });
});
