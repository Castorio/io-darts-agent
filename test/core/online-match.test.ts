import { describe, it, expect } from 'vitest';
import { EventParser } from '../../src/core/socket/EventParser.js';
import type { AutodartsMessage, MatchPlayer, MatchStateData, ParsedEvent } from '../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState } from '../mocks/autodarts-events.js';

// Online match as seen on the board PC (2026-10-19): Autodarts plays a
// "Bull-off" under the same match id first, then X01 legs; after each leg
// the players array rotates.
const MATCH = 'online-match';
const fjk = { id: 'p-fjk', index: 0, name: 'fjk', boardId: 'other-board', userId: null } as unknown as MatchPlayer;
const castorio = { id: 'p-cas', index: 1, name: 'castorio', boardId: MOCK_BOARD_ID, userId: null } as unknown as MatchPlayer;

function state(patch: Partial<MatchStateData>): AutodartsMessage {
  const message = createMockMatchState({ id: MATCH, legs: 2, sets: null as never, ...patch });
  return { ...message, topic: `${MATCH}.state` };
}

const list = (r: ParsedEvent | ParsedEvent[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);
const data = (e: ParsedEvent) => e.data as Record<string, any>;

function replay(states: AutodartsMessage[]): ParsedEvent[] {
  const parser = new EventParser(MOCK_BOARD_ID);
  parser.setMatchId(MATCH);
  return states.flatMap((m) => list(parser.parse(m)));
}

const bullOffDone = state({
  variant: 'Bull-off', players: [fjk, castorio], player: 0, leg: 1, set: 1,
  gameFinished: true, gameWinner: 0, gameScores: [0, 0],
});
const leg1Start = state({ variant: 'X01', players: [fjk, castorio], player: 0, leg: 1, set: 1, gameScores: [501, 501] });
const leg1Won = state({
  variant: 'X01', players: [fjk, castorio], player: 0, leg: 1, set: 1,
  gameFinished: true, gameWinner: 0, gameScores: [0, 141], scores: [{ legs: 1, sets: 0 }, { legs: 0, sets: 0 }] as never,
});
// Leg 2: rotated, castorio (index 1) now at array position 0 and starts
const leg2Start = state({
  variant: 'X01', players: [castorio, fjk], player: 0, leg: 2, set: 1, gameScores: [501, 501],
  scores: [{ legs: 0, sets: 0 }, { legs: 1, sets: 0 }] as never,
});

describe('online match with bull-off and rotating players', () => {
  it('reports the win of leg 1 even though the bull-off also ended in leg 1', () => {
    const finished = replay([bullOffDone, leg1Start, leg1Won]).filter((e) => e.type === 'game.finished');
    expect(finished).toHaveLength(1);
    expect(data(finished[0])).toMatchObject({ winnerName: 'fjk', leg: 1 });
  });

  it('announces the starting player of the next leg after the players rotate', () => {
    const changes = replay([leg1Start, leg1Won, leg2Start]).filter((e) => e.type === 'player.change');
    expect(changes.map((e) => data(e).playerName)).toEqual(['castorio']);
    expect(data(changes[0])).toMatchObject({ playerIndex: 1, currentPlayer: 0 });
  });

  it('does not announce a player change for further updates of the same turn', () => {
    const changes = replay([leg2Start, leg2Start]).filter((e) => e.type === 'player.change');
    expect(changes).toHaveLength(0);
  });

  it('passes legs to win, sets and legs won with the match state', () => {
    const states = replay([leg2Start]).filter((e) => e.type === 'match.state');
    expect(data(states[0])).toMatchObject({
      legs: 2,
      sets: null,
      scores: [{ legs: 0, sets: 0 }, { legs: 1, sets: 0 }],
    });
  });

  it('reports each dart once: board throws during a match come from the match state', () => {
    const parser = new EventParser(MOCK_BOARD_ID);
    parser.setMatchId(MATCH);
    const board = parser.parse({
      channel: 'autodarts.boards',
      topic: `${MOCK_BOARD_ID}.events`,
      data: { boardId: MOCK_BOARD_ID, event: 'Throw detected', throw: { segment: { bed: 'Triple', multiplier: 3, name: 'T20', number: 20 } }, throwNumber: 1 },
    } as AutodartsMessage);
    expect(list(board).map((e) => e.type)).toEqual(['board.event']);
  });

  it('does not report the end of the bull-off as a won leg', () => {
    const events = replay([bullOffDone]);
    expect(events.some((e) => e.type === 'game.finished')).toBe(false);
  });

  it('counts legs won per player itself, by the stable index', () => {
    const states = replay([bullOffDone, leg1Start, leg1Won, leg2Start]).filter((e) => e.type === 'match.state');
    // after the bull-off nobody has a leg, after leg 1 fjk (index 0) has one, also after the rotation
    expect(data(states[0]).legsWon).toEqual({ 0: 0, 1: 0 });
    expect(data(states.at(-1)!).legsWon).toEqual({ 0: 1, 1: 0 });
    const finished = replay([leg1Start, leg1Won]).find((e) => e.type === 'game.finished')!;
    expect(data(finished).legsWon).toEqual({ 0: 1, 1: 0 });
  });

  it('turns legs into a set once a player reaches the legs to win', () => {
    const setMatch = (patch: Partial<MatchStateData>) => state({ legs: 2, sets: 2, variant: 'X01', ...patch });
    const won = (leg: number, players: MatchPlayer[]) =>
      setMatch({ players, player: 0, leg, gameFinished: true, gameWinner: 0, gameScores: [0, 100] });
    const events = replay([
      setMatch({ players: [fjk, castorio], player: 0, leg: 1 }), won(1, [fjk, castorio]),
      setMatch({ players: [castorio, fjk], player: 1, leg: 2 }),
      setMatch({ players: [castorio, fjk], player: 1, leg: 2, gameFinished: true, gameWinner: 0, gameScores: [100, 0] }),
      setMatch({ players: [fjk, castorio], player: 0, leg: 1, set: 2 }),
    ]);
    const last = data(events.filter((e) => e.type === 'match.state').at(-1)!);
    expect(last.setsWon).toEqual({ 0: 1, 1: 0 });
    expect(last.legsWon).toEqual({ 0: 0, 1: 0 });
  });

  it('starts from the legs Autodarts reports when the hub joins a running match', () => {
    const states = replay([leg2Start]).filter((e) => e.type === 'match.state');
    // leg2Start: castorio (index 1) at position 0 with 0 legs, fjk (index 0) at position 1 with 1 leg
    expect(data(states[0]).legsWon).toEqual({ 0: 1, 1: 0 });
  });

  it('takes a leg back when the checkout dart is corrected, and counts the real finish', () => {
    const undone = state({ variant: 'X01', players: [fjk, castorio], player: 0, leg: 1, set: 1, gameScores: [40, 141] });
    const events = replay([leg1Start, leg1Won, undone, leg1Won]);
    expect(events.filter((e) => e.type === 'game.finished')).toHaveLength(2);
    const states = events.filter((e) => e.type === 'match.state');
    expect(data(states[2]).legsWon).toEqual({ 0: 0, 1: 0 });
    expect(data(states.at(-1)!).legsWon).toEqual({ 0: 1, 1: 0 });
  });

  it('does not count a leg twice when the hub joins on the leg won screen', () => {
    // Autodarts already counts the leg in its scores while the finished state repeats
    const joinedFinished = state({
      variant: 'X01', players: [fjk, castorio], player: 0, leg: 1, set: 1,
      gameFinished: true, gameWinner: 0, gameScores: [0, 141], scores: [{ legs: 1, sets: 0 }, { legs: 0, sets: 0 }] as never,
    });
    const states = replay([joinedFinished, joinedFinished]).filter((e) => e.type === 'match.state');
    expect(data(states.at(-1)!).legsWon).toEqual({ 0: 1, 1: 0 });
  });

  it('shows the set winner with the legs of the set on the clinching leg', () => {
    const setMatch = (patch: Partial<MatchStateData>) => state({ legs: 2, sets: 2, variant: 'X01', ...patch });
    const events = replay([
      setMatch({ players: [fjk, castorio], player: 0, leg: 1 }),
      setMatch({ players: [fjk, castorio], player: 0, leg: 1, gameFinished: true, gameWinner: 0, gameScores: [0, 100] }),
      setMatch({ players: [castorio, fjk], player: 1, leg: 2 }),
      setMatch({ players: [castorio, fjk], player: 1, leg: 2, gameFinished: true, gameWinner: 0, gameScores: [100, 0] }),
    ]);
    const clinch = events.filter((e) => e.type === 'game.finished').at(-1)!;
    expect(data(clinch).legsWon).toEqual({ 0: 2, 1: 0 });
    expect(data(clinch).setsWon).toEqual({ 0: 1, 1: 0 });
  });
});
