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
import { HIGGSFIELD_CATALOG, buildHiggsfieldBody, findHiggsfieldModel } from './higgsfieldCatalog.js';

export const DEFAULT_HIGGSFIELD_VIDEO_MODEL = 'kling-video/v3.0/std/text-to-video';
export const DEFAULT_HIGGSFIELD_IMAGE_MODEL = 'higgsfield-ai/soul/standard';

// Images usually finish within a minute; keep a generous ceiling
const IMAGE_TIMEOUT_MS = 5 * 60_000;

export interface HiggsfieldProviderConfig extends AIProviderConfig {
  type: 'higgsfield';
  options?: {
    /** Default video model (endpoint path) */
    defaultModel?: string;
    /** Default image model (endpoint path) */
    imageModel?: string;
  };
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

// Enough to cover all image jobs a user follows; older ids fall back to output detection
const MAX_TRACKED_IMAGE_REQUESTS = 200;

export class HiggsfieldProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['image-generation', 'video-generation'];
  // Request ids of image generations, so their job type is known before output exists
  private readonly imageRequestIds = new Set<string>();

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
    if (findHiggsfieldModel(model)?.type === 'video') {
      throw new Error(`${model} is not an image model`);
    }
    const client = this.client();

    const requestId = await client.submit(
      model,
      buildHiggsfieldBody(model, {
        prompt: request.prompt,
        width: request.width,
        height: request.height,
        count: request.count,
      })
    );
    this.imageRequestIds.add(requestId);
    if (this.imageRequestIds.size > MAX_TRACKED_IMAGE_REQUESTS) {
      // Sets keep insertion order, so the first entry is the oldest
      this.imageRequestIds.delete(this.imageRequestIds.values().next().value as string);
    }
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
    const configured = this.options().defaultModel;
    // An image model saved as default must not break video generation
    const fallback = configured && findHiggsfieldModel(configured)?.type !== 'image' ? configured : undefined;
    const model = request.model || fallback || DEFAULT_HIGGSFIELD_VIDEO_MODEL;
    if (findHiggsfieldModel(model)?.type === 'image') {
      throw new Error(`${model} is not a video model`);
    }

    const body = buildHiggsfieldBody(model, {
      prompt: request.prompt,
      duration: request.duration,
      aspectRatio: request.aspectRatio,
    });

    const jobId = await this.client().submit(model, body);
    return { videoUrl: '', jobId, model, duration: body.duration as number | undefined };
  }

  /**
   * Higgsfield has no model listing endpoint; the catalog comes from its docs
   */
  async listTextModels(): Promise<AIModelInfo[]> {
    return HIGGSFIELD_CATALOG.map((m) => ({ id: m.id, name: m.name, category: m.type }));
  }

  async getJobStatus(jobId: string): Promise<AIJob> {
    const status = await this.client().getStatus(jobId);
    const now = new Date();
    const mapped = mapStatus(status.status);

    return {
      id: jobId,
      providerId: this.config.id,
      providerJobId: jobId,
      type: this.imageRequestIds.has(jobId) || status.images ? 'image-generation' : 'video-generation',
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
