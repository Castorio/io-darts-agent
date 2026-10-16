import { describe, it, expect } from 'vitest';
import { EventParser } from '../../src/core/socket/EventParser.js';
import type { ParsedEvent } from '../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState, mockMatchStart } from '../mocks/autodarts-events.js';

const anna = { id: 'a', index: 0, name: 'Anna', avatarUrl: '', hostId: '', userId: '', boardId: MOCK_BOARD_ID, boardName: '', cpuPPR: null } as never;
const ben = { id: 'b', index: 1, name: 'Ben', avatarUrl: '', hostId: '', userId: '', boardId: MOCK_BOARD_ID, boardName: '', cpuPPR: null } as never;

function list(r: ParsedEvent | ParsedEvent[] | null): ParsedEvent[] {
  return r === null ? [] : Array.isArray(r) ? r : [r];
}

describe('leg winner', () => {
  it('names the player who checked out, not the one up after the switch', () => {
    const parser = new EventParser(MOCK_BOARD_ID);
    parser.parse(mockMatchStart);
    parser.parse(createMockMatchState({ leg: 1, players: [anna, ben], player: 1, gameScores: [40, 120] }));

    // Ben checks out: first finished state of leg 1
    const first = list(parser.parse(createMockMatchState({
      leg: 1, players: [anna, ben], player: 1, gameScores: [40, 0], gameFinished: true, gameWinner: 1,
    })));
    // Autodarts sends another finished state with the players already rotated for the next leg
    const second = list(parser.parse(createMockMatchState({
      leg: 1, players: [ben, anna], player: 1, gameScores: [40, 0], gameFinished: true, gameWinner: 1,
    })));

    const legWins = [...first, ...second].filter((e) => e.type === 'game.finished');
    expect(legWins).toHaveLength(1);
    expect((legWins[0].data as { winnerName: string }).winnerName).toBe('Ben');
  });

  it('reports the next leg again', () => {
    const parser = new EventParser(MOCK_BOARD_ID);
    parser.parse(mockMatchStart);
    parser.parse(createMockMatchState({ leg: 1, players: [anna, ben], player: 0, gameScores: [0, 80], gameFinished: true, gameWinner: 0 }));
    parser.parse(createMockMatchState({ leg: 2, players: [ben, anna], player: 0, gameScores: [501, 501] }));
    const leg2 = list(parser.parse(createMockMatchState({
      leg: 2, players: [ben, anna], player: 0, gameScores: [0, 33], gameFinished: true, gameWinner: 1,
    })));

    const win = leg2.find((e) => e.type === 'game.finished');
    expect((win?.data as { winnerName: string }).winnerName).toBe('Ben');
  });
});

describe('match winner', () => {
  it('names the player who checked out the last leg', () => {
    const parser = new EventParser(MOCK_BOARD_ID);
    parser.parse(mockMatchStart);
    // Leg 2 with rotated players: Ben (index 1) sits at position 0 and checks out
    const events = list(parser.parse(createMockMatchState({
      leg: 2, players: [ben, anna], player: 0, gameScores: [0, 70],
      gameFinished: true, gameWinner: 0, finished: true, winner: 0,
    })));

    const matchWin = events.find((e) => e.type === 'match.finished');
    expect(matchWin?.data).toMatchObject({ winnerName: 'Ben', winnerPlayerIndex: 1 });
  });
});
