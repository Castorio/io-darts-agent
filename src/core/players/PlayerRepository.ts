/**
 * Player Repository
 *
 * Handles persistence of local players to JSON file
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { LocalPlayer } from '../../types/player.js';

const DEFAULT_PLAYERS_PATH = './config/players.json';

export interface PlayersData {
  version: number;
  players: LocalPlayer[];
}

export interface PlayerRepositoryOptions {
  filePath?: string;
}

export class PlayerRepository {
  private filePath: string;
  private data: PlayersData | null = null;

  constructor(options: PlayerRepositoryOptions = {}) {
    this.filePath = options.filePath ?? DEFAULT_PLAYERS_PATH;
  }

  /**
   * Load players from file
   */
  async load(): Promise<PlayersData> {
    try {
      await access(this.filePath);
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as PlayersData;
      return this.data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Create default empty data
        const defaultData: PlayersData = {
          version: 1,
          players: [],
        };
        await this.save(defaultData);
        this.data = defaultData;
        return defaultData;
      }
      throw error;
    }
  }

  /**
   * Save players to file
   */
  async save(data?: PlayersData): Promise<void> {
    const dataToSave = data ?? this.data;
    if (!dataToSave) {
      throw new Error('No data to save. Call load() first.');
    }

    // Ensure directory exists
    const dir = dirname(this.filePath);
    try {
      await access(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
    this.data = dataToSave;
  }

  /**
   * Get all players
   */
  getAll(): LocalPlayer[] {
    if (!this.data) {
      throw new Error('Data not loaded. Call load() first.');
    }
    return this.data.players;
  }

  /**
   * Get player by ID
   */
  getById(id: string): LocalPlayer | undefined {
    return this.getAll().find((p) => p.id === id);
  }

  /**
   * Get player by name (case insensitive)
   */
  getByName(name: string): LocalPlayer | undefined {
    const lowerName = name.toLowerCase();
    return this.getAll().find((p) => p.name.toLowerCase() === lowerName);
  }

  /**
   * Add a new player
   */
  async add(player: LocalPlayer): Promise<void> {
    if (!this.data) {
      throw new Error('Data not loaded. Call load() first.');
    }
    this.data.players.push(player);
    await this.save();
  }

  /**
   * Update an existing player
   */
  async update(id: string, updates: Partial<LocalPlayer>): Promise<LocalPlayer | undefined> {
    if (!this.data) {
      throw new Error('Data not loaded. Call load() first.');
    }

    const index = this.data.players.findIndex((p) => p.id === id);
    if (index === -1) {
      return undefined;
    }

    this.data.players[index] = {
      ...this.data.players[index],
      ...updates,
      id, // Prevent ID from being changed
      updatedAt: new Date().toISOString(),
    };

    await this.save();
    return this.data.players[index];
  }

  /**
   * Delete a player by ID
   */
  async delete(id: string): Promise<boolean> {
    if (!this.data) {
      throw new Error('Data not loaded. Call load() first.');
    }

    const initialLength = this.data.players.length;
    this.data.players = this.data.players.filter((p) => p.id !== id);

    if (this.data.players.length < initialLength) {
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Check if a player exists by name
   */
  existsByName(name: string): boolean {
    return this.getByName(name) !== undefined;
  }

  /**
   * Get file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}
