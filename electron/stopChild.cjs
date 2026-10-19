/**
 * Stops a child process and resolves only once it has exited: SIGTERM first,
 * SIGKILL after timeoutMs. The app must not quit before that, or the backend
 * outlives it (no one is left to send SIGKILL) with its output pipes closed.
 */
const pending = new WeakMap();

function stopChild(child, { timeoutMs }) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (pending.has(child)) return pending.get(child);
  const stopped = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
  pending.set(child, stopped);
  return stopped;
}

module.exports = { stopChild };
