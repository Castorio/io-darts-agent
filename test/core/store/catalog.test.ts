import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCatalog, StoreCatalog, type StoreModule } from '../../../src/core/store/catalog.js';

function validModule(overrides: Partial<StoreModule> = {}): StoreModule {
  return {
    id: 'mqtt',
    name: { de: 'MQTT Modul', en: 'MQTT module' },
    description: { de: 'Verbindet mit MQTT', en: 'Connects to MQTT' },
    category: 'integration',
    author: 'Castorio',
    repo: 'https://github.com/castorio/autodarts-mqtt-module',
    branch: 'main',
    ...overrides,
  };
}

function catalogOf(...modules: unknown[]): unknown {
  return { version: 1, modules };
}

describe('parseCatalog', () => {
  it('accepts a valid module', () => {
    const result = parseCatalog(catalogOf(validModule()));
    expect(result.rejected).toBe(0);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]).toMatchObject({ id: 'mqtt', repo: 'https://github.com/castorio/autodarts-mqtt-module' });
  });

  it('defaults the branch to main when omitted', () => {
    const { branch, ...rest } = validModule();
    const result = parseCatalog(catalogOf(rest));
    expect(result.rejected).toBe(0);
    expect(result.modules[0]?.branch).toBe('main');
  });

  it('rejects an entry with an invalid id', () => {
    const result = parseCatalog(catalogOf(validModule({ id: 'MQTT_Module!' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects an entry missing the author field', () => {
    const mod = validModule() as unknown as Record<string, unknown>;
    delete mod.author;
    const result = parseCatalog(catalogOf(mod));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a repo on a foreign host', () => {
    const result = parseCatalog(catalogOf(validModule({ repo: 'https://gitlab.com/castorio/autodarts-mqtt-module' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a repo using plain http', () => {
    const result = parseCatalog(catalogOf(validModule({ repo: 'http://github.com/castorio/autodarts-mqtt-module' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a repo url with a path traversal segment', () => {
    const result = parseCatalog(catalogOf(validModule({ repo: 'https://github.com/a/b/../c' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a repo url with a query string', () => {
    const result = parseCatalog(catalogOf(validModule({ repo: 'https://github.com/castorio/autodarts-mqtt-module?x=1' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('accepts a repo url with a trailing .git', () => {
    const result = parseCatalog(catalogOf(validModule({ repo: 'https://github.com/castorio/autodarts-mqtt-module.git' })));
    expect(result.rejected).toBe(0);
    expect(result.modules).toHaveLength(1);
  });

  it('rejects a branch containing a space', () => {
    const result = parseCatalog(catalogOf(validModule({ branch: 'feature branch' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a branch containing a semicolon', () => {
    const result = parseCatalog(catalogOf(validModule({ branch: 'main;rm -rf /' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects both entries when ids are duplicated', () => {
    const result = parseCatalog(catalogOf(
      validModule({ id: 'mqtt', author: 'First' }),
      validModule({ id: 'mqtt', author: 'Second' }),
    ));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(2);
  });

  it('rejects a name longer than 200 characters', () => {
    const result = parseCatalog(catalogOf(validModule({ name: { de: 'a'.repeat(201), en: 'ok' } })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a description longer than 1000 characters', () => {
    const result = parseCatalog(catalogOf(validModule({ description: { de: 'ok', en: 'a'.repeat(1001) } })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects a category longer than 40 characters', () => {
    const result = parseCatalog(catalogOf(validModule({ category: 'a'.repeat(41) })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('rejects an author longer than 80 characters', () => {
    const result = parseCatalog(catalogOf(validModule({ author: 'a'.repeat(81) })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('accepts a valid https homepage', () => {
    const result = parseCatalog(catalogOf(validModule({ homepage: 'https://example.com/mqtt' })));
    expect(result.rejected).toBe(0);
    expect(result.modules[0]?.homepage).toBe('https://example.com/mqtt');
  });

  it('rejects a non-https homepage', () => {
    const result = parseCatalog(catalogOf(validModule({ homepage: 'http://example.com/mqtt' })));
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });

  it('returns an empty catalog when the top-level version is wrong', () => {
    const result = parseCatalog({ version: 2, modules: [validModule()] });
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(0);
  });

  it('returns an empty catalog when modules is not an array', () => {
    const result = parseCatalog({ version: 1, modules: 'nope' });
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(0);
  });

  it('returns an empty catalog for completely malformed input', () => {
    const result = parseCatalog(null);
    expect(result.modules).toHaveLength(0);
    expect(result.rejected).toBe(0);
  });
});

describe('StoreCatalog', () => {
  const okResponse = (body: string) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => body,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads and returns the parsed modules on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(catalogOf(validModule()))));
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.modules).toHaveLength(1);
      expect(result.modules[0]?.id).toBe('mqtt');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('serves the cached catalog within the ttl without fetching again', async () => {
    let now = 1000;
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(catalogOf(validModule()))));
    const catalog = new StoreCatalog({
      url: 'https://example.com/modules.json',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ttlMs: 60_000,
      now: () => now,
    });

    await catalog.load();
    now += 1_000;
    await catalog.load();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the ttl has expired', async () => {
    let now = 1000;
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(catalogOf(validModule()))));
    const catalog = new StoreCatalog({
      url: 'https://example.com/modules.json',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      ttlMs: 60_000,
      now: () => now,
    });

    await catalog.load();
    now += 60_001;
    await catalog.load();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns available false when the request times out', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const pending = catalog.load();
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;

    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.error).toBeTruthy();
    }
  });

  it('returns available false when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: { get: () => null }, text: async () => '' });
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(false);
  });

  it('returns available false when fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.error).toContain('network down');
    }
  });

  it('returns available false when the body is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('not json'));
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(false);
  });

  it('returns available false when the response exceeds 256 KB', async () => {
    const hugeBody = JSON.stringify(catalogOf(validModule({ description: { de: 'x'.repeat(300_000), en: 'ok' } })));
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(hugeBody));
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(false);
  });

  it('returns available false when content-length exceeds 256 KB', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === 'content-length' ? '300000' : null) },
      text: async () => JSON.stringify(catalogOf(validModule())),
    });
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(false);
  });

  it('logs a warning with the count and ids of rejected entries', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const body = catalogOf(
      validModule({ id: 'mqtt' }),
      validModule({ id: 'broken-module', author: '' }),
      validModule({ id: 'dup', author: 'First' }),
      validModule({ id: 'dup', author: 'Second' }),
    );
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(body)));
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await catalog.load();

    expect(result.available).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0]!;
    expect(message).toContain('3');
    expect(message).toContain('broken-module');
    expect(message).toContain('dup');

    warnSpy.mockRestore();
  });

  it('does not log a warning when every entry is valid', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(catalogOf(validModule()))));
    const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

    await catalog.load();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  describe('find', () => {
    it('returns the module matching the id', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(catalogOf(validModule()))));
      const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

      const mod = await catalog.find('mqtt');

      expect(mod?.id).toBe('mqtt');
    });

    it('returns null when no module matches the id', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(okResponse(JSON.stringify(catalogOf(validModule()))));
      const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

      const mod = await catalog.find('unknown-module');

      expect(mod).toBeNull();
    });

    it('returns null when the catalog is unavailable', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
      const catalog = new StoreCatalog({ url: 'https://example.com/modules.json', fetchImpl: fetchImpl as unknown as typeof fetch });

      const mod = await catalog.find('mqtt');

      expect(mod).toBeNull();
    });
  });
});
