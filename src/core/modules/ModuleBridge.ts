import * as net from 'net';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { ModuleProtocol } from './ModuleProtocol.js';
import type {
  IPCMessage,
  BridgeOptions,
  ConnectionState,
  ReadyPayload,
  StatusPayload,
  LogPayload,
  ErrorPayload,
  RoutesRegisterPayload,
  RouteRequestPayload,
  RouteResponsePayload,
  IntentEmitPayload,
  ModuleRequestPayload,
} from '../../types/modules.js';
import type { ParsedEvent } from '../../types/index.js';

const DEFAULT_OPTIONS: BridgeOptions = {
  socketPath: '',
  pingInterval: 10000,
  pingTimeout: 5000,
  reconnectDelay: 1000,
};

/**
 * ModuleBridge - IPC Socket Server for a single module
 *
 * Each module gets its own Unix domain socket for communication.
 * The bridge manages the connection lifecycle and message routing.
 */
export class ModuleBridge extends EventEmitter {
  private moduleId: string;
  private options: BridgeOptions;
  private server: net.Server | null = null;
  private client: net.Socket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private messageBuffer = '';
  private pingTimer: NodeJS.Timeout | null = null;
  private _lastPongTime = 0;
  private pendingResponses = new Map<string, {
    resolve: (value: IPCMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(moduleId: string, options: Partial<BridgeOptions> = {}) {
    super();
    this.moduleId = moduleId;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (!this.options.socketPath) {
      this.options.socketPath = this.getDefaultSocketPath();
    }
  }

  /**
   * Get the default socket path for this module
   */
  private getDefaultSocketPath(): string {
    const tmpDir = process.env.TMPDIR || '/tmp';
    return `${tmpDir}/autodarts-hub-${this.moduleId}.sock`;
  }

  /**
   * Start the IPC server and wait for module connection
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Bridge already started');
    }

    // Clean up old socket file if exists
    this.cleanupSocketFile();

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleClientConnection(socket);
      });

      this.server.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this.server.listen(this.options.socketPath, () => {
        this.emit('listening', this.options.socketPath);
        resolve();
      });
    });
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    this.stopPingTimer();

    // Reject all pending responses
    for (const [id, pending] of this.pendingResponses) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge stopped'));
      this.pendingResponses.delete(id);
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.cleanupSocketFile();
          this.server = null;
          this.setConnectionState('disconnected');
          resolve();
        });
      });
    }
  }

  /**
   * Check if a module is connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get the socket path
   */
  getSocketPath(): string {
    return this.options.socketPath;
  }

  /**
   * Send a message to the module
   */
  send<T>(message: IPCMessage<T>): boolean {
    if (!this.client || this.connectionState !== 'connected') {
      return false;
    }

    try {
      const data = ModuleProtocol.serialize(message);
      this.client.write(data);
      this.emit('sent', message);
      return true;
    } catch (err) {
      this.emit('error', err);
      return false;
    }
  }

  /**
   * Send a message and wait for a response
   */
  async sendAndWait<T, R>(message: IPCMessage<T>, timeout = 5000): Promise<IPCMessage<R>> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new Error(`Request timeout: ${message.type}`));
      }, timeout);

      this.pendingResponses.set(message.id, {
        resolve: resolve as (value: IPCMessage) => void,
        reject,
        timeout: timeoutHandle,
      });

      if (!this.send(message)) {
        clearTimeout(timeoutHandle);
        this.pendingResponses.delete(message.id);
        reject(new Error('Failed to send message'));
      }
    });
  }

  /**
   * Send an event to the module
   */
  sendEvent(event: ParsedEvent): boolean {
    const message = ModuleProtocol.createEvent(event);
    return this.send(message);
  }

  /**
   * Send init message to module
   */
  sendInit(config: Record<string, unknown>, subscribedEvents: string[]): boolean {
    const message = ModuleProtocol.createInit(
      this.moduleId,
      config,
      subscribedEvents as ParsedEvent['type'][],
      '1.0.0'
    );
    return this.send(message);
  }

  /**
   * Send config update to module
   */
  sendConfigUpdate(config: Record<string, unknown>, changedKeys: string[]): boolean {
    const message = ModuleProtocol.createConfigUpdate(config, changedKeys);
    return this.send(message);
  }

  /**
   * Send shutdown signal to module
   */
  sendShutdown(reason: 'user' | 'update' | 'hub-shutdown' | 'error', gracePeriodMs = 5000): boolean {
    const message = ModuleProtocol.createShutdown(reason, gracePeriodMs);
    return this.send(message);
  }

  /**
   * Send route request to module and wait for response
   */
  async sendRouteRequest(request: RouteRequestPayload, timeout = 30000): Promise<RouteResponsePayload> {
    const message = ModuleProtocol.createRouteRequest(request);
    const response = await this.sendAndWait<RouteRequestPayload, RouteResponsePayload>(message, timeout);
    return response.payload;
  }

  /**
   * Send ping and wait for pong
   */
  async ping(): Promise<number> {
    const start = Date.now();
    const message = ModuleProtocol.createPing();

    await this.sendAndWait(message, this.options.pingTimeout);
    return Date.now() - start;
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(socket: net.Socket): void {
    // Only allow one client at a time
    if (this.client) {
      socket.destroy();
      return;
    }

    this.client = socket;
    this.setConnectionState('connecting');
    this.messageBuffer = '';

    socket.on('data', (data) => {
      this.handleData(data);
    });

    socket.on('close', () => {
      this.handleClose();
    });

    socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.messageBuffer += data.toString();

    const { messages, remainder } = ModuleProtocol.parse(this.messageBuffer);
    this.messageBuffer = remainder;

    for (const message of messages) {
      this.handleMessage(message);
    }
  }

  /**
   * Handle a parsed message
   */
  private handleMessage(message: IPCMessage): void {
    this.emit('message', message);

    // Handle response to pending request
    const pending = this.pendingResponses.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingResponses.delete(message.id);
      pending.resolve(message);
      return;
    }

    // Handle specific message types
    switch (message.type) {
      case 'ready':
        this.handleReady(message as IPCMessage<ReadyPayload>);
        break;
      case 'status':
        this.emit('status', (message as IPCMessage<StatusPayload>).payload);
        break;
      case 'log':
        this.handleLog(message as IPCMessage<LogPayload>);
        break;
      case 'error':
        this.handleModuleError(message as IPCMessage<ErrorPayload>);
        break;
      case 'pong':
        this._lastPongTime = Date.now();
        // Resolve any pending ping
        for (const [id, pending] of this.pendingResponses) {
          if (id.startsWith('ping-')) {
            clearTimeout(pending.timeout);
            this.pendingResponses.delete(id);
            pending.resolve(message);
          }
        }
        break;
      case 'ping':
        this.send(ModuleProtocol.createPong());
        break;
      case 'routes.register':
        this.emit('routesRegister', (message as IPCMessage<RoutesRegisterPayload>).payload);
        break;
      case 'intent.emit':
        this.handleIntentEmit(message as IPCMessage<IntentEmitPayload>);
        break;
      case 'request':
        this.emit('request', (message as IPCMessage<ModuleRequestPayload>).payload, message.id);
        break;
      default:
        // Unknown message type, emit for custom handling
        this.emit(`message:${message.type}`, message);
    }
  }

  /**
   * Send response to a module request
   */
  sendRequestResponse(requestId: string, success: boolean, data?: unknown, error?: string): boolean {
    const message: IPCMessage = {
      id: this.generateMessageId(),
      type: 'request.response',
      timestamp: Date.now(),
      payload: {
        requestId,
        success,
        data,
        error,
      },
    };
    return this.send(message);
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Handle ready message from module
   */
  private handleReady(message: IPCMessage<ReadyPayload>): void {
    this.setConnectionState('connected');
    this.startPingTimer();
    this.emit('ready', message.payload);
  }

  /**
   * Handle log message from module
   */
  private handleLog(message: IPCMessage<LogPayload>): void {
    const { level, message: logMsg, context } = message.payload;
    this.emit('log', { level, message: logMsg, context, moduleId: this.moduleId });
  }

  /**
   * Handle error message from module
   */
  private handleModuleError(message: IPCMessage<ErrorPayload>): void {
    const { code, message: errorMsg, fatal, stack } = message.payload;
    this.emit('moduleError', { code, message: errorMsg, fatal, stack, moduleId: this.moduleId });

    if (fatal) {
      this.emit('fatalError', message.payload);
    }
  }

  /**
   * Handle intent emit from module
   */
  private handleIntentEmit(message: IPCMessage<IntentEmitPayload>): void {
    const { intentId, payload } = message.payload;
    this.emit('intentEmit', { moduleId: this.moduleId, intentId, payload });
  }

  /**
   * Handle client disconnect
   */
  private handleClose(): void {
    this.stopPingTimer();
    this.client = null;
    this.setConnectionState('disconnected');
    this.emit('disconnected');
  }

  /**
   * Get last pong time
   */
  getLastPongTime(): number {
    return this._lastPongTime;
  }

  /**
   * Set connection state and emit event
   */
  private setConnectionState(state: ConnectionState): void {
    const previous = this.connectionState;
    this.connectionState = state;

    if (previous !== state) {
      this.emit('stateChange', state, previous);
    }
  }

  /**
   * Start ping timer for health checking
   */
  private startPingTimer(): void {
    this.stopPingTimer();

    this.pingTimer = setInterval(async () => {
      try {
        await this.ping();
      } catch {
        // Ping failed, module may be unresponsive
        this.emit('pingFailed');
      }
    }, this.options.pingInterval);
  }

  /**
   * Stop ping timer
   */
  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Clean up socket file
   */
  private cleanupSocketFile(): void {
    try {
      if (fs.existsSync(this.options.socketPath)) {
        fs.unlinkSync(this.options.socketPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
