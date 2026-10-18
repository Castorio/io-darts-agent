import { describe, it, expect } from 'vitest';
import manifest from '../../../modules/wled/module.json';

describe('WLED module manifest', () => {
  it('does not offer the High Finish event, which the handler cannot detect', () => {
    expect(manifest.events).not.toContain('throw.highfinish');
    expect(Object.keys(manifest.eventMeta)).not.toContain('throw.highfinish');
    for (const group of manifest.eventGroups) {
      expect(group.events).not.toContain('throw.highfinish');
    }
  });

  it('documents the global fadeTime in milliseconds', () => {
    expect(manifest.config.fadeTime.label).toMatch(/ms/);
  });

  it('has no fadeTime default, so a fresh config leaves the WLED default transition alone', () => {
    expect('default' in manifest.config.fadeTime).toBe(false);
  });

  it('subscribes to cricket.closed but not to cricket.marks, which is a synthetic effect key', () => {
    expect(manifest.events).toContain('cricket.closed');
    expect(manifest.events).not.toContain('cricket.marks');
  });

  it('documents cricket.closed and cricket.marks in eventMeta with de/en/es labels', () => {
    for (const key of ['cricket.closed', 'cricket.marks']) {
      const meta = (manifest.eventMeta as Record<string, { label: Record<string, string>; description: Record<string, string> }>)[key];
      expect(meta).toBeDefined();
      for (const lang of ['de', 'en', 'es']) {
        expect(meta.label[lang]).toBeTruthy();
        expect(meta.description[lang]).toBeTruthy();
      }
    }
  });

  it('groups cricket.closed and cricket.marks into a Cricket event group', () => {
    const cricketGroup = manifest.eventGroups.find((g) => g.events.includes('cricket.closed'));
    expect(cricketGroup).toBeDefined();
    expect(cricketGroup?.events).toEqual(expect.arrayContaining(['cricket.closed', 'cricket.marks']));
  });

  it('exposes cricketMarksThreshold as a 3-9 number config field defaulting to 6', () => {
    const field = manifest.config.cricketMarksThreshold as { type: string; default: number; min: number; max: number };
    expect(field.type).toBe('number');
    expect(field.default).toBe(6);
    expect(field.min).toBe(3);
    expect(field.max).toBe(9);
  });
});
