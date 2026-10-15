import * as path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runtimePath, runtimeRoot } from './runtimePaths.js';

// src/core/runtimePaths.ts -> repo root (from source) or dist/ (compiled to dist/src/core)
const codeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('runtimeRoot', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the directory above the compiled src folder', () => {
    const saved = process.env.IO_DARTS_DATA_DIR;
    delete process.env.IO_DARTS_DATA_DIR;
    try {
      expect(runtimeRoot()).toBe(codeRoot);
    } finally {
      if (saved !== undefined) process.env.IO_DARTS_DATA_DIR = saved;
    }
  });

  it('treats an empty IO_DARTS_DATA_DIR as unset', () => {
    vi.stubEnv('IO_DARTS_DATA_DIR', '');
    expect(runtimeRoot()).toBe(codeRoot);
  });

  it('uses IO_DARTS_DATA_DIR when set', () => {
    const dir = path.resolve('/tmp', 'io-darts-data');
    vi.stubEnv('IO_DARTS_DATA_DIR', dir);
    expect(runtimeRoot()).toBe(dir);
  });

  it('resolves a relative IO_DARTS_DATA_DIR to an absolute path', () => {
    vi.stubEnv('IO_DARTS_DATA_DIR', 'relative-data');
    expect(runtimeRoot()).toBe(path.resolve(process.cwd(), 'relative-data'));
  });
});

describe('runtimePath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('joins segments onto the default root', () => {
    vi.stubEnv('IO_DARTS_DATA_DIR', '');
    expect(runtimePath('config', 'hub.config.json')).toBe(
      path.join(codeRoot, 'config', 'hub.config.json')
    );
  });

  it('joins segments onto IO_DARTS_DATA_DIR', () => {
    const dir = path.resolve('/tmp', 'io-darts-data');
    vi.stubEnv('IO_DARTS_DATA_DIR', dir);
    expect(runtimePath('modules_installed')).toBe(path.join(dir, 'modules_installed'));
  });

  it('returns the root itself without segments', () => {
    vi.stubEnv('IO_DARTS_DATA_DIR', '');
    expect(runtimePath()).toBe(codeRoot);
  });
});
