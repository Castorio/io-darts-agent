import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerPlayerRoutes } from '../../../src/api/routes/players.js';
import { PlayerService } from '../../../src/core/players/PlayerService.js';
import { PlayerRepository } from '../../../src/core/players/PlayerRepository.js';

// Mock the filesystem
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock APIServer
const mockServer = {
  isAuthEnabled: vi.fn().mockReturnValue(false),
};

describe('Player Routes', () => {
  let fastify: FastifyInstance;
  let playerService: PlayerService;
  let repository: PlayerRepository;

  beforeEach(async () => {
    // Setup filesystem mocks
    const { readFile, writeFile, access, mkdir } = await import('fs/promises');
    (access as ReturnType<typeof vi.fn>).mockRejectedValue({ code: 'ENOENT' });
    (mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Create service and fastify instance
    repository = new PlayerRepository({ filePath: '/tmp/test-players.json' });
    playerService = new PlayerService({ repository });
    await playerService.init();

    fastify = Fastify();
    registerPlayerRoutes(fastify, mockServer as any, { playerService });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
  });

  describe('GET /api/players', () => {
    it('should return empty list initially', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/players',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should return all players', async () => {
      await playerService.createPlayer({ name: 'Player 1' });
      await playerService.createPlayer({ name: 'Player 2' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/players',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('should search players by name', async () => {
      await playerService.createPlayer({ name: 'John Doe' });
      await playerService.createPlayer({ name: 'Jane Smith' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/players?search=john',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(1);
      expect(body.players[0].name).toBe('John Doe');
    });
  });

  describe('GET /api/players/:id', () => {
    it('should return player by ID', async () => {
      const created = await playerService.createPlayer({ name: 'Test Player' });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/players/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Test Player');
    });

    it('should return 404 for non-existent player', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/players/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/players', () => {
    it('should create a new player', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/players',
        payload: {
          name: 'New Player',
          nickname: 'Newbie',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.player.name).toBe('New Player');
      expect(body.player.nickname).toBe('Newbie');
    });

    it('should return 400 for missing name', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/players',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should return 409 for duplicate name', async () => {
      await playerService.createPlayer({ name: 'Existing' });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/players',
        payload: { name: 'existing' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('PUT /api/players/:id', () => {
    it('should update player', async () => {
      const created = await playerService.createPlayer({ name: 'Original' });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/players/${created.id}`,
        payload: { name: 'Updated' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.player.name).toBe('Updated');
    });

    it('should return 404 for non-existent player', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/players/non-existent',
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/players/:id', () => {
    it('should delete player', async () => {
      const created = await playerService.createPlayer({ name: 'To Delete' });

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/players/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const player = await playerService.getPlayer(created.id);
      expect(player).toBeUndefined();
    });

    it('should return 404 for non-existent player', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/players/non-existent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/players/:id/module-settings/:moduleId', () => {
    it('should return module settings', async () => {
      const created = await playerService.createPlayer({ name: 'Test' });
      await playerService.updateModuleSettings(created.id, 'wled', { color: 'red' });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/players/${created.id}/module-settings/wled`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.color).toBe('red');
    });

    it('should return empty object for non-existent module settings', async () => {
      const created = await playerService.createPlayer({ name: 'Test' });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/players/${created.id}/module-settings/unknown`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({});
    });
  });

  describe('PUT /api/players/:id/module-settings/:moduleId', () => {
    it('should update module settings', async () => {
      const created = await playerService.createPlayer({ name: 'Test' });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/players/${created.id}/module-settings/wled`,
        payload: {
          settings: { color: { r: 255, g: 0, b: 0 } },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.player.moduleSettings.wled).toEqual({
        color: { r: 255, g: 0, b: 0 },
      });
    });
  });

  describe('POST /api/players/match', () => {
    it('should match player by name', async () => {
      await playerService.createPlayer({ name: 'John Doe' });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/players/match',
        payload: { name: 'John Doe' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.matched).toBe(true);
      expect(body.player.name).toBe('John Doe');
    });

    it('should return matched: false for unknown player', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/players/match',
        payload: { name: 'Unknown' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.matched).toBe(false);
    });
  });

  describe('GET /api/players/:id/stats', () => {
    it('should return player stats', async () => {
      const created = await playerService.createPlayer({ name: 'Test' });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/players/${created.id}/stats`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.gamesPlayed).toBe(0);
      expect(body.averageScore).toBe(0);
    });
  });

  describe('Authentication', () => {
    beforeEach(() => {
      mockServer.isAuthEnabled.mockReturnValue(true);
    });

    it('should return 401 when auth is enabled and no session', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/players',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
