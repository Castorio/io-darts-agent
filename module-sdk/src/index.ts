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

// Route Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ModuleRouteDefinition {
  method: HttpMethod;
  path: string;
  handlerId: string;
  description?: string;
  requireAuth?: boolean;
  schema?: {
    body?: Record<string, unknown>;
    querystring?: Record<string, unknown>;
    params?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
}

export interface RouteRequest {
  handlerId: string;
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string>;
}

export interface RouteResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body: unknown;
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

// Core Player Types (for requesting player data from hub)
export interface CorePlayer {
  id: string;
  name: string;
  nickname?: string;
  color: string;
  avatar?: string;
  autodartsUserId?: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    legsPlayed: number;
    legsWon: number;
    averageScore: number;
    highestScore: number;
    total180s: number;
    totalCheckouts: number;
    bestCheckout: number;
    lastPlayed?: string;
  };
}

interface RequestResponsePayload {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface RouteRequestPayload {
  handlerId: string;
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string>;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type RouteHandler = (request: RouteRequest) => Promise<RouteResponse> | RouteResponse;

// ============================================
// Intent Template System
// ============================================

export type Locale = 'de' | 'en';

export interface IntentTemplateParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface IntentTemplate {
  id: string;
  category: string;
  priority: number;
  duration: number;
  templates: Record<Locale, string>;
  requiredParams: string[];
  optionalParams?: string[];
}

export interface RenderedIntent {
  message: string;
  category: string;
  priority: number;
  duration: number;
  templateId: string;
  params: IntentTemplateParams;
  locale: Locale;
}

// Global template registry
const intentTemplates: Map<string, IntentTemplate> = new Map();

/**
 * Register an intent template
 */
export function registerIntentTemplate(template: IntentTemplate): void {
  intentTemplates.set(template.id, template);
}

/**
 * Get a registered template by ID
 */
export function getIntentTemplate(templateId: string): IntentTemplate | undefined {
  return intentTemplates.get(templateId);
}

/**
 * Get all templates for a category
 */
export function getIntentTemplatesByCategory(category: string): IntentTemplate[] {
  return Array.from(intentTemplates.values()).filter(t => t.category === category);
}

/**
 * Render a template with parameters
 */
export function renderIntentTemplate(
  templateId: string,
  params: IntentTemplateParams,
  locale: Locale = 'de'
): RenderedIntent | null {
  const template = intentTemplates.get(templateId);
  if (!template) {
    return null;
  }

  // Check required params
  for (const param of template.requiredParams) {
    if (params[param] === undefined) {
      console.warn(`[IntentTemplate] Missing required param "${param}" for template "${templateId}"`);
      return null;
    }
  }

  // Get localized template string
  let message = template.templates[locale] || template.templates['de'];

  // Replace placeholders {{param}}
  message = message.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    if (value === undefined) return `{{${key}}}`;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(1);
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  });

  return {
    message,
    category: template.category,
    priority: template.priority,
    duration: template.duration,
    templateId,
    params,
    locale
  };
}

/**
 * Create intent payload from a template
 */
export function createIntentPayload(
  templateId: string,
  params: IntentTemplateParams,
  locale: Locale = 'de',
  overrides?: Partial<{ priority: number; duration: number; category: string }>
): Record<string, unknown> | null {
  const rendered = renderIntentTemplate(templateId, params, locale);
  if (!rendered) return null;

  return {
    message: rendered.message,
    category: overrides?.category ?? rendered.category,
    priority: overrides?.priority ?? rendered.priority,
    duration: overrides?.duration ?? rendered.duration,
    templateId,
    params,
    locale
  };
}

/**
 * Bulk register multiple templates
 */
export function registerIntentTemplates(templates: IntentTemplate[]): void {
  for (const template of templates) {
    intentTemplates.set(template.id, template);
  }
}

/**
 * Clear all registered templates
 */
export function clearIntentTemplates(): void {
  intentTemplates.clear();
}

/**
 * Get all registered template IDs
 */
export function getIntentTemplateIds(): string[] {
  return Array.from(intentTemplates.keys());
}

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
  private routeHandlers = new Map<string, RouteHandler>();
  private pendingRequests = new Map<string, { resolve: (data: unknown) => void; reject: (error: Error) => void }>();

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
   * Send a request to hub and wait for response
   */
  protected async request<T = unknown>(action: string, data?: Record<string, unknown>, timeoutMs = 5000): Promise<T> {
    const requestId = this.generateId();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${action} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store the pending request
      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          resolve(result as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          reject(error);
        },
      });

      // Send the request
      this.send({
        id: requestId,
        type: 'request',
        timestamp: Date.now(),
        payload: { action, data, requestId },
      });
    });
  }

  // ============================================
  // Core Data Access API
  // ============================================

  /**
   * Get all registered players from the hub
   */
  protected async getCorePlayers(): Promise<CorePlayer[]> {
    const result = await this.request<{ players: CorePlayer[] }>('getPlayers');
    return result.players || [];
  }

  /**
   * Get a specific player by ID from the hub
   */
  protected async getCorePlayerById(playerId: string): Promise<CorePlayer | undefined> {
    const result = await this.request<{ player?: CorePlayer }>('getPlayer', { playerId });
    return result.player;
  }

  /**
   * Get a specific player by name from the hub
   */
  protected async getCorePlayerByName(playerName: string): Promise<CorePlayer | undefined> {
    const result = await this.request<{ player?: CorePlayer }>('getPlayerByName', { playerName });
    return result.player;
  }

  /**
   * Check if a player is registered in the core
   */
  protected async isCorePlayer(playerNameOrId: string): Promise<boolean> {
    const result = await this.request<{ exists: boolean }>('isPlayerRegistered', { identifier: playerNameOrId });
    return result.exists || false;
  }

  /**
   * Emit an intent to the hub
   *
   * Intents are semantic messages that other modules can react to.
   * The intentId must be declared in the module's module.json under intents.emits
   *
   * @param intentId - The intent identifier (e.g., "mqtt.message.published")
   * @param payload - Optional payload data for the intent
   */
  protected emitIntent(intentId: string, payload: Record<string, unknown> = {}): void {
    this.send({
      id: this.generateId(),
      type: 'intent.emit',
      timestamp: Date.now(),
      payload: { intentId, payload },
    });
    this.log('debug', `Emitted intent: ${intentId}`, payload);
  }

  /**
   * Emit an intent using a template
   *
   * Renders a registered template with the provided parameters and emits it.
   *
   * @param intentId - The intent identifier
   * @param templateId - The template ID to render
   * @param params - Template parameters
   * @param locale - Locale for message (default: 'de')
   * @param overrides - Optional overrides for priority, duration, category
   * @returns true if intent was emitted, false if template not found or params invalid
   */
  protected emitTemplatedIntent(
    intentId: string,
    templateId: string,
    params: IntentTemplateParams,
    locale: Locale = 'de',
    overrides?: Partial<{ priority: number; duration: number; category: string }>
  ): boolean {
    const payload = createIntentPayload(templateId, params, locale, overrides);
    if (!payload) {
      this.log('warn', `Failed to render template "${templateId}" for intent "${intentId}"`);
      return false;
    }

    this.emitIntent(intentId, payload);
    return true;
  }

  /**
   * Register intent templates for this module
   *
   * @param templates - Array of templates to register
   */
  protected registerTemplates(templates: IntentTemplate[]): void {
    registerIntentTemplates(templates);
    this.log('debug', `Registered ${templates.length} intent templates`);
  }

  // ============================================
  // Route Registration API
  // ============================================

  /**
   * Register API routes with the hub
   *
   * Routes are mounted under /api/modules/:moduleId/routes/*
   * After registering routes, set up handlers using setRouteHandler()
   *
   * @param routes - Array of route definitions
   */
  protected registerRoutes(routes: ModuleRouteDefinition[]): void {
    this.send({
      id: this.generateId(),
      type: 'routes.register',
      timestamp: Date.now(),
      payload: { routes },
    });
    this.log('info', `Registered ${routes.length} API routes with hub`);
  }

  /**
   * Set a handler for a specific route
   *
   * @param handlerId - The handler ID matching the route definition
   * @param handler - The handler function
   */
  protected setRouteHandler(handlerId: string, handler: RouteHandler): void {
    this.routeHandlers.set(handlerId, handler);
  }

  /**
   * Remove a route handler
   *
   * @param handlerId - The handler ID to remove
   */
  protected removeRouteHandler(handlerId: string): void {
    this.routeHandlers.delete(handlerId);
  }

  /**
   * Handle incoming route request from hub
   */
  private async handleRouteRequest(message: IPCMessage<RouteRequestPayload>): Promise<void> {
    const { handlerId, method, path, params, query, body, headers } = message.payload;

    const handler = this.routeHandlers.get(handlerId);
    if (!handler) {
      this.sendRouteResponse(message.id, {
        statusCode: 404,
        body: { error: `No handler registered for "${handlerId}"` },
      });
      return;
    }

    try {
      const response = await handler({ handlerId, method, path, params, query, body, headers });
      this.sendRouteResponse(message.id, response);
    } catch (err) {
      const error = err as Error;
      this.log('error', `Route handler error: ${error.message}`, { handlerId, path });
      this.sendRouteResponse(message.id, {
        statusCode: 500,
        body: { error: error.message },
      });
    }
  }

  /**
   * Send route response back to hub
   */
  private sendRouteResponse(requestId: string, response: RouteResponse): void {
    this.send({
      id: requestId, // Use the same ID for correlation
      type: 'route.response',
      timestamp: Date.now(),
      payload: response,
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
      case 'route.request':
        await this.handleRouteRequest(message as IPCMessage<RouteRequestPayload>);
        break;
      case 'request.response':
        this.handleRequestResponse(message.payload as RequestResponsePayload);
        break;
    }
  }

  private handleRequestResponse(payload: RequestResponsePayload): void {
    const pending = this.pendingRequests.get(payload.requestId);
    if (!pending) {
      this.log('warn', `Received response for unknown request: ${payload.requestId}`);
      return;
    }

    if (payload.success) {
      pending.resolve(payload.data);
    } else {
      pending.reject(new Error(payload.error || 'Request failed'));
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
