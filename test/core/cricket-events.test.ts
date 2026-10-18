import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EventParser } from '../../src/core/socket/EventParser.js';
import type { AutodartsMessage, MatchStateData, ParsedEvent } from '../../src/types/index.js';

const messages: AutodartsMessage[] = readFileSync(fileURLToPath(new URL('../fixtures/cricket-2players.jsonl', import.meta.url)), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l).message);
const boardId = messages[0].topic.split('.')[0];
const list = (r: ParsedEvent | ParsedEvent[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);

function replay(extra: AutodartsMessage[] = []): ParsedEvent[] {
  const parser = new EventParser(boardId);
  return [...messages, ...extra].flatMap((m) => list(parser.parse(m)));
}
const data = (e: ParsedEvent) => e.data as Record<string, any>;

describe('Cricket events from the hub', () => {
  it('adds the game context to every match event', () => {
    const matchEvents = replay().filter((e) => ['match.state', 'throw.detected', 'turn.finished', 'player.change', 'cricket.state', 'cricket.closed'].includes(e.type));
    expect(matchEvents.length).toBeGreaterThan(0);
    for (const e of matchEvents) expect(data(e).game, e.type).toEqual({ variant: 'Cricket', mode: 'cricket', cutThroat: false });
  });

  it('gives each dart its marks and the running marks of the turn', () => {
    const throws = replay().filter((e) => e.type === 'throw.detected').map((e) => [data(e).segment.name, data(e).marks, data(e).turnMarks]);
    // Round 2, Anna: S20, D20, S15
    expect(throws).toContainEqual(['D20', 2, 3]);
    expect(throws).toContainEqual(['S15', 1, 4]);
    expect(replay().filter((e) => e.type === 'throw.detected').every((e) => typeof data(e).turnId === 'string')).toBe(true);
  });

  it('reports the closed 20 once, with the player by index', () => {
    const closed = replay().filter((e) => e.type === 'cricket.closed');
    expect(closed.map((e) => data(e))).toEqual([expect.objectContaining({ field: '20', playerIndex: 0, playerName: 'Anna', leg: 1 })]);
  });

  it('publishes the Cricket state when it changes, not on every update', () => {
    const states = replay().filter((e) => e.type === 'cricket.state');
    const matchStates = replay().filter((e) => e.type === 'match.state');
    expect(states.length).toBeGreaterThan(1);
    expect(states.length).toBeLessThan(matchStates.length);
    const lastState = data(states[states.length - 1]);
    expect(lastState.players.find((p: any) => p.index === 0)).toMatchObject({ points: 20, marks: { '20': 4 } });
  });

  it('adds the turn marks to turn.finished', () => {
    const turns = replay().filter((e) => e.type === 'turn.finished').map((e) => data(e).turnMarks);
    expect(turns).toContain(4);
  });

  it('does not report a close after the field was undone and thrown again', () => {
    const lastState = messages.filter((m) => m.channel === 'autodarts.matches').at(-1)!;
    const s = lastState.data as MatchStateData;
    // Anna (array position 0) at the board, her 20 undone to 2 marks and closed again
    const seg = (v: number[]) => ({ ...lastState, data: { ...s, player: 0, state: { segments: { ...(s.state as any).segments, '20': v } } } }) as AutodartsMessage;
    const closed = replay([seg([2, 1]), seg([4, 1])]).filter((e) => e.type === 'cricket.closed');
    expect(closed).toHaveLength(1);
  });

  it('keeps X01 events without Cricket fields', () => {
    // existing X01 parser tests cover the rest; here only: no cricket.* events and mode x01
    const x01 = messages.map((m) => m.channel === 'autodarts.matches'
      ? { ...m, data: { ...(m.data as MatchStateData), variant: 'X01', state: undefined } } : m) as AutodartsMessage[];
    const parser = new EventParser(boardId);
    const events = x01.flatMap((m) => list(parser.parse(m)));
    expect(events.some((e) => e.type.startsWith('cricket.'))).toBe(false);
    const t = events.find((e) => e.type === 'throw.detected')!;
    expect(data(t).game.mode).toBe('x01');
    expect(data(t).marks).toBeUndefined();
  });
});
