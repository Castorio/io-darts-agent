import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  stopExternalModule,
  restartExternalModule,
  type ExternalProcessModule,
  type ExternalProcessHandle,
} from './externalModuleLifecycle.js';

function makeRunningExternalModule(): {
  mod: ExternalProcessModule;
  proc: EventEmitter & ExternalProcessHandle;
  bridgeStop: ReturnType<typeof vi.fn>;
} {
  const proc = new EventEmitter() as EventEmitter & ExternalProcessHandle;
  proc.kill = vi.fn();
  const bridgeStop = vi.fn().mockResolvedValue(undefined);
  const mod: ExternalProcessModule = {
    id: 'homeassistant',
    manifest: { name: 'Home Assistant' },
    process: proc,
    bridge: {
      sendShutdown: vi.fn().mockReturnValue(true),
      stop: bridgeStop,
    },
    isExternalProcess: true,
  };
  return { mod, proc, bridgeStop };
}

describe('stopExternalModule', () => {
  it('is a no-op for a module with no running process/bridge (built-in modules)', async () => {
    const mod: ExternalProcessModule = { id: 'wled', manifest: { name: 'WLED' } };
    await expect(stopExternalModule(mod)).resolves.toBeUndefined();
  });

  it('stops cleanly when its own exit wait is the only exit listener', async () => {
    const { mod, proc, bridgeStop } = makeRunningExternalModule();

    const stopPromise = stopExternalModule(mod);
    // Let stopExternalModule's unregisterRoutes() await resolve and its
    // once('exit') listener actually get registered before the process exits.
    await new Promise((resolve) => setImmediate(resolve));
    proc.emit('exit', 0, null);
    await expect(stopPromise).resolves.toBeUndefined();

    expect(bridgeStop).toHaveBeenCalledTimes(1);
    expect(mod.process).toBeUndefined();
    expect(mod.bridge).toBeUndefined();
    expect(mod.isExternalProcess).toBe(false);
  });

  it('does not throw when a process-level exit handler already cleared the bridge (regression: 500 "Cannot read properties of undefined (reading \'stop\')")', async () => {
    const { mod, proc } = makeRunningExternalModule();

    // Reproduces the real race: spawnExternalModule registers its own permanent
    // `proc.on('exit', ...)` crash/cleanup handler *before* stop is ever called.
    // Node fires 'exit' listeners in registration order, so this one runs before
    // stopExternalModule's own once('exit') wait below resolves, and it clears
    // mod.bridge/mod.process itself.
    proc.on('exit', () => {
      mod.process = undefined;
      mod.bridge = undefined;
      mod.isExternalProcess = false;
    });

    const stopPromise = stopExternalModule(mod);
    await new Promise((resolve) => setImmediate(resolve));
    proc.emit('exit', 0, null);

    await expect(stopPromise).resolves.toBeUndefined();
  });
});

describe('restartExternalModule', () => {
  it('waits for the old process to fully stop before starting a new one', async () => {
    const { mod, proc } = makeRunningExternalModule();
    const start = vi.fn().mockImplementation(async (m: ExternalProcessModule) => {
      // By the time start() runs, the old process/bridge must already be gone -
      // this is what makes restart actually restart an external module, instead
      // of start() seeing mod.process still set and treating it as already running.
      expect(m.process).toBeUndefined();
      expect(m.bridge).toBeUndefined();
    });

    const restartPromise = restartExternalModule(mod, start);
    // Let stopExternalModule's unregisterRoutes() await and its exit-wait
    // registration settle before the process actually exits.
    await new Promise((resolve) => setImmediate(resolve));
    proc.emit('exit', 0, null);

    await restartPromise;

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(mod);
  });

  it('starts even when the module had nothing running (crashed/never started)', async () => {
    const mod: ExternalProcessModule = { id: 'homeassistant', manifest: { name: 'Home Assistant' } };
    const start = vi.fn().mockResolvedValue(undefined);

    await restartExternalModule(mod, start);

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(mod);
  });
});
