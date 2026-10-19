import { getModuleRouteRegistry } from './ModuleRouteRegistry.js';

/**
 * Minimal shape of a child process handle needed to stop an external module.
 * Matches the subset of Node's `ChildProcess` that this file touches, so tests
 * can pass a plain `EventEmitter` instead of spawning a real process.
 */
export interface ExternalProcessHandle {
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  kill?(signal?: NodeJS.Signals | number): boolean;
}

/**
 * Minimal shape of a module's IPC bridge needed to stop an external module.
 * Matches the subset of `ModuleBridge` that this file touches.
 */
export interface ExternalModuleBridge {
  sendShutdown(reason: 'user' | 'update' | 'hub-shutdown' | 'error', gracePeriodMs?: number): boolean;
  stop(): Promise<void>;
}

/**
 * Minimal shape of an installed module needed to stop/restart its external process.
 * `InstalledModule` in main.ts satisfies this structurally.
 */
export interface ExternalProcessModule {
  id: string;
  manifest: { name: string };
  process?: ExternalProcessHandle;
  bridge?: ExternalModuleBridge;
  isExternalProcess?: boolean;
}

/**
 * Stop an external module's child process gracefully, then release its bridge.
 *
 * A no-op when the module has no running process/bridge (e.g. a built-in,
 * in-process module, or an external module that already exited).
 *
 * The process's own crash/exit handler (registered when it was spawned) also
 * listens for the process's 'exit' event and clears `mod.process`/`mod.bridge`
 * itself. Since Node fires listeners in registration order and that handler is
 * registered before this function's own wait below, it can run first and clear
 * `mod.bridge` before we get here. `mod.bridge?.stop()` tolerates that instead of
 * throwing "Cannot read properties of undefined (reading 'stop')" once the
 * process has already exited.
 */
export async function stopExternalModule(mod: ExternalProcessModule): Promise<void> {
  if (!mod.process || !mod.bridge) {
    return;
  }

  console.log(`⏹️  Stopping external module: ${mod.manifest.name}`);

  const registry = getModuleRouteRegistry();
  await registry.unregisterRoutes(mod.id);
  console.log(`🛣️  [${mod.id}] Routes unregistered`);

  try {
    // Send shutdown signal
    mod.bridge.sendShutdown('user', 5000);

    // Wait for process to exit gracefully
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Shutdown timeout'));
      }, 6000);

      mod.process!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch {
    // Force kill if graceful shutdown fails
    console.log(`⚠️  Force killing module: ${mod.manifest.name}`);
    mod.process?.kill?.('SIGKILL');
  }

  // Cleanup
  await mod.bridge?.stop();
  mod.process = undefined;
  mod.bridge = undefined;
  mod.isExternalProcess = false;
}

/**
 * Stop all currently-running external modules, so no orphaned process
 * attaches to the next hub instance (restart, shutdown).
 */
export async function stopAllExternalModules(modules: Iterable<ExternalProcessModule>): Promise<void> {
  const running = [...modules].filter((mod) => mod.process);
  await Promise.all(
    running.map((mod) =>
      stopExternalModule(mod).catch((error) => {
        console.error(`Error stopping module ${mod.id}:`, error);
      })
    )
  );
}
