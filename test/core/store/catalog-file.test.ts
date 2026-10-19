import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCatalog } from '../../../src/core/store/catalog.js';

/**
 * The real catalog file (store/modules.json) is served as-is from
 * `main` and loaded by every hub; if it ever became invalid, the store
 * would silently drop its modules. This test loads it the same way
 * StoreCatalog does and asserts nothing is rejected, so a bad edit to
 * the file fails CI instead of failing silently in production.
 */
describe('store/modules.json', () => {
  const raw = readFileSync(join(__dirname, '../../../store/modules.json'), 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  it('parses as valid JSON with the expected top-level shape', () => {
    expect(parsed).toMatchObject({ version: 1 });
    expect(Array.isArray((parsed as { modules: unknown }).modules)).toBe(true);
  });

  it('accepts every entry with nothing rejected', () => {
    const result = parseCatalog(parsed);
    expect(result.rejected).toBe(0);
    expect(result.rejectedIds).toEqual([]);
  });

  it('contains the mqtt and autodarts-trainer modules', () => {
    const result = parseCatalog(parsed);
    const ids = result.modules.map((module) => module.id).sort();
    expect(ids).toEqual(['autodarts-trainer', 'mqtt']);
  });
});
