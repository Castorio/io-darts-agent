import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from '../../../modules/game-display/web/node_modules/pinia/dist/pinia.mjs';
import { useGameDisplayStore } from '../../../modules/game-display/web/src/stores/gameDisplay.js';

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static all: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  fail(): void {
    this.readyState = FakeSocket.CLOSED;
    this.onerror?.(new Error('403'));
    this.onclose?.();
  }
  close(): void {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }
}

const open = () => FakeSocket.all.filter((s) => s.readyState === FakeSocket.OPEN);

describe('game display websocket reconnect', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('window', { location: { protocol: 'http:', host: 'hub:3000' } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps a single connection while the hub rejects it during setup', async () => {
    const store = useGameDisplayStore();
    store.connect();
    store.connect(); // e.g. App mount and a reconnect at the same time

    for (let i = 0; i < 10; i++) {
      FakeSocket.all.filter((s) => s.readyState === FakeSocket.CONNECTING).forEach((s) => s.fail());
      await vi.advanceTimersByTimeAsync(3000);
    }
    FakeSocket.all.filter((s) => s.readyState === FakeSocket.CONNECTING).forEach((s) => s.open());

    expect(open()).toHaveLength(1);
    expect(FakeSocket.all.filter((s) => s.readyState === FakeSocket.CONNECTING)).toHaveLength(0);
  });

  it('does not reconnect after disconnect()', async () => {
    const store = useGameDisplayStore();
    store.connect();
    FakeSocket.all[0].open();

    store.disconnect();
    await vi.advanceTimersByTimeAsync(5000);

    expect(FakeSocket.all).toHaveLength(1);
  });
});
