/**
 * Higgsfield text-to-video and text-to-image models
 *
 * Generated from the model pages on docs.higgsfield.ai (2026-10-15). Model id =
 * endpoint path. Workflows that need input media (image-to-video, references,
 * edits, motion control) or extra mandatory inputs (Ads/Marketing Studio,
 * Qwen Image) are left out because the hub only sends a prompt.
 */

export interface HiggsfieldModel {
  id: string;
  name: string;
  type: 'video' | 'image';
  /** Either a range or fixed steps, as documented per model */
  duration?: { min?: number; max?: number; values?: number[]; default: number; required?: boolean };
  aspectRatios?: string[];
  /** How the model's native audio is switched: sound "on"/"off" or generate_audio true/false */
  audio?: 'sound' | 'generate_audio';
  batchSizes?: number[];
}

export const HIGGSFIELD_CATALOG: HiggsfieldModel[] = [
  {"id": "higgsfield/cinema-studio/4.0", "name": "Cinema Studio 4.0", "type": "video", "duration": {"min": 4, "max": 30, "default": 5}, "aspectRatios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], "audio": "generate_audio"},
  {"id": "minimax/hailuo-2.3/standard/text-to-video", "name": "Hailuo 2.3 Standard", "type": "video", "duration": {"values": [6, 10], "default": 6}},
  {"id": "alibaba/happy-horse/text-to-video", "name": "Happy Horse 1.0", "type": "video", "duration": {"min": 3, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1", "4:3", "3:4"]},
  {"id": "alibaba/happy-horse/v1.1/text-to-video", "name": "HappyHorse 1.1", "type": "video", "duration": {"min": 3, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1", "4:3", "3:4"]},
  {"id": "kling-video/v2.5-turbo/pro/text-to-video", "name": "Kling 2.5 Turbo Pro", "type": "video", "duration": {"values": [5, 10], "default": 5}},
  {"id": "kling-video/v2.6/pro/text-to-video", "name": "Kling 2.6 Pro", "type": "video", "duration": {"values": [5, 10], "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1"], "audio": "sound"},
  {"id": "kling-video/v3.0/4k/text-to-video", "name": "Kling 3.0 4K", "type": "video", "duration": {"min": 3, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1"], "audio": "sound"},
  {"id": "kling-video/v3.0/pro/text-to-video", "name": "Kling 3.0 Pro", "type": "video", "duration": {"min": 3, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1"], "audio": "sound"},
  {"id": "kling-video/v3.0/std/text-to-video", "name": "Kling 3.0 Standard", "type": "video", "duration": {"min": 3, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1"], "audio": "sound"},
  {"id": "kling-video/v3.0-turbo/text-to-video", "name": "Kling 3.0 Turbo", "type": "video", "duration": {"min": 3, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1"]},
  {"id": "lightricks/ltx-2.5/text-to-video/fast", "name": "LTX-2.5 fast", "type": "video", "duration": {"values": [6, 8, 10], "default": 6, "required": true}, "aspectRatios": ["16:9", "9:16"], "audio": "generate_audio"},
  {"id": "lightricks/ltx-2.5/text-to-video/pro", "name": "LTX-2.5 pro", "type": "video", "duration": {"values": [6, 8, 10], "default": 6, "required": true}, "aspectRatios": ["16:9", "9:16"], "audio": "generate_audio"},
  {"id": "minimax/h3/text-to-video", "name": "MiniMax H3", "type": "video", "duration": {"min": 5, "max": 15, "default": 5}, "aspectRatios": ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]},
  {"id": "pixverse/v6/text-to-video", "name": "PixVerse V6", "type": "video", "duration": {"min": 1, "max": 15, "default": 5}, "aspectRatios": ["16:9", "4:3", "1:1", "3:4", "9:16"], "audio": "generate_audio"},
  {"id": "bytedance/seedance-2.0/text-to-video", "name": "Seedance 2.0", "type": "video", "duration": {"min": 4, "max": 15, "default": 5}, "aspectRatios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], "audio": "generate_audio"},
  {"id": "bytedance/seedance-2.5/text-to-video", "name": "Seedance 2.5", "type": "video", "duration": {"min": 4, "max": 30, "default": 5}, "aspectRatios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], "audio": "generate_audio"},
  {"id": "wan/v2.6/text-to-video", "name": "Wan 2.6", "type": "video", "duration": {"values": [5, 10, 15], "default": 5}},
  {"id": "wan/v2.7/text-to-video", "name": "Wan 2.7", "type": "video", "duration": {"min": 2, "max": 15, "default": 5}, "aspectRatios": ["16:9", "9:16", "1:1", "4:3", "3:4"]},
  {"id": "alibaba/wan-3.0/text-to-video", "name": "Wan 3.0", "type": "video", "duration": {"min": 2, "max": 30, "default": 5}, "aspectRatios": ["16:9", "4:3", "1:1", "3:4", "9:16"], "audio": "generate_audio"},
  {"id": "alibaba/wan-3.0-prime/text-to-video", "name": "Wan 3.0 Prime", "type": "video", "duration": {"min": 2, "max": 30, "default": 5}, "aspectRatios": ["16:9", "4:3", "1:1", "3:4", "9:16"], "audio": "generate_audio"},
  {"id": "xai/grok-imagine-image-2.0", "name": "Grok Image 2.0", "type": "image", "aspectRatios": ["1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"]},
  {"id": "ideogram/v4.0", "name": "Ideogram 4.0", "type": "image", "aspectRatios": ["1:1", "1:2", "2:1", "2:3", "3:2", "4:5", "5:4", "9:16", "16:9", "5:8", "8:5", "3:4", "4:3", "9:22", "22:9", "9:23", "23:9", "3:8", "8:3", "5:12", "12:5", "1:3", "3:1"]},
  {"id": "recraft/v4.1/text-to-image", "name": "Recraft V4.1", "type": "image", "aspectRatios": ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"]},
  {"id": "recraft/v4.1/pro/text-to-image", "name": "Recraft V4.1 Pro", "type": "image", "aspectRatios": ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"]},
  {"id": "recraft/v4.1/utility/text-to-image", "name": "Recraft V4.1 Utility", "type": "image", "aspectRatios": ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"]},
  {"id": "recraft/v4.1/utility/pro/text-to-image", "name": "Recraft V4.1 Utility Pro", "type": "image", "aspectRatios": ["1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "6:10", "14:10", "10:14", "16:9", "9:16"]},
  {"id": "higgsfield-ai/soul/standard", "name": "SOUL", "type": "image", "aspectRatios": ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"], "batchSizes": [1, 4]},
  {"id": "higgsfield-ai/soul/cinema", "name": "SOUL Cinema", "type": "image", "aspectRatios": ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"], "batchSizes": [1, 4]},
  {"id": "higgsfield-ai/soul/v2/standard", "name": "SOUL V2", "type": "image", "aspectRatios": ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"], "batchSizes": [1, 4]},
  {"id": "z-image/turbo", "name": "Z-Image Turbo", "type": "image", "aspectRatios": ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"]},
];

export interface HiggsfieldBodyRequest {
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  width?: number;
  height?: number;
  count?: number;
}

export function findHiggsfieldModel(id: string): HiggsfieldModel | undefined {
  return HIGGSFIELD_CATALOG.find((m) => m.id === id);
}

function ratioValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number);
  return w / h;
}

function closestAspectRatio(options: string[], target: number): string {
  return options.reduce((best, cur) =>
    Math.abs(ratioValue(cur) - target) < Math.abs(ratioValue(best) - target) ? cur : best
  );
}

function fitDuration(spec: NonNullable<HiggsfieldModel['duration']>, seconds: number): number {
  if (spec.values?.length) {
    return spec.values.reduce((best, cur) => (Math.abs(cur - seconds) < Math.abs(best - seconds) ? cur : best));
  }
  const min = spec.min ?? seconds;
  const max = spec.max ?? seconds;
  return Math.min(max, Math.max(min, Math.round(seconds)));
}

/**
 * Request body for a model, using only parameters its schema documents and
 * values it accepts. Unknown models get the prompt only.
 */
export function buildHiggsfieldBody(modelId: string, request: HiggsfieldBodyRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: request.prompt };
  const model = findHiggsfieldModel(modelId);
  if (!model) return body;

  if (model.duration && (request.duration !== undefined || model.duration.required || model.type === 'video')) {
    body.duration = fitDuration(model.duration, request.duration ?? model.duration.default);
  }

  if (model.aspectRatios?.length) {
    const target = request.aspectRatio
      ? ratioValue(request.aspectRatio)
      : request.width && request.height
        ? request.width / request.height
        : 1;
    body.aspect_ratio = closestAspectRatio(model.aspectRatios, target);
  }

  // Animations play muted; native audio (on by default) would only add cost
  if (model.audio === 'sound') body.sound = 'off';
  if (model.audio === 'generate_audio') body.generate_audio = false;

  if (model.batchSizes?.length) {
    const wanted = request.count ?? 1;
    body.batch_size = model.batchSizes.find((size) => size >= wanted) ?? Math.max(...model.batchSizes);
  }

  return body;
}
