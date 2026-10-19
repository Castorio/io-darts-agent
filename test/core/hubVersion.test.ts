import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { hubVersion, readHubVersion } from '../../src/core/hubVersion.js';

const rootPackage = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')) as {
  version: string;
};

describe('hubVersion', () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('is the version from the hub package.json', () => {
    expect(hubVersion()).toBe(rootPackage.version);
  });

  it('finds the hub package.json above the compiled dist/src/core layout', () => {
    root = mkdtempSync(path.join(tmpdir(), 'hub-version-'));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'io-darts-agent', version: '9.9.9-beta' }));
    const coreDir = path.join(root, 'dist', 'src', 'core');
    mkdirSync(coreDir, { recursive: true });

    expect(readHubVersion(coreDir)).toBe('9.9.9-beta');
  });

  it('skips package.json files of other packages on the way up', () => {
    root = mkdtempSync(path.join(tmpdir(), 'hub-version-'));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'io-darts-agent', version: '2.0.0' }));
    const nested = path.join(root, 'dist');
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(nested, 'package.json'), JSON.stringify({ type: 'module' }));

    expect(readHubVersion(path.join(nested))).toBe('2.0.0');
  });

  it('falls back to "unknown" when no hub package.json is found', () => {
    root = mkdtempSync(path.join(tmpdir(), 'hub-version-'));
    expect(readHubVersion(root)).toBe('unknown');
  });
});
