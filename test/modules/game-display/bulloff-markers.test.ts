import { describe, it, expect } from 'vitest';
import { dartMarkers } from '../../../modules/game-display/web/src/utils/bullOff.js';

const player = (index: number, x: number | null, y: number | null, distance: number | null = 50) => ({ index, name: `P${index}`, distance, x, y });

describe('bull-off dart markers', () => {
  it('maps coordinates to board millimetres with y pointing up', () => {
    const [m] = dartMarkers([player(0, 0.4, 0.5)]);
    expect(m.x).toBeCloseTo(68);
    expect(m.y).toBeCloseTo(-85);
  });

  it('keeps a far miss visible at the board edge', () => {
    const [m] = dartMarkers([player(0, 2, 0)]);
    expect(Math.hypot(m.x, m.y)).toBeLessThanOrEqual(196);
    expect(m.offBoard).toBe(true);
  });

  it('moves labels of darts close together apart', () => {
    const [a, b] = dartMarkers([player(0, 0.05, 0.05), player(1, 0.055, 0.05)]);
    expect(Math.abs(a.labelY - b.labelY)).toBeGreaterThanOrEqual(16);
  });

  it('skips players without coordinates', () => {
    expect(dartMarkers([player(0, null, null)])).toEqual([]);
  });
});
