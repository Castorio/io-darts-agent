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
 * The layout is picked by WHERE mainDir sits (is its parent directory named
 * "dist"?), not by probing the filesystem for a `module-sdk/package.json`
 * at each candidate. Probing used to prefer the compiled-layout candidate
 * whenever it had a package.json, with no check that it was actually the
 * real module-sdk package - so a sibling repo checked out next to this one
 * and coincidentally (or deliberately) named "module-sdk" could hijack a
 * dev run and get linked into modules instead of the real SDK. Deciding
 * from mainDir's own location is unambiguous and can't be influenced by
 * what else happens to exist on disk.
 */
import * as path from 'path';

export function resolveSdkPath(mainDir: string): string {
  const isCompiledLayout = path.basename(path.dirname(mainDir)) === 'dist';
  return isCompiledLayout
    ? path.resolve(mainDir, '..', '..', 'module-sdk')
    : path.resolve(mainDir, '..', 'module-sdk');
}
