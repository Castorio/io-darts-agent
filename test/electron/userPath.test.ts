import { createRequire } from 'module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveUserPath, parseShellPath } = require('../../electron/userPath.cjs') as {
  resolveUserPath: (opts: {
    platform: string;
    env: Record<string, string | undefined>;
    execFileSync: (file: string, args: string[], opts: unknown) => string;
    existsSync?: (p: string) => boolean;
  }) => string;
  parseShellPath: (output: string) => string | null;
};

const GUI_PATH = '/usr/bin:/bin:/usr/sbin:/sbin';

describe('parseShellPath', () => {
  it('extracts the PATH between the markers and ignores shell noise around it', () => {
    const output = 'Welcome!\n__IO_DARTS_PATH__/opt/homebrew/bin:/usr/bin__IO_DARTS_PATH__\nbye';
    expect(parseShellPath(output)).toBe('/opt/homebrew/bin:/usr/bin');
  });

  it('returns null when the markers are missing', () => {
    expect(parseShellPath('nothing here')).toBeNull();
  });
});

describe('resolveUserPath', () => {
  it('puts the login shell PATH (nvm, Homebrew) in front of the minimal GUI PATH on macOS', () => {
    const execFileSync = vi.fn(
      () => '__IO_DARTS_PATH__/Users/me/.nvm/versions/node/v22/bin:/opt/homebrew/bin:/usr/bin__IO_DARTS_PATH__'
    );

    const result = resolveUserPath({
      platform: 'darwin',
      env: { PATH: GUI_PATH, SHELL: '/bin/zsh' },
      execFileSync,
      existsSync: () => false,
    });

    expect(result).toBe('/Users/me/.nvm/versions/node/v22/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin');
    expect(execFileSync).toHaveBeenCalledWith('/bin/zsh', ['-ilc', expect.any(String)], expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it('falls back to the GUI PATH plus common install dirs when the shell fails', () => {
    const execFileSync = vi.fn(() => {
      throw new Error('timed out');
    });

    const result = resolveUserPath({
      platform: 'darwin',
      env: { PATH: GUI_PATH, SHELL: '/bin/zsh' },
      execFileSync,
      existsSync: (p) => p === '/opt/homebrew/bin',
    });

    expect(result).toBe(`${GUI_PATH}:/opt/homebrew/bin`);
  });

  it('leaves the PATH untouched on Windows (installers update the system PATH there)', () => {
    const execFileSync = vi.fn();

    const result = resolveUserPath({
      platform: 'win32',
      env: { PATH: 'C:\\Windows\\system32' },
      execFileSync,
    });

    expect(result).toBe('C:\\Windows\\system32');
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
