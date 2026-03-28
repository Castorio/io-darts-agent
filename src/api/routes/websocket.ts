import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { APIServer } from '../Server.js';
import type { WSMessage, WSEventMessage, WSStatusMessage, WSModuleMessage } from '../../types/api.js';
import type { ParsedEvent, ModuleStatus } from '../../types/index.js';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'event' | 'module' | 'system';
  source: string;
  message: string;
  data?: unknown;
}

export interface WSLogMessage {
  type: 'log';
  entry: LogEntry;
}

export interface WebSocketDependencies {
  getAutodartsStatus: () => { connected: boolean; matchId?: string };
  subscribeToEvents: (handler: (event: ParsedEvent) => void) => () => void;
  subscribeToModuleStatus: (handler: (moduleId: string, status: ModuleStatus) => void) => () => void;
  subscribeToLogs?: (handler: (entry: LogEntry) => void) => () => void;
  getLogHistory?: () => LogEntry[];
}

interface WSClient {
  socket: WebSocket;
  sessionId?: string;
  authenticated: boolean;
  subscriptions: Set<string>;
}

/**
 * WebSocket manager for live event streaming
 */
export class WebSocketManager {
  private clients = new Set<WSClient>();
  private unsubscribeEvents?: () => void;
  private unsubscribeModules?: () => void;
  private unsubscribeLogs?: () => void;

  constructor(
    private server: APIServer,
    private deps: WebSocketDependencies
  ) {}

  /**
   * Register WebSocket routes
   */
  register(fastify: FastifyInstance): void {
    fastify.get('/api/events', { websocket: true }, (socket, request) => {
      this.handleConnection(socket, request.cookies['autodarts_session']);
    });

    // REST API for log history
    fastify.get('/api/logs', async () => {
      if (this.deps.getLogHistory) {
        return this.deps.getLogHistory();
      }
      return [];
    });
  }

  /**
   * Start listening for events
   */
  start(): void {
    // Subscribe to parsed events
    this.unsubscribeEvents = this.deps.subscribeToEvents((event) => {
      this.broadcastEvent(event);
    });

    // Subscribe to module status changes
    this.unsubscribeModules = this.deps.subscribeToModuleStatus((moduleId, status) => {
      this.broadcastModuleStatus(moduleId, status);
    });

    // Subscribe to logs if available
    if (this.deps.subscribeToLogs) {
      this.unsubscribeLogs = this.deps.subscribeToLogs((entry) => {
        this.broadcastLog(entry);
      });
    }
  }

  /**
   * Stop listening and close all connections
   */
  stop(): void {
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
    }
    if (this.unsubscribeModules) {
      this.unsubscribeModules();
    }
    if (this.unsubscribeLogs) {
      this.unsubscribeLogs();
    }

    // Close all client connections
    for (const client of this.clients) {
      client.socket.close(1000, 'Server shutting down');
    }
    this.clients.clear();
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, sessionId?: string): void {
    // Check authentication
    const authEnabled = this.server.isAuthEnabled();
    const authenticated = !authEnabled || (sessionId ? this.server.isSessionValid(sessionId) : false);

    if (authEnabled && !authenticated) {
      socket.close(4001, 'Authentication required');
      return;
    }

    const client: WSClient = {
      socket,
      sessionId,
      authenticated,
      subscriptions: new Set(['*']), // Subscribe to all by default
    };

    this.clients.add(client);

    // Send initial status
    this.sendStatus(client);

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle close
    socket.on('close', () => {
      this.clients.delete(client);
    });

    // Handle errors
    socket.on('error', () => {
      this.clients.delete(client);
    });
  }

  /**
   * Handle message from client
   */
  private handleClientMessage(client: WSClient, message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'subscribe':
        // Subscribe to specific event types
        if (Array.isArray(message.events)) {
          client.subscriptions.clear();
          for (const event of message.events) {
            if (typeof event === 'string') {
              client.subscriptions.add(event);
            }
          }
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from specific event types
        if (Array.isArray(message.events)) {
          for (const event of message.events) {
            if (typeof event === 'string') {
              client.subscriptions.delete(event);
            }
          }
        }
        break;

      case 'ping':
        // Respond to ping with pong
        this.send(client, { type: 'pong', timestamp: Date.now() });
        break;
    }
  }

  /**
   * Send current status to a client
   */
  private sendStatus(client: WSClient): void {
    const status = this.deps.getAutodartsStatus();
    const message: WSStatusMessage = {
      type: 'status',
      status,
    };
    this.send(client, message);
  }

  /**
   * Broadcast event to all subscribed clients
   */
  private broadcastEvent(event: ParsedEvent): void {
    const message: WSEventMessage = {
      type: 'event',
      event: {
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        data: event.data,
      },
    };

    for (const client of this.clients) {
      // Check if client is subscribed to this event type
      if (client.subscriptions.has('*') || client.subscriptions.has(event.type)) {
        this.send(client, message);
      }
    }
  }

  /**
   * Broadcast module status change
   */
  private broadcastModuleStatus(moduleId: string, status: ModuleStatus): void {
    const message: WSModuleMessage = {
      type: 'module',
      moduleId,
      status,
    };

    for (const client of this.clients) {
      this.send(client, message);
    }
  }

  /**
   * Broadcast log entry to all clients
   */
  private broadcastLog(entry: LogEntry): void {
    const message: WSLogMessage = {
      type: 'log',
      entry,
    };

    for (const client of this.clients) {
      // Check if client is subscribed to logs (or subscribed to all)
      if (client.subscriptions.has('*') || client.subscriptions.has('logs')) {
        this.send(client, message);
      }
    }
  }

  /**
   * Broadcast status update to all clients
   */
  broadcastStatusUpdate(): void {
    const status = this.deps.getAutodartsStatus();
    const message: WSStatusMessage = {
      type: 'status',
      status,
    };

    for (const client of this.clients) {
      this.send(client, message);
    }
  }

  /**
   * Send message to a client
   */
  private send(client: WSClient, message: WSMessage | WSLogMessage | { type: string; [key: string]: unknown }): void {
    if (client.socket.readyState === 1) { // WebSocket.OPEN
      client.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

/**
 * Register WebSocket routes
 */
export function registerWebSocketRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: WebSocketDependencies
): WebSocketManager {
  const manager = new WebSocketManager(server, deps);
  manager.register(fastify);
  return manager;
}
