import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HiggsfieldClient, parseHiggsfieldCredentials } from './HiggsfieldClient.js';

const REQUEST_ID = 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff';
const API_KEY = 'key-id-1:secret-1';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const queued = {
  status: 'queued',
  request_id: REQUEST_ID,
  status_url: `https://api.higgsfield.ai/requests/${REQUEST_ID}/status`,
  cancel_url: `https://api.higgsfield.ai/requests/${REQUEST_ID}/cancel`,
};

describe('parseHiggsfieldCredentials', () => {
  it('splits KEY_ID:KEY_SECRET', () => {
    expect(parseHiggsfieldCredentials(' key-id-1:secret-1 ')).toEqual({ keyId: 'key-id-1', secret: 'secret-1' });
  });

  it.each(['', 'only-one-part', ':secret', 'id:', 'a:b:c'])('rejects %j', (value) => {
    expect(() => parseHiggsfieldCredentials(value)).toThrow('KEY_ID:KEY_SECRET');
  });
});

describe('HiggsfieldClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: HiggsfieldClient;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, queued));
    vi.stubGlobal('fetch', fetchMock);
    client = new HiggsfieldClient(API_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('submit()', () => {
    it('posts the body to the model path with key auth and an idempotency key', async () => {
      const requestId = await client.submit('kling-video/v3.0/std/text-to-video', { prompt: 'A dart hits bull' });

      expect(requestId).toBe(REQUEST_ID);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.higgsfield.ai/kling-video/v3.0/std/text-to-video');
      const headers = init.headers as Record<string, string>;
      expect(init.method).toBe('POST');
      expect(headers.Authorization).toBe('Key key-id-1:secret-1');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.parse(init.body as string)).toEqual({ prompt: 'A dart hits bull' });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('retries a submit after a network error with the same idempotency key', async () => {
      fetchMock.mockReset();
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(jsonResponse(200, queued));

      const requestId = await client.submit('higgsfield-ai/soul/standard', { prompt: 'x' });

      expect(requestId).toBe(REQUEST_ID);
      const keys = fetchMock.mock.calls.map((c) => ((c[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key']);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
    });

    it('does not retry a submit that was rejected', async () => {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(jsonResponse(422, { detail: [] }));

      await expect(client.submit('higgsfield-ai/soul/standard', { prompt: 'x' })).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each(['../requests', 'https://evil.example.com/x', 'kling video', 'single'])(
      'rejects the model path %j without sending anything',
      async (modelPath) => {
        await expect(client.submit(modelPath, { prompt: 'x' })).rejects.toThrow('Invalid Higgsfield model');
        expect(fetchMock).not.toHaveBeenCalled();
      }
    );

    it('rejects a response without a valid request id', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: 'queued', request_id: '../../x' }));

      await expect(client.submit('higgsfield-ai/soul/standard', { prompt: 'x' })).rejects.toThrow(
        'request id'
      );
    });

    it.each([
      [400, { detail: 'Maximum number of concurrent requests (4) has been reached' }, 'concurrent'],
      [401, { detail: 'Invalid credentials' }, 'invalid key'],
      [403, { detail: 'Not enough credits' }, 'credits'],
      [404, { detail: 'Not found' }, 'not available'],
      [422, { detail: [{ msg: 'field required' }] }, 'rejected the parameters'],
      [423, { detail: 'Model blocked' }, 'temporarily'],
      [503, { detail: 'Model disabled' }, 'temporarily'],
    ])('translates HTTP %i into a clear error', async (status, body, message) => {
      fetchMock.mockResolvedValue(jsonResponse(status, body));

      await expect(client.submit('higgsfield-ai/soul/standard', { prompt: 'x' })).rejects.toThrow(message);
    });

    it('does not include the secret in error messages', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Invalid credentials for key-id-1:secret-1' }));

      const error = await client.submit('higgsfield-ai/soul/standard', { prompt: 'x' }).catch((e: Error) => e);

      expect((error as Error).message).not.toContain('secret-1');
    });
  });

  describe('getStatus()', () => {
    it('reads the status from the documented path built from the request id', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { status: 'completed', request_id: REQUEST_ID, video: { url: 'https://cdn.example.com/v.mp4' } })
      );

      const status = await client.getStatus(REQUEST_ID);

      expect(fetchMock.mock.calls[0][0]).toBe(`https://api.higgsfield.ai/requests/${REQUEST_ID}/status`);
      expect(status).toEqual({
        status: 'completed',
        video: { url: 'https://cdn.example.com/v.mp4' },
        images: undefined,
        error: undefined,
      });
    });

    it('refuses request ids that are not UUIDs', async () => {
      await expect(client.getStatus('../files/generate-upload-url')).rejects.toThrow('request id');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('waitFor()', () => {
    it('polls with backoff until a terminal status', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { status: 'queued' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'in_progress' }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'completed', images: [{ url: 'https://cdn/i.jpg' }] }));
      const sleep = vi.fn().mockResolvedValue(undefined);

      const status = await client.waitFor(REQUEST_ID, { timeoutMs: 60_000, sleep });

      expect(status.status).toBe('completed');
      expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 3000]);
    });

    it('keeps polling through transient errors until the request finishes', async () => {
      const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
      fetchMock
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce(jsonResponse(503, { detail: 'Service unavailable' }))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'completed', images: [{ url: 'https://cdn/i.jpg' }] }));
      const sleep = vi.fn().mockResolvedValue(undefined);

      const status = await client.waitFor(REQUEST_ID, { timeoutMs: 60_000, sleep });

      expect(status.status).toBe('completed');
    });

    it('stops polling on errors that will not go away', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Invalid credentials' }));
      const sleep = vi.fn().mockResolvedValue(undefined);

      await expect(client.waitFor(REQUEST_ID, { timeoutMs: 60_000, sleep })).rejects.toThrow('invalid key');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('caps the poll interval at ten seconds', async () => {
      for (let i = 0; i < 8; i++) fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'in_progress' }));
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'failed', error: 'Generation failed' }));
      const sleep = vi.fn().mockResolvedValue(undefined);

      const status = await client.waitFor(REQUEST_ID, { timeoutMs: 600_000, sleep });

      expect(status).toMatchObject({ status: 'failed', error: 'Generation failed' });
      expect(Math.max(...sleep.mock.calls.map((c) => c[0] as number))).toBe(10_000);
    });

    it('gives up after the timeout', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: 'in_progress' }));
      let now = 0;
      const sleep = vi.fn(async (ms: number) => {
        now += ms;
      });

      await expect(
        client.waitFor(REQUEST_ID, { timeoutMs: 20_000, sleep, now: () => now })
      ).rejects.toThrow('did not finish');
    });
  });

  describe('cancel()', () => {
    it('posts to the cancel path and reports success', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: 'canceled' }));

      await expect(client.cancel(REQUEST_ID)).resolves.toBe(true);
      expect(fetchMock.mock.calls[0][0]).toBe(`https://api.higgsfield.ai/requests/${REQUEST_ID}/cancel`);
    });

    it('reports false when the request can no longer be canceled', async () => {
      fetchMock.mockResolvedValue(jsonResponse(400, { detail: 'Request is in progress' }));

      await expect(client.cancel(REQUEST_ID)).resolves.toBe(false);
    });
  });

  describe('verifyCredentials()', () => {
    it('treats 404 for an unknown request as valid credentials', async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { detail: 'Not found' }));

      await expect(client.verifyCredentials()).resolves.toBe(true);
    });

    it('treats 401 as invalid credentials', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Invalid credentials' }));

      await expect(client.verifyCredentials()).resolves.toBe(false);
    });
  });
});
