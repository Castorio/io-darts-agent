/**
 * Stop/restart decisions shared by module maintenance operations (uninstall,
 * update) that must not leave a running module's process/intents behind.
 *
 * Extracted as pure orchestration over injected stop/start callbacks so the
 * "was it running, and do we bring it back after maintenance" logic can be
 * unit tested without booting the whole hub (ElevenLabs service, player
 * service, IPC bridges, etc. that the real stop/start implementations touch).
 */
export interface MaintainableModule {
  status: string;
}

/**
 * Stop a module before maintenance (uninstall, update) if it is currently
 * running, using the same stop routine the Stop button uses (unregisters
 * intents, stops the external process if any). A no-op when the module
 * isn't running. Returns whether it was running, so the caller can decide
 * whether to start it again afterwards.
 */
export async function stopForMaintenance<T extends MaintainableModule>(
  mod: T,
  stop: (mod: T) => Promise<void>
): Promise<boolean> {
  const wasRunning = mod.status === 'running';
  if (wasRunning) {
    await stop(mod);
  }
  return wasRunning;
}

/**
 * Start a module again after maintenance (update), but only when it was
 * running before - and without letting a start failure make the
 * maintenance operation itself look like it failed (the update already
 * succeeded; only the auto-restart did not).
 */
export async function restartAfterMaintenance<T>(
  wasRunning: boolean,
  mod: T,
  start: (mod: T) => Promise<void>,
  onStartError: (error: unknown) => void
): Promise<void> {
  if (!wasRunning) {
    return;
  }
  try {
    await start(mod);
  } catch (error) {
    onStartError(error);
  }
}
