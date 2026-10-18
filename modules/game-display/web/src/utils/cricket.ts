/**
 * Cricket view logic. Autodarts sends the marks in `state.segments`: each
 * field ("15".."20", "25" for Bull) maps to the marks per player array
 * position. Three marks close a field, marks beyond that score points.
 */

/** Standard Cricket fields; Tactics adds 10 to 14 (see fieldsOf) */
export const CRICKET_FIELDS = ['20', '19', '18', '17', '16', '15', '25'] as const
/** "10".."20", "25" for Bull */
export type CricketField = string
export type CricketMarks = Record<CricketField, number>
export type CricketSegments = Record<string, number[] | undefined>

/** Default of the "From Marks" setting of the strong turn animation */
export const DEFAULT_CRICKET_MARKS_THRESHOLD = 6

const CLOSED = 3

export function isCricket(variant: string | null | undefined): boolean {
  return variant?.toLowerCase() === 'cricket'
}

/**
 * Fields of the game as the state lists them, high to low with Bull last,
 * so Tactics (10 to 20) works too. Without a state the Cricket fields.
 */
export function fieldsOf(segments: CricketSegments | null | undefined): CricketField[] {
  const numbers = Object.keys(segments ?? {})
    .filter((key) => /^\d+$/.test(key))
    .map(Number)
  if (numbers.length === 0) return [...CRICKET_FIELDS]
  const fields = numbers.filter((n) => n !== 25).sort((a, b) => b - a).map(String)
  return numbers.includes(25) ? [...fields, '25'] : fields
}

/** Marks of the player at `arrayPosition` for every field */
export function marksFor(segments: CricketSegments | null | undefined, arrayPosition: number): CricketMarks {
  const marks: CricketMarks = {}
  for (const field of fieldsOf(segments)) {
    marks[field] = segments?.[field]?.[arrayPosition] ?? 0
  }
  return marks
}

/** Display sign for a field: nothing, one slash, a cross, or closed */
export function markSymbol(marks: number): string {
  if (marks >= CLOSED) return '⊗'
  if (marks === 2) return 'X'
  if (marks === 1) return '/'
  return ''
}

/** Fields every player has closed: nobody can score there any more */
export function deadFields(segments: CricketSegments | null | undefined): CricketField[] {
  if (!segments) return []
  return fieldsOf(segments).filter((field) => {
    const perPlayer = segments?.[field]
    return !!perPlayer && perPlayer.length > 0 && perPlayer.every((m) => m >= CLOSED)
  })
}

interface TurnLike {
  throws?: Array<{ marks?: number | null } | null> | null
}

/** Marks scored by the darts of a turn (a miss counts 0) */
export function turnMarks(turn: TurnLike | null | undefined): number {
  return (turn?.throws ?? []).reduce((sum, t) => sum + (t?.marks ?? 0), 0)
}

export type CricketAnimation = { type: 'cricketClose'; field: CricketField } | { type: 'cricketMarks' }

/**
 * Animations one match state update causes for the active player: fields
 * closed since `prev`, and a strong turn from `threshold` marks on. Without
 * a previous state (first state after a reconnect) nothing is reported.
 * The caller makes sure each animation fires once (see OnceTracker).
 */
export function cricketAnimations(
  prev: CricketSegments | null | undefined,
  next: CricketSegments | null | undefined,
  arrayPosition: number,
  turn: TurnLike | null | undefined,
  threshold: number,
): CricketAnimation[] {
  if (!prev || !next) return []
  const before = marksFor(prev, arrayPosition)
  const after = marksFor(next, arrayPosition)
  const result: CricketAnimation[] = fieldsOf(next)
    .filter((field) => (before[field] ?? 0) < CLOSED && after[field] >= CLOSED)
    .map((field) => ({ type: 'cricketClose', field }))
  if (turnMarks(turn) >= threshold) result.push({ type: 'cricketMarks' })
  return result
}

/** Lets each key through once, e.g. one close animation per leg, player and field */
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
