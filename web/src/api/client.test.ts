import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './client';

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body);
}

describe('api.generateVoicePack', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses an existing pack name unchanged when regenerating missing files (packId given)', async () => {
    const fetchMock = stubFetch();
    await api.generateVoicePack('v1', 'de', 'Rachel (DE)', 'v1_de');
    const body = bodyOf(fetchMock);
    expect(body.packName).toBe('Rachel (DE)');
    expect(body.packId).toBe('v1_de');
  });

  it('still appends the language suffix when creating a brand new pack (no packId)', async () => {
    const fetchMock = stubFetch();
    await api.generateVoicePack('v1', 'de', 'Rachel');
    const body = bodyOf(fetchMock);
    expect(body.packName).toBe('Rachel (DE)');
    expect(body.packId).toBe('v1_de');
  });

  it('falls back to a generic pack name when no voice name is given', async () => {
    const fetchMock = stubFetch();
    await api.generateVoicePack('v1', 'en');
    const body = bodyOf(fetchMock);
    expect(body.packName).toBe('Voice Pack (EN)');
  });
});
