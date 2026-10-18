/**
 * Cricket display helpers. The hub computes the Cricket state (marks per
 * field and player, dead fields, closed fields) and pushes it via the
 * `cricket.state` and `cricket.closed` events; this module only keeps the
 * bits the display needs to render that state.
 */

/** Standard Cricket fields; Tactics adds 10 to 14 (the hub sends the actual field list) */
export const CRICKET_FIELDS = ['20', '19', '18', '17', '16', '15', '25'] as const
/** "10".."20", "25" for Bull */
export type CricketField = string

/** Default of the "From Marks" setting of the strong turn animation */
export const DEFAULT_CRICKET_MARKS_THRESHOLD = 6

const CLOSED = 3

export function isCricket(variant: string | null | undefined): boolean {
  return variant?.toLowerCase() === 'cricket'
}

/** Display sign for a field: nothing, one slash, a cross, or closed */
export function markSymbol(marks: number): string {
  if (marks >= CLOSED) return '⊗'
  if (marks === 2) return 'X'
  if (marks === 1) return '/'
  return ''
}

/** Lets each key through once, e.g. one strong-turn animation per turn */
export class OnceTracker {
  private seen = new Set<string>()

  take(key: string): boolean {
    if (this.seen.has(key)) return false
    this.seen.add(key)
    return true
  }

  reset(): void {
    this.seen.clear()
  }
}

/** One player's Cricket state, keyed by the stable player.index */
export interface CricketPlayerState {
  index: number
  name: string
  points: number
  marks: Record<string, number>
}

/**
 * Cricket state as pushed by the hub's `cricket.state` event (and returned
 * by `/api/match/current` on reload). Structurally identical to
 * `CricketStateData` on the hub (`src/core/game/cricket.ts`); defined again
 * here because the display web app must not import from `src/`.
 */
export interface CricketState {
  matchId: string
  set: number
  leg: number
  mode: 'cricket' | 'tactics'
  cutThroat: boolean
  fields: string[]
  deadFields: string[]
  players: CricketPlayerState[]
}
