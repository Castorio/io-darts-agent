import { describe, it, expect } from 'vitest';
import { HIGGSFIELD_CATALOG, buildHiggsfieldBody, findHiggsfieldModel } from './higgsfieldCatalog.js';

describe('HIGGSFIELD_CATALOG', () => {
  it('lists 20 text-to-video and 10 text-to-image models', () => {
    expect(HIGGSFIELD_CATALOG.filter((m) => m.type === 'video')).toHaveLength(20);
    expect(HIGGSFIELD_CATALOG.filter((m) => m.type === 'image')).toHaveLength(10);
  });

  it('has unique ids that are valid model paths', () => {
    const ids = HIGGSFIELD_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9][a-z0-9.-]*(\/[a-z0-9][a-z0-9.-]*)+$/);
    }
  });

  it('contains the current defaults and no media-input workflows', () => {
    expect(findHiggsfieldModel('kling-video/v3.0/std/text-to-video')?.type).toBe('video');
    expect(findHiggsfieldModel('higgsfield-ai/soul/standard')?.type).toBe('image');
    expect(HIGGSFIELD_CATALOG.some((m) => /image-to-video|motion-control|reference/.test(m.id))).toBe(false);
  });
});

describe('buildHiggsfieldBody', () => {
  it('snaps the duration to the allowed steps of Hailuo 2.3', () => {
    const body = buildHiggsfieldBody('minimax/hailuo-2.3/standard/text-to-video', { prompt: 'x', duration: 5 });

    expect(body).toEqual({ prompt: 'x', duration: 6 });
  });

  it('picks the closest allowed duration for Kling 2.5 Turbo', () => {
    expect(buildHiggsfieldBody('kling-video/v2.5-turbo/pro/text-to-video', { prompt: 'x', duration: 7 }).duration).toBe(5);
    expect(buildHiggsfieldBody('kling-video/v2.5-turbo/pro/text-to-video', { prompt: 'x', duration: 9 }).duration).toBe(10);
  });

  it('clamps the duration into a range', () => {
    expect(buildHiggsfieldBody('kling-video/v3.0/std/text-to-video', { prompt: 'x', duration: 20 }).duration).toBe(15);
    expect(buildHiggsfieldBody('kling-video/v3.0/std/text-to-video', { prompt: 'x', duration: 1 }).duration).toBe(3);
  });

  it('sends the default duration when a model requires one', () => {
    expect(buildHiggsfieldBody('lightricks/ltx-2.5/text-to-video/fast', { prompt: 'x' }).duration).toBe(6);
  });

  it('mutes models that support sound and leaves others alone', () => {
    expect(buildHiggsfieldBody('kling-video/v3.0/std/text-to-video', { prompt: 'x' }).sound).toBe('off');
    expect(buildHiggsfieldBody('bytedance/seedance-2.0/text-to-video', { prompt: 'x' })).not.toHaveProperty('sound');
  });

  it('uses the closest supported aspect ratio', () => {
    expect(buildHiggsfieldBody('kling-video/v3.0/std/text-to-video', { prompt: 'x', aspectRatio: '1:1' }).aspect_ratio).toBe('1:1');
    // LTX only offers 16:9 and 9:16
    expect(buildHiggsfieldBody('lightricks/ltx-2.5/text-to-video/pro', { prompt: 'x', aspectRatio: '16:9' }).aspect_ratio).toBe('16:9');
    expect(buildHiggsfieldBody('higgsfield-ai/soul/standard', { prompt: 'x', width: 1600, height: 900 }).aspect_ratio).toBe('16:9');
  });

  it('omits the aspect ratio for models without one', () => {
    expect(buildHiggsfieldBody('wan/v2.6/text-to-video', { prompt: 'x', aspectRatio: '1:1' })).not.toHaveProperty('aspect_ratio');
  });

  it('requests a batch only where the model supports it', () => {
    expect(buildHiggsfieldBody('higgsfield-ai/soul/standard', { prompt: 'x', count: 3 }).batch_size).toBe(4);
    expect(buildHiggsfieldBody('higgsfield-ai/soul/standard', { prompt: 'x' }).batch_size).toBe(1);
    expect(buildHiggsfieldBody('ideogram/v4.0', { prompt: 'x', count: 3 })).not.toHaveProperty('batch_size');
  });

  it('sends only the prompt for unknown models', () => {
    expect(buildHiggsfieldBody('some-vendor/new-model', { prompt: 'x', duration: 5, aspectRatio: '1:1' })).toEqual({ prompt: 'x' });
  });
});
