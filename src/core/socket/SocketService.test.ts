import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../events/EventBus.js';

// We need to create the mock factory without referencing external variables
vi.mock('ws', async () => {
  const { EventEmitter } = await import('events');

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;

    static instances: MockWebSocket[] = [];

    readyState = 0;
    sentMessages: string[] = [];
    url: string;
    options: unknown;

    constructor(url: string, options?: unknown) {
      super();
      this.url = url;
      this.options = options;
      MockWebSocket.instances.push(this);
      this.readyState = 0; // CONNECTING

      // Simulate async connection
      setTimeout(() => {
        this.readyState = 1; // OPEN
        this.emit('open');
      }, 10);
    }

    send(data: string): void {
      this.sentMessages.push(data);
    }

    close(): void {
      this.readyState = 3; // CLOSED
      this.emit('close', 1000, Buffer.from('Normal close'));
    }
  }

  return { default: MockWebSocket };
});

// Import after mock
import WebSocket from 'ws';
import { SocketService } from './SocketService.js';
import { EventParser } from './EventParser.js';

type MockSocket = { url: string; options: unknown; emit: (event: string, ...args: unknown[]) => void };
const sockets = (): MockSocket[] =>
  (WebSocket as unknown as { instances: MockSocket[] }).instances;

const BOARD_ID = 'test-board-id';
const TICKET = 'test-ticket';
const ticketProvider = (): Promise<string> => Promise.resolve(TICKET);
const MATCH_ID = 'test-match-id';

describe('SocketService', () => {
  let socketService: SocketService;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    sockets().length = 0;
    eventBus = new EventBus();
    socketService = new SocketService(BOARD_ID, eventBus, {
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
    });
  });

  afterEach(() => {
    socketService.disconnect();
    eventBus.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('connect()', () => {
    it('should connect to WebSocket server', async () => {
      const stateCallback = vi.fn();
      socketService.onStateChange(stateCallback);

      socketService.connect(ticketProvider);

      expect(stateCallback).toHaveBeenCalledWith('connecting');

      // Wait for connection
      await vi.advanceTimersByTimeAsync(50);

      expect(stateCallback).toHaveBeenCalledWith('connected');
      expect(socketService.getConnectionState()).toBe('connected');
    });

    it('should not connect if already connecting', async () => {
      const stateCallback = vi.fn();
      socketService.onStateChange(stateCallback);

      socketService.connect(ticketProvider);
      socketService.connect(ticketProvider);

      expect(stateCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect from WebSocket server', async () => {
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      socketService.disconnect();

      expect(socketService.getConnectionState()).toBe('disconnected');
    });
  });

  describe('subscribe()', () => {
    it('should queue subscription if not connected', () => {
      socketService.subscribe('autodarts.boards', `${BOARD_ID}.state`);

      expect(socketService.getConnectionState()).toBe('disconnected');
    });

    it('should subscribe when connected', async () => {
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribe('autodarts.boards', `${BOARD_ID}.state`);

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });

  describe('subscribeToBoard()', () => {
    it('should subscribe to board state and matches', async () => {
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribeToBoard();

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });

  describe('subscribeToMatch()', () => {
    it('should set match ID when subscribing', async () => {
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribeToMatch(MATCH_ID);

      expect(socketService.getMatchId()).toBe(MATCH_ID);
    });
  });

  describe('unsubscribeFromMatch()', () => {
    it('should clear match ID when unsubscribing', async () => {
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribeToMatch(MATCH_ID);
      socketService.unsubscribeFromMatch(MATCH_ID);

      expect(socketService.getMatchId()).toBeNull();
    });
  });

  describe('getConnectionState()', () => {
    it('should return disconnected initially', () => {
      expect(socketService.getConnectionState()).toBe('disconnected');
    });

    it('should return connecting after connect called', () => {
      socketService.connect(ticketProvider);
      expect(socketService.getConnectionState()).toBe('connecting');
    });
  });

  describe('ticket authentication', () => {
    it('opens the message bus url with the ticket and without an auth header', async () => {
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      expect(sockets()[0].url).toBe(`wss://play.ws.autodarts.com/ms/v0/subscribe?code=${TICKET}`);
      expect(sockets()[0].options).toBeUndefined();
    });

    it('fetches a fresh ticket for every reconnect', async () => {
      const provider = vi
        .fn<[], Promise<string>>()
        .mockResolvedValueOnce('ticket-1')
        .mockResolvedValueOnce('ticket-2');
      socketService.connect(provider);
      await vi.advanceTimersByTimeAsync(50);

      sockets()[0].emit('close', 1006, Buffer.from('gone'));
      await vi.advanceTimersByTimeAsync(1100);

      expect(provider).toHaveBeenCalledTimes(2);
      expect(sockets()[1].url).toContain('code=ticket-2');
      expect(socketService.getConnectionState()).toBe('connected');
    });

    it('opens only one socket when reconnected while a ticket is in flight', async () => {
      let resolveFirst!: (t: string) => void;
      const slowProvider = (): Promise<string> =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        });

      socketService.connect(slowProvider);
      socketService.disconnect();
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);
      resolveFirst('stale-ticket');
      await vi.advanceTimersByTimeAsync(50);

      expect(sockets()).toHaveLength(1);
      expect(sockets()[0].url).toContain(`code=${TICKET}`);
      expect(socketService.getConnectionState()).toBe('connected');
    });

    it('waits until connected', async () => {
      socketService.connect(ticketProvider);

      const wait = socketService.waitUntilConnected(1000);
      await vi.advanceTimersByTimeAsync(200);
      await expect(wait).resolves.toBeUndefined();
    });

    it('rejects waiting when no connection is made in time', async () => {
      socketService.connect(() => new Promise<string>(() => {}));

      const wait = socketService.waitUntilConnected(1000);
      const assertion = expect(wait).rejects.toThrow('Connection timeout');
      await vi.advanceTimersByTimeAsync(1100);
      await assertion;
    });

    it('retries with backoff when the ticket cannot be fetched', async () => {
      const provider = vi
        .fn<[], Promise<string>>()
        .mockRejectedValueOnce(new Error('Socket ticket request failed: 503'))
        .mockResolvedValueOnce('ticket-2');
      const errorCallback = vi.fn();
      socketService.onErrorCallback(errorCallback);

      socketService.connect(provider);
      await vi.advanceTimersByTimeAsync(10);

      expect(socketService.getConnectionState()).toBe('reconnecting');
      expect(errorCallback).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1100);

      expect(provider).toHaveBeenCalledTimes(2);
      expect(socketService.getConnectionState()).toBe('connected');
    });

    it('marks a Cricket gap on the parser when the socket reconnects', async () => {
      const markGapSpy = vi.spyOn(EventParser.prototype, 'markGap');
      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      // Connection drops and is re-established
      sockets()[0].emit('close', 1006, Buffer.from('gone'));
      await vi.advanceTimersByTimeAsync(1100);

      expect(socketService.getConnectionState()).toBe('connected');
      expect(markGapSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should register error callback', async () => {
      const errorCallback = vi.fn();
      socketService.onErrorCallback(errorCallback);

      socketService.connect(ticketProvider);
      await vi.advanceTimersByTimeAsync(50);

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });
});
