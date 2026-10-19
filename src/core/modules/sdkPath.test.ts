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

  it('does not let a sibling repo named "module-sdk" hijack a dev run (regression)', () => {
    // mainDir is <root>/src (the dev/tsx layout), so the one-level-up
    // candidate is <root>/module-sdk. A probe-based resolver would accept
    // ANY directory there that happens to have a package.json, even one
    // that is not actually the real module-sdk package (e.g. a sibling repo
    // checked out next to this one and coincidentally named module-sdk).
    const mainDir = path.join(root, 'src');
    mkdirSync(mainDir, { recursive: true });
    mkdirSync(path.join(root, 'module-sdk'), { recursive: true });
    writeFileSync(path.join(root, 'module-sdk', 'package.json'), '{"name":"not-the-real-sdk"}');

    // The layout is decided by whether mainDir sits inside a `dist` folder,
    // not by probing for package.json, so this still resolves relative to
    // the source layout instead of trusting whatever sits there.
    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
  });

  it('picks the compiled layout purely from mainDir being inside dist, even with no module-sdk on disk at all', () => {
    const mainDir = path.join(root, 'dist', 'src');
    mkdirSync(mainDir, { recursive: true });
    // No module-sdk anywhere - still resolves to the compiled-layout path
    // (two levels up), not the dev layout (one level up), because mainDir's
    // parent directory is named "dist".
    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
    expect(resolveSdkPath(mainDir)).not.toBe(path.join(root, 'dist', 'module-sdk'));
  });

  it('picks the source layout purely from mainDir NOT being inside dist', () => {
    const mainDir = path.join(root, 'src');
    mkdirSync(mainDir, { recursive: true });
    // No module-sdk anywhere - still resolves to the source-layout path
    // (one level up), because mainDir's parent is not "dist".
    expect(resolveSdkPath(mainDir)).toBe(path.join(root, 'module-sdk'));
  });
});
