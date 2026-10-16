import { describe, it, expect, vi } from 'vitest';
import { createStartOnce } from './startOnce.js';

describe('createStartOnce', () => {
  it('runs one start for parallel calls of the same module', async () => {
    let release!: () => void;
    const start = vi.fn(() => new Promise<void>((r) => (release = r)));
    const startOnce = createStartOnce<string>(() => false, start);

    const a = startOnce('trainer');
    const b = startOnce('trainer');
    release();
    await Promise.all([a, b]);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('skips a module that is already running', async () => {
    const start = vi.fn(async () => {});
    const startOnce = createStartOnce<string>(() => true, start);

    await startOnce('trainer');

    expect(start).not.toHaveBeenCalled();
  });

  it('allows a new start after a failed one', async () => {
    const start = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
    const startOnce = createStartOnce<string>(() => false, start);

    await expect(startOnce('mqtt')).rejects.toThrow('timeout');
    await startOnce('mqtt');

    expect(start).toHaveBeenCalledTimes(2);
  });
});
