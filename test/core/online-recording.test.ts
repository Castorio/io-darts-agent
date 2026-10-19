import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EventParser } from '../../src/core/socket/EventParser.js';
import type { AutodartsMessage, MatchPlayer, MatchStateData, ParsedEvent } from '../../src/types/index.js';
import { MOCK_BOARD_ID, createMockMatchState } from '../mocks/autodarts-events.js';

// Real online match (anonymized): bull-off, then X01 first to 2 legs, won 2:0 by "Gegner"
const messages: AutodartsMessage[] = readFileSync(
  fileURLToPath(new URL('../fixtures/online-bulloff-2legs.jsonl', import.meta.url)), 'utf8',
).trim().split('\n').map((l) => JSON.parse(l).message);
const boardId = messages[0].topic.split('.')[0];
const list = (r: ParsedEvent | ParsedEvent[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);
const data = (e: ParsedEvent) => e.data as Record<string, any>;
const events = (() => {
  const parser = new EventParser(boardId);
  return messages.flatMap((m) => list(parser.parse(m)));
})();
const gegner = (data(events.find((e) => e.type === 'match.state')!).players as Array<{ index: number; name: string }>)
  .find((p) => p.name === 'Gegner')!.index;

describe('recorded online match', () => {
  it('reports both legs of the winner and none for the bull-off', () => {
    const finished = events.filter((e) => e.type === 'game.finished').map((e) => [data(e).winnerName, data(e).leg, data(e).game.variant]);
    expect(finished).toEqual([['Gegner', 1, 'X01'], ['Gegner', 2, 'X01']]);
  });

  it('names the match winner', () => {
    expect(data(events.find((e) => e.type === 'match.finished')!).winnerName).toBe('Gegner');
  });

  it('counts the legs per player', () => {
    const last = data(events.filter((e) => e.type === 'match.state').at(-1)!);
    expect(last.legsWon[gegner]).toBe(2);
    expect(Object.values(last.legsWon).reduce((a: number, b) => a + (b as number), 0)).toBe(2);
    expect(last.legs).toBe(2);
  });

  it('announces the starting player of every leg', () => {
    const starters = events
      .filter((e) => e.type === 'player.change' && data(e).game.variant === 'X01')
      .map((e) => data(e).playerName);
    expect(starters.length).toBeGreaterThan(10);
  });
});

describe('gameWinner is an array position', () => {
  it('names the right Cricket leg winner after the players rotated', () => {
    const a = { id: 'a', index: 0, name: 'Anna', boardId: MOCK_BOARD_ID, userId: null } as unknown as MatchPlayer;
    const b = { id: 'b', index: 1, name: 'Ben', boardId: MOCK_BOARD_ID, userId: null } as unknown as MatchPlayer;
    const parser = new EventParser(MOCK_BOARD_ID);
    parser.setMatchId('m');
    const msg = createMockMatchState({
      id: 'm', variant: 'Cricket', leg: 2, players: [b, a], player: 1,
      gameScores: [0, 40], gameFinished: true, gameWinner: 1, finished: true, winner: 1,
    } as Partial<MatchStateData>);
    const evts = list(parser.parse({ ...msg, topic: 'm.state' }));
    expect(data(evts.find((e) => e.type === 'game.finished')!).winnerName).toBe('Anna');
    expect(data(evts.find((e) => e.type === 'match.finished')!).winnerName).toBe('Anna');
  });
});
