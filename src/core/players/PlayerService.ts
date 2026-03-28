/**
 * Player Service
 *
 * Business logic for managing local players
 */

import { randomUUID } from 'crypto';
import { PlayerRepository } from './PlayerRepository.js';
import type {
  LocalPlayer,
  PlayerStats,
  CreatePlayerRequest,
  UpdatePlayerRequest,
} from '../../types/player.js';

export interface PlayerServiceOptions {
  repository?: PlayerRepository;
}

export class PlayerService {
  private repository: PlayerRepository;
  private initialized = false;

  constructor(options: PlayerServiceOptions = {}) {
    this.repository = options.repository ?? new PlayerRepository();
  }

  /**
   * Initialize the service (load data)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.repository.load();
    this.initialized = true;
  }

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<LocalPlayer[]> {
    await this.ensureInitialized();
    return this.repository.getAll();
  }

  /**
   * Get player by ID
   */
  async getPlayer(id: string): Promise<LocalPlayer | undefined> {
    await this.ensureInitialized();
    return this.repository.getById(id);
  }

  /**
   * Get player by name
   */
  async getPlayerByName(name: string): Promise<LocalPlayer | undefined> {
    await this.ensureInitialized();
    return this.repository.getByName(name);
  }

  /**
   * Create a new player
   */
  async createPlayer(request: CreatePlayerRequest): Promise<LocalPlayer> {
    await this.ensureInitialized();

    // Validate name
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Player name is required');
    }

    const trimmedName = request.name.trim();

    // Check for duplicate name
    if (this.repository.existsByName(trimmedName)) {
      throw new Error(`Player with name "${trimmedName}" already exists`);
    }

    const now = new Date().toISOString();
    const player: LocalPlayer = {
      id: randomUUID(),
      name: trimmedName,
      nickname: request.nickname?.trim(),
      color: request.color || '#3B82F6', // Default blue
      avatar: request.avatar || 'default',
      autodartsUserId: request.autodartsUserId,
      createdAt: now,
      updatedAt: now,
      moduleSettings: {},
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        legsPlayed: 0,
        legsWon: 0,
        averageScore: 0,
        highestScore: 0,
        total180s: 0,
        totalCheckouts: 0,
        bestCheckout: 0,
      },
    };

    await this.repository.add(player);
    return player;
  }

  /**
   * Update a player
   */
  async updatePlayer(id: string, request: UpdatePlayerRequest): Promise<LocalPlayer> {
    await this.ensureInitialized();

    const existing = this.repository.getById(id);
    if (!existing) {
      throw new Error(`Player with ID "${id}" not found`);
    }

    // Validate new name if provided
    if (request.name !== undefined) {
      if (request.name.trim().length === 0) {
        throw new Error('Player name cannot be empty');
      }

      const trimmedName = request.name.trim();
      const existingByName = this.repository.getByName(trimmedName);
      if (existingByName && existingByName.id !== id) {
        throw new Error(`Player with name "${trimmedName}" already exists`);
      }
    }

    const updates: Partial<LocalPlayer> = {};
    if (request.name !== undefined) updates.name = request.name.trim();
    if (request.nickname !== undefined) updates.nickname = request.nickname?.trim();
    if (request.color !== undefined) updates.color = request.color;
    if (request.avatar !== undefined) updates.avatar = request.avatar;
    if (request.autodartsUserId !== undefined) updates.autodartsUserId = request.autodartsUserId;

    const updated = await this.repository.update(id, updates);
    if (!updated) {
      throw new Error(`Failed to update player "${id}"`);
    }

    return updated;
  }

  /**
   * Delete a player
   */
  async deletePlayer(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.repository.delete(id);
  }

  /**
   * Update player module settings
   */
  async updateModuleSettings(
    playerId: string,
    moduleId: string,
    settings: Record<string, unknown>
  ): Promise<LocalPlayer> {
    await this.ensureInitialized();

    const player = this.repository.getById(playerId);
    if (!player) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    const updatedModuleSettings = {
      ...player.moduleSettings,
      [moduleId]: settings,
    };

    const updated = await this.repository.update(playerId, {
      moduleSettings: updatedModuleSettings,
    });

    if (!updated) {
      throw new Error(`Failed to update module settings for player "${playerId}"`);
    }

    return updated;
  }

  /**
   * Get player module settings
   */
  async getModuleSettings(
    playerId: string,
    moduleId: string
  ): Promise<Record<string, unknown> | undefined> {
    await this.ensureInitialized();

    const player = this.repository.getById(playerId);
    if (!player) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    return player.moduleSettings[moduleId];
  }

  /**
   * Update player statistics
   */
  async updateStats(playerId: string, statsUpdate: Partial<PlayerStats>): Promise<LocalPlayer> {
    await this.ensureInitialized();

    const player = this.repository.getById(playerId);
    if (!player) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    const updatedStats: PlayerStats = {
      ...player.stats,
      ...statsUpdate,
    };

    const updated = await this.repository.update(playerId, {
      stats: updatedStats,
    });

    if (!updated) {
      throw new Error(`Failed to update stats for player "${playerId}"`);
    }

    return updated;
  }

  /**
   * Record a game result for a player
   */
  async recordGameResult(
    playerId: string,
    result: {
      won: boolean;
      legsWon: number;
      legsPlayed: number;
      average: number;
      highScore: number;
      has180: boolean;
      checkoutScore?: number;
    }
  ): Promise<LocalPlayer> {
    await this.ensureInitialized();

    const player = this.repository.getById(playerId);
    if (!player) {
      throw new Error(`Player with ID "${playerId}" not found`);
    }

    const stats = player.stats;
    const newGamesPlayed = stats.gamesPlayed + 1;
    const newLegsPlayed = stats.legsPlayed + result.legsPlayed;

    // Calculate new average (weighted)
    const totalDarts = stats.gamesPlayed > 0 ? stats.gamesPlayed : 1;
    const newAverage =
      (stats.averageScore * totalDarts + result.average) / (totalDarts + 1);

    const updatedStats: PlayerStats = {
      gamesPlayed: newGamesPlayed,
      gamesWon: stats.gamesWon + (result.won ? 1 : 0),
      legsPlayed: newLegsPlayed,
      legsWon: stats.legsWon + result.legsWon,
      averageScore: Math.round(newAverage * 100) / 100,
      highestScore: Math.max(stats.highestScore, result.highScore),
      total180s: stats.total180s + (result.has180 ? 1 : 0),
      totalCheckouts: stats.totalCheckouts + (result.checkoutScore ? 1 : 0),
      bestCheckout: Math.max(stats.bestCheckout, result.checkoutScore ?? 0),
      lastPlayed: new Date().toISOString(),
    };

    return this.updateStats(playerId, updatedStats);
  }

  /**
   * Search players by name (partial match)
   */
  async searchPlayers(query: string): Promise<LocalPlayer[]> {
    await this.ensureInitialized();

    if (!query || query.trim().length === 0) {
      return this.repository.getAll();
    }

    const lowerQuery = query.toLowerCase().trim();
    return this.repository
      .getAll()
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.nickname?.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * Match a player name from Autodarts to a local player
   */
  async matchPlayer(autodartsName: string): Promise<LocalPlayer | undefined> {
    await this.ensureInitialized();

    // Try exact match first
    let player = this.repository.getByName(autodartsName);
    if (player) return player;

    // Try nickname match
    const lowerName = autodartsName.toLowerCase();
    player = this.repository
      .getAll()
      .find((p) => p.nickname?.toLowerCase() === lowerName);

    return player;
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Get repository (for testing)
   */
  getRepository(): PlayerRepository {
    return this.repository;
  }
}
