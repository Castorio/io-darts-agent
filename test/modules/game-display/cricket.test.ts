import { describe, it, expect } from 'vitest';
import {
  CRICKET_FIELDS,
  isCricket,
  markSymbol,
} from '../../../modules/game-display/web/src/utils/cricket.js';

describe('cricket display helpers', () => {
  it('recognizes the Cricket variant, case-insensitive', () => {
    expect(isCricket('Cricket')).toBe(true);
    expect(isCricket('cricket')).toBe(true);
    expect(isCricket('X01')).toBe(false);
    expect(isCricket(undefined)).toBe(false);
  });

  it('lists the fields from 20 down to 15, then Bull', () => {
    expect(CRICKET_FIELDS).toEqual(['20', '19', '18', '17', '16', '15', '25']);
  });

  it('shows / for one mark, X for two and a closed sign from three on', () => {
    expect([0, 1, 2, 3, 5].map(markSymbol)).toEqual(['', '/', 'X', '⊗', '⊗']);
  });
});
