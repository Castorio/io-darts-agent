/**
 * Copying a module's source tree for a local install (source: 'local').
 *
 * Extracted so the skip/filter rules can be unit tested against real
 * directories instead of mocked fs calls.
 */
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Always skipped, regardless of the module's own .gitignore: dependency
 * trees, VCS metadata, Python virtualenvs/caches and OS clutter. These are
 * the entries the bug report found bloating a local install (a .venv alone
 * was 808MB) - none of them are needed in the copy, since npm install and
 * the module's own build step (if any) run again after copying.
 *
 * `dist` is deliberately NOT skipped: some modules ship a pre-built dist
 * with no "build" script to regenerate it (see buildModule in
 * ModuleInstaller, which only runs `npm run build` when the module declares
 * one), so dropping it could leave such a module non-functional. Modules
 * that do have a build step get dist regenerated anyway, so copying it
 * first is harmless, just a few extra (typically small) files.
 */
export const DEFAULT_COPY_SKIP_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  '.DS_Store',
]);

export function shouldSkipCopyEntry(name: string, extraSkipNames: ReadonlySet<string> = new Set()): boolean {
  return DEFAULT_COPY_SKIP_NAMES.has(name) || extraSkipNames.has(name);
}

/**
 * Parse a .gitignore's content into plain names to skip, keeping only
 * patterns simple enough to match safely by basename:
 * - a bare name ("node_modules") or a directory pattern ("dist/")
 * - no negation ("!foo"), no wildcards (*, ?, [...]), no nested paths
 *   ("src/generated") - those need a real gitignore matcher (anchoring,
 *   globbing, precedence between rules) to apply correctly, and matching
 *   them naively could skip (or fail to skip) the wrong thing.
 */
export function parseSimpleGitignoreNames(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('!'))
    .map((line) => (line.endsWith('/') ? line.slice(0, -1) : line))
    .filter((line) => line.length > 0 && !line.includes('/') && !/[*?[\]]/.test(line));
}

/**
 * Read and parse the module's own top-level .gitignore, if any. Returns []
 * if there is none or it can't be read - the copy still runs, just without
 * the extra exclusions.
 */
export async function readSimpleGitignoreNames(sourceDir: string): Promise<string[]> {
  try {
    const content = await fs.readFile(path.join(sourceDir, '.gitignore'), 'utf-8');
    return parseSimpleGitignoreNames(content);
  } catch {
    return [];
  }
}

/**
 * Recursively copy a module's source tree for a local install.
 *
 * Symlinked entries are never followed (copied or recursed into): a
 * symlink inside the source tree can point anywhere on disk, including
 * outside the module being installed, and following it would copy (or walk
 * into) files the install has no business touching.
 */
export async function copyModuleDir(
  src: string,
  dest: string,
  extraSkipNames: ReadonlySet<string> = new Set()
): Promise<void> {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkipCopyEntry(entry.name, extraSkipNames)) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyModuleDir(srcPath, destPath, extraSkipNames);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
