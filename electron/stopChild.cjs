/**
 * Stops a child process and resolves only once it has exited: SIGTERM first,
 * SIGKILL after timeoutMs. The app must not quit before that, or the backend
 * outlives it (no one is left to send SIGKILL) with its output pipes closed.
 */
function stopChild(child, { timeoutMs }) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

module.exports = { stopChild };
