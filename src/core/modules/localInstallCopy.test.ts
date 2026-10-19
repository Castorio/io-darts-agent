import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, readdirSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { copyModuleDir, parseSimpleGitignoreNames, readSimpleGitignoreNames } from './localInstallCopy.js';

describe('parseSimpleGitignoreNames', () => {
  it('extracts bare names and directory patterns', () => {
    const content = ['node_modules', 'dist/', '# a comment', '', '.env'].join('\n');
    expect(parseSimpleGitignoreNames(content)).toEqual(['node_modules', 'dist', '.env']);
  });

  it('ignores negations, wildcards and nested paths it cannot match safely', () => {
    const content = ['!keep-me', '*.log', 'build/**/*', 'src/generated', 'a?c'].join('\n');
    expect(parseSimpleGitignoreNames(content)).toEqual([]);
  });
});

describe('readSimpleGitignoreNames', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'gitignore-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns [] when there is no .gitignore', async () => {
    expect(await readSimpleGitignoreNames(root)).toEqual([]);
  });

  it('reads simple names from the module .gitignore', async () => {
    writeFileSync(path.join(root, '.gitignore'), 'secrets/\nbuild\n');
    expect(await readSimpleGitignoreNames(root)).toEqual(['secrets', 'build']);
  });
});

describe('copyModuleDir', () => {
  let root: string;
  let src: string;
  let dest: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'copy-module-'));
    src = path.join(root, 'src-module');
    dest = path.join(root, 'dest-module');
    mkdirSync(src, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('copies regular files and nested directories', async () => {
    mkdirSync(path.join(src, 'lib'), { recursive: true });
    writeFileSync(path.join(src, 'module.json'), '{"id":"m"}');
    writeFileSync(path.join(src, 'lib', 'index.js'), 'module.exports = 1;');

    await copyModuleDir(src, dest, new Set());

    expect(readFileSync(path.join(dest, 'module.json'), 'utf-8')).toBe('{"id":"m"}');
    expect(readFileSync(path.join(dest, 'lib', 'index.js'), 'utf-8')).toBe('module.exports = 1;');
  });

  it('skips node_modules, .git, venvs, caches and .DS_Store at any depth', async () => {
    for (const name of ['node_modules', '.git', '.venv', 'venv', '__pycache__']) {
      mkdirSync(path.join(src, name), { recursive: true });
      writeFileSync(path.join(src, name, 'f.txt'), 'x');
    }
    writeFileSync(path.join(src, '.DS_Store'), 'x');
    mkdirSync(path.join(src, 'nested'), { recursive: true });
    mkdirSync(path.join(src, 'nested', 'node_modules'), { recursive: true });
    writeFileSync(path.join(src, 'nested', 'node_modules', 'f.txt'), 'x');
    writeFileSync(path.join(src, 'keep.txt'), 'keep');

    await copyModuleDir(src, dest, new Set());

    expect(readdirSync(dest)).toEqual(['keep.txt', 'nested']);
    expect(readdirSync(path.join(dest, 'nested'))).toEqual([]);
  });

  it('skips extra names given by the caller (e.g. from the module .gitignore)', async () => {
    mkdirSync(path.join(src, 'secrets'), { recursive: true });
    writeFileSync(path.join(src, 'secrets', 'key.txt'), 'x');
    writeFileSync(path.join(src, 'keep.txt'), 'keep');

    await copyModuleDir(src, dest, new Set(['secrets']));

    expect(readdirSync(dest)).toEqual(['keep.txt']);
  });

  it('does not follow a symlink that points outside the source tree', async () => {
    const outside = path.join(root, 'outside');
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, 'secret.txt'), 'top secret');
    symlinkSync(outside, path.join(src, 'linked-dir'), 'dir');
    symlinkSync(path.join(outside, 'secret.txt'), path.join(src, 'linked-file.txt'));
    writeFileSync(path.join(src, 'keep.txt'), 'keep');

    await copyModuleDir(src, dest, new Set());

    expect(readdirSync(dest)).toEqual(['keep.txt']);
    expect(existsSync(path.join(dest, 'linked-dir'))).toBe(false);
    expect(existsSync(path.join(dest, 'linked-file.txt'))).toBe(false);
  });
});
