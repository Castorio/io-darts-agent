import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIServer } from '../../../src/api/Server.js';
import { registerSetupRoutes } from '../../../src/api/routes/setup.js';

describe('Setup Routes', () => {
  let server: APIServer;
  let saveConfig: ReturnType<typeof vi.fn>;
  let testConnection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = new APIServer({ port: 3098, logger: false });
    saveConfig = vi.fn().mockResolvedValue(undefined);
    testConnection = vi.fn().mockResolvedValue({
      success: true,
      userId: 'user123',
      boardName: 'My Board',
    });

    await server.initialize(null);

    registerSetupRoutes(server.getInstance(), server, {
      saveConfig,
      testAutodartsConnection: testConnection,
    });

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /api/setup/status', () => {
    it('should return setup required when not configured', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/status');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.setupRequired).toBe(true);
      expect(data.version).toBeDefined();
    });

    it('should return setup not required when configured', async () => {
      server.setConfig({
        setupCompleted: true,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });

      const response = await fetch('http://127.0.0.1:3098/api/setup/status');
      const data = await response.json();
      expect(data.setupRequired).toBe(false);
    });
  });

  describe('POST /api/setup/test-connection', () => {
    it('should test connection with valid credentials', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'password123',
          boardId: 'board-id',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.userId).toBe('user123');
      expect(testConnection).toHaveBeenCalledWith('test@test.com', 'password123', 'board-id');
    });

    it('should return error for missing fields', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should handle connection failure', async () => {
      testConnection.mockResolvedValueOnce({
        success: false,
        error: 'Invalid credentials',
      });

      const response = await fetch('http://127.0.0.1:3098/api/setup/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: 'wrong',
          boardId: 'board-id',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/setup/complete', () => {
    it('should complete setup without web auth', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAuth: { enabled: false },
          autodarts: {
            email: 'test@test.com',
            password: 'password123',
            boardId: 'board-id',
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(saveConfig).toHaveBeenCalled();

      const savedConfig = saveConfig.mock.calls[0][0];
      expect(savedConfig.setupCompleted).toBe(true);
      expect(savedConfig.webAuth.enabled).toBe(false);
      expect(savedConfig.autodarts.email).toBe('test@test.com');
    });

    it('should complete setup with web auth', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAuth: {
            enabled: true,
            username: 'admin',
            password: 'secretpassword',
          },
          autodarts: {
            email: 'test@test.com',
            password: 'password123',
            boardId: 'board-id',
          },
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);

      const savedConfig = saveConfig.mock.calls[0][0];
      expect(savedConfig.webAuth.enabled).toBe(true);
      expect(savedConfig.webAuth.username).toBe('admin');
      expect(savedConfig.webAuth.passwordHash).toBeTruthy();
      expect(savedConfig.webAuth.passwordHash).not.toBe('secretpassword'); // Hashed
    });

    it('should reject if setup already completed', async () => {
      server.setConfig({
        setupCompleted: true,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });

      const response = await fetch('http://127.0.0.1:3098/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAuth: { enabled: false },
          autodarts: {
            email: 'test@test.com',
            password: 'password123',
            boardId: 'board-id',
          },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject missing autodarts credentials', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAuth: { enabled: false },
          autodarts: { email: 'test@test.com' },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject enabled web auth without credentials', async () => {
      const response = await fetch('http://127.0.0.1:3098/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webAuth: { enabled: true },
          autodarts: {
            email: 'test@test.com',
            password: 'password123',
            boardId: 'board-id',
          },
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});
