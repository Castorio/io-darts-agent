/**
 * Module store catalog: fetches and validates the list of modules that can be
 * installed from the configured catalog URL, and caches the result for a
 * short time so the store page doesn't hammer the catalog host.
 */

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,100}$/;
const REPO_RE = /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;
const DEFAULT_BRANCH = 'main';
const NAME_MAX = 200;
const DESCRIPTION_MAX = 1000;
const CATEGORY_MAX = 40;
const AUTHOR_MAX = 80;
const MAX_RESPONSE_BYTES = 256 * 1024;
const LOAD_TIMEOUT_MS = 8_000;
const DEFAULT_TTL_MS = 10 * 60_000;

export interface StoreModule {
  id: string;
  name: { de: string; en: string };
  description: { de: string; en: string };
  category: string;
  author: string;
  repo: string;
  branch: string;
  homepage?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocalizedText(value: unknown, maxLength: number): value is { de: string; en: string } {
  if (!isPlainObject(value)) return false;
  const { de, en } = value;
  return (
    typeof de === 'string' && de.length > 0 && de.length <= maxLength &&
    typeof en === 'string' && en.length > 0 && en.length <= maxLength
  );
}

function isValidRepoUrl(raw: string): boolean {
  // Validate the exact shape against the raw string first: the WHATWG URL
  // parser normalizes "." / ".." path segments for special schemes, which
  // would silently turn a traversal attempt like ".../a/b/../c" into a
  // clean-looking "/a/c". Anchoring the regex on the untouched input instead
  // means such a string simply never matches.
  if (!REPO_RE.test(raw)) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'github.com') return false;
    if (parsed.search !== '' || parsed.hash !== '') return false;
    if (parsed.username !== '' || parsed.password !== '') return false;
    return true;
  } catch {
    return false;
  }
}

function isValidHomepage(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseModule(raw: unknown): StoreModule | null {
  if (!isPlainObject(raw)) return null;

  const { id, name, description, category, author, repo, branch, homepage } = raw;

  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (!isLocalizedText(name, NAME_MAX)) return null;
  if (!isLocalizedText(description, DESCRIPTION_MAX)) return null;
  if (typeof category !== 'string' || category.length === 0 || category.length > CATEGORY_MAX) return null;
  if (typeof author !== 'string' || author.length === 0 || author.length > AUTHOR_MAX) return null;
  if (typeof repo !== 'string' || !isValidRepoUrl(repo)) return null;

  let resolvedBranch = DEFAULT_BRANCH;
  if (branch !== undefined) {
    if (typeof branch !== 'string' || !BRANCH_RE.test(branch)) return null;
    resolvedBranch = branch;
  }

  if (homepage !== undefined) {
    if (typeof homepage !== 'string' || !isValidHomepage(homepage)) return null;
  }

  const module: StoreModule = {
    id,
    name: name as { de: string; en: string },
    description: description as { de: string; en: string },
    category,
    author,
    repo,
    branch: resolvedBranch,
  };
  if (homepage !== undefined) {
    module.homepage = homepage;
  }
  return module;
}

/**
 * Validates the raw catalog JSON and returns the accepted modules plus how
 * many entries were rejected. Invalid entries and duplicate ids are dropped
 * rather than failing the whole catalog.
 */
export function parseCatalog(raw: unknown): { modules: StoreModule[]; rejected: number } {
  if (!isPlainObject(raw)) return { modules: [], rejected: 0 };
  if (raw.version !== 1) return { modules: [], rejected: 0 };
  if (!Array.isArray(raw.modules)) return { modules: [], rejected: 0 };

  let rejected = 0;
  const byId = new Map<string, StoreModule[]>();

  for (const entry of raw.modules) {
    const parsed = parseModule(entry);
    if (!parsed) {
      rejected += 1;
      continue;
    }
    const existing = byId.get(parsed.id);
    if (existing) {
      existing.push(parsed);
    } else {
      byId.set(parsed.id, [parsed]);
    }
  }

  const modules: StoreModule[] = [];
  for (const entries of byId.values()) {
    if (entries.length === 1) {
      modules.push(entries[0]);
    } else {
      rejected += entries.length;
    }
  }

  return { modules, rejected };
}

export type CatalogLoadResult =
  | { available: true; modules: StoreModule[] }
  | { available: false; error: string };

export interface StoreCatalogOptions {
  url: string;
  fetchImpl?: typeof fetch;
  ttlMs?: number;
  now?: () => number;
}

/**
 * Loads the module store catalog from a configured URL, validating and
 * caching the result. Network and parsing failures surface as
 * `{ available: false, error }` rather than throwing, so callers can degrade
 * the store UI gracefully.
 */
export class StoreCatalog {
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private cache: { modules: StoreModule[]; fetchedAt: number } | null = null;

  constructor(opts: StoreCatalogOptions) {
    this.url = opts.url;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.now = opts.now ?? Date.now;
  }

  async load(): Promise<CatalogLoadResult> {
    if (this.cache && this.now() - this.cache.fetchedAt < this.ttlMs) {
      return { available: true, modules: this.cache.modules };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(this.url, { signal: controller.signal });

      if (!response.ok) {
        return { available: false, error: `Catalog request failed with status ${response.status}` };
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
        return { available: false, error: 'Catalog response exceeds the 256 KB size limit' };
      }

      const text = await response.text();
      if (Buffer.byteLength(text, 'utf-8') > MAX_RESPONSE_BYTES) {
        return { available: false, error: 'Catalog response exceeds the 256 KB size limit' };
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return { available: false, error: 'Catalog response is not valid JSON' };
      }

      const { modules } = parseCatalog(json);
      this.cache = { modules, fetchedAt: this.now() };
      return { available: true, modules };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { available: false, error: 'Catalog request timed out' };
      }
      return { available: false, error: error instanceof Error ? error.message : 'Catalog request failed' };
    } finally {
      clearTimeout(timeout);
    }
  }

  async find(id: string): Promise<StoreModule | null> {
    const result = await this.load();
    if (!result.available) return null;
    return result.modules.find((module) => module.id === id) ?? null;
  }
}
