import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  stopExternalModule,
  restartExternalModule,
  handleExternalModuleExit,
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

  it('marks the module "stopping" before sending the shutdown, so an intentional stop is not logged as a crash', async () => {
    const { mod, proc } = makeRunningExternalModule();
    mod.status = 'running';

    const stopPromise = stopExternalModule(mod);
    // mod.status must already be 'stopping' by the time sendShutdown goes out,
    // i.e. before the process has had any chance to exit.
    expect(mod.status).toBe('stopping');

    await new Promise((resolve) => setImmediate(resolve));
    proc.emit('exit', 0, null);
    await stopPromise;
  });
});

describe('handleExternalModuleExit', () => {
  it('ignores the exit of a process that is no longer mod.process (stale exit after a restart)', () => {
    const { mod, proc, bridgeStop } = makeRunningExternalModule();
    const newProc = new EventEmitter() as EventEmitter & ExternalProcessHandle;
    const newBridge = { sendShutdown: vi.fn().mockReturnValue(true), stop: vi.fn().mockResolvedValue(undefined) };
    // Simulate: the old process was replaced by a new one (restart already ran).
    mod.process = newProc;
    mod.bridge = newBridge;
    mod.status = 'running';

    const handled = handleExternalModuleExit(mod, proc);

    expect(handled).toBe(false);
    expect(mod.process).toBe(newProc);
    expect(mod.bridge).toBe(newBridge);
    expect(mod.status).toBe('running');
    expect(bridgeStop).not.toHaveBeenCalled();
  });

  it('cleans up and marks the module crashed when its current process exits unexpectedly', () => {
    const { mod, proc, bridgeStop } = makeRunningExternalModule();
    mod.status = 'running';

    const handled = handleExternalModuleExit(mod, proc);

    expect(handled).toBe(true);
    expect(mod.status).toBe('crashed');
    expect(mod.process).toBeUndefined();
    expect(mod.bridge).toBeUndefined();
    expect(mod.isExternalProcess).toBe(false);
    expect(bridgeStop).toHaveBeenCalledTimes(1);
  });

  it('cleans up without marking "crashed" when the exit follows an intentional stop (status already "stopping")', () => {
    const { mod, proc } = makeRunningExternalModule();
    mod.status = 'stopping';

    const handled = handleExternalModuleExit(mod, proc);

    expect(handled).toBe(true);
    expect(mod.status).toBe('stopping');
    expect(mod.process).toBeUndefined();
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
