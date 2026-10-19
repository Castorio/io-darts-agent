import { describe, it, expect } from 'vitest';
import { computeModuleStats } from './moduleStats.js';

describe('computeModuleStats', () => {
  it('counts zero modules as zero total and zero running', () => {
    expect(computeModuleStats([])).toEqual({ total: 0, running: 0 });
  });

  it('counts running modules among stopped ones (e.g. before Autodarts has connected)', () => {
    const modules = [
      { status: 'running' as const },
      { status: 'stopped' as const },
      { status: 'running' as const },
    ];
    expect(computeModuleStats(modules)).toEqual({ total: 3, running: 2 });
  });

  it('does not count starting, stopping, error or crashed modules as running', () => {
    const modules = [
      { status: 'starting' as const },
      { status: 'stopping' as const },
      { status: 'error' as const },
      { status: 'crashed' as const },
    ];
    expect(computeModuleStats(modules)).toEqual({ total: 4, running: 0 });
  });

  it('accepts any iterable, such as a Map of installed modules', () => {
    const installedModules = new Map<string, { status: string }>([
      ['wled', { status: 'running' }],
      ['darts-caller', { status: 'running' }],
    ]);
    expect(computeModuleStats(installedModules.values())).toEqual({ total: 2, running: 2 });
  });
});
