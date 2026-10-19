/**
 * Bull-off before an (online) match: every player throws one dart at the
 * bull, the closest starts. Autodarts plays it as variant "Bull-off" with
 * gameScores = distance to the bull centre in mm and only the current turn
 * in `turns`, so the darts are remembered here per player.index.
 * Coordinates are normalized: radius 1 = 170 mm (outer edge of the double).
 */
import type { MatchStateData } from '../../types/index.js';

export interface BullOffPlayer {
  index: number;
  name: string;
  /** Distance to the bull centre in mm, null until the player has thrown */
  distance: number | null;
  x: number | null;
  y: number | null;
}

export interface BullOffState {
  players: BullOffPlayer[];
  finished: boolean;
  /** player.index of the winner (starts the first leg) */
  winnerIndex: number | null;
}

export function isBullOff(variant: string | null | undefined): boolean {
  return variant?.toLowerCase() === 'bull-off';
}

interface Dart {
  x: number | null;
  y: number | null;
}

export class BullOffTracker {
  private matchId: string | null = null;
  private inBullOff = false;
  private darts = new Map<number, Dart>();

  /** Returns the bull-off state for this match state, null outside a bull-off */
  update(state: MatchStateData): BullOffState | null {
    if (!isBullOff(state.variant)) {
      this.inBullOff = false;
      return null;
    }
    // A new match or a new bull-off in the same match starts without darts
    if (state.id !== this.matchId || !this.inBullOff) {
      this.matchId = state.id;
      this.darts.clear();
    }
    this.inBullOff = true;

    for (const turn of state.turns ?? []) {
      const player = state.players.find((p) => p.id === turn.playerId);
      const dart = turn.throws?.[0];
      if (!player || !dart) continue;
      const coords = dart.coords;
      this.darts.set(player.index, {
        x: typeof coords?.x === 'number' ? coords.x : null,
        y: typeof coords?.y === 'number' ? coords.y : null,
      });
    }

    const winner = state.gameFinished && state.gameWinner !== null && state.gameWinner >= 0
      ? state.players[state.gameWinner]
      : undefined;

    return {
      players: state.players.map((player, position) => {
        const dart = this.darts.get(player.index);
        return {
          index: player.index,
          name: player.name,
          distance: dart ? (state.gameScores?.[position] ?? null) : null,
          x: dart?.x ?? null,
          y: dart?.y ?? null,
        };
      }),
      finished: state.gameFinished === true,
      winnerIndex: winner?.index ?? null,
    };
  }

  reset(): void {
    this.matchId = null;
    this.inBullOff = false;
    this.darts.clear();
  }
}
