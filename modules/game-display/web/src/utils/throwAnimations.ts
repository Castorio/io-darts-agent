/**
 * Which animations a single dart triggers, and a per-turn guard so each one
 * fires once even when the same dart is seen again (several match.state
 * updates, a reset dart counter, a repeated event).
 */

export type ThrowAnimationType = '180' | 'bull' | 'doubleBull' | 'highScore'

export interface DartSegmentLike {
  number: number
  multiplier: number
}

/** Default of the "From Score" setting of the high score animation */
export const DEFAULT_HIGH_SCORE_THRESHOLD = 140

/**
 * Animations for the dart at `dartIndex`. 180 and high score belong to the
 * whole turn and are only checked on the third dart; `turnScore` is the
 * authoritative turn score from the match state (0 after a bust).
 */
export function throwAnimationsForDart(
  darts: DartSegmentLike[],
  dartIndex: number,
  turnScore: number,
  highScoreThreshold: number,
): ThrowAnimationType[] {
  const dart = darts[dartIndex]
  if (!dart) return []
  const result: ThrowAnimationType[] = []

  if (dart.number === 25 && dart.multiplier === 1) result.push('bull')
  else if (dart.number === 25 && dart.multiplier === 2) result.push('doubleBull')

  if (dartIndex === 2) {
    if (turnScore === 180) result.push('180')
    else if (turnScore >= highScoreThreshold && turnScore < 180) result.push('highScore')
  }
  return result
}

/** Remembers what already fired in the current turn */
export class ThrowAnimationTracker {
  private turnKey: string | null = null
  private fired = new Set<string>()

  /** Returns the animations that have not fired yet for this turn and dart, and marks them */
  take(turnKey: string, dartIndex: number, types: ThrowAnimationType[]): ThrowAnimationType[] {
    if (turnKey !== this.turnKey) {
      this.turnKey = turnKey
      this.fired.clear()
    }
    const fresh: ThrowAnimationType[] = []
    for (const type of types) {
      const key = `${dartIndex}:${type}`
      if (!this.fired.has(key)) {
        this.fired.add(key)
        fresh.push(type)
      }
    }
    return fresh
  }

  reset(): void {
    this.turnKey = null
    this.fired.clear()
  }
}
