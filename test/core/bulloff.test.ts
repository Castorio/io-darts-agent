import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EventParser } from '../../src/core/socket/EventParser.js';
import { BullOffTracker, isBullOff } from '../../src/core/game/bullOff.js';
import type { AutodartsMessage, MatchStateData, ParsedEvent } from '../../src/types/index.js';

// Real online match (anonymized): "Gegner" throws 82 mm, "Anna" 68 mm and starts
const messages: AutodartsMessage[] = readFileSync(
  fileURLToPath(new URL('../fixtures/online-bulloff-2legs.jsonl', import.meta.url)), 'utf8',
).trim().split('\n').map((l) => JSON.parse(l).message);
const states = messages.filter((m) => m.channel === 'autodarts.matches').map((m) => m.data as MatchStateData);
const bullOffStates = states.filter((s) => s.variant === 'Bull-off');
const indexOf = (name: string) => states[0].players.find((p) => p.name === name)!.index;

describe('bull-off tracking', () => {
  it('recognizes the variant', () => {
    expect(isBullOff('Bull-off')).toBe(true);
    expect(isBullOff('X01')).toBe(false);
    expect(isBullOff(undefined)).toBe(false);
  });

  it('keeps every dart although Autodarts only sends the current turn', () => {
    const tracker = new BullOffTracker();
    let last = null;
    for (const s of bullOffStates) last = tracker.update(s);
    const byName = Object.fromEntries(last!.players.map((p) => [p.name, p]));
    expect(byName.Gegner.distance).toBe(82);
    expect(byName.Anna.distance).toBe(68);
    expect(Math.hypot(byName.Anna.x!, byName.Anna.y!) * 170).toBeCloseTo(68, 0);
    expect(last).toMatchObject({ finished: true, winnerIndex: indexOf('Anna') });
  });

  it('has no distance for a player who has not thrown yet', () => {
    const tracker = new BullOffTracker();
    const first = tracker.update(bullOffStates[0])!;
    expect(first.players.find((p) => p.name === 'Anna')).toMatchObject({ distance: null, x: null, y: null });
    expect(first).toMatchObject({ finished: false, winnerIndex: null });
  });

  it('is null outside the bull-off', () => {
    const tracker = new BullOffTracker();
    expect(tracker.update(states.find((s) => s.variant === 'X01')!)).toBeNull();
  });

  it('publishes the bull-off with the match state', () => {
    const parser = new EventParser(messages[0].topic.split('.')[0]);
    const list = (r: ParsedEvent | ParsedEvent[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);
    const matchStates = messages.flatMap((m) => list(parser.parse(m))).filter((e) => e.type === 'match.state');
    const bull = matchStates.map((e) => (e.data as Record<string, any>).bullOff);
    expect(bull[0]).not.toBeNull();
    expect(bull.filter(Boolean).at(-1).winnerIndex).toBe(indexOf('Anna'));
    expect(bull.at(-1)).toBeNull();
  });

  it('handles three players and a dart without coordinates', () => {
    const tracker = new BullOffTracker();
    const players = [
      { id: 'a', index: 0, name: 'A' }, { id: 'b', index: 1, name: 'B' }, { id: 'c', index: 2, name: 'C' },
    ] as MatchStateData['players'];
    const base = { id: 'm3', variant: 'Bull-off', players, gameFinished: false, gameWinner: -1 } as unknown as MatchStateData;
    const turn = (playerId: string, coords?: { x: number; y: number }) => [{ playerId, throws: [{ coords, segment: { name: 'S1' } }] }];
    tracker.update({ ...base, player: 0, gameScores: [30, 0, 0], turns: turn('a', { x: 0.1, y: 0.1 }) } as never);
    tracker.update({ ...base, player: 1, gameScores: [30, 210, 0], turns: turn('b') } as never);
    const done = tracker.update({ ...base, player: 2, gameScores: [30, 210, 12], turns: turn('c', { x: 0, y: -0.07 }), gameFinished: true, gameWinner: 2 } as never)!;
    expect(done.players.map((p) => [p.name, p.distance, p.x === null])).toEqual([['A', 30, false], ['B', 210, true], ['C', 12, false]]);
    expect(done.winnerIndex).toBe(2);
  });

  it('starts empty when a bull-off begins again in the same match', () => {
    const tracker = new BullOffTracker();
    for (const s of bullOffStates) tracker.update(s);
    tracker.update(states.find((s) => s.variant === 'X01')!);
    const again = tracker.update({ ...bullOffStates[0], turns: [] })!;
    expect(again.players.every((p) => p.distance === null)).toBe(true);
  });
});
