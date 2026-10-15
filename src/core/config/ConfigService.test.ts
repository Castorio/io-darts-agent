import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService, loadConfigFromEnv } from './ConfigService.js';
import type { HubConfig } from '../../types/index.js';
import * as fs from 'fs/promises';

vi.mock('fs/promises');

const mockConfig: HubConfig = {
  auth: {
    email: 'test@example.com',
    password: 'password123',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  },
  boardId: 'test-board-id',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
};

describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigService({ configPath: '/test/config.json' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('load()', () => {
    it('should load configuration from file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const config = await configService.load();

      expect(config).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith('/test/config.json', 'utf-8');
    });

    it('should create default config if file missing and createIfMissing is true', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValueOnce(error).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.stubEnv('AUTODARTS_CLIENT_ID', 'test-client');
      vi.stubEnv('AUTODARTS_CLIENT_SECRET', 'test-secret');

      const config = await configService.load();
      vi.unstubAllEnvs();

      expect(config.auth.clientId).toBe('test-client');
      expect(config.auth.clientSecret).toBe('test-secret');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw if file missing and createIfMissing is false', async () => {
      configService = new ConfigService({
        configPath: '/test/config.json',
        createIfMissing: false,
      });

      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValue(error);

      await expect(configService.load()).rejects.toThrow();
    });

    it('should throw on invalid JSON', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(configService.load()).rejects.toThrow();
    });
  });

  describe('save()', () => {
    it('should save configuration to file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configService.save(mockConfig);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/config.json',
        JSON.stringify(mockConfig, null, 2),
        'utf-8'
      );
    });

    it('should create directory if it does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.access).mockRejectedValueOnce(error);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configService.save(mockConfig);

      expect(fs.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
    });

    it('should throw on invalid config', async () => {
      const invalidConfig = { auth: {} } as HubConfig;

      await expect(configService.save(invalidConfig)).rejects.toThrow();
    });
  });

  describe('get()', () => {
    it('should return loaded config', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await configService.load();
      const config = configService.get();

      expect(config).toEqual(mockConfig);
    });

    it('should throw if config not loaded', () => {
      expect(() => configService.get()).toThrow('Configuration not loaded');
    });
  });

  describe('getAuth()', () => {
    it('should return auth config', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await configService.load();
      const auth = configService.getAuth();

      expect(auth).toEqual(mockConfig.auth);
    });
  });

  describe('getBoardId()', () => {
    it('should return board ID', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await configService.load();
      const boardId = configService.getBoardId();

      expect(boardId).toBe('test-board-id');
    });
  });

  describe('update()', () => {
    it('should update specific config key', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configService.load();
      await configService.update('boardId', 'new-board-id');

      expect(configService.getBoardId()).toBe('new-board-id');
    });
  });

  describe('updateAuth()', () => {
    it('should update auth config partially', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await configService.load();
      await configService.updateAuth({ email: 'new@example.com' });

      const auth = configService.getAuth();
      expect(auth.email).toBe('new@example.com');
      expect(auth.password).toBe('password123'); // unchanged
    });
  });

  describe('exists()', () => {
    it('should return true if config file exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const exists = await configService.exists();

      expect(exists).toBe(true);
    });

    it('should return false if config file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const exists = await configService.exists();

      expect(exists).toBe(false);
    });
  });

  describe('getConfigPath()', () => {
    it('should return config file path', () => {
      expect(configService.getConfigPath()).toBe('/test/config.json');
    });
  });
});

describe('loadConfigFromEnv()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AUTODARTS_CLIENT_ID = 'test-client';
    process.env.AUTODARTS_CLIENT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load config from environment variables', () => {
    process.env.AUTODARTS_EMAIL = 'test@example.com';
    process.env.AUTODARTS_PASSWORD = 'password123';
    process.env.AUTODARTS_BOARD_ID = 'test-board-id';

    const config = loadConfigFromEnv();

    expect(config.auth.email).toBe('test@example.com');
    expect(config.auth.password).toBe('password123');
    expect(config.boardId).toBe('test-board-id');
    expect(config.auth.clientId).toBe('test-client');
    expect(config.auth.clientSecret).toBe('test-secret');
  });

  it('should throw if client credentials are missing', () => {
    process.env.AUTODARTS_EMAIL = 'test@example.com';
    process.env.AUTODARTS_PASSWORD = 'password123';
    process.env.AUTODARTS_BOARD_ID = 'test-board-id';
    delete process.env.AUTODARTS_CLIENT_ID;

    expect(() => loadConfigFromEnv()).toThrow('AUTODARTS_CLIENT_ID');
  });

  it('should use custom client credentials from env', () => {
    process.env.AUTODARTS_EMAIL = 'test@example.com';
    process.env.AUTODARTS_PASSWORD = 'password123';
    process.env.AUTODARTS_BOARD_ID = 'test-board-id';
    process.env.AUTODARTS_CLIENT_ID = 'custom-client';
    process.env.AUTODARTS_CLIENT_SECRET = 'custom-secret';

    const config = loadConfigFromEnv();

    expect(config.auth.clientId).toBe('custom-client');
    expect(config.auth.clientSecret).toBe('custom-secret');
  });

  it('should throw if required env vars are missing', () => {
    delete process.env.AUTODARTS_EMAIL;
    delete process.env.AUTODARTS_PASSWORD;
    delete process.env.AUTODARTS_BOARD_ID;

    expect(() => loadConfigFromEnv()).toThrow('Missing required environment variables');
  });

  it('should use default server config', () => {
    process.env.AUTODARTS_EMAIL = 'test@example.com';
    process.env.AUTODARTS_PASSWORD = 'password123';
    process.env.AUTODARTS_BOARD_ID = 'test-board-id';

    const config = loadConfigFromEnv();

    expect(config.server?.port).toBe(3000);
    expect(config.server?.host).toBe('0.0.0.0');
  });

  it('should use custom server config from env', () => {
    process.env.AUTODARTS_EMAIL = 'test@example.com';
    process.env.AUTODARTS_PASSWORD = 'password123';
    process.env.AUTODARTS_BOARD_ID = 'test-board-id';
    process.env.SERVER_PORT = '8080';
    process.env.SERVER_HOST = 'localhost';

    const config = loadConfigFromEnv();

    expect(config.server?.port).toBe(8080);
    expect(config.server?.host).toBe('localhost');
  });
});
