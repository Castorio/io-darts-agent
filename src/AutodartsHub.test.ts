import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = {
  login: vi.fn(),
  getToken: vi.fn(),
  refresh: vi.fn(),
  getUserId: vi.fn(() => 'user-1'),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
};

const socket = {
  onStateChange: vi.fn(),
  onErrorCallback: vi.fn(),
  connect: vi.fn<[ticketProvider: () => Promise<string>], void>(),
  waitUntilConnected: vi.fn(),
  subscribeToBoard: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('./core/auth/AuthService.js', () => ({ AuthService: vi.fn(() => auth) }));
vi.mock('./core/socket/SocketService.js', () => ({ SocketService: vi.fn(() => socket) }));

import { AutodartsHub } from './index.js';

const config = {
  auth: { email: 'test@example.com', password: 'secret' },
  boardId: 'board-1',
};

describe('AutodartsHub.start()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.login.mockResolvedValue('access-1');
  });

  it('subscribes to the board once connected', async () => {
    socket.waitUntilConnected.mockResolvedValue(undefined);
    const hub = new AutodartsHub(config);

    await hub.start();

    expect(socket.subscribeToBoard).toHaveBeenCalled();
    expect(hub.isActive()).toBe(true);
  });

  it('connects with a ticket provider backed by the auth service', async () => {
    socket.waitUntilConnected.mockResolvedValue(undefined);
    auth.getToken.mockResolvedValue('access-1');
    const fetchMock = vi.fn<[url: string, init?: RequestInit], Promise<unknown>>().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ code: 'ticket-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const hub = new AutodartsHub(config);
    await hub.start();

    const provider = socket.connect.mock.calls[0][0];
    try {
      await expect(provider()).resolves.toBe('ticket-1');
    } finally {
      vi.unstubAllGlobals();
    }

    expect(auth.getToken).toHaveBeenCalled();
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({
      Authorization: 'Bearer access-1',
    });
  });

  it('cleans up socket and token refresh when the connection times out', async () => {
    socket.waitUntilConnected.mockRejectedValue(new Error('Connection timeout'));
    const hub = new AutodartsHub(config);

    await expect(hub.start()).rejects.toThrow('Connection timeout');

    expect(socket.disconnect).toHaveBeenCalled();
    expect(auth.stopAutoRefresh).toHaveBeenCalled();
    expect(hub.isActive()).toBe(false);
  });
});
