import { describe, it, expect } from 'vitest';
import { scoreToEnglish, scoreToGerman, type PhraseEntry } from '../../../modules/darts-caller/src/numberWords.js';

describe('numberWords', () => {
  describe('scoreToEnglish()', () => {
    it('spells zero as "No score"', () => {
      expect(scoreToEnglish(0)).toBe('No score');
    });

    it('spells a number under 20 directly', () => {
      expect(scoreToEnglish(7)).toBe('seven');
    });

    it('spells a two-digit number with tens and ones', () => {
      expect(scoreToEnglish(45)).toBe('forty five');
    });

    it('spells a round hundred without a remainder', () => {
      expect(scoreToEnglish(100)).toBe('one hundred');
    });

    it('spells 180 with hundred and remainder joined by "and"', () => {
      expect(scoreToEnglish(180)).toBe('one hundred and eighty');
    });
  });

  describe('scoreToGerman()', () => {
    it('spells zero as "Null"', () => {
      expect(scoreToGerman(0)).toBe('Null');
    });

    it('spells a two-digit number, ones before tens', () => {
      expect(scoreToGerman(45)).toBe('fünfundvierzig');
    });

    it('spells 180 with hundred and remainder', () => {
      expect(scoreToGerman(180)).toBe('einhundertachtzig');
    });
  });

  it('exposes a PhraseEntry shape usable by both callers', () => {
    const entry: PhraseEntry = { filename: 'f', text: 't', category: 'c' };
    expect(entry.filename).toBe('f');
  });
});
