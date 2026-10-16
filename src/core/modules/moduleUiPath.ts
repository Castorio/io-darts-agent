/**
 * Path checks for serving module UIs (/module-ui/:moduleId/*)
 */

import * as path from 'path';

/** A module id is used as a folder name, so it must be one plain segment */
export function isValidModuleId(moduleId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(moduleId);
}

/**
 * File for a requested UI path, or null if it would leave the UI folder
 *
 * The router decodes the wildcard (..%2f becomes ../), so the path is
 * resolved and checked against the folder before any file access.
 */
export function resolveModuleUiFile(uiRoot: string, requestedPath: string): string | null {
  if (requestedPath.includes('\0')) return null;
  const root = path.resolve(uiRoot);
  const file = path.resolve(root, requestedPath);
  return file.startsWith(root + path.sep) ? file : null;
}
