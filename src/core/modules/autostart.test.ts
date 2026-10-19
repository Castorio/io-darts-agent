import { describe, it, expect, vi } from 'vitest';
import type { ModuleStatus } from '../../types/modules.js';
import { autostartModules, connectThenAutostart } from './autostart.js';

interface FakeModule {
  id: string;
  status: ModuleStatus;
  autostart: boolean;
}

const mod = (id: string, autostart = true, status: ModuleStatus = 'stopped'): FakeModule => ({
  id,
  status,
  autostart,
});

describe('autostartModules', () => {
  it('starts every stopped module that should autostart and marks it running', async () => {
    const modules = [mod('homeassistant'), mod('wled'), mod('trainer', false)];
    const start = vi.fn(async (_m: FakeModule) => {});

    await autostartModules(modules, { shouldAutostart: (m) => m.autostart, start });

    expect(start.mock.calls.map(([m]) => m.id)).toEqual(['homeassistant', 'wled']);
    expect(modules.map((m) => m.status)).toEqual(['running', 'running', 'stopped']);
  });

  it('skips modules that are not stopped', async () => {
    const modules = [mod('wled', true, 'running'), mod('caller', true, 'error')];
    const start = vi.fn(async (_m: FakeModule) => {});

    await autostartModules(modules, { shouldAutostart: () => true, start });

    expect(start).not.toHaveBeenCalled();
  });

  it('keeps going when one module fails and leaves the failed one stopped', async () => {
    const modules = [mod('broken'), mod('wled')];
    const onFailed = vi.fn();
    const start = vi.fn(async (m: FakeModule) => {
      if (m.id === 'broken') throw new Error('spawn failed');
    });

    await autostartModules(modules, { shouldAutostart: () => true, start, onFailed });

    expect(modules.map((m) => m.status)).toEqual(['stopped', 'running']);
    expect(onFailed).toHaveBeenCalledWith(modules[0], expect.any(Error));
  });
});

describe('connectThenAutostart', () => {
  it('still autostarts modules when the Autodarts login fails, then rethrows', async () => {
    const loginError = new Error('Invalid credentials');
    const autostart = vi.fn(async () => {});

    await expect(
      connectThenAutostart(() => Promise.reject(loginError), autostart)
    ).rejects.toBe(loginError);

    expect(autostart).toHaveBeenCalledTimes(1);
  });

  it('autostarts after a successful connect', async () => {
    const order: string[] = [];

    await connectThenAutostart(
      async () => {
        order.push('connect');
      },
      async () => {
        order.push('autostart');
      }
    );

    expect(order).toEqual(['connect', 'autostart']);
  });

  it('does not start a module twice when a later connect succeeds', async () => {
    const modules = [mod('homeassistant'), mod('wled')];
    const start = vi.fn(async (_m: FakeModule) => {});
    const autostart = (): Promise<void> =>
      autostartModules(modules, { shouldAutostart: () => true, start });

    await expect(
      connectThenAutostart(() => Promise.reject(new Error('login failed')), autostart)
    ).rejects.toThrow('login failed');
    await connectThenAutostart(async () => {}, autostart);

    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls.map(([m]) => m.id)).toEqual(['homeassistant', 'wled']);
  });
});
