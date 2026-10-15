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
});
