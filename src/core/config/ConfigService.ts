import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { HubConfig, AuthConfig } from '../../types/index.js';

const DEFAULT_CONFIG_PATH = './config/hub.config.json';

export interface ConfigServiceOptions {
  configPath?: string;
  createIfMissing?: boolean;
}

export class ConfigService {
  private configPath: string;
  private createIfMissing: boolean;
  private config: HubConfig | null = null;

  constructor(options: ConfigServiceOptions = {}) {
    this.configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
    this.createIfMissing = options.createIfMissing ?? true;
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<HubConfig> {
    try {
      await access(this.configPath);
      const content = await readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content) as HubConfig;
      this.validateConfig(this.config);
      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && this.createIfMissing) {
        const defaultConfig = this.createDefaultConfig();
        await this.save(defaultConfig);
        this.config = defaultConfig;
        return defaultConfig;
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async save(config: HubConfig): Promise<void> {
    this.validateConfig(config);

    // Ensure directory exists
    const dir = dirname(this.configPath);
    try {
      await access(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.config = config;
  }

  /**
   * Get current configuration (must call load() first)
   */
  get(): HubConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Get auth configuration
   */
  getAuth(): AuthConfig {
    return this.get().auth;
  }

  /**
   * Get board ID
   */
  getBoardId(): string {
    return this.get().boardId;
  }

  /**
   * Update a specific section of the config
   */
  async update<K extends keyof HubConfig>(
    key: K,
    value: HubConfig[K]
  ): Promise<void> {
    const config = this.get();
    config[key] = value;
    await this.save(config);
  }

  /**
   * Update auth credentials
   */
  async updateAuth(auth: Partial<AuthConfig>): Promise<void> {
    const config = this.get();
    config.auth = { ...config.auth, ...auth };
    await this.save(config);
  }

  /**
   * Check if configuration exists
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate configuration structure (only validates structure, not values)
   */
  private validateConfig(config: HubConfig, validateValues = false): void {
    if (!config.auth) {
      throw new Error('Configuration missing "auth" section');
    }
    if (typeof config.auth.email !== 'string') {
      throw new Error('Configuration missing "auth.email"');
    }
    if (typeof config.auth.password !== 'string') {
      throw new Error('Configuration missing "auth.password"');
    }
    if (typeof config.boardId !== 'string') {
      throw new Error('Configuration missing "boardId"');
    }

    // Validate values only when explicitly requested
    if (validateValues) {
      if (!config.auth.email) {
        throw new Error('Configuration "auth.email" is empty');
      }
      if (!config.auth.password) {
        throw new Error('Configuration "auth.password" is empty');
      }
      if (!config.boardId) {
        throw new Error('Configuration "boardId" is empty');
      }
    }
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): HubConfig {
    return {
      auth: {
        email: '',
        password: '',
      },
      boardId: '',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
    };
  }
}

/**
 * Load configuration from environment variables (alternative to file)
 */
export function loadConfigFromEnv(): HubConfig {
  const email = process.env.AUTODARTS_EMAIL;
  const password = process.env.AUTODARTS_PASSWORD;
  const clientId = process.env.AUTODARTS_CLIENT_ID || undefined;
  const boardId = process.env.AUTODARTS_BOARD_ID;

  if (!email || !password || !boardId) {
    throw new Error(
      'Missing required environment variables: AUTODARTS_EMAIL, AUTODARTS_PASSWORD, AUTODARTS_BOARD_ID'
    );
  }

  return {
    auth: {
      email,
      password,
      clientId,
    },
    boardId,
    server: {
      port: parseInt(process.env.SERVER_PORT ?? '3000', 10),
      host: process.env.SERVER_HOST ?? '0.0.0.0',
    },
  };
}

// ============================================
// API Configuration Service (Extended)
// For use with Setup Wizard and API
// ============================================

import type { HubConfiguration } from '../../types/api.js';

// Optional OAuth client id override; AuthService falls back to the web app client
const ENV_CLIENT_ID = process.env.AUTODARTS_CLIENT_ID || undefined;

/**
 * Extended ConfigService for API (with Setup Wizard support)
 */
export class APIConfigService {
  private configPath: string;
  private config: HubConfiguration | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath ?? './config/hub.config.json';
  }

  /**
   * Check if config file exists
   */
  async configExists(): Promise<boolean> {
    try {
      await access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<HubConfiguration> {
    const content = await readFile(this.configPath, 'utf-8');
    this.config = JSON.parse(content) as HubConfiguration;
    return this.config;
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: HubConfiguration): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.configPath);
    try {
      await access(dir);
    } catch {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.config = config;
  }

  /**
   * Get current config (must call loadConfig first)
   */
  getConfig(): HubConfiguration | null {
    return this.config;
  }

  /**
   * Get config path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if setup is required
   */
  isSetupRequired(): boolean {
    return !this.config || !this.config.setupCompleted;
  }

  /**
   * Convert API config to Hub config format
   */
  toHubConfig(apiConfig: HubConfiguration): HubConfig {
    return {
      auth: {
        email: apiConfig.autodarts.email,
        password: apiConfig.autodarts.password,
        clientId: apiConfig.autodarts.clientId || ENV_CLIENT_ID,
      },
      boardId: apiConfig.autodarts.boardId,
      server: apiConfig.server,
    };
  }
}
