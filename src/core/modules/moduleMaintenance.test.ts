import { describe, it, expect, vi } from 'vitest';
import { stopForMaintenance, restartAfterMaintenance, type MaintainableModule } from './moduleMaintenance.js';

describe('stopForMaintenance', () => {
  it('stops a running module and reports that it was running', async () => {
    const mod: MaintainableModule = { status: 'running' };
    const stop = vi.fn().mockResolvedValue(undefined);

    const wasRunning = await stopForMaintenance(mod, stop);

    expect(wasRunning).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(mod);
  });

  it('does not call stop for a module that is not running (regression: uninstall/update left the external process running)', async () => {
    const mod: MaintainableModule = { status: 'stopped' };
    const stop = vi.fn().mockResolvedValue(undefined);

    const wasRunning = await stopForMaintenance(mod, stop);

    expect(wasRunning).toBe(false);
    expect(stop).not.toHaveBeenCalled();
  });

  it('propagates a stop failure instead of silently reporting success', async () => {
    const mod: MaintainableModule = { status: 'running' };
    const stop = vi.fn().mockRejectedValue(new Error('shutdown timeout'));

    await expect(stopForMaintenance(mod, stop)).rejects.toThrow('shutdown timeout');
  });
});

describe('restartAfterMaintenance', () => {
  it('starts the module again when it was running before maintenance', async () => {
    const mod = { id: 'homeassistant' };
    const start = vi.fn().mockResolvedValue(undefined);
    const onStartError = vi.fn();

    await restartAfterMaintenance(true, mod, start, onStartError);

    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(mod);
    expect(onStartError).not.toHaveBeenCalled();
  });

  it('does nothing when the module was not running before maintenance', async () => {
    const mod = { id: 'homeassistant' };
    const start = vi.fn().mockResolvedValue(undefined);
    const onStartError = vi.fn();

    await restartAfterMaintenance(false, mod, start, onStartError);

    expect(start).not.toHaveBeenCalled();
    expect(onStartError).not.toHaveBeenCalled();
  });

  it('reports a start failure via the error callback instead of throwing (the update itself already succeeded)', async () => {
    const mod = { id: 'homeassistant' };
    const error = new Error('entry point not found');
    const start = vi.fn().mockRejectedValue(error);
    const onStartError = vi.fn();

    await expect(restartAfterMaintenance(true, mod, start, onStartError)).resolves.toBeUndefined();

    expect(onStartError).toHaveBeenCalledWith(error);
  });
});
