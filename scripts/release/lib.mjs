/**
 * Shared helpers for the release scripts (`check-version.mjs`,
 * `smoke-test.mjs`). Kept dependency-free (plain Node + the global `fetch`)
 * so these scripts can run in CI without `npm ci` for a separate toolchain.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const VERSION_TAG_PATTERN = /^(?:refs\/tags\/)?v(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

/**
 * Extracts the semantic version from a git ref / tag name.
 *
 * Accepts `refs/tags/v1.2.3` or `v1.2.3` and returns `1.2.3`. Throws for
 * anything else (missing `v` prefix, not a tag ref, etc.) so a malformed
 * `GITHUB_REF` fails loudly instead of silently mismatching.
 *
 * @param {string} ref
 * @returns {string}
 */
export function versionFromTag(ref) {
  const match = typeof ref === 'string' ? VERSION_TAG_PATTERN.exec(ref) : null;
  if (!match) {
    throw new Error(`Cannot parse a version from ref "${ref}" (expected "refs/tags/vX.Y.Z" or "vX.Y.Z")`);
  }
  return match[1];
}

/**
 * Asserts that a git ref's version matches the given package version.
 *
 * @param {string} ref
 * @param {string} version
 */
export function checkTagMatchesVersion(ref, version) {
  const tagVersion = versionFromTag(ref);
  if (tagVersion !== version) {
    throw new Error(
      `Tag version "${tagVersion}" (from ref "${ref}") does not match package.json version "${version}"`
    );
  }
}

/**
 * Locates the packaged (unpacked, `--dir`-built) Electron app produced by
 * electron-builder for the given platform/arch, and returns the path to its
 * executable plus its app root (the folder that contains `dist/src/main.js`).
 *
 * @param {string} releasesDir
 * @param {string} platform - `process.platform` value (`darwin`, `win32`, `linux`)
 * @param {string} arch - `process.arch` value (`arm64`, `x64`, ...)
 * @param {{ existsSync: (p: string) => boolean }} [fsApi]
 * @returns {{ executable: string, appRoot: string }}
 */
export function findPackagedApp(releasesDir, platform, arch, fsApi = fs) {
  let unpackedDir;
  let executable;
  let appRoot;

  if (platform === 'darwin') {
    unpackedDir = arch === 'arm64' ? 'mac-arm64' : 'mac';
    const appBundle = path.join(releasesDir, unpackedDir, 'IO-Darts-Agent.app');
    executable = path.join(appBundle, 'Contents', 'MacOS', 'IO-Darts-Agent');
    appRoot = path.join(appBundle, 'Contents', 'Resources', 'app');
  } else if (platform === 'win32') {
    unpackedDir = 'win-unpacked';
    executable = path.join(releasesDir, unpackedDir, 'IO-Darts-Agent.exe');
    appRoot = path.join(releasesDir, unpackedDir, 'resources', 'app');
  } else if (platform === 'linux') {
    unpackedDir = arch === 'arm64' ? 'linux-arm64-unpacked' : 'linux-unpacked';
    executable = path.join(releasesDir, unpackedDir, 'io-darts-agent');
    appRoot = path.join(releasesDir, unpackedDir, 'resources', 'app');
  } else {
    throw new Error(`Unsupported platform "${platform}" for findPackagedApp`);
  }

  if (!fsApi.existsSync(executable) || !fsApi.existsSync(appRoot)) {
    throw new Error(
      `Packaged app not found for ${platform}/${arch} under "${releasesDir}" ` +
        `(expected executable "${executable}" and app root "${appRoot}"). ` +
        'Did the electron-builder packaging step run?'
    );
  }

  return { executable, appRoot };
}

/**
 * Asserts that module-sdk - linked into every external module
 * (ModuleInstaller.fixSdkLink) - was actually packaged into the app, with
 * its compiled JS, type declarations (modules compile against them) and
 * package.json all present. Catches an electron-builder config regression
 * (it ships via `extraResources`, not `files`, because electron-builder's
 * main file matcher unconditionally strips `.d.ts`) before it reaches a
 * release.
 *
 * @param {string} appRoot
 * @param {{ existsSync: (p: string) => boolean }} [fsApi]
 */
export function assertModuleSdkShipped(appRoot, fsApi = fs) {
  const required = [
    path.join(appRoot, 'module-sdk', 'dist', 'index.js'),
    path.join(appRoot, 'module-sdk', 'dist', 'index.d.ts'),
    path.join(appRoot, 'module-sdk', 'package.json'),
  ];
  const missing = required.filter((file) => !fsApi.existsSync(file));
  if (missing.length > 0) {
    throw new Error(`module-sdk is not fully packaged under "${appRoot}" - missing: ${missing.join(', ')}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls `${baseUrl}/health` until it reports `{ status: 'ok' }` or the
 * timeout elapses.
 *
 * @param {string} baseUrl
 * @param {{ timeoutMs?: number, intervalMs?: number, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<true>}
 */
export async function waitForHealth(baseUrl, options = {}) {
  const { timeoutMs = 90_000, intervalMs = 500, fetchImpl = fetch } = options;
  const deadline = Date.now() + timeoutMs;
  let lastError = new Error('waitForHealth: timed out before the first attempt');

  while (Date.now() < deadline) {
    try {
      const res = await fetchImpl(`${baseUrl}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body && body.status === 'ok') {
          return true;
        }
        lastError = new Error(`Unexpected /health body: ${JSON.stringify(body)}`);
      } else {
        lastError = new Error(`/health responded with status ${res.status}`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${baseUrl}/health to report ok after ${timeoutMs}ms: ${lastError.message}`);
}

/**
 * Kills a child process tree on Windows, where `child.kill()` only signals
 * the immediate process and leaves its children running. `taskkill` is
 * spawned fire-and-forget (its own exit is not awaited); if it fails to
 * start at all (e.g. missing from PATH) that must not crash the caller, so
 * an `error` handler logs it instead of leaving it unhandled.
 *
 * @param {{ pid: number | undefined }} child
 * @param {{ spawnImpl?: typeof spawn, log?: (msg: string) => void }} [options]
 * @returns {import('node:child_process').ChildProcess}
 */
export function killWindowsProcessTree(child, options = {}) {
  const { spawnImpl = spawn, log = (msg) => console.error(msg) } = options;
  const killer = spawnImpl('taskkill', ['/pid', String(child.pid), '/t', '/f']);
  killer.on('error', (err) => {
    log(`[smoke-test] taskkill failed to start: ${err.message}`);
  });
  return killer;
}
