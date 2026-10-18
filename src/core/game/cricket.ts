/**
 * Game mode and Cricket logic shared by the hub. Autodarts sends Cricket
 * marks in `state.segments`: each field ("10".."20", "25" for Bull) maps to
 * the marks per player ARRAY POSITION. The players array rotates after each
 * leg, so everything published here is keyed by the stable player.index.
 */
import type { MatchStateData } from '../../types/index.js';

export type GameMode = 'x01' | 'cricket' | 'tactics' | 'other';
export interface GameContext { variant: string; mode: GameMode; cutThroat: boolean }
export type CricketSegments = Record<string, number[] | undefined>;
export interface CricketPlayerState { index: number; name: string; points: number; marks: Record<string, number> }
export interface CricketStateData {
  matchId: string; set: number; leg: number;
  mode: 'cricket' | 'tactics'; cutThroat: boolean;
  fields: string[]; deadFields: string[]; players: CricketPlayerState[];
  game?: GameContext;
}
export interface CricketClosedData {
  matchId: string; set: number; leg: number; field: string; playerIndex: number; playerName: string;
  game?: GameContext;
}

export const CRICKET_FIELDS: readonly string[] = ['20', '19', '18', '17', '16', '15', '25'];
const CLOSED = 3;
const TACTICS_ONLY = ['10', '11', '12', '13', '14'];

export function isCricketMode(mode: GameMode | undefined): boolean {
  return mode === 'cricket' || mode === 'tactics';
}

export function segmentsOf(state: MatchStateData): CricketSegments | null {
  return typeof state.state === 'object' && state.state ? state.state.segments ?? null : null;
}

export function gameContextOf(state: MatchStateData): GameContext {
  const variant = state.variant || 'X01';
  const cutThroat = state.settings?.cutThroat === true;
  const lower = variant.toLowerCase();
  if (lower === 'x01') return { variant, mode: 'x01', cutThroat: false };
  if (lower !== 'cricket') return { variant, mode: 'other', cutThroat: false };
  const segments = segmentsOf(state);
  const tactics = state.settings?.gameMode?.toLowerCase() === 'tactics'
    || TACTICS_ONLY.some((field) => segments?.[field] !== undefined);
  return { variant, mode: tactics ? 'tactics' : 'cricket', cutThroat };
}

export function fieldsOf(segments: CricketSegments | null | undefined): string[] {
  const numbers = Object.keys(segments ?? {}).filter((key) => /^\d+$/.test(key)).map(Number);
  if (numbers.length === 0) return [...CRICKET_FIELDS];
  const fields = numbers.filter((n) => n !== 25).sort((a, b) => b - a).map(String);
  return numbers.includes(25) ? [...fields, '25'] : fields;
}

export function marksFor(segments: CricketSegments | null | undefined, arrayPosition: number): Record<string, number> {
  const marks: Record<string, number> = {};
  for (const field of fieldsOf(segments)) marks[field] = segments?.[field]?.[arrayPosition] ?? 0;
  return marks;
}

export function deadFields(segments: CricketSegments | null | undefined): string[] {
  if (!segments) return [];
  return fieldsOf(segments).filter((field) => {
    const perPlayer = segments[field];
    return !!perPlayer && perPlayer.length > 0 && perPlayer.every((m) => m >= CLOSED);
  });
}

export function closedFields(
  prev: CricketSegments | null | undefined,
  next: CricketSegments | null | undefined,
  arrayPosition: number,
): string[] {
  if (!prev || !next) return [];
  const before = marksFor(prev, arrayPosition);
  const after = marksFor(next, arrayPosition);
  return fieldsOf(next).filter((field) => (before[field] ?? 0) < CLOSED && after[field] >= CLOSED);
}

export function throwMarks(t: { marks?: unknown } | null | undefined): number {
  return typeof t?.marks === 'number' ? t.marks : 0;
}

export function cricketStateOf(state: MatchStateData): CricketStateData | null {
  const game = gameContextOf(state);
  if (game.mode !== 'cricket' && game.mode !== 'tactics') return null;
  const segments = segmentsOf(state);
  return {
    matchId: state.id,
    set: state.set,
    leg: state.leg,
    mode: game.mode,
    cutThroat: game.cutThroat,
    fields: fieldsOf(segments),
    deadFields: deadFields(segments),
    players: state.players.map((p, arrayPos) => ({
      index: p.index ?? arrayPos,
      name: p.name,
      points: state.gameScores?.[arrayPos] ?? 0,
      marks: marksFor(segments, arrayPos),
    })),
  };
}
