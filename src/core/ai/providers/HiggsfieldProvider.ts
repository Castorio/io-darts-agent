/**
 * Higgsfield AI Provider
 *
 * Image and video generation through the Higgsfield API. The API key is
 * stored as KEY_ID:KEY_SECRET (see HiggsfieldClient).
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIModelInfo,
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  AIJob,
  AIJobStatus,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from '../types.js';
import {
  HiggsfieldClient,
  parseHiggsfieldCredentials,
  type HiggsfieldRequestStatus,
  type HiggsfieldStatus,
} from './HiggsfieldClient.js';

export const DEFAULT_HIGGSFIELD_VIDEO_MODEL = 'kling-video/v3.0/std/text-to-video';
export const DEFAULT_HIGGSFIELD_IMAGE_MODEL = 'higgsfield-ai/soul/standard';

/** Model id = endpoint path (docs.higgsfield.ai/docs/models, 2026-10-15) */
export const HIGGSFIELD_MODELS: Array<AIModelInfo & { type: 'video' | 'image' }> = [
  { id: DEFAULT_HIGGSFIELD_VIDEO_MODEL, name: 'Kling 3.0 Standard (Text-zu-Video)', type: 'video' },
  { id: 'kling-video/v2.5-turbo/pro/text-to-video', name: 'Kling 2.5 Turbo Pro (Text-zu-Video)', type: 'video' },
  { id: 'minimax/hailuo-2.3/standard/text-to-video', name: 'Hailuo 2.3 (Text-zu-Video)', type: 'video' },
  { id: DEFAULT_HIGGSFIELD_IMAGE_MODEL, name: 'Soul Standard (Bild)', type: 'image' },
];

// Kling video length limits per model page
const MIN_VIDEO_SECONDS = 3;
const MAX_VIDEO_SECONDS = 15;
const DEFAULT_VIDEO_SECONDS = 5;

// Images usually finish within a minute; keep a generous ceiling
const IMAGE_TIMEOUT_MS = 5 * 60_000;

// Only Kling 3.0 has a verified aspect_ratio/sound schema; others get prompt and duration
const KLING_3_MODELS = new Set([DEFAULT_HIGGSFIELD_VIDEO_MODEL]);

export interface HiggsfieldProviderConfig extends AIProviderConfig {
  type: 'higgsfield';
  options?: {
    /** Default video model (endpoint path) */
    defaultModel?: string;
    /** Default image model (endpoint path) */
    imageModel?: string;
  };
}

/** Soul aspect ratio closest to the requested size */
export function imageAspectRatio(width?: number, height?: number): string {
  if (!width || !height || width === height) return '1:1';
  const ratio = width / height;
  const options: Array<[string, number]> = [
    ['16:9', 16 / 9],
    ['3:2', 3 / 2],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
    ['2:3', 2 / 3],
    ['9:16', 9 / 16],
  ];
  return options.reduce((best, cur) => (Math.abs(cur[1] - ratio) < Math.abs(best[1] - ratio) ? cur : best))[0];
}

function clampDuration(seconds?: number): number {
  const value = Math.round(seconds ?? DEFAULT_VIDEO_SECONDS);
  return Math.min(MAX_VIDEO_SECONDS, Math.max(MIN_VIDEO_SECONDS, value));
}

function mapStatus(status: HiggsfieldRequestStatus): AIJobStatus {
  switch (status) {
    case 'queued':
      return 'pending';
    case 'in_progress':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'cancelled';
    default:
      return 'failed';
  }
}

function failureReason(status: HiggsfieldStatus): string {
  if (status.status === 'nsfw') return 'Higgsfield content moderation rejected the request';
  if (status.status === 'canceled') return 'Higgsfield request was canceled';
  return status.error || 'Higgsfield generation failed';
}

export class HiggsfieldProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['image-generation', 'video-generation'];

  override isConfigured(): boolean {
    try {
      parseHiggsfieldCredentials(this.config.apiKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check the key with a credit-free status request
   */
  override async getStatus(): Promise<AIProviderStatus> {
    const baseStatus = await super.getStatus();
    if (!baseStatus.configured) {
      return { ...baseStatus, error: this.config.apiKey ? 'Key must be KEY_ID:KEY_SECRET' : undefined };
    }

    try {
      const valid = await this.client().verifyCredentials();
      return valid
        ? { ...baseStatus, available: this.isAvailable() }
        : { ...baseStatus, available: false, error: 'Invalid API key' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect to Higgsfield';
      return { ...baseStatus, available: false, error: message };
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const model = request.model || this.options().imageModel || DEFAULT_HIGGSFIELD_IMAGE_MODEL;
    const client = this.client();

    const requestId = await client.submit(model, {
      prompt: request.prompt,
      aspect_ratio: imageAspectRatio(request.width, request.height),
      batch_size: (request.count ?? 1) > 1 ? 4 : 1,
    });
    const status = await client.waitFor(requestId, { timeoutMs: IMAGE_TIMEOUT_MS });
    if (status.status !== 'completed') {
      throw new Error(failureReason(status));
    }

    return {
      images: (status.images ?? []).map((img) => ({ url: img.url })),
      model,
    };
  }

  /**
   * Start a video; poll with getJobStatus(jobId)
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    const model = request.model || this.options().defaultModel || DEFAULT_HIGGSFIELD_VIDEO_MODEL;
    const duration = clampDuration(request.duration);

    const body: Record<string, unknown> = { prompt: request.prompt, duration };
    if (KLING_3_MODELS.has(model)) {
      body.aspect_ratio = request.aspectRatio ?? '16:9';
      // Animations play muted; native audio would only add cost
      body.sound = 'off';
    }

    const jobId = await this.client().submit(model, body);
    return { videoUrl: '', jobId, model, duration };
  }

  async getJobStatus(jobId: string): Promise<AIJob> {
    const status = await this.client().getStatus(jobId);
    const now = new Date();
    const mapped = mapStatus(status.status);

    return {
      id: jobId,
      providerId: this.config.id,
      providerJobId: jobId,
      type: status.images ? 'image-generation' : 'video-generation',
      status: mapped,
      createdAt: now,
      updatedAt: now,
      completedAt: mapped === 'completed' ? now : undefined,
      resultUrl: status.video?.url ?? status.images?.[0]?.url,
      error: mapped === 'failed' || mapped === 'cancelled' ? failureReason(status) : undefined,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return this.client().cancel(jobId);
  }

  private options(): NonNullable<HiggsfieldProviderConfig['options']> {
    return (this.config as HiggsfieldProviderConfig).options ?? {};
  }

  // Built per call so a key change in the settings applies immediately
  private client(): HiggsfieldClient {
    return new HiggsfieldClient(this.config.apiKey, { baseUrl: this.config.baseUrl });
  }
}

export function createHiggsfieldProvider(config: HiggsfieldProviderConfig): HiggsfieldProvider {
  return new HiggsfieldProvider(config);
}
