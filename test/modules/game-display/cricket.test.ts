import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CRICKET_FIELDS,
  fieldsOf,
  OnceTracker,
  cricketAnimations,
  deadFields,
  isCricket,
  markSymbol,
  marksFor,
  turnMarks,
} from '../../../modules/game-display/web/src/utils/cricket.js';

type Segments = Record<string, number[]>;

// Real two player Cricket recording (names and ids anonymized)
const states = readFileSync(fileURLToPath(new URL('../../fixtures/cricket-2players.jsonl', import.meta.url)), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line).message)
  .filter((m) => m.channel === 'autodarts.matches')
  .map((m) => m.data);

const last = states[states.length - 1];

describe('cricket helpers', () => {
  it('recognizes the Cricket variant, case-insensitive', () => {
    expect(isCricket('Cricket')).toBe(true);
    expect(isCricket('cricket')).toBe(true);
    expect(isCricket('X01')).toBe(false);
    expect(isCricket(undefined)).toBe(false);
  });

  it('lists the fields from 20 down to 15, then Bull', () => {
    expect(CRICKET_FIELDS).toEqual(['20', '19', '18', '17', '16', '15', '25']);
  });

  it('takes the fields from the state, so Tactics shows 10 to 20 as well', () => {
    expect(fieldsOf(last.state.segments)).toEqual(['20', '19', '18', '17', '16', '15', '25']);
    const tactics = Object.fromEntries(['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '25'].map((f) => [f, [0, 0]]));
    expect(fieldsOf(tactics)).toEqual(['20', '19', '18', '17', '16', '15', '14', '13', '12', '11', '10', '25']);
    expect(fieldsOf(null)).toEqual([...CRICKET_FIELDS]);
  });

  it('closes and kills Tactics fields like the others', () => {
    const prev = { '12': [2, 3] };
    const next = { '12': [3, 3] };
    expect(cricketAnimations(prev, next, 0, undefined, 6)).toEqual([{ type: 'cricketClose', field: '12' }]);
    expect(deadFields(next)).toEqual(['12']);
    expect(marksFor(next, 0)['12']).toBe(3);
  });

  it('reads the marks of one player from the recorded state', () => {
    expect(marksFor(last.state.segments, 0)).toEqual({ '20': 4, '19': 0, '18': 1, '17': 0, '16': 0, '15': 1, '25': 0 });
    expect(marksFor(last.state.segments, 1)).toEqual({ '20': 1, '19': 0, '18': 0, '17': 0, '16': 0, '15': 0, '25': 0 });
  });

  it('treats missing segments as no marks', () => {
    expect(marksFor(null, 0)['20']).toBe(0);
    expect(marksFor({ '20': [2] }, 1)['20']).toBe(0);
  });

  it('shows / for one mark, X for two and a closed sign from three on', () => {
    expect([0, 1, 2, 3, 5].map(markSymbol)).toEqual(['', '/', 'X', '⊗', '⊗']);
  });

  it('calls a field dead once every player has closed it', () => {
    expect(deadFields(last.state.segments)).toEqual([]);
    expect(deadFields({ ...last.state.segments, '19': [3, 4], '18': [3, 2] })).toEqual(['19']);
  });

  it('counts the marks of a turn from its darts', () => {
    expect(turnMarks(last.turns[last.turns.length - 1])).toBe(0);
    const thirdDartOfRound2 = states.find((s) => s.round === 2 && s.player === 0 && s.turns.at(-1).throws.length === 3);
    expect(turnMarks(thirdDartOfRound2.turns.at(-1))).toBe(4);
    expect(turnMarks(undefined)).toBe(0);
  });
});

describe('cricket animations', () => {
  const at = (round: number, player: number, darts: number) =>
    states.find((s) => s.round === round && s.player === player && (s.turns.at(-1)?.throws.length ?? 0) === darts);

  it('reports the field the double 20 closed in the recording', () => {
    const before = at(2, 0, 1);
    const after = at(2, 0, 2);
    expect(cricketAnimations(before.state.segments, after.state.segments, 0, after.turns.at(-1), 6))
      .toEqual([{ type: 'cricketClose', field: '20' }]);
  });

  it('reports nothing without a previous state, so a reconnect stays quiet', () => {
    const after = at(2, 0, 2);
    expect(cricketAnimations(null, after.state.segments, 0, after.turns.at(-1), 6)).toEqual([]);
  });

  it('does not report a field the player had already closed', () => {
    const prev: Segments = { '20': [3, 0] };
    const next: Segments = { '20': [5, 0] };
    expect(cricketAnimations(prev, next, 0, undefined, 6)).toEqual([]);
  });

  it('reports a strong turn from the threshold on', () => {
    const turn = { throws: [{ marks: 3 }, { marks: 3 }] };
    const segments: Segments = { '20': [6, 0] };
    expect(cricketAnimations(segments, segments, 0, turn, 6)).toEqual([{ type: 'cricketMarks' }]);
    expect(cricketAnimations(segments, segments, 0, turn, 7)).toEqual([]);
  });
});

describe('OnceTracker', () => {
  it('lets each key through once until reset', () => {
    const tracker = new OnceTracker();
    expect(tracker.take('a')).toBe(true);
    expect(tracker.take('a')).toBe(false);
    expect(tracker.take('b')).toBe(true);
    tracker.reset();
    expect(tracker.take('a')).toBe(true);
  });
});
