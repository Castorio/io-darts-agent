import * as net from 'net';
import { EventEmitter } from 'events';

// ============================================
// Types (duplicated from hub for standalone use)
// ============================================

export type AutodartsEventType =
  | 'board.state'
  | 'board.event'
  | 'match.start'
  | 'match.delete'
  | 'match.finish'
  | 'match.state'
  | 'match.result'
  | 'throw.detected'
  | 'takeout.started'
  | 'takeout.finished'
  | 'player.change'
  | 'turn.finished'
  | 'game.finished'
  | 'match.finished'
  | 'raw';

export interface ParsedEvent<T = unknown> {
  type: AutodartsEventType;
  timestamp: Date;
  raw: { channel: string; topic: string; data: unknown };
  data: T;
}

export interface ThrowSegment {
  bed: string;
  multiplier: number;
  name: string;
  number: number;
}

export interface ThrowCoords {
  x: number;
  y: number;
}

export interface ThrowData {
  segment: ThrowSegment;
  coords?: ThrowCoords;
  throwNumber: number;
  boardId: string;
}

export interface MatchData {
  matchId: string;
  player: number;
  playerName: string;
  gameScores: number[];
  turnScore: number;
  round: number;
  finished: boolean;
  winner: number | null;
}

// IPC Types
interface IPCMessage<T = unknown> {
  id: string;
  type: string;
  timestamp: number;
  payload: T;
}

interface InitPayload {
  moduleId: string;
  config: Record<string, unknown>;
  hubVersion: string;
  subscribedEvents: string[];
}

interface EventPayload {
  event: ParsedEvent;
}

interface ConfigUpdatePayload {
  config: Record<string, unknown>;
  changedKeys: string[];
}

interface ShutdownPayload {
  reason: string;
  gracePeriodMs: number;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================
// Module Base Class
// ============================================

export interface ModuleOptions {
  socketPath?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_OPTIONS: Required<ModuleOptions> = {
  socketPath: process.env.AUTODARTS_SOCKET_PATH || '',
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
};

/**
 * AutodartsModule - Base class for all IO-Darts-Agent modules
 *
 * Extend this class to create your own module:
 *
 * ```typescript
 * class MyModule extends AutodartsModule {
 *   protected async onInit(config: Record<string, unknown>): Promise<void> {
 *     // Initialize your module
 *   }
 *
 *   protected async onEvent(event: ParsedEvent): Promise<void> {
 *     // Handle events
 *   }
 * }
 *
 * const module = new MyModule();
 * module.start();
 * ```
 */
export abstract class AutodartsModule extends EventEmitter {
  protected moduleId: string;
  protected config: Record<string, unknown> = {};
  protected options: Required<ModuleOptions>;

  private socket: net.Socket | null = null;
  private messageBuffer = '';
  private connected = false;
  private reconnectAttempts = 0;
  private shutdownRequested = false;

  constructor(options: ModuleOptions = {}) {
    super();
    this.moduleId = process.env.AUTODARTS_MODULE_ID || 'unknown';
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start the module and connect to hub
   */
  async start(): Promise<void> {
    if (!this.options.socketPath) {
      throw new Error('Socket path not configured. Set AUTODARTS_SOCKET_PATH environment variable.');
    }

    await this.connect();
  }

  /**
   * Stop the module gracefully
   */
  async stop(): Promise<void> {
    this.shutdownRequested = true;
    await this.onShutdown('user');
    this.disconnect();
  }

  /**
   * Log a message (sent to hub)
   */
  protected log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.send({
      id: this.generateId(),
      type: 'log',
      timestamp: Date.now(),
      payload: { level, message, context },
    });

    // Also log locally
    const prefix = `[${this.moduleId}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, context || '');
        break;
      case 'info':
        console.info(prefix, message, context || '');
        break;
      case 'warn':
        console.warn(prefix, message, context || '');
        break;
      case 'error':
        console.error(prefix, message, context || '');
        break;
    }
  }

  /**
   * Report an error to hub
   */
  protected reportError(code: string, message: string, fatal = false): void {
    const stack = new Error().stack;
    this.send({
      id: this.generateId(),
      type: 'error',
      timestamp: Date.now(),
      payload: { code, message, fatal, stack },
    });
  }

  /**
   * Update module status
   */
  protected updateStatus(status: string, message?: string, data?: Record<string, unknown>): void {
    this.send({
      id: this.generateId(),
      type: 'status',
      timestamp: Date.now(),
      payload: { status, message, data },
    });
  }

  /**
   * Send a request to hub
   */
  protected async request(action: string, data?: Record<string, unknown>): Promise<void> {
    this.send({
      id: this.generateId(),
      type: 'request',
      timestamp: Date.now(),
      payload: { action, data },
    });
  }

  // ============================================
  // Abstract methods - implement in your module
  // ============================================

  /**
   * Called when module is initialized with config
   */
  protected abstract onInit(config: Record<string, unknown>): Promise<void>;

  /**
   * Called when an event is received
   */
  protected abstract onEvent(event: ParsedEvent): Promise<void>;

  /**
   * Called when config is updated
   */
  protected async onConfigUpdate(config: Record<string, unknown>, changedKeys: string[]): Promise<void> {
    this.config = config;
  }

  /**
   * Called when shutdown is requested
   */
  protected async onShutdown(reason: string): Promise<void> {
    // Override in subclass for cleanup
  }

  // ============================================
  // Private methods
  // ============================================

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.options.socketPath, () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.sendReady();
        resolve();
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.handleDisconnect();
      });

      this.socket.on('error', (err) => {
        if (!this.connected) {
          reject(err);
        } else {
          this.emit('error', err);
        }
      });
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  private handleDisconnect(): void {
    if (this.shutdownRequested) {
      return;
    }

    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.log('warn', `Disconnected from hub, reconnecting (attempt ${this.reconnectAttempts})...`);

      setTimeout(() => {
        this.connect().catch((err) => {
          this.log('error', 'Reconnect failed', { error: err.message });
        });
      }, this.options.reconnectDelay);
    } else {
      this.log('error', 'Max reconnect attempts reached, exiting');
      process.exit(1);
    }
  }

  private handleData(data: Buffer): void {
    this.messageBuffer += data.toString();

    const messages = this.parseMessages();
    for (const message of messages) {
      this.handleMessage(message);
    }
  }

  private parseMessages(): IPCMessage[] {
    const messages: IPCMessage[] = [];
    const parts = this.messageBuffer.split('\n');
    this.messageBuffer = parts.pop() || '';

    for (const part of parts) {
      if (part.trim()) {
        try {
          messages.push(JSON.parse(part));
        } catch {
          // Skip invalid JSON
        }
      }
    }

    return messages;
  }

  private async handleMessage(message: IPCMessage): Promise<void> {
    switch (message.type) {
      case 'init':
        await this.handleInit(message.payload as InitPayload);
        break;
      case 'event':
        await this.handleEvent(message.payload as EventPayload);
        break;
      case 'config.update':
        await this.handleConfigUpdate(message.payload as ConfigUpdatePayload);
        break;
      case 'shutdown':
        await this.handleShutdown(message.payload as ShutdownPayload);
        break;
      case 'ping':
        this.sendPong();
        break;
    }
  }

  private async handleInit(payload: InitPayload): Promise<void> {
    this.moduleId = payload.moduleId;
    this.config = payload.config;

    try {
      await this.onInit(payload.config);
      this.log('info', 'Module initialized');
    } catch (err) {
      const error = err as Error;
      this.reportError('INIT_FAILED', error.message, true);
    }
  }

  private async handleEvent(payload: EventPayload): Promise<void> {
    try {
      await this.onEvent(payload.event);
    } catch (err) {
      const error = err as Error;
      this.log('error', `Event handler error: ${error.message}`, { event: payload.event.type });
    }
  }

  private async handleConfigUpdate(payload: ConfigUpdatePayload): Promise<void> {
    try {
      await this.onConfigUpdate(payload.config, payload.changedKeys);
      this.log('info', 'Config updated', { changedKeys: payload.changedKeys });
    } catch (err) {
      const error = err as Error;
      this.log('error', `Config update error: ${error.message}`);
    }
  }

  private async handleShutdown(payload: ShutdownPayload): Promise<void> {
    this.shutdownRequested = true;
    this.log('info', `Shutdown requested: ${payload.reason}`);

    try {
      await this.onShutdown(payload.reason);
    } catch (err) {
      const error = err as Error;
      this.log('error', `Shutdown error: ${error.message}`);
    }

    // Exit after grace period
    setTimeout(() => {
      process.exit(0);
    }, Math.min(payload.gracePeriodMs, 100)); // Exit quickly after cleanup
  }

  private sendReady(): void {
    this.send({
      id: this.generateId(),
      type: 'ready',
      timestamp: Date.now(),
      payload: {
        moduleId: this.moduleId,
        version: '1.0.0',
      },
    });
  }

  private sendPong(): void {
    this.send({
      id: this.generateId(),
      type: 'pong',
      timestamp: Date.now(),
      payload: {},
    });
  }

  private send(message: IPCMessage): void {
    if (this.socket && this.connected) {
      this.socket.write(JSON.stringify(message) + '\n');
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Types are exported via interface declarations above
