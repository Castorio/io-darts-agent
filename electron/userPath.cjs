/**
 * PATH for the hub backend.
 *
 * An app started from the Finder (or a Linux desktop launcher) gets only a
 * minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin on macOS), so npm and node from
 * nvm or Homebrew are invisible and installing external modules fails with
 * "Node.js (npm) not found". Ask the user's login shell for its PATH (the same
 * one a terminal has) and put it in front of the inherited one. If the shell
 * fails or hangs, fall back to the inherited PATH plus the usual install dirs.
 * Windows installers update the system PATH, so it is left alone there.
 */

const fs = require('fs');

const MARKER = '__IO_DARTS_PATH__';
const SHELL_TIMEOUT_MS = 5000;
const FALLBACK_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

function parseShellPath(output) {
  const start = output.indexOf(MARKER);
  if (start === -1) return null;
  const end = output.indexOf(MARKER, start + MARKER.length);
  if (end === -1) return null;
  const value = output.slice(start + MARKER.length, end).trim();
  return value || null;
}

function mergePaths(...lists) {
  const seen = new Set();
  const result = [];
  for (const list of lists) {
    for (const dir of (list || '').split(':')) {
      if (dir && !seen.has(dir)) {
        seen.add(dir);
        result.push(dir);
      }
    }
  }
  return result.join(':');
}

function resolveUserPath({ platform, env, execFileSync, existsSync = fs.existsSync }) {
  const inherited = env.PATH || '';
  if (platform === 'win32') return inherited;

  const shell = env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/sh');
  try {
    const output = execFileSync(shell, ['-ilc', `printf '${MARKER}%s${MARKER}' "$PATH"`], {
      encoding: 'utf8',
      timeout: SHELL_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const shellPath = parseShellPath(String(output));
    if (shellPath) return mergePaths(shellPath, inherited);
  } catch {
    // shell missing, failed or timed out: use the fallback below
  }
  return mergePaths(inherited, FALLBACK_DIRS.filter((dir) => existsSync(dir)).join(':'));
}

module.exports = { resolveUserPath, parseShellPath };
