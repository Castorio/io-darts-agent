import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { resolveBuiltinModulesDir } from './BuiltinModuleInstaller.js';

describe('resolveBuiltinModulesDir', () => {
  let root: string;
  let distDir: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'builtin-'));
    distDir = path.join(root, 'dist');
    // tsc output: compiled sources only, no manifests
    mkdirSync(path.join(distDir, 'modules', 'wled', 'src'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('uses the source modules next to dist, where the manifests live', () => {
    mkdirSync(path.join(root, 'modules', 'wled'), { recursive: true });
    writeFileSync(path.join(root, 'modules', 'wled', 'module.json'), '{}');

    expect(resolveBuiltinModulesDir(distDir)).toBe(path.join(root, 'modules'));
  });

  it('falls back to dist/modules for a bundle that ships the modules there', () => {
    writeFileSync(path.join(distDir, 'modules', 'wled', 'module.json'), '{}');

    expect(resolveBuiltinModulesDir(distDir)).toBe(path.join(distDir, 'modules'));
  });
});
