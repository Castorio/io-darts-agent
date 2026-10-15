import { describe, it, expect } from 'vitest';
import {
  RUNWAY_TEXT_TO_VIDEO_MODELS,
  DEFAULT_RUNWAY_MODEL,
  buildRunwayTextToVideoBody,
  findRunwayModel,
  resolveRunwayModel,
} from './runwayCatalog.js';

describe('RUNWAY_TEXT_TO_VIDEO_MODELS', () => {
  it('lists the 23 text_to_video models of API version 2024-11-06', () => {
    expect(RUNWAY_TEXT_TO_VIDEO_MODELS).toHaveLength(23);
  });

  it('has unique ids and a display name for every model', () => {
    const ids = RUNWAY_TEXT_TO_VIDEO_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of RUNWAY_TEXT_TO_VIDEO_MODELS) {
      expect(model.name, model.id).toMatch(/\S/);
      expect(model.name, model.id).not.toBe(model.id);
    }
  });

  it('contains the default and none of the retired Gen-3 models', () => {
    expect(findRunwayModel(DEFAULT_RUNWAY_MODEL)?.name).toBe('Gen-4.5');
    for (const retired of ['gen3a_turbo', 'gen3a', 'gen-3', 'gen4_turbo']) {
      expect(findRunwayModel(retired), retired).toBeUndefined();
    }
  });

  it('offers only concrete ratios (no adaptive or auto ratios)', () => {
    for (const model of RUNWAY_TEXT_TO_VIDEO_MODELS) {
      for (const ratio of model.ratios) {
        expect(ratio, model.id).toMatch(/^\d+:\d+$/);
      }
    }
  });

  it('marks ratio and duration as required where the API requires them', () => {
    expect(findRunwayModel('gen4.5')?.required).toEqual(['promptText', 'ratio', 'duration']);
    expect(findRunwayModel('veo3.1')?.required).toEqual(['promptText', 'ratio']);
    expect(findRunwayModel('klingO3_4k')?.required).toEqual(['ratio']);
    expect(findRunwayModel('h3_max')?.required).toEqual(['promptText']);
  });
});

describe('resolveRunwayModel', () => {
  it('keeps a catalog model', () => {
    expect(resolveRunwayModel('kling3.0_standard')).toEqual({ model: 'kling3.0_standard' });
  });

  it('falls back to the default for retired or unknown ids and reports the replaced id', () => {
    expect(resolveRunwayModel('gen3a_turbo')).toEqual({ model: DEFAULT_RUNWAY_MODEL, replaced: 'gen3a_turbo' });
    expect(resolveRunwayModel('gen-3')).toEqual({ model: DEFAULT_RUNWAY_MODEL, replaced: 'gen-3' });
  });

  it('uses the default without a replacement note when nothing is saved', () => {
    expect(resolveRunwayModel(undefined)).toEqual({ model: DEFAULT_RUNWAY_MODEL });
    expect(resolveRunwayModel('  ')).toEqual({ model: DEFAULT_RUNWAY_MODEL });
  });
});

describe('buildRunwayTextToVideoBody', () => {
  it('builds a Gen-4.5 landscape body', () => {
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', duration: 5, aspect: 'landscape' })).toEqual({
      model: 'gen4.5',
      promptText: 'x',
      ratio: '1280:720',
      duration: 5,
    });
  });

  it('picks the portrait ratio for portrait animations', () => {
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', aspect: 'portrait' }).ratio).toBe('720:1280');
    expect(buildRunwayTextToVideoBody('veo3.1_fast', { prompt: 'x', aspect: 'portrait' }).ratio).toBe('720:1280');
  });

  it('uses a square ratio when the model has one', () => {
    expect(buildRunwayTextToVideoBody('kling3.0_standard', { prompt: 'x', aspect: 'square' }).ratio).toBe('960:960');
    expect(buildRunwayTextToVideoBody('klingO3_4k', { prompt: 'x', aspect: 'square' }).ratio).toBe('2880:2880');
    expect(buildRunwayTextToVideoBody('grok_imagine_1_5', { prompt: 'x', aspect: 'square' }).ratio).toBe('1:1');
  });

  it('falls back to landscape for square requests on models without a square ratio', () => {
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', aspect: 'square' }).ratio).toBe('1280:720');
  });

  it('prefers 720p over smaller and larger frames of the same shape', () => {
    expect(buildRunwayTextToVideoBody('seedance2', { prompt: 'x', aspect: 'landscape' }).ratio).toBe('1280:720');
    expect(buildRunwayTextToVideoBody('wan3', { prompt: 'x', aspect: 'square' }).ratio).toBe('960:960');
    expect(buildRunwayTextToVideoBody('happyhorse_1_0', { prompt: 'x', aspect: 'portrait' }).ratio).toBe('720:1280');
  });

  it('omits the ratio for a model without one', () => {
    expect(buildRunwayTextToVideoBody('h3_max', { prompt: 'x', aspect: 'landscape' })).not.toHaveProperty('ratio');
  });

  it('clamps the duration into the allowed range', () => {
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', duration: 30 }).duration).toBe(10);
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', duration: 1 }).duration).toBe(2);
    expect(buildRunwayTextToVideoBody('h3_max', { prompt: 'x', duration: 3 }).duration).toBe(5);
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', duration: 4.6 }).duration).toBe(5);
  });

  it('snaps the duration to the allowed steps', () => {
    expect(buildRunwayTextToVideoBody('veo3.1', { prompt: 'x', duration: 5 }).duration).toBe(4);
    expect(buildRunwayTextToVideoBody('veo3.1', { prompt: 'x', duration: 7.5 }).duration).toBe(8);
    expect(buildRunwayTextToVideoBody('kling2.5_turbo_pro', { prompt: 'x', duration: 9 }).duration).toBe(10);
  });

  it('uses the model default when no duration is given', () => {
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x' }).duration).toBe(5);
    expect(buildRunwayTextToVideoBody('veo3.1', { prompt: 'x' }).duration).toBe(4);
  });

  it('mutes every model with an audio switch', () => {
    const withAudio = RUNWAY_TEXT_TO_VIDEO_MODELS.filter((m) => m.audio).map((m) => m.id);
    expect(withAudio).toEqual(expect.arrayContaining(['veo3.1', 'kling3.0_standard', 'seedance2', 'wan3', 'seedance2_5']));
    expect(withAudio).toHaveLength(14);
    for (const id of withAudio) {
      expect(buildRunwayTextToVideoBody(id, { prompt: 'x' }).audio, id).toBe(false);
    }
  });

  it('sends no audio field to models without audio', () => {
    for (const id of ['gen4.5', 'gemini_omni_flash', 'grok_imagine_1_5_lite', 'h3_max']) {
      expect(buildRunwayTextToVideoBody(id, { prompt: 'x' }), id).not.toHaveProperty('audio');
    }
  });

  it('sends the seed only to models that accept one', () => {
    expect(buildRunwayTextToVideoBody('gen4.5', { prompt: 'x', seed: 42 }).seed).toBe(42);
    expect(buildRunwayTextToVideoBody('kling3.0_pro', { prompt: 'x', seed: 42 })).not.toHaveProperty('seed');
  });

  it('cuts the prompt to the model limit', () => {
    const body = buildRunwayTextToVideoBody('gen4.5', { prompt: 'a'.repeat(1500) });
    expect((body.promptText as string).length).toBe(1000);
    const long = buildRunwayTextToVideoBody('wan3', { prompt: 'a'.repeat(1500) });
    expect((long.promptText as string).length).toBe(1500);
  });

  it('sends only prompt, model, ratio and duration for unknown models', () => {
    expect(
      buildRunwayTextToVideoBody('future_model', { prompt: 'x', duration: 7, aspect: 'portrait', seed: 1 })
    ).toEqual({ model: 'future_model', promptText: 'x', ratio: '720:1280', duration: 5 });
    expect(buildRunwayTextToVideoBody('future_model', { prompt: 'x', duration: 9 })).toMatchObject({
      ratio: '1280:720',
      duration: 10,
    });
  });
});
