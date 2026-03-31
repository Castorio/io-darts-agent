import { randomUUID } from 'crypto';
import type {
  IPCMessage,
  IPCMessageType,
  InitPayload,
  EventPayload,
  ConfigUpdatePayload,
  ShutdownPayload,
  ReadyPayload,
  StatusPayload,
  LogPayload,
  ErrorPayload,
  RequestPayload,
  RouteRequestPayload,
  RouteResponsePayload,
  RoutesRegisterPayload,
} from '../../types/modules.js';
import type { ParsedEvent, AutodartsEventType } from '../../types/index.js';

/**
 * ModuleProtocol - Handles IPC message creation and parsing
 *
 * All communication between Hub and Module uses this protocol.
 * Messages are JSON-encoded and sent over Unix domain sockets.
 */
export class ModuleProtocol {
  private static readonly MESSAGE_DELIMITER = '\n';

  /**
   * Create a new IPC message
   */
  static createMessage<T>(type: IPCMessageType, payload: T): IPCMessage<T> {
    return {
      id: randomUUID(),
      type,
      timestamp: Date.now(),
      payload,
    };
  }

  /**
   * Serialize a message for transmission
   */
  static serialize<T>(message: IPCMessage<T>): string {
    return JSON.stringify(message) + this.MESSAGE_DELIMITER;
  }

  /**
   * Parse raw data into messages (handles partial messages)
   */
  static parse(buffer: string): { messages: IPCMessage[]; remainder: string } {
    const messages: IPCMessage[] = [];
    const parts = buffer.split(this.MESSAGE_DELIMITER);

    // Last part is either empty (complete message) or partial (incomplete)
    const remainder = parts.pop() ?? '';

    for (const part of parts) {
      if (part.trim()) {
        try {
          const message = JSON.parse(part) as IPCMessage;
          if (this.isValidMessage(message)) {
            messages.push(message);
          }
        } catch {
          // Skip invalid JSON
          console.error('Failed to parse IPC message:', part.substring(0, 100));
        }
      }
    }

    return { messages, remainder };
  }

  /**
   * Validate message structure
   */
  static isValidMessage(message: unknown): message is IPCMessage {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;
    return (
      typeof msg.id === 'string' &&
      typeof msg.type === 'string' &&
      typeof msg.timestamp === 'number' &&
      'payload' in msg
    );
  }

  // ============================================
  // Hub → Module Message Factories
  // ============================================

  /**
   * Create an init message to send to a module
   */
  static createInit(
    moduleId: string,
    config: Record<string, unknown>,
    subscribedEvents: AutodartsEventType[],
    hubVersion = '1.0.0',
    language = 'en'
  ): IPCMessage<InitPayload> {
    return this.createMessage('init', {
      moduleId,
      config,
      hubVersion,
      subscribedEvents,
      language,
    });
  }

  /**
   * Create an event message to send to a module
   */
  static createEvent(event: ParsedEvent): IPCMessage<EventPayload> {
    return this.createMessage('event', { event });
  }

  /**
   * Create a config update message
   */
  static createConfigUpdate(
    config: Record<string, unknown>,
    changedKeys: string[]
  ): IPCMessage<ConfigUpdatePayload> {
    return this.createMessage('config.update', { config, changedKeys });
  }

  /**
   * Create a shutdown message
   */
  static createShutdown(
    reason: ShutdownPayload['reason'],
    gracePeriodMs = 5000
  ): IPCMessage<ShutdownPayload> {
    return this.createMessage('shutdown', { reason, gracePeriodMs });
  }

  /**
   * Create a ping message
   */
  static createPing(): IPCMessage<Record<string, never>> {
    return this.createMessage('ping', {});
  }

  // ============================================
  // Module → Hub Message Factories
  // ============================================

  /**
   * Create a ready message
   */
  static createReady(
    moduleId: string,
    version: string,
    capabilities?: string[]
  ): IPCMessage<ReadyPayload> {
    return this.createMessage('ready', { moduleId, version, capabilities });
  }

  /**
   * Create a status message
   */
  static createStatus(
    status: StatusPayload['status'],
    message?: string,
    data?: Record<string, unknown>
  ): IPCMessage<StatusPayload> {
    return this.createMessage('status', { status, message, data });
  }

  /**
   * Create a log message
   */
  static createLog(
    level: LogPayload['level'],
    message: string,
    context?: Record<string, unknown>
  ): IPCMessage<LogPayload> {
    return this.createMessage('log', { level, message, context });
  }

  /**
   * Create an error message
   */
  static createError(
    code: string,
    message: string,
    fatal = false,
    stack?: string
  ): IPCMessage<ErrorPayload> {
    return this.createMessage('error', { code, message, fatal, stack });
  }

  /**
   * Create a request message
   */
  static createRequest(
    action: string,
    data?: Record<string, unknown>
  ): IPCMessage<RequestPayload> {
    return this.createMessage('request', { action, data });
  }

  /**
   * Create a pong message (response to ping)
   */
  static createPong(): IPCMessage<Record<string, never>> {
    return this.createMessage('pong', {});
  }

  // ============================================
  // Route-related Message Factories
  // ============================================

  /**
   * Create a route request message (Hub → Module)
   */
  static createRouteRequest(request: RouteRequestPayload): IPCMessage<RouteRequestPayload> {
    return this.createMessage('route.request', request);
  }

  /**
   * Create a route response message (Module → Hub)
   */
  static createRouteResponse(
    response: RouteResponsePayload,
    requestId?: string
  ): IPCMessage<RouteResponsePayload> {
    const msg = this.createMessage('route.response', response);
    // Use the request ID for response correlation if provided
    if (requestId) {
      msg.id = requestId;
    }
    return msg;
  }

  /**
   * Create a routes registration message (Module → Hub)
   */
  static createRoutesRegister(payload: RoutesRegisterPayload): IPCMessage<RoutesRegisterPayload> {
    return this.createMessage('routes.register', payload);
  }

  // ============================================
  // Type Guards
  // ============================================

  static isInitMessage(msg: IPCMessage): msg is IPCMessage<InitPayload> {
    return msg.type === 'init';
  }

  static isEventMessage(msg: IPCMessage): msg is IPCMessage<EventPayload> {
    return msg.type === 'event';
  }

  static isConfigUpdateMessage(msg: IPCMessage): msg is IPCMessage<ConfigUpdatePayload> {
    return msg.type === 'config.update';
  }

  static isShutdownMessage(msg: IPCMessage): msg is IPCMessage<ShutdownPayload> {
    return msg.type === 'shutdown';
  }

  static isReadyMessage(msg: IPCMessage): msg is IPCMessage<ReadyPayload> {
    return msg.type === 'ready';
  }

  static isStatusMessage(msg: IPCMessage): msg is IPCMessage<StatusPayload> {
    return msg.type === 'status';
  }

  static isLogMessage(msg: IPCMessage): msg is IPCMessage<LogPayload> {
    return msg.type === 'log';
  }

  static isErrorMessage(msg: IPCMessage): msg is IPCMessage<ErrorPayload> {
    return msg.type === 'error';
  }

  static isRequestMessage(msg: IPCMessage): msg is IPCMessage<RequestPayload> {
    return msg.type === 'request';
  }

  static isPingMessage(msg: IPCMessage): boolean {
    return msg.type === 'ping';
  }

  static isPongMessage(msg: IPCMessage): boolean {
    return msg.type === 'pong';
  }

  static isRouteRequestMessage(msg: IPCMessage): msg is IPCMessage<RouteRequestPayload> {
    return msg.type === 'route.request';
  }

  static isRouteResponseMessage(msg: IPCMessage): msg is IPCMessage<RouteResponsePayload> {
    return msg.type === 'route.response';
  }

  static isRoutesRegisterMessage(msg: IPCMessage): msg is IPCMessage<RoutesRegisterPayload> {
    return msg.type === 'routes.register';
  }
}
