import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HIGH_SCORE_THRESHOLD,
  ThrowAnimationTracker,
  throwAnimationsForDart,
} from '../../../modules/game-display/web/src/utils/throwAnimations';

const T20 = { number: 20, multiplier: 3 };
const T19 = { number: 19, multiplier: 3 };
const S1 = { number: 1, multiplier: 1 };
const BULL = { number: 25, multiplier: 1 };
const DBULL = { number: 25, multiplier: 2 };

describe('throwAnimationsForDart', () => {
  it('fires bull and bullseye on the dart itself', () => {
    expect(throwAnimationsForDart([BULL], 0, 25, 140)).toEqual(['bull']);
    expect(throwAnimationsForDart([S1, DBULL], 1, 51, 140)).toEqual(['doubleBull']);
  });

  it('fires 180 only on the third dart', () => {
    expect(throwAnimationsForDart([T20, T20], 1, 120, 100)).toEqual([]);
    expect(throwAnimationsForDart([T20, T20, T20], 2, 180, 140)).toEqual(['180']);
  });

  it('fires the high score only on the third dart, also for a threshold of 120 or less', () => {
    expect(throwAnimationsForDart([T20, T20], 1, 120, 100)).toEqual([]);
    expect(throwAnimationsForDart([T20, T20, T19], 2, 177, 100)).toEqual(['highScore']);
  });

  it('respects the threshold and the default', () => {
    expect(DEFAULT_HIGH_SCORE_THRESHOLD).toBe(140);
    expect(throwAnimationsForDart([T20, T19, S1], 2, 118, 140)).toEqual([]);
    expect(throwAnimationsForDart([T20, T19, S1], 2, 118, 100)).toEqual(['highScore']);
  });

  it('fires nothing for a busted turn (score 0)', () => {
    expect(throwAnimationsForDart([T20, T20, T20], 2, 0, 100)).toEqual([]);
  });
});

describe('ThrowAnimationTracker', () => {
  it('lets each animation of a dart through once per turn', () => {
    const tracker = new ThrowAnimationTracker();
    expect(tracker.take('turn-1', 2, ['highScore'])).toEqual(['highScore']);
    expect(tracker.take('turn-1', 2, ['highScore'])).toEqual([]);
  });

  it('starts fresh for a new turn', () => {
    const tracker = new ThrowAnimationTracker();
    tracker.take('turn-1', 0, ['bull']);
    expect(tracker.take('turn-2', 0, ['bull'])).toEqual(['bull']);
  });

  it('keeps different darts of the same turn apart', () => {
    const tracker = new ThrowAnimationTracker();
    expect(tracker.take('turn-1', 0, ['bull'])).toEqual(['bull']);
    expect(tracker.take('turn-1', 1, ['bull'])).toEqual(['bull']);
  });

  it('forgets everything on reset', () => {
    const tracker = new ThrowAnimationTracker();
    tracker.take('turn-1', 0, ['bull']);
    tracker.reset();
    expect(tracker.take('turn-1', 0, ['bull'])).toEqual(['bull']);
  });
});
