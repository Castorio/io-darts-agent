import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerDeveloperRoutes } from '../../../src/api/routes/developer.js';
import type { ParsedEvent } from '../../../src/types/index.js';

const server = {
  isAuthEnabled: () => false,
  getConfig: () => ({ developerMode: true }),
};

describe('developer simulator match state', () => {
  it('sends the remaining score in gameScores and the darts of the turn, like Autodarts', async () => {
    const events: ParsedEvent[] = [];
    const app = Fastify();
    registerDeveloperRoutes(app, server as never, { emitEvent: (e) => events.push(e) });
    await app.ready();

    await app.inject({ method: 'POST', url: '/api/developer/simulate/match/start', payload: {} });
    await app.inject({ method: 'POST', url: '/api/developer/simulate/throw', payload: { number: 20, multiplier: 3 } });
    await app.close();

    const state = events.filter((e) => e.type === 'match.state').at(-1)!.data as Record<string, any>;
    expect(state.gameScores[0]).toBe(441);
    expect(state.scores[0]).toEqual({ legs: 0, sets: 0 });
    expect(state.turns.at(-1).throws.map((t: any) => t.segment.name)).toEqual(['T20']);
  });
});
