/**
 * The hub's own version, read from its package.json at runtime so the API and
 * the web UI always show what was actually released (no hardcoded copy that
 * has to be bumped by hand).
 *
 * The file sits in <root>/src/core (compiled: <root>/dist/src/core, packaged
 * desktop app: <app>/dist/src/core next to <app>/package.json), so the hub's
 * package.json is found by walking up and taking the first one named
 * io-darts-agent.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HUB_PACKAGE_NAME = 'io-darts-agent';

export function readHubVersion(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf-8')) as {
        name?: unknown;
        version?: unknown;
      };
      if (pkg.name === HUB_PACKAGE_NAME && typeof pkg.version === 'string') return pkg.version;
    } catch {
      // no readable package.json here, keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) return 'unknown';
    dir = parent;
  }
}

let cached: string | undefined;

export function hubVersion(): string {
  cached ??= readHubVersion(path.dirname(fileURLToPath(import.meta.url)));
  return cached;
}
