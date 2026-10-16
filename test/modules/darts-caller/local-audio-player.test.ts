import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { linuxPlayerCandidates, playWithFirstAvailable } from '../../../modules/darts-caller/src/LocalAudioPlayer.js';

function fakeProcess(result: { error?: string; code?: number }) {
  const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
  proc.stderr = new EventEmitter();
  setTimeout(() => {
    if (result.error) {
      const err = Object.assign(new Error(result.error), { code: result.error });
      proc.emit('error', err);
      // Node also emits close (code -2) after a spawn ENOENT
      proc.emit('close', -2);
    } else {
      proc.emit('close', result.code ?? 0);
    }
  }, 0);
  return proc;
}

describe('linuxPlayerCandidates', () => {
  it('only offers players that decode MP3, never aplay', () => {
    const cmds = linuxPlayerCandidates(80).map((p) => p.cmd);
    expect(cmds).toEqual(['mpg123', 'ffplay']);
    expect(cmds).not.toContain('aplay');
  });

  it('passes the volume to both players', () => {
    const [mpg123, ffplay] = linuxPlayerCandidates(50);
    expect(mpg123.args('/a.mp3')).toEqual(['-q', '-f', '16384', '/a.mp3']);
    expect(ffplay.args('/a.mp3')).toEqual(['-nodisp', '-autoexit', '-loglevel', 'error', '-volume', '50', '/a.mp3']);
  });
});

describe('playWithFirstAvailable', () => {
  it('falls through to ffplay when mpg123 is not installed', async () => {
    const spawn = vi
      .fn()
      .mockImplementationOnce(() => fakeProcess({ error: 'ENOENT' }))
      .mockImplementationOnce(() => fakeProcess({ code: 0 }));

    const used = await playWithFirstAvailable(linuxPlayerCandidates(80), '/a.mp3', spawn);

    expect(used).toBe('ffplay');
    expect(spawn.mock.calls.map((c) => c[0])).toEqual(['mpg123', 'ffplay']);
  });

  it('waits for the fallback player instead of returning early', async () => {
    let ffplayFinished = false;
    const spawn = vi
      .fn()
      .mockImplementationOnce(() => fakeProcess({ error: 'ENOENT' }))
      .mockImplementationOnce(() => {
        const proc = fakeProcess({ code: 0 });
        proc.on('close', () => {
          ffplayFinished = true;
        });
        return proc;
      });

    await playWithFirstAvailable(linuxPlayerCandidates(80), '/a.mp3', spawn);

    expect(ffplayFinished).toBe(true);
  });

  it('reports when no player is installed', async () => {
    const spawn = vi.fn(() => fakeProcess({ error: 'ENOENT' }));

    expect(await playWithFirstAvailable(linuxPlayerCandidates(80), '/a.mp3', spawn)).toBeNull();
  });

  it('does not try the next player when playback itself failed', async () => {
    const spawn = vi.fn(() => fakeProcess({ code: 1 }));

    expect(await playWithFirstAvailable(linuxPlayerCandidates(80), '/a.mp3', spawn)).toBe('mpg123');
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
