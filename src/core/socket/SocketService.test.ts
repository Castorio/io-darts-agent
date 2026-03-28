import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../events/EventBus.js';

// We need to create the mock factory without referencing external variables
vi.mock('ws', () => {
  const { EventEmitter } = require('events');

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = 0;
    sentMessages: string[] = [];
    url: string;

    constructor(url: string) {
      super();
      this.url = url;
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
import { SocketService } from './SocketService.js';

const BOARD_ID = 'test-board-id';
const TOKEN = 'test-token';
const MATCH_ID = 'test-match-id';

describe('SocketService', () => {
  let socketService: SocketService;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
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

      socketService.connect(TOKEN);

      expect(stateCallback).toHaveBeenCalledWith('connecting');

      // Wait for connection
      await vi.advanceTimersByTimeAsync(50);

      expect(stateCallback).toHaveBeenCalledWith('connected');
      expect(socketService.getConnectionState()).toBe('connected');
    });

    it('should not connect if already connecting', async () => {
      const stateCallback = vi.fn();
      socketService.onStateChange(stateCallback);

      socketService.connect(TOKEN);
      socketService.connect(TOKEN);

      expect(stateCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    it('should disconnect from WebSocket server', async () => {
      socketService.connect(TOKEN);
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
      socketService.connect(TOKEN);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribe('autodarts.boards', `${BOARD_ID}.state`);

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });

  describe('subscribeToBoard()', () => {
    it('should subscribe to board state and matches', async () => {
      socketService.connect(TOKEN);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribeToBoard();

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });

  describe('subscribeToMatch()', () => {
    it('should set match ID when subscribing', async () => {
      socketService.connect(TOKEN);
      await vi.advanceTimersByTimeAsync(50);

      socketService.subscribeToMatch(MATCH_ID);

      expect(socketService.getMatchId()).toBe(MATCH_ID);
    });
  });

  describe('unsubscribeFromMatch()', () => {
    it('should clear match ID when unsubscribing', async () => {
      socketService.connect(TOKEN);
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
      socketService.connect(TOKEN);
      expect(socketService.getConnectionState()).toBe('connecting');
    });
  });

  describe('updateToken()', () => {
    it('should update the stored token', async () => {
      socketService.connect(TOKEN);
      await vi.advanceTimersByTimeAsync(50);

      socketService.updateToken('new-token');

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });

  describe('error handling', () => {
    it('should register error callback', async () => {
      const errorCallback = vi.fn();
      socketService.onErrorCallback(errorCallback);

      socketService.connect(TOKEN);
      await vi.advanceTimersByTimeAsync(50);

      expect(socketService.getConnectionState()).toBe('connected');
    });
  });
});
