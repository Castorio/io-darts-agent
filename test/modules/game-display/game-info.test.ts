import { describe, it, expect } from 'vitest';
import { gameInfoLines, legsAndSetsFrom } from '../../../modules/game-display/web/src/utils/gameInfo.js';

const t = (key: string): string => ({
  'strings.firstTo': 'First to',
  'score.legs': 'Legs',
  'score.leg': 'Leg',
  'score.sets': 'Sets',
  'strings.straightOut': 'Straight Out',
  'strings.doubleOut': 'Double Out',
  'strings.straightIn': 'Straight In',
  'strings.doubleIn': 'Double In',
  'strings.masterOut': 'Master Out',
  'gameInfo.game': 'Game',
  'gameInfo.legs': 'Legs',
  'gameInfo.format': 'Format',
  'gameInfo.inMode': 'In',
  'cricket.cutThroat': 'Cut Throat',
})[key] ?? key;

const base = { variant: 'X01', baseScore: 501, inMode: 'Straight', outMode: 'Straight', bullMode: '25/50', maxRounds: 50 };

describe('legsAndSetsFrom', () => {
  it('treats missing values from Autodarts as a single leg', () => {
    expect(legsAndSetsFrom({ legs: null, sets: null })).toEqual({ legsToWin: 1, setsToWin: 1 });
  });

  it('keeps configured values', () => {
    expect(legsAndSetsFrom({ legs: 3, sets: 2 })).toEqual({ legsToWin: 3, setsToWin: 2 });
  });
});

describe('gameInfoLines', () => {
  it('shows a single leg match without a format line or Straight In', () => {
    expect(gameInfoLines({ ...base, legsToWin: 1, setsToWin: 1 }, t)).toEqual([
      { label: 'Game', value: '501 Straight Out' },
      { label: 'Legs', value: '1 Leg' },
    ]);
  });

  it('says first to, since Autodarts gives the legs needed to win', () => {
    const lines = gameInfoLines({ ...base, outMode: 'Double', legsToWin: 3, setsToWin: 1 }, t);
    expect(lines[0].value).toBe('501 Double Out');
    expect(lines[1].value).toBe('First to 3 Legs');
  });

  it('shows sets and the in mode when they apply', () => {
    const lines = gameInfoLines({ ...base, inMode: 'Double', legsToWin: 3, setsToWin: 2 }, t);
    expect(lines[1]).toEqual({ label: 'Format', value: 'First to 2 Sets, First to 3 Legs' });
    expect(lines[2]).toEqual({ label: 'In', value: 'Double In' });
  });

  it('names Cricket without X01 score and modes', () => {
    // The store fills X01 defaults for missing settings, Cricket must ignore them
    const cricket = { ...base, variant: 'Cricket', inMode: 'Double', outMode: 'Double', legsToWin: 1, setsToWin: 1 };
    expect(gameInfoLines(cricket, t)).toEqual([
      { label: 'Game', value: 'Cricket' },
      { label: 'Legs', value: '1 Leg' },
    ]);
    expect(gameInfoLines({ ...cricket, cutThroat: true }, t)[0].value).toBe('Cricket Cut Throat');
  });
});
