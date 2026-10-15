import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { builtinModules } from 'module';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8')) as {
  dependencies: Record<string, string>;
};

// Runtime code that ships in a production install (npm ci --omit=dev)
const RUNTIME_DIRS = ['src', 'modules/wled/src', 'modules/darts-caller/src', 'modules/game-display/src'];

// Packages loaded by name at runtime rather than imported
const LOADED_BY_NAME = ['pino-pretty'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.ts$/.test(entry) && !/\.(test|d)\.ts$/.test(entry) ? [full] : [];
  });
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function runtimeImports(): Set<string> {
  const names = new Set<string>(LOADED_BY_NAME);
  const pattern = /(?:^|[^.\w])(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const dir of RUNTIME_DIRS) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(pattern)) {
        const statement = match[0];
        const specifier = match[1] ?? match[2];
        if (/\bimport\s+type\b|\bexport\s+type\b/.test(statement)) continue;
        if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
        if (builtinModules.includes(packageName(specifier))) continue;
        names.add(packageName(specifier));
      }
    }
  }
  return names;
}

describe('runtime dependencies', () => {
  it('declares every package the runtime code needs in dependencies', () => {
    const missing = [...runtimeImports()].filter((name) => !(name in pkg.dependencies)).sort();

    expect(missing).toEqual([]);
  });
});
