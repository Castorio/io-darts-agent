import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIServer, isLocalOrigin } from '../../src/api/Server.js';
import { serverUrl } from '../helpers/serverUrl.js';

describe('APIServer', () => {
  let server: APIServer;

  beforeEach(() => {
    server = new APIServer({ port: 0, logger: false });
  });

  afterEach(async () => {
    try {
      await server.stop();
    } catch {
      // Ignore if not started
    }
  });

  describe('constructor', () => {
    it('should create server with default options', () => {
      const s = new APIServer({ logger: false });
      expect(s.getAddress()).toBe('http://0.0.0.0:3000');
    });

    it('should create server with custom options', () => {
      const s = new APIServer({ port: 8080, host: '127.0.0.1', logger: false });
      expect(s.getAddress()).toBe('http://127.0.0.1:8080');
    });
  });

  describe('configuration', () => {
    it('should report setup required when no config', () => {
      expect(server.isSetupRequired()).toBe(true);
    });

    it('should report setup required when setupCompleted is false', () => {
      server.setConfig({
        setupCompleted: false,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: '', password: '', boardId: '', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });
      expect(server.isSetupRequired()).toBe(true);
    });

    it('should report setup not required when setupCompleted is true', () => {
      server.setConfig({
        setupCompleted: true,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });
      expect(server.isSetupRequired()).toBe(false);
    });

    it('should report auth enabled correctly', () => {
      expect(server.isAuthEnabled()).toBe(false);

      server.setConfig({
        setupCompleted: true,
        webAuth: { enabled: true, username: 'admin', passwordHash: 'hash' },
        autodarts: { email: '', password: '', boardId: '', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      });
      expect(server.isAuthEnabled()).toBe(true);
    });
  });

  describe('session management', () => {
    it('should create session', () => {
      const sessionId = server.createSession('testuser');
      expect(sessionId).toBeTruthy();
      expect(sessionId.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should retrieve session', () => {
      const sessionId = server.createSession('testuser');
      const session = server.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.username).toBe('testuser');
      expect(session?.authenticated).toBe(true);
    });

    it('should delete session', () => {
      const sessionId = server.createSession('testuser');
      expect(server.getSession(sessionId)).toBeDefined();

      server.deleteSession(sessionId);
      expect(server.getSession(sessionId)).toBeUndefined();
    });

    it('should validate session', () => {
      const sessionId = server.createSession('testuser');
      expect(server.isSessionValid(sessionId)).toBe(true);
      expect(server.isSessionValid('invalid-session')).toBe(false);
    });

    it('should create unique session IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(server.createSession('user'));
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('initialization', () => {
    it('should initialize without config', async () => {
      await server.initialize(null);
      expect(server.isSetupRequired()).toBe(true);
    });

    it('should initialize with config', async () => {
      const config = {
        setupCompleted: true,
        webAuth: { enabled: false, username: '', passwordHash: '' },
        autodarts: { email: 'test@test.com', password: 'pass', boardId: 'board1', clientId: '', clientSecret: '' },
        server: { port: 3000, host: '0.0.0.0' },
      };
      await server.initialize(config);
      expect(server.isSetupRequired()).toBe(false);
      expect(server.getConfig()).toEqual(config);
    });

    it('should emit initialized event', async () => {
      const handler = vi.fn();
      server.on('initialized', handler);

      await server.initialize(null);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('server lifecycle', () => {
    it('should start and stop', async () => {
      await server.initialize(null);

      const startedHandler = vi.fn();
      const stoppedHandler = vi.fn();
      server.on('started', startedHandler);
      server.on('stopped', stoppedHandler);

      await server.start();
      expect(startedHandler).toHaveBeenCalled();

      await server.stop();
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should emit error on start failure', async () => {
      await server.initialize(null);
      await server.start();

      // Try to start another server on same port
      const server2 = new APIServer({ port: Number(new URL(serverUrl(server)).port), logger: false });
      await server2.initialize(null);

      const errorHandler = vi.fn();
      server2.on('error', errorHandler);

      await expect(server2.start()).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('health endpoint', () => {
    it('should respond to health check', async () => {
      await server.initialize(null);
      await server.start();

      const response = await fetch(`${serverUrl(server)}/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toEqual({ status: 'ok' });
    });
  });

  describe('CORS', () => {
    it.each([
      [undefined],
      ['http://localhost:5173'],
      ['http://127.0.0.1:3000'],
      ['http://[::1]:3000'],
      ['http://192.168.1.20:3000'],
      ['http://10.0.0.5'],
      ['http://172.20.1.1'],
      ['http://darts.local:3000'],
      ['http://dartpc:3000'],
      ['http://darts.fritz.box'],
      ['http://nuc.lan'],
      ['http://nuc.home.arpa'],
      ['http://169.254.10.20'],
      ['http://172.16.0.1'],
      ['http://172.31.255.255'],
      ['http://[fd12:3456::1]:3000'],
      ['http://[fe80::1]'],
    ])('accepts local origin %s', (origin) => {
      expect(isLocalOrigin(origin)).toBe(true);
    });

    it.each([
      ['https://evil.com'],
      ['http://172.32.0.1'],
      ['http://172.15.0.1'],
      ['http://localhost.evil.com'],
      ['http://[2001:db8::1]'],
      ['http://192.168.1.20.evil.com'],
      ['http://8.8.8.8'],
      ['null'],
      ['not a url'],
    ])('rejects non-local origin %s', (origin) => {
      expect(isLocalOrigin(origin)).toBe(false);
    });

    it('rejects requests from internet origins before they reach a route', async () => {
      await server.initialize(null);
      const response = await server.getInstance().inject({
        method: 'POST',
        url: '/health',
        headers: { origin: 'https://evil.com' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects preflight requests from internet origins', async () => {
      await server.initialize(null);
      const response = await server.getInstance().inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://evil.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('serves requests without origin header', async () => {
      await server.initialize(null);
      const response = await server.getInstance().inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
    });

    it('grants CORS access to LAN origins', async () => {
      await server.initialize(null);
      const response = await server.getInstance().inject({
        method: 'GET',
        url: '/health',
        headers: { origin: 'http://192.168.1.20:3000' },
      });

      expect(response.headers['access-control-allow-origin']).toBe('http://192.168.1.20:3000');
    });
  });
});
