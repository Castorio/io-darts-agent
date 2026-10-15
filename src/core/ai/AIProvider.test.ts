import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAIProvider } from './AIProvider.js';
import type { AICapability } from './types.js';

class TestProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = [];

  get(url: string) {
    return this.fetchJson<{ ok: boolean }>(url, { method: 'GET' });
  }

  postOnce(url: string) {
    return this.fetchJson<{ id: string }>(url, { method: 'POST', body: { a: 1 }, retry: false });
  }

  // No real waiting between attempts
  protected override delay(): Promise<void> {
    return Promise.resolve();
  }
}

function provider(): TestProvider {
  return new TestProvider({ id: 't', type: 'openai', name: 'T', apiKey: 'k', maxRetries: 3 });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('BaseAIProvider requests', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not retry a 4xx answer', async () => {
    fetchMock.mockImplementation(async () => json(401, { error: 'bad key' }));

    await expect(provider().get('https://x/a')).rejects.toThrow('API error (401)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a 4xx of a request without retry as the API error', async () => {
    fetchMock.mockImplementation(async () => json(422, { error: 'bad prompt' }));

    await expect(provider().postOnce('https://x/start')).rejects.toThrow('API error (422)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a GET after a server error', async () => {
    fetchMock
      .mockImplementationOnce(async () => json(503, {}))
      .mockImplementationOnce(async () => json(200, { ok: true }));

    await expect(provider().get('https://x/a')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends a request without retry exactly once on a server error', async () => {
    fetchMock.mockImplementation(async () => json(500, { error: 'boom' }));

    await expect(provider().postOnce('https://x/start')).rejects.toThrow('T: request failed (status 500); not retried');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends a request without retry exactly once on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(provider().postOnce('https://x/start')).rejects.toThrow(/fetch failed.*not retried/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
