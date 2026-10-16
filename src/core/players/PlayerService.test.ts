import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerService } from './PlayerService.js';
import { PlayerRepository } from './PlayerRepository.js';

// Mock the filesystem
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
}));

describe('PlayerService', () => {
  let service: PlayerService;
  let repository: PlayerRepository;

  beforeEach(async () => {
    // Create a fresh repository with mocked file operations
    const { writeFile, access, mkdir } = await import('fs/promises');

    // Mock file doesn't exist initially
    (access as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: 'ENOENT' });
    (mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    repository = new PlayerRepository({ filePath: '/tmp/test-players.json' });
    service = new PlayerService({ repository });
    await service.init();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createPlayer()', () => {
    it('should create a player with valid data', async () => {
      const player = await service.createPlayer({
        name: 'John Doe',
        nickname: 'Johnny',
      });

      expect(player).toBeDefined();
      expect(player.id).toBeDefined();
      expect(player.name).toBe('John Doe');
      expect(player.nickname).toBe('Johnny');
      expect(player.stats.gamesPlayed).toBe(0);
    });

    it('should trim whitespace from name', async () => {
      const player = await service.createPlayer({
        name: '  John Doe  ',
      });

      expect(player.name).toBe('John Doe');
    });

    it('should throw error for empty name', async () => {
      await expect(service.createPlayer({ name: '' })).rejects.toThrow('Player name is required');
    });

    it('should throw error for whitespace-only name', async () => {
      await expect(service.createPlayer({ name: '   ' })).rejects.toThrow('Player name is required');
    });

    it('should throw error for duplicate name', async () => {
      await service.createPlayer({ name: 'John Doe' });
      await expect(service.createPlayer({ name: 'john doe' })).rejects.toThrow('already exists');
    });
  });

  describe('getPlayer()', () => {
    it('should return player by ID', async () => {
      const created = await service.createPlayer({ name: 'Test Player' });
      const found = await service.getPlayer(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent ID', async () => {
      const found = await service.getPlayer('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getPlayerByName()', () => {
    it('should find player by exact name', async () => {
      await service.createPlayer({ name: 'Test Player' });
      const found = await service.getPlayerByName('Test Player');

      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Player');
    });

    it('should find player case-insensitively', async () => {
      await service.createPlayer({ name: 'Test Player' });
      const found = await service.getPlayerByName('test player');

      expect(found).toBeDefined();
      expect(found?.name).toBe('Test Player');
    });

    it('should return undefined for non-existent name', async () => {
      const found = await service.getPlayerByName('Unknown');
      expect(found).toBeUndefined();
    });
  });

  describe('updatePlayer()', () => {
    it('should update player name', async () => {
      const created = await service.createPlayer({ name: 'Original Name' });
      const updated = await service.updatePlayer(created.id, { name: 'New Name' });

      expect(updated.name).toBe('New Name');
      expect(updated.id).toBe(created.id);
    });

    it('should update player nickname', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const updated = await service.updatePlayer(created.id, { nickname: 'New Nick' });

      expect(updated.nickname).toBe('New Nick');
    });

    it('should throw error for non-existent player', async () => {
      await expect(service.updatePlayer('non-existent', { name: 'New' })).rejects.toThrow(
        'not found'
      );
    });

    it('should throw error for duplicate name', async () => {
      await service.createPlayer({ name: 'Player 1' });
      const player2 = await service.createPlayer({ name: 'Player 2' });

      await expect(service.updatePlayer(player2.id, { name: 'Player 1' })).rejects.toThrow(
        'already exists'
      );
    });

    it('should allow updating to same name', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const updated = await service.updatePlayer(created.id, { name: 'Test' });

      expect(updated.name).toBe('Test');
    });
  });

  describe('deletePlayer()', () => {
    it('should delete existing player', async () => {
      const created = await service.createPlayer({ name: 'To Delete' });
      const deleted = await service.deletePlayer(created.id);

      expect(deleted).toBe(true);

      const found = await service.getPlayer(created.id);
      expect(found).toBeUndefined();
    });

    it('should return false for non-existent player', async () => {
      const deleted = await service.deletePlayer('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('updateModuleSettings()', () => {
    it('should update module settings', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const updated = await service.updateModuleSettings(created.id, 'wled', {
        color: { r: 255, g: 0, b: 0 },
      });

      expect(updated.moduleSettings['wled']).toEqual({
        color: { r: 255, g: 0, b: 0 },
      });
    });

    it('should preserve existing module settings', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      await service.updateModuleSettings(created.id, 'wled', { color: 'red' });
      const updated = await service.updateModuleSettings(created.id, 'sound', { volume: 50 });

      expect(updated.moduleSettings['wled']).toEqual({ color: 'red' });
      expect(updated.moduleSettings['sound']).toEqual({ volume: 50 });
    });

    it('should throw error for non-existent player', async () => {
      await expect(
        service.updateModuleSettings('non-existent', 'wled', { color: 'red' })
      ).rejects.toThrow('not found');
    });
  });

  describe('getModuleSettings()', () => {
    it('should return module settings', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      await service.updateModuleSettings(created.id, 'wled', { color: 'blue' });

      const settings = await service.getModuleSettings(created.id, 'wled');
      expect(settings).toEqual({ color: 'blue' });
    });

    it('should return undefined for non-existent module', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const settings = await service.getModuleSettings(created.id, 'non-existent');
      expect(settings).toBeUndefined();
    });
  });

  describe('searchPlayers()', () => {
    beforeEach(async () => {
      await service.createPlayer({ name: 'John Doe', nickname: 'Johnny' });
      await service.createPlayer({ name: 'Jane Smith', nickname: 'Smithy' });
      await service.createPlayer({ name: 'Bob Johnson' });
    });

    it('should find players by name', async () => {
      const results = await service.searchPlayers('john');
      expect(results).toHaveLength(2); // John Doe and Bob Johnson
    });

    it('should find players by nickname', async () => {
      const results = await service.searchPlayers('johnny');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Doe');
    });

    it('should return all players for empty query', async () => {
      const results = await service.searchPlayers('');
      expect(results).toHaveLength(3);
    });

    it('should return empty array for no matches', async () => {
      const results = await service.searchPlayers('xyz');
      expect(results).toHaveLength(0);
    });
  });

  describe('matchPlayer()', () => {
    beforeEach(async () => {
      await service.createPlayer({ name: 'John Doe', nickname: 'Johnny' });
    });

    it('should match by exact name', async () => {
      const player = await service.matchPlayer('John Doe');
      expect(player).toBeDefined();
      expect(player?.name).toBe('John Doe');
    });

    it('should match by nickname', async () => {
      const player = await service.matchPlayer('Johnny');
      expect(player).toBeDefined();
      expect(player?.name).toBe('John Doe');
    });

    it('should return undefined for no match', async () => {
      const player = await service.matchPlayer('Unknown');
      expect(player).toBeUndefined();
    });
  });

  describe('updateStats()', () => {
    it('should update player stats', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const updated = await service.updateStats(created.id, {
        gamesPlayed: 5,
        gamesWon: 3,
      });

      expect(updated.stats.gamesPlayed).toBe(5);
      expect(updated.stats.gamesWon).toBe(3);
    });
  });

  describe('recordGameResult()', () => {
    it('should record a game win', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const updated = await service.recordGameResult(created.id, {
        won: true,
        legsWon: 3,
        legsPlayed: 5,
        average: 65.5,
        highScore: 140,
        has180: true,
        checkoutScore: 120,
      });

      expect(updated.stats.gamesPlayed).toBe(1);
      expect(updated.stats.gamesWon).toBe(1);
      expect(updated.stats.legsWon).toBe(3);
      expect(updated.stats.legsPlayed).toBe(5);
      expect(updated.stats.total180s).toBe(1);
      expect(updated.stats.bestCheckout).toBe(120);
      expect(updated.stats.lastPlayed).toBeDefined();
    });

    it('should record a game loss', async () => {
      const created = await service.createPlayer({ name: 'Test' });
      const updated = await service.recordGameResult(created.id, {
        won: false,
        legsWon: 1,
        legsPlayed: 3,
        average: 50,
        highScore: 100,
        has180: false,
      });

      expect(updated.stats.gamesPlayed).toBe(1);
      expect(updated.stats.gamesWon).toBe(0);
      expect(updated.stats.legsWon).toBe(1);
    });
  });
});
