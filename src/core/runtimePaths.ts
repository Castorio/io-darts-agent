/**
 * Runtime data location (config, data, media, modules_installed)
 *
 * By default runtime data lives next to the compiled code: dist/ for a build,
 * the repo root when running from source. A packaged desktop app is read-only,
 * so it points IO_DARTS_DATA_DIR at a writable per-user folder instead.
 *
 * Read-only assets shipped with the code (web/dist, built-in modules) must not
 * use this; they stay resolved relative to the code.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

// This file sits in <root>/src/core (compiled: dist/src/core)
const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function runtimeRoot(): string {
  const override = process.env.IO_DARTS_DATA_DIR;
  return override ? path.resolve(override) : CODE_ROOT;
}

export function runtimePath(...segments: string[]): string {
  return path.join(runtimeRoot(), ...segments);
}
