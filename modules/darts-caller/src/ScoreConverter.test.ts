/**
 * ScoreConverter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreConverter } from './ScoreConverter.js';

describe('ScoreConverter', () => {
  let converter: ScoreConverter;

  beforeEach(() => {
    converter = new ScoreConverter();
  });

  describe('scoreToText', () => {
    it('should convert 0 to "no score"', () => {
      expect(converter.scoreToText(0)).toBe('no score');
    });

    it('should convert single digits correctly', () => {
      expect(converter.scoreToText(1)).toBe('one');
      expect(converter.scoreToText(5)).toBe('five');
      expect(converter.scoreToText(9)).toBe('nine');
    });

    it('should convert teens correctly', () => {
      expect(converter.scoreToText(11)).toBe('eleven');
      expect(converter.scoreToText(15)).toBe('fifteen');
      expect(converter.scoreToText(19)).toBe('nineteen');
    });

    it('should convert tens correctly', () => {
      expect(converter.scoreToText(20)).toBe('twenty');
      expect(converter.scoreToText(50)).toBe('fifty');
      expect(converter.scoreToText(90)).toBe('ninety');
    });

    it('should convert compound numbers correctly', () => {
      expect(converter.scoreToText(21)).toBe('twenty one');
      expect(converter.scoreToText(45)).toBe('forty five');
      expect(converter.scoreToText(99)).toBe('ninety nine');
    });

    it('should convert 100 correctly', () => {
      expect(converter.scoreToText(100)).toBe('one hundred');
    });

    it('should convert 180 with special pronunciation', () => {
      expect(converter.scoreToText(180)).toBe('one hundred and eighty');
    });

    it('should convert scores over 100 correctly', () => {
      expect(converter.scoreToText(140)).toBe('one hundred and forty');
      expect(converter.scoreToText(125)).toBe('one hundred and twenty five');
      expect(converter.scoreToText(101)).toBe('one hundred and one');
    });
  });

  describe('isCheckoutPossible', () => {
    it('should return false for scores below 2', () => {
      expect(converter.isCheckoutPossible(0)).toBe(false);
      expect(converter.isCheckoutPossible(1)).toBe(false);
    });

    it('should return false for scores above 170', () => {
      expect(converter.isCheckoutPossible(171)).toBe(false);
      expect(converter.isCheckoutPossible(180)).toBe(false);
    });

    it('should return false for impossible checkouts', () => {
      expect(converter.isCheckoutPossible(169)).toBe(false);
      expect(converter.isCheckoutPossible(168)).toBe(false);
      expect(converter.isCheckoutPossible(166)).toBe(false);
      expect(converter.isCheckoutPossible(165)).toBe(false);
      expect(converter.isCheckoutPossible(163)).toBe(false);
      expect(converter.isCheckoutPossible(162)).toBe(false);
      expect(converter.isCheckoutPossible(159)).toBe(false);
    });

    it('should return true for valid checkouts', () => {
      expect(converter.isCheckoutPossible(2)).toBe(true);
      expect(converter.isCheckoutPossible(40)).toBe(true);
      expect(converter.isCheckoutPossible(100)).toBe(true);
      expect(converter.isCheckoutPossible(170)).toBe(true);
      expect(converter.isCheckoutPossible(167)).toBe(true);
    });
  });

  describe('getCheckoutPath', () => {
    it('should return checkout path for valid finishes', () => {
      expect(converter.getCheckoutPath(170)).toBe('T20, T20, Bull');
      expect(converter.getCheckoutPath(100)).toBe('T20, D20');
      expect(converter.getCheckoutPath(40)).toBe('D20');
      expect(converter.getCheckoutPath(2)).toBe('D1');
    });

    it('should return null for impossible finishes', () => {
      expect(converter.getCheckoutPath(169)).toBe(null);
      expect(converter.getCheckoutPath(171)).toBe(null);
    });
  });

  describe('getRequireText', () => {
    it('should return basic require text', () => {
      expect(converter.getRequireText(100)).toBe('you require one hundred');
      expect(converter.getRequireText(40)).toBe('you require forty');
    });

    it('should include path when requested', () => {
      expect(converter.getRequireText(100, true)).toBe('you require one hundred, T20, D20');
      expect(converter.getRequireText(40, true)).toBe('you require forty, D20');
    });
  });

  describe('special calls', () => {
    it('should return correct game start text', () => {
      expect(converter.getGameStartText()).toBe('game on');
    });

    it('should return correct game shot text', () => {
      expect(converter.getGameShotText()).toBe('game shot');
      expect(converter.getGameShotText('John')).toBe('game shot, John');
    });

    it('should return correct match shot text', () => {
      expect(converter.getMatchShotText()).toBe('game shot and the match');
      expect(converter.getMatchShotText('John')).toBe('game shot and the match, John');
    });

    it('should return correct 180 text', () => {
      expect(converter.get180Text()).toBe('one hundred and eighty!');
    });

    it('should return correct bust text', () => {
      expect(converter.getBustText()).toBe('bust');
    });
  });

  describe('scoreToAudioFile', () => {
    it('should return correct audio file names', () => {
      expect(converter.scoreToAudioFile(180)).toBe('180');
      expect(converter.scoreToAudioFile(0)).toBe('no_score');
      expect(converter.scoreToAudioFile(100)).toBe('score_100');
      expect(converter.scoreToAudioFile(45)).toBe('score_45');
    });
  });
});
