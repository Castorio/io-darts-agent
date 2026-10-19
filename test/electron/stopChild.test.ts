import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stopChild } = require('../../electron/stopChild.cjs') as {
  stopChild: (child: FakeChild, opts: { timeoutMs: number }) => Promise<void>;
};

class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  signalCode: string | null = null;
  signals: string[] = [];
  constructor(private readonly exitsOn: string[]) {
    super();
  }
  kill(signal: string): boolean {
    this.signals.push(signal);
    if (this.exitsOn.includes(signal)) {
      setTimeout(() => {
        this.signalCode = signal;
        this.emit('exit', null, signal);
      }, 5);
    }
    return true;
  }
}

describe('stopChild', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves once the child has exited after SIGTERM', async () => {
    const child = new FakeChild(['SIGTERM']);
    await stopChild(child, { timeoutMs: 1000 });
    expect(child.signals).toEqual(['SIGTERM']);
    expect(child.signalCode).toBe('SIGTERM');
  });

  it('kills a child that ignores SIGTERM and only resolves after it is gone', async () => {
    const child = new FakeChild(['SIGKILL']);
    await stopChild(child, { timeoutMs: 20 });
    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(child.signalCode).toBe('SIGKILL');
  });

  it('resolves at once for a child that already exited', async () => {
    const child = new FakeChild([]);
    child.exitCode = 0;
    await stopChild(child, { timeoutMs: 1000 });
    expect(child.signals).toEqual([]);
  });
});
