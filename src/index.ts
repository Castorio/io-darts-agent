import 'dotenv/config';
import { AuthService } from './core/auth/AuthService.js';
import { SocketService } from './core/socket/SocketService.js';
import { EventBus, getEventBus } from './core/events/EventBus.js';
import { ConfigService, loadConfigFromEnv } from './core/config/ConfigService.js';
import type { HubConfig } from './types/index.js';

export class AutodartsHub {
  private authService: AuthService;
  private socketService: SocketService;
  private eventBus: EventBus;
  private config: HubConfig;
  private isRunning = false;

  constructor(config: HubConfig) {
    this.config = config;
    this.eventBus = getEventBus();
    this.authService = new AuthService(config.auth);
    this.socketService = new SocketService(config.boardId, this.eventBus);
  }

  /**
   * Start the hub - authenticate and connect to Autodarts
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Hub is already running');
      return;
    }

    console.log('Starting IO-Darts-Agent...');

    // Authenticate
    console.log('Authenticating...');
    const token = await this.authService.login();
    console.log('✅ Authentication successful');
    console.log(`   User ID: ${this.authService.getUserId()}`);

    // Setup auto-refresh
    this.authService.startAutoRefresh((newToken) => {
      console.log('🔄 Token refreshed');
      this.socketService.updateToken(newToken);
    });

    // Connect WebSocket
    console.log('Connecting to WebSocket...');
    this.socketService.onStateChange((state) => {
      console.log(`🔌 Connection state: ${state}`);
    });

    this.socketService.onErrorCallback((error) => {
      console.error('❌ Socket error:', error.message);
    });

    this.socketService.connect(token);

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const checkConnection = (): void => {
        if (this.socketService.getConnectionState() === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });

    // Subscribe to board
    this.socketService.subscribeToBoard();
    console.log(`✅ Subscribed to board: ${this.config.boardId}`);

    this.isRunning = true;
    console.log('🎯 IO-Darts-Agent is running');
    console.log('   Waiting for match events...\n');
  }

  /**
   * Stop the hub
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('\nStopping IO-Darts-Agent...');
    this.authService.stopAutoRefresh();
    this.socketService.disconnect();
    this.authService.logout();
    this.isRunning = false;
    console.log('Hub stopped');
  }

  /**
   * Get the EventBus for subscribing to events
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Check if hub is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current match ID (if any)
   */
  getCurrentMatchId(): string | null {
    return this.socketService.getMatchId();
  }
}

// Export all components for module use
export { AuthService } from './core/auth/AuthService.js';
export { SocketService } from './core/socket/SocketService.js';
export { EventBus, getEventBus, resetEventBus } from './core/events/EventBus.js';
export { EventParser, getLastThrow, calculateSegmentScore, isHighValueSegment, isMiss } from './core/socket/EventParser.js';
export { ConfigService, loadConfigFromEnv } from './core/config/ConfigService.js';

// Module System exports
export { ModuleProtocol, ModuleBridge, ModuleManager, ModuleInstaller } from './core/modules/index.js';

export * from './types/index.js';

// Main entry point
async function main(): Promise<void> {
  let config: HubConfig;

  try {
    // Try to load from config file first
    const configService = new ConfigService();
    if (await configService.exists()) {
      config = await configService.load();
      console.log('📄 Loaded config from file');
    } else {
      // Fall back to environment variables
      config = loadConfigFromEnv();
      console.log('🔧 Loaded config from environment');
    }
  } catch (error) {
    console.error('Failed to load configuration:', error);
    console.log('\nPlease set the following environment variables:');
    console.log('  AUTODARTS_EMAIL=your-email@example.com');
    console.log('  AUTODARTS_PASSWORD=your-password');
    console.log('  AUTODARTS_BOARD_ID=your-board-id');
    console.log('\nOr create config/hub.config.json with the required settings.');
    process.exit(1);
  }

  const hub = new AutodartsHub(config);

  // Setup event handlers for demo
  const eventBus = hub.getEventBus();

  eventBus.on('match.start', (event) => {
    const data = event.data as { matchId: string };
    console.log(`🎯 Match started: ${data.matchId}`);
  });

  eventBus.on('throw.detected', (event) => {
    const data = event.data as {
      segment: { name: string; multiplier: number; number: number };
      throwNumber: number;
    };
    const score = data.segment.multiplier * data.segment.number;
    console.log(`🎯 Throw ${data.throwNumber}: ${data.segment.name} (${score} points)`);
  });

  eventBus.on('player.change', (event) => {
    const data = event.data as { playerName: string };
    console.log(`👤 Player change: ${data.playerName}'s turn`);
  });

  eventBus.on('takeout.started', () => {
    console.log('🔄 Takeout started');
  });

  eventBus.on('takeout.finished', () => {
    console.log('✅ Takeout finished');
  });

  eventBus.on('game.finished', (event) => {
    const data = event.data as { winnerName: string; leg: number; set: number };
    console.log(`🏆 Game finished! Winner: ${data.winnerName}`);
  });

  eventBus.on('match.finished', (event) => {
    const data = event.data as { winnerName: string };
    console.log(`🏆🏆 Match finished! Winner: ${data.winnerName}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    hub.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    hub.stop();
    process.exit(0);
  });

  // Start the hub
  try {
    await hub.start();
  } catch (error) {
    console.error('Failed to start hub:', error);
    process.exit(1);
  }
}

// Run if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  void main();
}
