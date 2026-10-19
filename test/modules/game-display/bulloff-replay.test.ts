import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setActivePinia, createPinia } from '../../../modules/game-display/web/node_modules/pinia/dist/pinia.mjs';
import { EventParser } from '../../../src/core/socket/EventParser.js';
import type { AutodartsMessage, ParsedEvent } from '../../../src/types/index.js';
import { useGameDisplayStore } from '../../../modules/game-display/web/src/stores/gameDisplay.js';
import { gameInfoLines } from '../../../modules/game-display/web/src/utils/gameInfo.js';

const messages: AutodartsMessage[] = readFileSync(
  fileURLToPath(new URL('../../fixtures/online-bulloff-2legs.jsonl', import.meta.url)), 'utf8',
).trim().split('\n').map((l) => JSON.parse(l).message);
const list = (r: ParsedEvent | ParsedEvent[] | null) => (r === null ? [] : Array.isArray(r) ? r : [r]);

describe('game display during the bull-off', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ active: false }) }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function replayUntil(stop: (m: AutodartsMessage) => boolean) {
    const store = useGameDisplayStore();
    const parser = new EventParser(messages[0].topic.split('.')[0]);
    for (const m of messages) {
      if (stop(m)) break;
      for (const e of list(parser.parse(m))) store.handleEvent({ type: e.type, data: e.data });
    }
    return store;
  }
  const isX01 = (m: AutodartsMessage) => m.channel === 'autodarts.matches' && (m.data as { variant?: string }).variant === 'X01';

  it('shows the bull-off with both darts and the winner', () => {
    const store = replayUntil(isX01);
    expect(store.isBullOff).toBe(true);
    const byName = Object.fromEntries(store.gameState.bullOff!.players.map((p) => [p.name, p]));
    expect(byName.Gegner.distance).toBe(82);
    expect(byName.Anna.distance).toBe(68);
    expect(store.gameState.bullOff!.finished).toBe(true);
    expect(store.bullOffWinner?.name).toBe('Anna');
  });

  it('switches back to the game when the first leg starts', () => {
    let seenX01 = 0;
    const store = replayUntil((m) => isX01(m) && ++seenX01 > 1);
    expect(store.isBullOff).toBe(false);
    expect(store.gameState.bullOff).toBeNull();
  });

  it('names the bull-off in the game info, without X01 details', () => {
    const t = (key: string) => ({ 'gameInfo.game': 'Game', 'bullOff.title': 'Bull-off' })[key] ?? key;
    const lines = gameInfoLines({ variant: 'Bull-off', baseScore: 501, inMode: 'Straight', outMode: 'Double', bullMode: '25/50', maxRounds: 0, setsToWin: 1, legsToWin: 2 }, t);
    expect(lines[0]).toEqual({ label: 'Game', value: 'Bull-off' });
    expect(lines.some((l) => /Double Out|501/.test(l.value))).toBe(false);
  });
});
