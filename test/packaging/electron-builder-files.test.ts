import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import * as path from 'path';

// module-sdk/ is linked into every external module by ModuleInstaller.fixSdkLink
// (src/core/modules/ModuleInstaller.ts) so modules can build against
// @autodarts-hub/module-sdk. resolveSdkPath (src/core/modules/sdkPath.ts)
// expects it at <appRoot>/module-sdk for the compiled layout the packaged
// app runs - electron-builder's config must actually ship it there.
//
// It ships via extraResources, not the `files` list: electron-builder's main
// file matcher unconditionally strips *.d.ts (app-builder-lib's
// fileMatcher.js excludedExts), which would break builds of modules that
// compile against the SDK's types. extraResources isn't subject to that.
const root = path.resolve(__dirname, '../..');
const config = readFileSync(path.join(root, 'electron-builder.yml'), 'utf-8');

function extraResourcesSection(): string {
  const match = config.match(/^extraResources:\n([\s\S]*?)(?=\n\S|\n$)/m);
  if (!match) {
    throw new Error('electron-builder.yml has no extraResources: section');
  }
  return match[1];
}

describe('electron-builder module-sdk packaging', () => {
  it('ships module-sdk into the unpacked app directory', () => {
    const section = extraResourcesSection();
    expect(section).toMatch(/from:\s*"module-sdk"/);
    expect(section).toMatch(/to:\s*"app\/module-sdk"/);
  });

  it('includes the package manifest and compiled dist output', () => {
    const section = extraResourcesSection();
    expect(section).toMatch(/"package\.json"/);
    expect(section).toMatch(/"dist\/\*\*\/\*"/);
  });

  it('drops source maps but keeps .d.ts (modules compile against the SDK types)', () => {
    const section = extraResourcesSection();
    const moduleSdkBlockStart = section.indexOf('module-sdk');
    const block = section.slice(moduleSdkBlockStart);
    expect(block).toMatch(/!dist\/\*\*\/\*\.map/);
    expect(block).not.toMatch(/d\.ts/);
  });

  it('does not also list module-sdk under files (would double-ship and is unaffected by the .d.ts strip anyway)', () => {
    const filesMatch = config.match(/^files:\n([\s\S]*?)(?=\n\S|\n$)/m);
    expect(filesMatch).not.toBeNull();
    expect(filesMatch![1]).not.toMatch(/module-sdk/);
  });
});
