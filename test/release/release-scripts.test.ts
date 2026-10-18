import { describe, it, expect, vi } from 'vitest';
import {
  versionFromTag,
  checkTagMatchesVersion,
  findPackagedApp,
  waitForHealth,
  // @ts-expect-error -- plain JS module, no type declarations
} from '../../scripts/release/lib.mjs';

describe('versionFromTag', () => {
  it('extracts the version from a full tag ref', () => {
    expect(versionFromTag('refs/tags/v1.0.0')).toBe('1.0.0');
  });

  it('extracts the version from a bare tag', () => {
    expect(versionFromTag('v1.0.0')).toBe('1.0.0');
  });

  it('throws for a ref without the v prefix', () => {
    expect(() => versionFromTag('1.0.0')).toThrow();
  });

  it('throws for a ref that is not a version tag at all', () => {
    expect(() => versionFromTag('release-1')).toThrow();
  });
});

describe('checkTagMatchesVersion', () => {
  it('does not throw when the tag version matches package.json', () => {
    expect(() => checkTagMatchesVersion('refs/tags/v1.2.3', '1.2.3')).not.toThrow();
  });

  it('throws with both values in the message when they differ', () => {
    expect(() => checkTagMatchesVersion('refs/tags/v1.2.3', '1.2.4')).toThrow(/1\.2\.3/);
    expect(() => checkTagMatchesVersion('refs/tags/v1.2.3', '1.2.4')).toThrow(/1\.2\.4/);
  });
});

/**
 * Builds a fake fs with only `existsSync`, backed by a set of paths that
 * "exist". Matches the subset of the `fs` API that `findPackagedApp` uses.
 */
function fakeFs(existingPaths: string[]) {
  const set = new Set(existingPaths);
  return { existsSync: (p: string) => set.has(p) };
}

describe('findPackagedApp', () => {
  it('finds the darwin arm64 app bundle (mac-arm64)', () => {
    const releasesDir = '/releases';
    const executable = '/releases/mac-arm64/IO-Darts-Agent.app/Contents/MacOS/IO-Darts-Agent';
    const appRoot = '/releases/mac-arm64/IO-Darts-Agent.app/Contents/Resources/app';
    const result = findPackagedApp(releasesDir, 'darwin', 'arm64', fakeFs([executable, appRoot]));
    expect(result).toEqual({ executable, appRoot });
  });

  it('finds the darwin x64 app bundle (mac)', () => {
    const releasesDir = '/releases';
    const executable = '/releases/mac/IO-Darts-Agent.app/Contents/MacOS/IO-Darts-Agent';
    const appRoot = '/releases/mac/IO-Darts-Agent.app/Contents/Resources/app';
    const result = findPackagedApp(releasesDir, 'darwin', 'x64', fakeFs([executable, appRoot]));
    expect(result).toEqual({ executable, appRoot });
  });

  it('finds the win32 unpacked app', () => {
    const releasesDir = '/releases';
    const executable = '/releases/win-unpacked/IO-Darts-Agent.exe';
    const appRoot = '/releases/win-unpacked/resources/app';
    const result = findPackagedApp(releasesDir, 'win32', 'x64', fakeFs([executable, appRoot]));
    expect(result).toEqual({ executable, appRoot });
  });

  it('finds the linux x64 unpacked app', () => {
    const releasesDir = '/releases';
    const executable = '/releases/linux-unpacked/io-darts-agent';
    const appRoot = '/releases/linux-unpacked/resources/app';
    const result = findPackagedApp(releasesDir, 'linux', 'x64', fakeFs([executable, appRoot]));
    expect(result).toEqual({ executable, appRoot });
  });

  it('finds the linux arm64 unpacked app', () => {
    const releasesDir = '/releases';
    const executable = '/releases/linux-arm64-unpacked/io-darts-agent';
    const appRoot = '/releases/linux-arm64-unpacked/resources/app';
    const result = findPackagedApp(releasesDir, 'linux', 'arm64', fakeFs([executable, appRoot]));
    expect(result).toEqual({ executable, appRoot });
  });

  it('throws when the packaged app is missing', () => {
    const releasesDir = '/releases';
    expect(() => findPackagedApp(releasesDir, 'darwin', 'arm64', fakeFs([]))).toThrow();
  });
});

describe('waitForHealth', () => {
  it('resolves true once /health reports ok, after earlier failures', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call < 3) {
        throw new Error('ECONNREFUSED');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as unknown as Response;
    });

    const result = await waitForHealth('http://localhost:3999', {
      timeoutMs: 2000,
      intervalMs: 5,
      fetchImpl,
    });

    expect(result).toBe(true);
    expect(call).toBeGreaterThanOrEqual(3);
  });

  it('throws after the timeout when /health never reports ok', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    await expect(
      waitForHealth('http://localhost:3999', {
        timeoutMs: 50,
        intervalMs: 5,
        fetchImpl,
      })
    ).rejects.toThrow();
  });
});
