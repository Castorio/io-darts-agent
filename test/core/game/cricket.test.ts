import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MatchStateData } from '../../../src/types/index.js';
import {
  CRICKET_FIELDS, closedFields, cricketStateOf, deadFields, fieldsOf, gameContextOf, isCricketMode, marksFor, throwMarks,
} from '../../../src/core/game/cricket.js';

const states: MatchStateData[] = readFileSync(fileURLToPath(new URL('../../fixtures/cricket-2players.jsonl', import.meta.url)), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l).message)
  .filter((m) => m.channel === 'autodarts.matches').map((m) => m.data);
const last = states[states.length - 1];
const withState = (patch: Partial<MatchStateData>): MatchStateData => ({ ...last, ...patch });

describe('gameContextOf', () => {
  it('reads Cricket from the recording', () => {
    expect(gameContextOf(last)).toEqual({ variant: 'Cricket', mode: 'cricket', cutThroat: false });
  });
  it('knows X01, Tactics, Cut Throat and other variants', () => {
    expect(gameContextOf(withState({ variant: 'X01', state: undefined })).mode).toBe('x01');
    expect(gameContextOf(withState({ variant: '' as string })).mode).toBe('x01');
    expect(gameContextOf(withState({ settings: { ...last.settings, gameMode: 'Tactics' } })).mode).toBe('tactics');
    const tacticsFields = Object.fromEntries(['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '25'].map((f) => [f, [0, 0]]));
    expect(gameContextOf(withState({ state: { segments: tacticsFields } })).mode).toBe('tactics');
    expect(gameContextOf(withState({ settings: { ...last.settings, cutThroat: true } })).cutThroat).toBe(true);
    expect(gameContextOf(withState({ variant: 'Bermuda' })).mode).toBe('other');
    expect(isCricketMode('tactics')).toBe(true);
    expect(isCricketMode('x01')).toBe(false);
  });
});

describe('fields and marks', () => {
  it('orders fields high to low with Bull last', () => {
    expect(fieldsOf(last.state && typeof last.state === 'object' ? last.state.segments : null)).toEqual([...CRICKET_FIELDS]);
    expect(fieldsOf({ '10': [0], '25': [0], '20': [0] })).toEqual(['20', '10', '25']);
    expect(fieldsOf(null)).toEqual([...CRICKET_FIELDS]);
  });
  it('reads marks per array position and dead fields', () => {
    const segments = { '20': [4, 1], '19': [3, 3] };
    expect(marksFor(segments, 0)).toEqual({ '20': 4, '19': 3 });
    expect(deadFields(segments)).toEqual(['19']);
    expect(deadFields(null)).toEqual([]);
  });
  it('reports fields closed since the previous state, never without one', () => {
    expect(closedFields({ '20': [2, 0] }, { '20': [4, 0] }, 0)).toEqual(['20']);
    expect(closedFields({ '20': [3, 0] }, { '20': [5, 0] }, 0)).toEqual([]);
    expect(closedFields(null, { '20': [4, 0] }, 0)).toEqual([]);
  });
  it('reads the marks of a dart, 0 when absent', () => {
    expect(throwMarks({ marks: 2 })).toBe(2);
    expect(throwMarks({ marks: null })).toBe(0);
    expect(throwMarks(undefined)).toBe(0);
  });
});

describe('cricketStateOf', () => {
  it('keys players by their stable index', () => {
    const state = cricketStateOf(last)!;
    expect(state).toMatchObject({ mode: 'cricket', cutThroat: false, fields: [...CRICKET_FIELDS], deadFields: [], set: last.set, leg: last.leg });
    const anna = state.players.find((p) => p.name === 'Anna')!;
    expect(anna).toMatchObject({ index: 0, points: 20, marks: { '20': 4, '18': 1, '15': 1 } });
  });
  it('follows the rotated players array', () => {
    const rotated = withState({
      players: [last.players[1], last.players[0]],
      gameScores: [0, 20],
      state: { segments: { '20': [1, 4] } },
    });
    const anna = cricketStateOf(rotated)!.players.find((p) => p.index === 0)!;
    expect(anna.marks['20']).toBe(4);
    expect(anna.points).toBe(20);
  });
  it('is null outside Cricket', () => {
    expect(cricketStateOf(withState({ variant: 'X01' }))).toBeNull();
  });
});
