/**
 * Legs and sets won per player for the running match, counted by the hub
 * itself and keyed by the stable player.index (Autodarts rotates the
 * players array after every leg, and its own scores array is not proven to
 * follow player.index).
 *
 * Each won leg is remembered with its winner, so a corrected checkout (the
 * leg goes back to "in progress") takes the win back. Legs the hub never saw
 * in progress (it joined on the leg won screen) are already contained in the
 * Autodarts scores it starts from and are not counted again.
 */
import type { MatchStateData } from '../../types/index.js';

export interface LegTallySnapshot {
  legsWon: Record<number, number>;
  setsWon: Record<number, number>;
}

interface ScoreEntry {
  legs?: number;
  sets?: number;
}

interface LegWin {
  set: number;
  winner: number;
}

function legKeyOf(state: MatchStateData): string {
  return `${state.variant}:${state.set}:${state.leg}`;
}

export class LegTally {
  private matchId: string | null = null;
  private players: number[] = [];
  // Counts Autodarts reported when the hub started following this match
  private baseSet = 1;
  private baseLegs = new Map<number, number>();
  private baseSets = new Map<number, number>();
  private wins = new Map<string, LegWin>();
  private openLegs = new Set<string>();

  /** Call with every match state, before recordLeg */
  sync(state: MatchStateData): void {
    if (state.id !== this.matchId) {
      this.reset();
      this.matchId = state.id;
      this.baseSet = state.set || 1;
      // Best effort when joining a running match: read by array position like gameScores
      const scores = (state.scores as unknown as ScoreEntry[] | undefined) ?? [];
      state.players.forEach((player, position) => {
        const index = player.index ?? position;
        const entry = scores[position];
        this.baseLegs.set(index, typeof entry?.legs === 'number' ? entry.legs : 0);
        this.baseSets.set(index, typeof entry?.sets === 'number' ? entry.sets : 0);
      });
    }
    state.players.forEach((player, position) => {
      const index = player.index ?? position;
      if (!this.players.includes(index)) this.players.push(index);
    });

    const key = legKeyOf(state);
    if (!state.gameFinished) {
      this.openLegs.add(key);
      // Back in progress after a finish: the checkout was corrected
      this.wins.delete(key);
    }
  }

  /** A leg was won (the parser reports each leg once) */
  recordLeg(state: MatchStateData, winnerIndex: number): void {
    const key = legKeyOf(state);
    if (!this.openLegs.has(key)) return;
    this.wins.set(key, { set: state.set || 1, winner: winnerIndex });
  }

  snapshot(state: MatchStateData): LegTallySnapshot {
    const currentSet = state.set || 1;
    const legsToWin = typeof state.legs === 'number' ? state.legs : null;
    const playsSets = typeof state.sets === 'number' && state.sets > 1;

    const legsIn = (set: number): Map<number, number> => {
      const legs = new Map<number, number>();
      for (const index of this.players) legs.set(index, set === this.baseSet ? (this.baseLegs.get(index) ?? 0) : 0);
      for (const win of this.wins.values()) {
        if (playsSets && win.set !== set) continue;
        legs.set(win.winner, (legs.get(win.winner) ?? 0) + 1);
      }
      return legs;
    };

    const setsWon = new Map<number, number>();
    for (const index of this.players) setsWon.set(index, this.baseSets.get(index) ?? 0);
    if (playsSets && legsToWin !== null) {
      // A set is won by the first player who reached the legs to win in it
      const sets = new Set<number>([this.baseSet, ...[...this.wins.values()].map((w) => w.set)]);
      for (const set of sets) {
        for (const [index, legs] of legsIn(set)) {
          if (legs >= legsToWin && !(set === this.baseSet && (this.baseLegs.get(index) ?? 0) >= legsToWin)) {
            setsWon.set(index, (setsWon.get(index) ?? 0) + 1);
          }
        }
      }
    }

    return {
      legsWon: Object.fromEntries(legsIn(currentSet)),
      setsWon: Object.fromEntries(setsWon),
    };
  }

  reset(): void {
    this.matchId = null;
    this.players = [];
    this.baseSet = 1;
    this.baseLegs.clear();
    this.baseSets.clear();
    this.wins.clear();
    this.openLegs.clear();
  }
}
