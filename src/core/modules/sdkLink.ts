import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveSdkPath } from './sdkPath.js';

const SDK_PACKAGE = '@autodarts-hub/module-sdk';

async function pathExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export interface EnsureSdkLinkEvents {
  onWarning?: (message: string) => void;
  onLinked?: (message: string) => void;
}

/**
 * Ensure modulePath/node_modules/@autodarts-hub/module-sdk resolves to a
 * real module-sdk package.json at sdkPath, (re)creating the link if it's
 * missing, dangling, or stale.
 *
 * Used both right after install/update (ModuleInstaller.fixSdkLink, where a
 * module's own file: dependency on the SDK may point at its author's
 * machine) and right before every external-module spawn
 * (src/main.ts spawnExternalModule): a Linux AppImage re-mounts the whole
 * app under a fresh /tmp/.mount_XXXXXXX path on every launch, so a link
 * created on a previous run points at a mountpoint that no longer exists -
 * the pathExists(sdkLinkPath) check below is what notices that and
 * recreates the link against the current run's sdkPath.
 */
export async function ensureSdkLink(modulePath: string, sdkPath: string, events: EnsureSdkLinkEvents = {}): Promise<void> {
  let declared = false;
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(modulePath, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    } | null;
    declared = !!(pkg?.dependencies?.[SDK_PACKAGE] ?? pkg?.devDependencies?.[SDK_PACKAGE]);
  } catch {
    return; // no readable package.json, nothing to link
  }
  if (!declared) return;

  const sdkLinkPath = path.join(modulePath, 'node_modules', '@autodarts-hub', 'module-sdk');
  if (await pathExists(path.join(sdkLinkPath, 'package.json'))) return;

  if (!(await pathExists(path.join(sdkPath, 'package.json')))) {
    events.onWarning?.(`Warning: module-sdk not found at ${sdkPath}, module may not build correctly`);
    return;
  }

  await fs.rm(sdkLinkPath, { recursive: true, force: true });
  await fs.mkdir(path.dirname(sdkLinkPath), { recursive: true });
  // A junction needs no admin rights on Windows, so updates reach the module there too
  await fs.symlink(sdkPath, sdkLinkPath, process.platform === 'win32' ? 'junction' : 'dir');
  events.onLinked?.('Linked the hub module SDK');
}

export interface Logger {
  warn: (message: string) => void;
  info: (message: string) => void;
}

const consoleLogger: Logger = {
  warn: (message) => console.warn(message),
  info: (message) => console.log(message),
};

/**
 * The pre-spawn step src/main.ts's spawnExternalModule runs before every
 * external module start: resolves the hub's current module-sdk path from
 * mainDir (the running main.ts/main.js's own directory - see
 * resolveSdkPath) and re-points modulePath's SDK link against it if
 * needed (see ensureSdkLink's doc comment for why this has to happen on
 * every spawn, not just at install time - the AppImage remount case).
 *
 * Pulled out of main.ts as its own small, independently testable step
 * (real caller wiring, i.e. actually running a spawned module process,
 * stays in main.ts) rather than inlined there.
 */
export async function refreshSdkLinkBeforeSpawn(
  modulePath: string,
  mainDir: string,
  logger: Logger = consoleLogger
): Promise<void> {
  const sdkPath = resolveSdkPath(mainDir);
  await ensureSdkLink(modulePath, sdkPath, {
    onWarning: (message) => logger.warn(`⚠️  ${message}`),
    onLinked: (message) => logger.info(`🔗 ${message}`),
  });
}
