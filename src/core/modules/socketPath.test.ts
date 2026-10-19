import { describe, it, expect } from 'vitest';
import { moduleSocketPath } from './socketPath.js';

// Unix domain socket paths under a tmp dir don't exist as a concept on
// Windows; net IPC there needs a named pipe (\\.\pipe\<name>), which also
// sidesteps the path-length limits and permission quirks of a tmp dir.
describe('moduleSocketPath', () => {
  it('returns a named pipe path on win32, ignoring tmpDir', () => {
    expect(moduleSocketPath('wled', 'win32', 'C:\\Users\\me\\AppData\\Local\\Temp')).toBe(
      '\\\\.\\pipe\\autodarts-hub-wled'
    );
  });

  it('returns a unix domain socket path under tmpDir on darwin', () => {
    expect(moduleSocketPath('wled', 'darwin', '/tmp')).toBe('/tmp/autodarts-hub-wled.sock');
  });

  it('returns a unix domain socket path under tmpDir on linux', () => {
    expect(moduleSocketPath('darts-caller', 'linux', '/var/folders/xyz')).toBe(
      '/var/folders/xyz/autodarts-hub-darts-caller.sock'
    );
  });

  it('defaults platform and tmpDir to the running process when not given', () => {
    // Just exercise the defaults; the exact value depends on the host running
    // the test, so only check it matches one of the two known shapes.
    const result = moduleSocketPath('wled');
    expect(result).toMatch(/^(\\\\\.\\pipe\\autodarts-hub-wled|.*autodarts-hub-wled\.sock)$/);
  });
});
