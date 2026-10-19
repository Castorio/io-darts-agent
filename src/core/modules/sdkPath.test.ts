import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { resolveSdkPath } from './sdkPath.js';

describe('resolveSdkPath', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'sdk-path-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds module-sdk next to the repo root when running compiled (dist/src)', () => {
    const mainDir = path.join(root, 'dist', 'src');
    mkdirSync(mainDir, { recursive: true });
    mkdirSync(path.join(root, 'module-sdk'), { recursive: true });
    writeFileSync(path.join(root, 'module-sdk', 'package.json'), '{}');

    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
  });

  it('finds module-sdk next to the repo root when running from source (src)', () => {
    // This is the dev/tsx case: main.ts lives directly under <repoRoot>/src,
    // one level above the repo root instead of two (dist/src).
    const mainDir = path.join(root, 'src');
    mkdirSync(mainDir, { recursive: true });
    mkdirSync(path.join(root, 'module-sdk'), { recursive: true });
    writeFileSync(path.join(root, 'module-sdk', 'package.json'), '{}');

    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
  });

  it('prefers the compiled-layout candidate when both happen to exist', () => {
    const mainDir = path.join(root, 'dist', 'src');
    mkdirSync(mainDir, { recursive: true });
    mkdirSync(path.join(root, 'module-sdk'), { recursive: true });
    writeFileSync(path.join(root, 'module-sdk', 'package.json'), '{}');
    // A stray module-sdk directly under dist/ (the one-level-up candidate
    // for this mainDir) must not win over the real one at the repo root.
    mkdirSync(path.join(root, 'dist', 'module-sdk'), { recursive: true });
    writeFileSync(path.join(root, 'dist', 'module-sdk', 'package.json'), '{}');

    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
  });

  it('falls back to the compiled-layout path when neither candidate exists', () => {
    const mainDir = path.join(root, 'dist', 'src');
    mkdirSync(mainDir, { recursive: true });

    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
  });
});
