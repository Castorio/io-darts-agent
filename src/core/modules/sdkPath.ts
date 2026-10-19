/**
 * Resolve the module SDK directory (module-sdk/ at the repo root), which is
 * linked into locally-installed and git-cloned modules so they can build
 * against @autodarts-hub/module-sdk.
 *
 * `mainDir` is the directory of the running main.ts/main.js file:
 * - dist/src, two levels below the repo root, for a compiled build (the
 *   normal production layout, including the unpacked Electron app, whose
 *   root also holds dist/, web/dist/, modules/ and node_modules/)
 * - src, one level below the repo root, when running from source via
 *   tsx/ts-node (e.g. `npm run dev`)
 *
 * Resolving purely from the compiled-build assumption (always two levels
 * up) lands one directory too high when running from source. Pick whichever
 * candidate actually has a module-sdk package, preferring the compiled
 * layout so existing production/packaged behavior is unchanged; fall back
 * to the compiled-layout path if neither exists, so callers get a
 * predictable (if missing) path instead of silently preferring an
 * unrelated directory that happens to exist.
 */
import * as fs from 'fs';
import * as path from 'path';

function hasPackageJson(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, 'package.json'));
  } catch {
    return false;
  }
}

export function resolveSdkPath(mainDir: string): string {
  const compiledLayout = path.resolve(mainDir, '..', '..', 'module-sdk');
  if (hasPackageJson(compiledLayout)) {
    return compiledLayout;
  }

  const sourceLayout = path.resolve(mainDir, '..', 'module-sdk');
  if (hasPackageJson(sourceLayout)) {
    return sourceLayout;
  }

  return compiledLayout;
}
