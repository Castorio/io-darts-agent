#!/usr/bin/env node
/**
 * Fails the release workflow early if the git tag that triggered it does
 * not match the version in package.json.
 *
 * Usage: node scripts/release/check-version.mjs [ref]
 * Reads the ref from argv[2], falling back to the GITHUB_REF env var set by
 * GitHub Actions on a tag push (e.g. "refs/tags/v1.2.3").
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTagMatchesVersion } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const ref = process.argv[2] || process.env.GITHUB_REF;
  if (!ref) {
    console.error('[check-version] No ref given: pass it as argv[2] or set GITHUB_REF.');
    process.exit(1);
    return;
  }

  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  try {
    checkTagMatchesVersion(ref, pkg.version);
  } catch (err) {
    console.error(`[check-version] ${err.message}`);
    process.exit(1);
    return;
  }

  console.log(`[check-version] OK: ref "${ref}" matches package.json version "${pkg.version}"`);
}

main();
