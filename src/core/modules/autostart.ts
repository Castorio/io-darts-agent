import type { ModuleStatus } from '../../types/modules.js';

export interface AutostartCandidate {
  id: string;
  status: ModuleStatus;
}

export interface AutostartDependencies<M extends AutostartCandidate> {
  shouldAutostart: (mod: M) => boolean;
  /** Sets up and starts one module; rejects if it could not be started. */
  start: (mod: M) => Promise<void>;
  onStarted?: (mod: M) => void;
  onFailed?: (mod: M, error: unknown) => void;
}

/**
 * Start every stopped module that should autostart, one after another.
 * Modules that are not 'stopped' (already running, starting, crashed) are skipped,
 * so calling this again after a reconnect never starts a module twice.
 */
export async function autostartModules<M extends AutostartCandidate>(
  modules: Iterable<M>,
  deps: AutostartDependencies<M>
): Promise<void> {
  for (const mod of modules) {
    if (mod.status !== 'stopped' || !deps.shouldAutostart(mod)) continue;
    try {
      await deps.start(mod);
      mod.status = 'running';
      deps.onStarted?.(mod);
    } catch (error) {
      deps.onFailed?.(mod, error);
    }
  }
}

/**
 * Connect to Autodarts, then autostart modules whether or not the connect worked.
 * Modules such as Home Assistant or WLED are useful without a live Autodarts
 * connection; they simply get no game events until one exists.
 * A connect error is rethrown after the autostart so callers still see it.
 */
export async function connectThenAutostart(
  connect: () => Promise<void>,
  autostart: () => Promise<void>
): Promise<void> {
  let connectFailed = false;
  let connectError: unknown;
  try {
    await connect();
  } catch (error) {
    connectFailed = true;
    connectError = error;
  }

  await autostart();

  if (connectFailed) throw connectError;
}
