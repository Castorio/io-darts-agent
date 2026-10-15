import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSocketTicket } from './SocketTicket.js';

const TICKET_URL = 'https://play.ws.autodarts.com/ms/v0/tickets';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('fetchSocketTicket', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a ticket with the bearer token and returns its code', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { code: 'ticket-1' }));

    const ticket = await fetchSocketTicket(() => Promise.resolve('access-1'));

    expect(ticket).toBe('ticket-1');
    expect(fetchMock).toHaveBeenCalledWith(TICKET_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer access-1' },
      signal: expect.any(AbortSignal),
    });
  });

  it('retries once with a fresh token after a 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'unauthorized' } }))
      .mockResolvedValueOnce(jsonResponse(200, { code: 'ticket-2' }));
    const onUnauthorized = vi.fn(() => Promise.resolve('access-2'));

    const ticket = await fetchSocketTicket(() => Promise.resolve('access-1'), { onUnauthorized });

    expect(ticket).toBe('ticket-2');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1][1]).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer access-2' },
      signal: expect.any(AbortSignal),
    });
  });

  it('gives up after a second 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));

    await expect(
      fetchSocketTicket(() => Promise.resolve('access-1'), {
        onUnauthorized: () => Promise.resolve('access-2'),
      })
    ).rejects.toThrow('Socket ticket request failed: 401');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on server errors without retrying', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));

    await expect(fetchSocketTicket(() => Promise.resolve('access-1'))).rejects.toThrow(
      'Socket ticket request failed: 503'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the response carries no code', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await expect(fetchSocketTicket(() => Promise.resolve('access-1'))).rejects.toThrow(
      'Socket ticket response without code'
    );
  });

  it('uses a custom ticket url', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { code: 'ticket-3' }));

    await fetchSocketTicket(() => Promise.resolve('access-1'), { url: 'https://example.test/t' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/t');
  });
});
