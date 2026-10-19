#!/usr/bin/env node
/**
 * Smoke-tests a packaged (electron-builder `--dir` or installed) build of
 * IO-Darts-Agent: starts the backend the same way the Electron shell does
 * (ELECTRON_RUN_AS_NODE, a fresh data dir, supervised mode), waits for
 * /health, checks that / serves the web UI and that the hub reports the
 * version from its packaged package.json, then stops it again.
 *
 * Usage: node scripts/release/smoke-test.mjs [releasesDir]
 * releasesDir defaults to "<repo>/releases" (electron-builder's output dir).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { findPackagedApp, assertModuleSdkShipped, waitForHealth, killWindowsProcessTree } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEALTH_TIMEOUT_MS = 90_000;
const PORT = 3999;

function tail(text, lineCount) {
  const lines = text.split('\n');
  return lines.slice(-lineCount).join('\n');
}

function killChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (process.platform === 'win32') {
    killWindowsProcessTree(child);
    return;
  }
  child.kill('SIGTERM');
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }, 5000).unref();
}

async function main() {
  const releasesDir = process.argv[2] || path.join(__dirname, '..', '..', 'releases');
  const { executable, appRoot } = findPackagedApp(releasesDir, process.platform, process.arch);
  assertModuleSdkShipped(appRoot);
  const backendPath = path.join(appRoot, 'dist', 'src', 'main.js');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-darts-smoke-'));

  console.log(`[smoke-test] executable: ${executable}`);
  console.log(`[smoke-test] backend:    ${backendPath}`);
  console.log(`[smoke-test] data dir:   ${dataDir}`);

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    IO_DARTS_DATA_DIR: dataDir,
    IO_DARTS_SUPERVISED: '1',
    PORT: String(PORT),
    NODE_ENV: 'production',
  };

  const child = spawn(executable, [backendPath], {
    cwd: dataDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  let spawnError = null;
  child.on('error', (err) => {
    spawnError = err;
  });

  function cleanup() {
    killChild(child);
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[smoke-test] Could not remove temp data dir: ${err.message}`);
    }
  }

  function fail(message) {
    console.error(`[smoke-test] FAILED: ${message}`);
    if (spawnError) {
      console.error(`[smoke-test] spawn error: ${spawnError.message}`);
    }
    console.error('[smoke-test] --- last 50 lines of stdout ---');
    console.error(tail(stdout, 50));
    console.error('[smoke-test] --- last 50 lines of stderr ---');
    console.error(tail(stderr, 50));
    cleanup();
    process.exitCode = 1;
  }

  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    await waitForHealth(baseUrl, { timeoutMs: HEALTH_TIMEOUT_MS, intervalMs: 500 });
  } catch (err) {
    fail(`waiting for /health: ${err.message}`);
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/`);
    if (res.status !== 200) {
      fail(`GET / returned status ${res.status}, expected 200`);
      return;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      fail(`GET / returned content-type "${contentType}", expected text/html`);
      return;
    }
  } catch (err) {
    fail(`GET /: ${err.message}`);
    return;
  }

  // The web UI and /api/status show the version the hub reads from the
  // packaged package.json; it must be the version being released.
  try {
    const expected = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version;
    const res = await fetch(`${baseUrl}/api/setup/status`);
    const body = await res.json();
    if (body.version !== expected) {
      fail(`GET /api/setup/status reported version "${body.version}", expected "${expected}"`);
      return;
    }
  } catch (err) {
    fail(`GET /api/setup/status: ${err.message}`);
    return;
  }

  console.log('[smoke-test] OK: /health reported ok, / served the web UI and the hub reports its packaged version');
  cleanup();
}

main().catch((err) => {
  console.error(`[smoke-test] Unexpected error: ${err.stack || err.message}`);
  process.exitCode = 1;
});
