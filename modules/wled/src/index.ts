/**
 * WLED Module for IO-Darts-Agent
 *
 * Controls WLED-based LED strips based on Autodarts events
 */

import { AutodartsModule, type ParsedEvent } from '@autodarts-hub/module-sdk';
import { WledClient } from './WledClient.js';
import { EventMapper, WledActionExecutor } from './EventMapper.js';
import { type WledModuleConfig, DEFAULT_EVENT_ACTIONS, DEFAULT_PLAYER_COLORS } from './types.js';

interface ModuleConfig {
  wledHost: string;
  wledPort?: number;
  connectionTimeout?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  normalBrightness?: number;
  eventActions?: WledModuleConfig['eventActions'];
  playerColors?: WledModuleConfig['playerColors'];
}

const DEFAULT_MODULE_CONFIG: Partial<ModuleConfig> = {
  wledPort: 80,
  connectionTimeout: 5000,
  autoReconnect: true,
  reconnectInterval: 10000,
  normalBrightness: 255,
};

/**
 * WLED Module - Controls LED lighting based on dart events
 */
class WledModule extends AutodartsModule {
  private client: WledClient | null = null;
  private mapper: EventMapper;
  private executor: WledActionExecutor | null = null;
  private wledConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private moduleConfig: ModuleConfig | null = null;

  constructor() {
    super();
    this.mapper = new EventMapper();
  }

  /**
   * Initialize module with config
   */
  protected async onInit(config: Record<string, unknown>): Promise<void> {
    this.moduleConfig = { ...DEFAULT_MODULE_CONFIG, ...config } as ModuleConfig;

    // Validate required config
    if (!this.moduleConfig.wledHost) {
      this.reportError('CONFIG_MISSING', 'WLED host is required', true);
      return;
    }

    // Initialize WLED client
    this.client = new WledClient({
      host: this.moduleConfig.wledHost,
      port: this.moduleConfig.wledPort,
      timeout: this.moduleConfig.connectionTimeout,
    });

    // Initialize executor with player colors and brightness
    const playerColors = this.moduleConfig.playerColors ?? DEFAULT_PLAYER_COLORS;
    const normalBrightness = this.moduleConfig.normalBrightness ?? 255;
    this.executor = new WledActionExecutor(this.client, playerColors, normalBrightness);

    // Update event mapper config
    this.mapper.updateConfig({
      eventActions: this.moduleConfig.eventActions ?? DEFAULT_EVENT_ACTIONS,
      playerColors,
      normalBrightness,
    });

    // Try to connect
    await this.connectToWled(this.moduleConfig);

    this.log('info', `WLED module initialized for ${this.moduleConfig.wledHost}`);
  }

  /**
   * Handle incoming events
   */
  protected async onEvent(event: ParsedEvent): Promise<void> {
    if (!this.wledConnected || !this.executor) {
      this.log('warn', 'WLED not connected, skipping event', { type: event.type });
      return;
    }

    try {
      // Map event to WLED actions
      const actions = this.mapper.mapEvent(event);

      if (actions.length > 0) {
        this.log('debug', `Executing ${actions.length} WLED actions for ${event.type}`);

        // Execute actions
        await this.executor.executeAll(actions);
      }
    } catch (err) {
      const error = err as Error;
      this.log('error', `Failed to execute WLED action: ${error.message}`);
    }
  }

  /**
   * Handle config updates
   */
  protected async onConfigUpdate(config: Record<string, unknown>, changedKeys: string[]): Promise<void> {
    await super.onConfigUpdate(config, changedKeys);

    this.moduleConfig = { ...DEFAULT_MODULE_CONFIG, ...config } as ModuleConfig;

    // Update mapper config
    this.mapper.updateConfig({
      eventActions: this.moduleConfig.eventActions,
      playerColors: this.moduleConfig.playerColors,
      normalBrightness: this.moduleConfig.normalBrightness,
    });

    // Update executor settings
    if (this.executor) {
      if (this.moduleConfig.playerColors) {
        this.executor.setPlayerColors(this.moduleConfig.playerColors);
      }
      if (this.moduleConfig.normalBrightness !== undefined) {
        this.executor.setNormalBrightness(this.moduleConfig.normalBrightness);
      }
    }

    // Check if WLED host changed
    if (changedKeys.includes('wledHost') || changedKeys.includes('wledPort')) {
      this.log('info', 'WLED host changed, reconnecting...');

      this.disconnectFromWled();

      this.client = new WledClient({
        host: this.moduleConfig.wledHost,
        port: this.moduleConfig.wledPort,
        timeout: this.moduleConfig.connectionTimeout,
      });

      const playerColors = this.moduleConfig.playerColors ?? DEFAULT_PLAYER_COLORS;
      const normalBrightness = this.moduleConfig.normalBrightness ?? 255;
      this.executor = new WledActionExecutor(this.client, playerColors, normalBrightness);

      await this.connectToWled(this.moduleConfig);
    }
  }

  /**
   * Handle shutdown
   */
  protected async onShutdown(reason: string): Promise<void> {
    this.log('info', `Shutting down WLED module: ${reason}`);

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Turn off LEDs gracefully
    if (this.client && this.wledConnected) {
      try {
        await this.client.turnOff();
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.wledConnected = false;
  }

  /**
   * Connect to WLED device
   */
  private async connectToWled(config: ModuleConfig): Promise<void> {
    if (!this.client) return;

    try {
      const reachable = await this.client.ping();

      if (reachable) {
        this.wledConnected = true;

        const info = await this.client.getInfo();
        this.log('info', `Connected to WLED: ${info.name} (${info.ver})`);

        this.updateStatus('ready', `Connected to ${info.name}`, {
          host: config.wledHost,
          version: info.ver,
          ledCount: info.leds.count,
        });
      } else {
        throw new Error('Device not reachable');
      }
    } catch (err) {
      const error = err as Error;
      this.wledConnected = false;

      this.log('error', `Failed to connect to WLED: ${error.message}`);
      this.updateStatus('error', `Connection failed: ${error.message}`);

      // Schedule reconnect
      if (config.autoReconnect) {
        this.scheduleReconnect(config);
      }
    }
  }

  /**
   * Disconnect from WLED
   */
  private disconnectFromWled(): void {
    this.wledConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(config: ModuleConfig): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const interval = config.reconnectInterval ?? 10000;

    this.reconnectTimer = setTimeout(async () => {
      this.log('info', 'Attempting to reconnect to WLED...');
      await this.connectToWled(config);
    }, interval);
  }
}

// Start module
const module = new WledModule();
module.start().catch((err) => {
  console.error('Failed to start WLED module:', err);
  process.exit(1);
});

export { WledModule, WledClient, EventMapper, WledActionExecutor };
export * from './WledClient.js';
export * from './EventMapper.js';
// Export types (WledColor is already exported from WledClient)
export type { EventAction, EventActionsConfig, EventActionType, WledModuleConfig } from './types.js';
export { DEFAULT_EVENT_ACTION, DEFAULT_EVENT_ACTIONS, DEFAULT_PLAYER_COLORS } from './types.js';
