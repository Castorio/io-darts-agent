import { describe, it, expect, vi } from 'vitest';
import { RESTART_EXIT_CODE, restartStrategy, restartProcess } from './restart.js';

describe('restartStrategy', () => {
  it('leaves the restart to systemd', () => {
    expect(restartStrategy({ INVOCATION_ID: 'abc' })).toBe('exit');
  });

  it('leaves the restart to the desktop app', () => {
    expect(restartStrategy({ IO_DARTS_SUPERVISED: '1' })).toBe('exit');
  });

  it('starts a new process when nothing supervises the hub', () => {
    expect(restartStrategy({})).toBe('respawn');
  });
});

describe('restartProcess', () => {
  function deps(env: NodeJS.ProcessEnv) {
    return {
      env,
      argv: ['/usr/bin/node', '/app/dist/src/main.js'],
      cwd: '/app',
      spawn: vi.fn(() => ({ unref: vi.fn() })),
      exit: vi.fn(),
    };
  }

  it('exits with the restart code under a supervisor', () => {
    const d = deps({ INVOCATION_ID: 'abc' });

    restartProcess(d);

    expect(d.spawn).not.toHaveBeenCalled();
    expect(d.exit).toHaveBeenCalledWith(RESTART_EXIT_CODE);
    expect(RESTART_EXIT_CODE).not.toBe(0);
  });

  it('spawns a detached copy with the same command, then exits cleanly', () => {
    const d = deps({ PATH: '/bin' });

    restartProcess(d);

    expect(d.spawn).toHaveBeenCalledWith('/usr/bin/node', ['/app/dist/src/main.js'], {
      cwd: '/app',
      env: { PATH: '/bin' },
      detached: true,
      stdio: 'inherit',
    });
    expect(d.exit).toHaveBeenCalledWith(0);
  });
});
