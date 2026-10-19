import * as path from 'path';
import * as os from 'os';

/**
 * Build the IPC endpoint a module and the hub both connect to for a given
 * module id. Net IPC has no concept of a filesystem socket on Windows, so
 * win32 gets a named pipe instead of a path under a tmp directory; on every
 * other platform this is a Unix domain socket file.
 *
 * `moduleId` is expected to already be validated (see
 * MODULE_NAME_PATTERN/assertValidModuleId in ModuleInstaller.ts, which
 * installer-created ids go through), so it's embedded as-is.
 */
export function moduleSocketPath(
  moduleId: string,
  platform: NodeJS.Platform = process.platform,
  tmpDir: string = os.tmpdir()
): string {
  if (platform === 'win32') {
    return `\\\\.\\pipe\\autodarts-hub-${moduleId}`;
  }
  return path.join(tmpDir, `autodarts-hub-${moduleId}.sock`);
}
