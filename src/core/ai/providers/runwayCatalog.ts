/**
 * Runway text_to_video models
 *
 * Generated from the Runway API reference (https://docs.dev.runwayml.com/api.md,
 * X-Runway-Version 2024-11-06, retrieved 2026-10-16) and the display names in
 * https://docs.dev.runwayml.com/guides/models.md. `POST /v1/text_to_video` is a
 * discriminated union on `model`: every model accepts only its own fields and
 * values, so the request body is built from this catalog.
 *
 * Left out on purpose: references, multishot, output formats, resolution and
 * draft switches. The hub only sends a prompt.
 */

export interface RunwayModel {
  id: string;
  name: string;
  /** Concrete `ratio` values (adaptive and auto ratios are left out); empty when the model has no ratio field */
  ratios: string[];
  /** Either a range or fixed steps, as documented per model */
  duration: { min?: number; max?: number; values?: number[]; default: number };
  /** Body fields the API requires besides `model` */
  required: string[];
  /** Model has an `audio` switch (on by default) */
  audio?: boolean;
  /** Model accepts a `seed` */
  seed?: boolean;
  /** Maximum `promptText` length in UTF-16 code units */
  promptMax: number;
}

/**
 * Runway's own current model: simple schema (no audio track), 12 credits per
 * second, accepts any whole duration from 2 to 10 seconds
 */
export const DEFAULT_RUNWAY_MODEL = 'gen4.5';

const R720 = ['1280:720', '720:1280'];
const VEO = ['1280:720', '720:1280', '1080:1920', '1920:1080'];
const KLING_4K = ['3840:2160', '2160:3840', '2880:2880'];
const KLING_PRO = ['1920:1080', '1080:1920', '1440:1440'];
const KLING_STD = ['1280:720', '720:1280', '960:960'];
const SEEDANCE_720 = [
  '992:432', '864:496', '752:560', '640:640', '560:752', '496:864',
  '1470:630', '1280:720', '1112:834', '960:960', '834:1112', '720:1280',
];
const WAN = [
  '832:480', '720:544', '624:624', '544:720', '480:832', '1280:720', '1104:832', '960:960',
  '832:1104', '720:1280', '1920:1080', '1648:1248', '1440:1440', '1248:1648', '1080:1920',
];
const PROMPT_ONLY = ['promptText'];

export const RUNWAY_TEXT_TO_VIDEO_MODELS: RunwayModel[] = [
  { id: 'gen4.5', name: 'Gen-4.5', ratios: R720, duration: { min: 2, max: 10, default: 5 }, required: ['promptText', 'ratio', 'duration'], seed: true, promptMax: 1000 },
  { id: 'veo3.1', name: 'Veo 3.1', ratios: VEO, duration: { values: [4, 6, 8], default: 4 }, required: ['promptText', 'ratio'], audio: true, seed: true, promptMax: 1000 },
  { id: 'veo3.1_fast', name: 'Veo 3.1 Fast', ratios: VEO, duration: { values: [4, 6, 8], default: 4 }, required: ['promptText', 'ratio'], audio: true, seed: true, promptMax: 1000 },
  { id: 'klingO3_4k', name: 'Kling O3 4K', ratios: KLING_4K, duration: { min: 3, max: 15, default: 5 }, required: ['ratio'], audio: true, promptMax: 2500 },
  // Text-only requests need a concrete ratio, so `adaptive` is left out
  { id: 'hailuo3', name: 'MiniMax H3', ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], duration: { min: 5, max: 15, default: 5 }, required: PROMPT_ONLY, promptMax: 6000 },
  { id: 'kling3.0_4k', name: 'Kling 3.0 4K', ratios: KLING_4K, duration: { min: 3, max: 15, default: 5 }, required: ['ratio'], audio: true, promptMax: 2500 },
  { id: 'happyhorse_1_0', name: 'HappyHorse 1.0', ratios: ['1280:720', '720:1280', '960:960', '1108:832', '832:1108', '1920:1080', '1080:1920', '1440:1440', '1662:1248', '1248:1662'], duration: { min: 3, max: 15, default: 5 }, required: PROMPT_ONLY, promptMax: 2500 },
  { id: 'kling2.5_turbo_pro', name: 'Kling 2.5 Turbo Pro', ratios: ['1920:1080', '1440:1440', '1080:1920', '1280:720', '720:720', '720:1280'], duration: { values: [5, 10], default: 5 }, required: PROMPT_ONLY, promptMax: 2500 },
  { id: 'kling3.0_pro', name: 'Kling 3.0 Pro', ratios: KLING_PRO, duration: { min: 3, max: 15, default: 5 }, required: ['ratio'], audio: true, promptMax: 2500 },
  { id: 'kling3.0_standard', name: 'Kling 3.0 Standard', ratios: KLING_STD, duration: { min: 3, max: 15, default: 5 }, required: ['ratio'], audio: true, promptMax: 2500 },
  { id: 'klingO3_pro', name: 'Kling O3 Pro', ratios: KLING_PRO, duration: { min: 3, max: 15, default: 5 }, required: ['ratio'], audio: true, promptMax: 2500 },
  { id: 'klingO3_standard', name: 'Kling O3 Standard', ratios: KLING_STD, duration: { min: 3, max: 15, default: 5 }, required: ['ratio'], audio: true, promptMax: 2500 },
  // The reference gives no numeric range for Seedance; 4 to 15 seconds is the vendor's documented span
  { id: 'seedance2', name: 'Seedance 2.0', ratios: [...SEEDANCE_720, '2206:946', '1920:1080', '1664:1248', '1440:1440', '1248:1664', '1080:1920', '3840:1646', '3840:2160', '3840:2880', '3840:3840', '2880:3840', '2160:3840'], duration: { min: 4, max: 15, default: 5 }, required: PROMPT_ONLY, audio: true, seed: true, promptMax: 3500 },
  { id: 'seedance2_fast', name: 'Seedance 2.0 Fast', ratios: SEEDANCE_720, duration: { min: 4, max: 15, default: 5 }, required: PROMPT_ONLY, audio: true, seed: true, promptMax: 3500 },
  { id: 'seedance2_mini', name: 'Seedance 2.0 Mini', ratios: SEEDANCE_720, duration: { min: 4, max: 15, default: 5 }, required: PROMPT_ONLY, audio: true, seed: true, promptMax: 3500 },
  { id: 'gemini_omni_flash', name: 'Gemini Omni Flash', ratios: R720, duration: { min: 3, max: 10, default: 5 }, required: PROMPT_ONLY, promptMax: 4000 },
  { id: 'grok_imagine_1_5', name: 'Grok Imagine Video 1.5', ratios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'], duration: { min: 1, max: 15, default: 5 }, required: PROMPT_ONLY, promptMax: 2500 },
  // `auto_*` ratios are for keyframe image-to-video only
  { id: 'wan3', name: 'WAN 3.0', ratios: WAN, duration: { min: 2, max: 30, default: 5 }, required: PROMPT_ONLY, audio: true, promptMax: 20000 },
  { id: 'gemini_omni_flash_1.1', name: 'Gemini Omni Flash 1.1', ratios: ['640:360', '360:640', '1280:720', '720:1280', '1920:1080', '1080:1920', '3840:2160', '2160:3840'], duration: { min: 3, max: 10, default: 5 }, required: PROMPT_ONLY, promptMax: 4000 },
  { id: 'wan3_prime', name: 'WAN 3.0 Prime', ratios: WAN, duration: { min: 2, max: 30, default: 5 }, required: PROMPT_ONLY, audio: true, promptMax: 20000 },
  // No ratio field at all
  { id: 'h3_max', name: 'MiniMax H3 Max', ratios: [], duration: { min: 5, max: 15, default: 5 }, required: PROMPT_ONLY, seed: true, promptMax: 6000 },
  // Same span as Seedance 2.0 (see above); the reference states only the default of 5
  { id: 'seedance2_5', name: 'Seedance 2.5', ratios: ['992:432', '854:480', '752:560', '640:640', '560:752', '480:854', '1470:630', '1280:720', '1112:834', '960:960', '834:1112', '720:1280', '2206:946', '1920:1080', '1664:1248', '1440:1440', '1248:1664', '1080:1920'], duration: { min: 4, max: 15, default: 5 }, required: [], audio: true, seed: true, promptMax: 15000 },
  { id: 'grok_imagine_1_5_lite', name: 'Grok Imagine Video 1.5 Lite', ratios: ['848:480', '480:848', '480:480', '640:480', '480:640', '720:480', '480:720', '1280:720', '720:1280', '720:720', '960:720', '720:960', '1088:720', '720:1088', '1904:1072', '1072:1904', '1424:1424', '1648:1232', '1232:1648', '1744:1152', '1152:1744'], duration: { min: 1, max: 15, default: 5 }, required: PROMPT_ONLY, promptMax: 2500 },
];

export type RunwayAspect = 'landscape' | 'portrait' | 'square';

export interface RunwayTextToVideoRequest {
  prompt: string;
  duration?: number;
  aspect?: RunwayAspect;
  seed?: number;
}

export function findRunwayModel(id: string): RunwayModel | undefined {
  return RUNWAY_TEXT_TO_VIDEO_MODELS.find((m) => m.id === id);
}

/**
 * Model to send for a configured id. Retired ids (Gen-3 and older) and
 * unknown ids fall back to the default, `replaced` names the dropped id.
 */
export function resolveRunwayModel(id: string | undefined): { model: string; replaced?: string } {
  const wanted = id?.trim();
  if (!wanted) return { model: DEFAULT_RUNWAY_MODEL };
  if (findRunwayModel(wanted)) return { model: wanted };
  return { model: DEFAULT_RUNWAY_MODEL, replaced: wanted };
}

const ASPECT_TARGET: Record<RunwayAspect, number> = { landscape: 16 / 9, portrait: 9 / 16, square: 1 };
// Animations are overlays; 720p is sharp enough and the cheaper tier on most models
const PREFERRED_PIXELS = 1280 * 720;

function closestRatio(ratios: string[], aspect: RunwayAspect): string {
  const target = Math.log(ASPECT_TARGET[aspect]);
  const score = (ratio: string) => {
    const [w, h] = ratio.split(':').map(Number);
    return { shape: Math.abs(Math.log(w / h) - target), size: Math.abs(Math.log((w * h) / PREFERRED_PIXELS)) };
  };
  // Closest shape first, then the frame size nearest 720p; on a full tie the first listed wins
  return ratios.reduce((best, cur) => {
    const a = score(cur);
    const b = score(best);
    if (a.shape < b.shape - 1e-9) return cur;
    if (Math.abs(a.shape - b.shape) <= 1e-9 && a.size < b.size - 1e-9) return cur;
    return best;
  });
}

function fitDuration(spec: RunwayModel['duration'], seconds: number): number {
  if (spec.values?.length) {
    return spec.values.reduce((best, cur) => (Math.abs(cur - seconds) < Math.abs(best - seconds) ? cur : best));
  }
  const min = spec.min ?? 1;
  const max = spec.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, Math.round(seconds)));
}

// For ids outside the catalog: values nearly every Runway video model accepts
const UNKNOWN_MODEL_RATIOS: Record<RunwayAspect, string> = { landscape: '1280:720', portrait: '720:1280', square: '1280:720' };
const UNKNOWN_MODEL_DURATION: RunwayModel['duration'] = { values: [5, 10], default: 5 };
const UNKNOWN_MODEL_PROMPT_MAX = 1000;

/**
 * Request body for `POST /v1/text_to_video`, using only the fields the model
 * documents and values it accepts. Audio is switched off because animations
 * play muted and the soundtrack would only add cost.
 */
export function buildRunwayTextToVideoBody(modelId: string, request: RunwayTextToVideoRequest): Record<string, unknown> {
  const aspect = request.aspect ?? 'landscape';
  const model = findRunwayModel(modelId);

  if (!model) {
    return {
      model: modelId,
      promptText: request.prompt.slice(0, UNKNOWN_MODEL_PROMPT_MAX),
      ratio: UNKNOWN_MODEL_RATIOS[aspect],
      duration: fitDuration(UNKNOWN_MODEL_DURATION, request.duration ?? UNKNOWN_MODEL_DURATION.default),
    };
  }

  const body: Record<string, unknown> = {
    model: model.id,
    promptText: request.prompt.slice(0, model.promptMax),
  };
  if (model.ratios.length) body.ratio = closestRatio(model.ratios, aspect);
  body.duration = fitDuration(model.duration, request.duration ?? model.duration.default);
  if (model.audio) body.audio = false;
  if (model.seed && request.seed !== undefined) body.seed = request.seed;
  return body;
}
