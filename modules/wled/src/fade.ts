/**
 * Fade time units for the WLED module.
 *
 * Stored unit: milliseconds, both for the global `fadeTime` and for the
 * per-action `fadeTime`. The only place that converts to the WLED JSON API
 * unit (100 ms steps) is `toWledTransition`.
 *
 * Migration: configs written before this unit was fixed carry no
 * `fadeTimeUnit` marker. In those configs the per-action `fadeTime` was
 * written by the event editor in tenths of a second (presets 0, 2, 5, 10,
 * 20, 50 labeled "instant" to "5s"; documented range 0 to 100). The global
 * `fadeTime` was always documented in milliseconds. It could not be set in
 * the UI, so a legacy global value of 0 is the old manifest default and is
 * removed: the module then sends no transition and WLED keeps its own
 * default, as before. A legacy global value above 0 was set by hand and is
 * kept as milliseconds.
 *
 * Global fadeTime after migration: missing or null = WLED default (no `tt`
 * sent), 0 = instant, above 0 = that many milliseconds.
 *
 * Ambiguous legacy per-action values:
 * - 0 to 100: tenths of a second, multiplied by 100 (50 becomes 5000 ms).
 * - above 100: the old editor could never produce them, so they were set by
 *   hand against the handler, which read them as milliseconds. They are kept
 *   as milliseconds.
 * - negative, non numeric or empty: dropped, the action then falls back to
 *   the global fade time.
 *
 * A config that carries `fadeTimeUnit: 'ms'` is never converted again.
 *
 * Keep in sync with web/src/lib/wledFade.ts (a parity test guards this).
 */

export const FADE_TIME_UNIT = 'ms' as const;

/** WLED keeps transitions in a 16 bit millisecond counter, so 65.5 s is the ceiling. */
export const MAX_FADE_MS = 65500;

/** Highest per-action value the old editor understood as tenths of a second. */
export const LEGACY_TENTHS_MAX = 100;

interface FadeCarrier {
  fadeTime?: number;
}

export interface FadeConfigShape<A extends FadeCarrier = FadeCarrier> {
  fadeTime?: number | null;
  fadeTimeUnit?: typeof FADE_TIME_UNIT;
  events?: Record<string, A>;
  eventActions?: Record<string, A>;
  defaultState?: A;
}

/** Returns a clamped, non-negative millisecond value, or undefined if unusable. */
export function sanitizeFadeMs(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, MAX_FADE_MS);
}

/** Converts milliseconds to the WLED `tt` / `transition` unit (100 ms). */
export function toWledTransition(ms: number): number {
  const safe = sanitizeFadeMs(ms) ?? 0;
  return Math.round(safe / 100);
}

/** Interprets a per-action value from a config without the unit marker. */
export function migrateLegacyActionFade(value: unknown): number | undefined {
  const n = sanitizeFadeMs(value);
  if (n === undefined) return undefined;
  return n <= LEGACY_TENTHS_MAX ? n * 100 : n;
}

function normalizeAction<A extends FadeCarrier>(action: A, legacy: boolean): A {
  if (!action || typeof action !== 'object') return action;
  if (!('fadeTime' in action)) return { ...action };
  const { fadeTime, ...rest } = action;
  const ms = legacy ? migrateLegacyActionFade(fadeTime) : sanitizeFadeMs(fadeTime);
  return (ms === undefined ? rest : { ...rest, fadeTime: ms }) as A;
}

function normalizeActionMap<A extends FadeCarrier>(
  map: Record<string, A> | undefined,
  legacy: boolean,
): Record<string, A> | undefined {
  if (!map || typeof map !== 'object') return map;
  const out: Record<string, A> = {};
  for (const [key, action] of Object.entries(map)) {
    out[key] = normalizeAction(action, legacy);
  }
  return out;
}

/**
 * Pure: returns a copy of the config with every fade time in milliseconds
 * and the unit marker set. Safe to call repeatedly.
 */
export function normalizeWledConfig<C extends FadeConfigShape<A>, A extends FadeCarrier = FadeCarrier>(
  config: C,
): C & { fadeTimeUnit: typeof FADE_TIME_UNIT } {
  const legacy = config.fadeTimeUnit !== FADE_TIME_UNIT;
  const out: C & { fadeTimeUnit: typeof FADE_TIME_UNIT } = { ...config, fadeTimeUnit: FADE_TIME_UNIT };

  if ('fadeTime' in config) {
    const sanitized = sanitizeFadeMs(config.fadeTime);
    const ms = legacy && sanitized === 0 ? undefined : sanitized;
    if (ms === undefined) delete out.fadeTime;
    else out.fadeTime = ms;
  }
  if (config.events !== undefined) out.events = normalizeActionMap(config.events, legacy);
  if (config.eventActions !== undefined) out.eventActions = normalizeActionMap(config.eventActions, legacy);
  if (config.defaultState !== undefined) out.defaultState = normalizeAction(config.defaultState, legacy);
  return out;
}

/**
 * Hub side merge for a config save. The stored config is migrated first, so
 * a legacy file gets every fade location (events, eventActions,
 * defaultState, global) converted before the marker is written. The update
 * is read as milliseconds: the WLED page and the generic module form both
 * write ms, so a global 0 from a form stays "instant" instead of being taken
 * for the old manifest default.
 */
export function mergeWledConfigUpdate<C extends FadeConfigShape>(
  stored: C,
  update: Partial<C>,
): C & { fadeTimeUnit: typeof FADE_TIME_UNIT } {
  const migrated = normalizeWledConfig(stored);
  return normalizeWledConfig({ ...migrated, ...update, fadeTimeUnit: FADE_TIME_UNIT } as C);
}
