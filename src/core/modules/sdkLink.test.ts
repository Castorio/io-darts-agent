import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { ensureSdkLink } from './sdkLink.js';

function writeModule(modulePath: string, declaresSdk: boolean): void {
  mkdirSync(modulePath, { recursive: true });
  writeFileSync(
    path.join(modulePath, 'package.json'),
    JSON.stringify(
      declaresSdk ? { dependencies: { '@autodarts-hub/module-sdk': 'file:../module-sdk' } } : { dependencies: {} }
    )
  );
}

function writeSdk(sdkPath: string, marker: string): void {
  mkdirSync(sdkPath, { recursive: true });
  writeFileSync(path.join(sdkPath, 'package.json'), JSON.stringify({ name: '@autodarts-hub/module-sdk', marker }));
}

function linkedSdkMarker(linkPath: string): string {
  const pkg = JSON.parse(readFileSync(path.join(linkPath, 'package.json'), 'utf-8')) as { marker: string };
  return pkg.marker;
}

describe('ensureSdkLink', () => {
  let root: string;
  let modulePath: string;
  let linkPath: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'sdk-link-'));
    modulePath = path.join(root, 'module');
    linkPath = path.join(modulePath, 'node_modules', '@autodarts-hub', 'module-sdk');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('does nothing when the module does not declare the SDK as a dependency', async () => {
    writeModule(modulePath, false);
    const sdkPath = path.join(root, 'sdk');
    writeSdk(sdkPath, 'v1');

    await ensureSdkLink(modulePath, sdkPath);

    expect(existsSync(linkPath)).toBe(false);
  });

  it('does nothing when the module has no readable package.json', async () => {
    mkdirSync(modulePath, { recursive: true });
    const sdkPath = path.join(root, 'sdk');
    writeSdk(sdkPath, 'v1');

    await expect(ensureSdkLink(modulePath, sdkPath)).resolves.toBeUndefined();
    expect(existsSync(linkPath)).toBe(false);
  });

  it('creates the link when none exists yet', async () => {
    writeModule(modulePath, true);
    const sdkPath = path.join(root, 'sdk');
    writeSdk(sdkPath, 'v1');
    const linked = vi.fn();

    await ensureSdkLink(modulePath, sdkPath, { onLinked: linked });

    expect(linkedSdkMarker(linkPath)).toBe('v1');
    expect(linked).toHaveBeenCalled();
  });

  it('leaves a working link alone', async () => {
    writeModule(modulePath, true);
    const sdkPath = path.join(root, 'sdk');
    writeSdk(sdkPath, 'v1');
    await ensureSdkLink(modulePath, sdkPath);

    const linked = vi.fn();
    await ensureSdkLink(modulePath, sdkPath, { onLinked: linked });

    expect(linked).not.toHaveBeenCalled();
    expect(linkedSdkMarker(linkPath)).toBe('v1');
  });

  it('re-points a dangling link to the current sdkPath (AppImage remounts under a new /tmp/.mount_* path on every launch)', async () => {
    writeModule(modulePath, true);
    const firstMountSdk = path.join(root, 'mount-A', 'module-sdk');
    writeSdk(firstMountSdk, 'mount-A');
    await ensureSdkLink(modulePath, firstMountSdk);
    expect(linkedSdkMarker(linkPath)).toBe('mount-A');

    // Simulate the AppImage unmounting the previous run's mountpoint entirely
    rmSync(path.join(root, 'mount-A'), { recursive: true, force: true });
    expect(existsSync(path.join(linkPath, 'package.json'))).toBe(false); // now dangling

    const secondMountSdk = path.join(root, 'mount-B', 'module-sdk');
    writeSdk(secondMountSdk, 'mount-B');
    const linked = vi.fn();

    await ensureSdkLink(modulePath, secondMountSdk, { onLinked: linked });

    expect(linkedSdkMarker(linkPath)).toBe('mount-B');
    expect(linked).toHaveBeenCalled();
  });

  it('warns instead of throwing when the hub sdkPath itself does not exist', async () => {
    writeModule(modulePath, true);
    const missingSdkPath = path.join(root, 'nowhere');
    const warned = vi.fn();

    await ensureSdkLink(modulePath, missingSdkPath, { onWarning: warned });

    expect(warned).toHaveBeenCalledWith(expect.stringContaining(missingSdkPath));
    expect(existsSync(linkPath)).toBe(false);
  });
});
