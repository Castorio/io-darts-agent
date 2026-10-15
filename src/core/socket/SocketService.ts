import WebSocket from 'ws';
import type {
  WSOutgoingMessage,
  AutodartsMessage,
} from '../../types/index.js';
import { EventParser } from './EventParser.js';
import { EventBus } from '../events/EventBus.js';

const WS_URL = 'wss://play.ws.autodarts.com/ms/v0/subscribe';

/** Supplies a fresh single-use message bus ticket per connection attempt */
export type TicketProvider = () => Promise<string>;

export interface SocketServiceOptions {
  wsUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class SocketService {
  private wsUrl: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;

  private ws: WebSocket | null = null;
  private ticketProvider: TicketProvider | null = null;
  // Identifies the current connection attempt; stale ticket fetches and sockets are dropped
  private attemptId = 0;
  private boardId: string;
  private eventParser: EventParser;
  private eventBus: EventBus;

  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private subscriptions: Set<string> = new Set();
  private pendingSubscriptions: WSOutgoingMessage[] = [];

  private onConnectionChange?: (state: ConnectionState) => void;
  private onError?: (error: Error) => void;

  constructor(
    boardId: string,
    eventBus: EventBus,
    options: SocketServiceOptions = {}
  ) {
    this.boardId = boardId;
    this.eventBus = eventBus;
    this.eventParser = new EventParser(boardId);
    this.wsUrl = options.wsUrl ?? WS_URL;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  /**
   * Connect to the WebSocket server. Every attempt, including reconnects,
   * fetches a fresh ticket from the provider.
   */
  connect(ticketProvider: TicketProvider): void {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.clearReconnectTimeout();
    this.ticketProvider = ticketProvider;
    this.connectionState = 'connecting';
    this.onConnectionChange?.(this.connectionState);

    void this.openWithFreshTicket();
  }

  /**
   * Resolve once the socket is connected, reject after the timeout.
   */
  waitUntilConnected(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const poll = setInterval(() => {
        if (this.connectionState === 'connected') {
          clearInterval(poll);
          resolve();
        } else if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(poll);
          reject(new Error('Connection timeout'));
        }
      }, 50);
    });
  }

  private async openWithFreshTicket(): Promise<void> {
    const provider = this.ticketProvider;
    if (!provider) return;
    const attempt = ++this.attemptId;

    let ticket: string;
    try {
      ticket = await provider();
    } catch (error) {
      if (attempt !== this.attemptId) return;
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.handleConnectFailure();
      return;
    }

    // A disconnect() or a newer connect() happened while the ticket was in flight
    if (attempt !== this.attemptId) return;

    const ws = new WebSocket(`${this.wsUrl}?code=${encodeURIComponent(ticket)}`);
    this.ws = ws;
    const current = (): boolean => attempt === this.attemptId && this.ws === ws;

    ws.on('open', () => current() && this.handleOpen());
    ws.on('message', (data: WebSocket.RawData) => current() && this.handleMessage(data));
    ws.on('close', (code: number, reason: Buffer) => current() && this.handleClose(code, reason));
    ws.on('error', (error: Error) => current() && this.handleError(error));
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.attemptId++;
    this.clearReconnectTimeout();
    this.subscriptions.clear();
    this.pendingSubscriptions = [];
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.onConnectionChange?.(this.connectionState);
  }

  /**
   * Subscribe to a channel/topic
   */
  subscribe(channel: string, topic: string): void {
    const key = `${channel}:${topic}`;
    if (this.subscriptions.has(key)) return;

    const message: WSOutgoingMessage = { type: 'subscribe', channel, topic };

    if (this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.send(message);
      this.subscriptions.add(key);
    } else {
      this.pendingSubscriptions.push(message);
    }
  }

  /**
   * Unsubscribe from a channel/topic
   */
  unsubscribe(channel: string, topic: string): void {
    const key = `${channel}:${topic}`;
    if (!this.subscriptions.has(key)) return;

    const message: WSOutgoingMessage = { type: 'unsubscribe', channel, topic };

    if (this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.send(message);
    }

    this.subscriptions.delete(key);
    this.pendingSubscriptions = this.pendingSubscriptions.filter(
      (m) => !(m.channel === channel && m.topic === topic)
    );
  }

  /**
   * Subscribe to initial board events
   */
  subscribeToBoard(): void {
    this.subscribe('autodarts.boards', `${this.boardId}.state`);
    this.subscribe('autodarts.boards', `${this.boardId}.matches`);
  }

  /**
   * Subscribe to match events
   */
  subscribeToMatch(matchId: string): void {
    console.log(`🔔 SocketService.subscribeToMatch: matchId=${matchId}, boardId=${this.boardId}`);
    this.eventParser.setMatchId(matchId);
    this.subscribe('autodarts.matches', `${matchId}.state`);
    this.subscribe('autodarts.boards', `${this.boardId}.events`);
    console.log(`🔔 SocketService.subscribeToMatch: Subscribed to autodarts.boards/${this.boardId}.events`);
  }

  /**
   * Unsubscribe from match events
   */
  unsubscribeFromMatch(matchId: string): void {
    this.eventParser.setMatchId(null);
    this.unsubscribe('autodarts.matches', `${matchId}.state`);
    this.unsubscribe('autodarts.boards', `${this.boardId}.events`);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current match ID
   */
  getMatchId(): string | null {
    return this.eventParser.getMatchId();
  }

  /**
   * Get current match state
   */
  getCurrentMatchState(): import('../../types/index.js').MatchStateData | null {
    return this.eventParser.getCurrentMatchState();
  }

  /**
   * Get timestamp of last match update
   */
  getLastMatchUpdate(): Date | null {
    return this.eventParser.getLastMatchUpdate();
  }

  /**
   * Set connection state change callback
   */
  onStateChange(callback: (state: ConnectionState) => void): void {
    this.onConnectionChange = callback;
  }

  /**
   * Set error callback
   */
  onErrorCallback(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  // ==================== Private Methods ====================

  private handleOpen(): void {
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    this.onConnectionChange?.(this.connectionState);

    // Resend pending subscriptions
    const pending = [...this.pendingSubscriptions];
    this.pendingSubscriptions = [];

    for (const message of pending) {
      this.send(message);
      this.subscriptions.add(`${message.channel}:${message.topic}`);
    }

    // Re-subscribe to all previous subscriptions (for reconnect)
    for (const key of this.subscriptions) {
      const [channel, topic] = key.split(':');
      this.send({ type: 'subscribe', channel, topic });
    }
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString()) as AutodartsMessage;
      const isBoardEvent = message.channel === 'autodarts.boards' && message.topic?.endsWith('.events');
      console.log(`📨 WS Message: channel=${message.channel}, topic=${message.topic}${isBoardEvent ? ' [BOARD EVENT]' : ''}`);
      if (isBoardEvent) {
        console.log(`🎯 Board Event RAW data:`, JSON.stringify(message.data));
      }
      const events = this.eventParser.parse(message);

      if (!events) return;

      const eventArray = Array.isArray(events) ? events : [events];

      for (const event of eventArray) {
        // Auto-subscribe to match when detected
        if (event.type === 'match.start') {
          const matchId = (event.data as { matchId: string }).matchId;
          this.subscribeToMatch(matchId);
        }

        // Emit event to bus
        void this.eventBus.emit(event);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }

  private handleClose(code: number, reason: Buffer): void {
    this.ws = null;

    if (this.connectionState === 'disconnected') {
      return; // Intentional disconnect
    }

    console.warn(`WebSocket closed: ${code} - ${reason.toString()}`);
    this.handleConnectFailure();
  }

  private handleConnectFailure(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.connectionState = 'reconnecting';
      this.onConnectionChange?.(this.connectionState);
      this.scheduleReconnect();
    } else {
      this.connectionState = 'disconnected';
      this.onConnectionChange?.(this.connectionState);
      this.onError?.(new Error('Max reconnect attempts reached'));
    }
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    this.onError?.(error);
  }

  private send(message: WSOutgoingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimeout();

    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      if (this.ticketProvider && this.connectionState === 'reconnecting') {
        this.connectionState = 'connecting';
        this.onConnectionChange?.(this.connectionState);
        void this.openWithFreshTicket();
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
