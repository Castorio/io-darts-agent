import { describe, it, expect } from 'vitest';
import {
  FADE_TIME_UNIT,
  MAX_FADE_MS,
  sanitizeFadeMs,
  toWledTransition,
  migrateLegacyActionFade,
  normalizeWledConfig,
  mergeWledConfigUpdate,
} from '../../../modules/wled/src/fade.js';

describe('toWledTransition', () => {
  it('converts milliseconds to WLED 100 ms units', () => {
    expect(toWledTransition(0)).toBe(0);
    expect(toWledTransition(700)).toBe(7);
    expect(toWledTransition(5000)).toBe(50);
  });

  it('rounds to the nearest 100 ms unit', () => {
    expect(toWledTransition(149)).toBe(1);
    expect(toWledTransition(150)).toBe(2);
    expect(toWledTransition(40)).toBe(0);
  });

  it('clamps to the WLED maximum', () => {
    expect(toWledTransition(MAX_FADE_MS * 10)).toBe(MAX_FADE_MS / 100);
  });
});

describe('sanitizeFadeMs', () => {
  it('keeps finite non-negative numbers', () => {
    expect(sanitizeFadeMs(0)).toBe(0);
    expect(sanitizeFadeMs(1500)).toBe(1500);
  });

  it('accepts numeric strings', () => {
    expect(sanitizeFadeMs('700')).toBe(700);
  });

  it('drops values that are not a usable duration', () => {
    expect(sanitizeFadeMs(undefined)).toBeUndefined();
    expect(sanitizeFadeMs(null)).toBeUndefined();
    expect(sanitizeFadeMs(-5)).toBeUndefined();
    expect(sanitizeFadeMs(Number.NaN)).toBeUndefined();
    expect(sanitizeFadeMs('abc')).toBeUndefined();
    expect(sanitizeFadeMs('')).toBeUndefined();
  });

  it('clamps to MAX_FADE_MS', () => {
    expect(sanitizeFadeMs(10_000_000)).toBe(MAX_FADE_MS);
  });
});

describe('migrateLegacyActionFade', () => {
  it('treats legacy values 0..100 as tenths of a second', () => {
    expect(migrateLegacyActionFade(0)).toBe(0);
    expect(migrateLegacyActionFade(2)).toBe(200);
    expect(migrateLegacyActionFade(5)).toBe(500);
    expect(migrateLegacyActionFade(10)).toBe(1000);
    expect(migrateLegacyActionFade(20)).toBe(2000);
    expect(migrateLegacyActionFade(50)).toBe(5000);
    expect(migrateLegacyActionFade(100)).toBe(10000);
  });

  it('treats legacy values above 100 as already being milliseconds', () => {
    expect(migrateLegacyActionFade(101)).toBe(101);
    expect(migrateLegacyActionFade(1500)).toBe(1500);
  });

  it('drops invalid legacy values', () => {
    expect(migrateLegacyActionFade(-1)).toBeUndefined();
    expect(migrateLegacyActionFade('x')).toBeUndefined();
    expect(migrateLegacyActionFade(undefined)).toBeUndefined();
  });
});

describe('normalizeWledConfig', () => {
  it('migrates legacy per-action fade values and marks the config', () => {
    const legacy = {
      wledHost: '10.0.0.5',
      fadeTime: 700,
      events: {
        'throw.180': { actionType: 'effect', fadeTime: 50 },
        'throw.miss': { actionType: 'solid', fadeTime: 0 },
        'throw.double': { actionType: 'solid' },
      },
    };
    const result = normalizeWledConfig(legacy);
    expect(result.fadeTimeUnit).toBe(FADE_TIME_UNIT);
    expect(result.fadeTime).toBe(700);
    expect(result.events?.['throw.180'].fadeTime).toBe(5000);
    expect(result.events?.['throw.miss'].fadeTime).toBe(0);
    expect(result.events?.['throw.double'].fadeTime).toBeUndefined();
    expect('fadeTime' in (result.events?.['throw.double'] ?? {})).toBe(false);
  });

  it('migrates eventActions and defaultState as well', () => {
    const result = normalizeWledConfig({
      eventActions: { 'throw.bull': { actionType: 'solid', fadeTime: 10 } },
      defaultState: { actionType: 'solid', fadeTime: 20 },
    });
    expect(result.eventActions?.['throw.bull'].fadeTime).toBe(1000);
    expect(result.defaultState?.fadeTime).toBe(2000);
  });

  it('is idempotent: a config already in milliseconds is not converted again', () => {
    const once = normalizeWledConfig({ events: { a: { actionType: 'solid', fadeTime: 50 } } });
    const twice = normalizeWledConfig(once);
    expect(twice.events?.a.fadeTime).toBe(5000);
    expect(twice).toEqual(once);
  });

  it('keeps small millisecond values when the config is marked as ms', () => {
    const result = normalizeWledConfig({
      fadeTimeUnit: 'ms',
      events: { a: { actionType: 'solid', fadeTime: 50 } },
    });
    expect(result.events?.a.fadeTime).toBe(50);
  });

  it('treats a legacy global fadeTime of 0 as "WLED default" (it was only ever the manifest default)', () => {
    const result = normalizeWledConfig({ fadeTime: 0 });
    expect('fadeTime' in result).toBe(false);
  });

  it('keeps a hand-set legacy global fadeTime in milliseconds', () => {
    expect(normalizeWledConfig({ fadeTime: 300 }).fadeTime).toBe(300);
  });

  it('keeps an explicit global 0 (instant) once the config is marked as ms', () => {
    expect(normalizeWledConfig({ fadeTimeUnit: 'ms', fadeTime: 0 }).fadeTime).toBe(0);
  });

  it('removes a cleared global fadeTime (null) so WLED uses its own default', () => {
    const result = normalizeWledConfig({ fadeTimeUnit: 'ms', fadeTime: null });
    expect('fadeTime' in result).toBe(false);
  });

  it('drops an invalid global fadeTime', () => {
    const result = normalizeWledConfig({ fadeTime: -3 });
    expect(result.fadeTime).toBeUndefined();
  });

  it('does not mutate its input', () => {
    const input = { events: { a: { actionType: 'solid' as const, fadeTime: 5 } } };
    normalizeWledConfig(input);
    expect(input.events.a.fadeTime).toBe(5);
    expect('fadeTimeUnit' in input).toBe(false);
  });

  it('tolerates missing or malformed event maps', () => {
    expect(normalizeWledConfig({}).fadeTimeUnit).toBe('ms');
    const result = normalizeWledConfig({ events: { a: null as unknown as object } } as never);
    expect(result.events?.a).toBeNull();
  });
});

describe('mergeWledConfigUpdate (hub side, before saving)', () => {
  it('migrates every stored fade location of a legacy config before merging a page save', () => {
    const stored = {
      wledHost: '10.0.0.5',
      events: { 'throw.180': { actionType: 'solid', fadeTime: 50 } },
      eventActions: { 'throw.bull': { actionType: 'solid', fadeTime: 10 } },
      defaultState: { actionType: 'solid', fadeTime: 20 },
    };
    const pageSave = {
      fadeTimeUnit: 'ms' as const,
      events: { 'throw.180': { actionType: 'solid', fadeTime: 5000 } },
    };
    const result = mergeWledConfigUpdate(stored, pageSave);
    expect(result.fadeTimeUnit).toBe('ms');
    expect(result.events?.['throw.180'].fadeTime).toBe(5000);
    expect(result.eventActions?.['throw.bull'].fadeTime).toBe(1000);
    expect(result.defaultState?.fadeTime).toBe(2000);
    expect(result.wledHost).toBe('10.0.0.5');
  });

  it('keeps a global 0 set through a form on a legacy config as "instant"', () => {
    const stored = { wledHost: 'x', fadeTime: 0 };
    const result = mergeWledConfigUpdate(stored, { fadeTime: 0 });
    expect(result.fadeTime).toBe(0);
    expect(result.fadeTimeUnit).toBe('ms');
  });

  it('still drops the old default 0 when the update does not touch fadeTime', () => {
    const result = mergeWledConfigUpdate({ wledHost: 'x', fadeTime: 0 }, { wledHost: 'y' });
    expect('fadeTime' in result).toBe(false);
    expect(result.wledHost).toBe('y');
  });

  it('reads an unmarked update as milliseconds, since every current writer uses ms', () => {
    const result = mergeWledConfigUpdate({}, { events: { a: { actionType: 'solid', fadeTime: 50 } } });
    expect(result.events?.a.fadeTime).toBe(50);
  });

  it('clears the global fadeTime with null', () => {
    const result = mergeWledConfigUpdate({ fadeTimeUnit: 'ms', fadeTime: 700 }, { fadeTime: null });
    expect('fadeTime' in result).toBe(false);
  });

  it('does not mutate its inputs', () => {
    const stored = { events: { a: { actionType: 'solid', fadeTime: 5 } } };
    const update = { fadeTime: 0 };
    mergeWledConfigUpdate(stored, update);
    expect(stored.events.a.fadeTime).toBe(5);
    expect(update).toEqual({ fadeTime: 0 });
  });
});
