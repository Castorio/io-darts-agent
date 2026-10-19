import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';
import { guardBrokenPipes, isBrokenPipe } from '../../src/core/brokenPipe.js';

function epipe(): NodeJS.ErrnoException {
  return Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
}

describe('guardBrokenPipes', () => {
  it('reports a closed stdout or stderr instead of raising an uncaught exception', () => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const onBrokenPipe = vi.fn();
    guardBrokenPipes([stdout, stderr], onBrokenPipe);

    expect(() => stdout.emit('error', epipe())).not.toThrow();
    expect(() => stderr.emit('error', epipe())).not.toThrow();
    expect(onBrokenPipe).toHaveBeenCalledTimes(2);
  });

  it('still raises other stream errors', () => {
    const stdout = new EventEmitter();
    guardBrokenPipes([stdout], vi.fn());

    expect(() => stdout.emit('error', Object.assign(new Error('boom'), { code: 'EIO' }))).toThrow('boom');
  });
});

describe('isBrokenPipe', () => {
  it('recognises EPIPE errors only', () => {
    expect(isBrokenPipe(epipe())).toBe(true);
    expect(isBrokenPipe(new Error('other'))).toBe(false);
    expect(isBrokenPipe('EPIPE')).toBe(false);
  });
});
