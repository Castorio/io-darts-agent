import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HiggsfieldProvider,
  DEFAULT_HIGGSFIELD_IMAGE_MODEL,
  DEFAULT_HIGGSFIELD_VIDEO_MODEL,
} from './HiggsfieldProvider.js';
import { findHiggsfieldModel } from './higgsfieldCatalog.js';

const REQUEST_ID = 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff';

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as unknown as Response;
}

function provider(apiKey = 'key-id:secret', options: Record<string, unknown> = {}) {
  return new HiggsfieldProvider({ id: 'higgsfield', type: 'higgsfield', name: 'Higgsfield', apiKey, enabled: true, options });
}

function submittedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit).method === 'POST');
  return JSON.parse((call![1] as RequestInit).body as string) as Record<string, unknown>;
}

function submittedUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  return fetchMock.mock.calls.find((c) => (c[1] as RequestInit).method === 'POST')![0] as string;
}

describe('HiggsfieldProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers image and video generation with Kling 3.0 and Soul as defaults', () => {
    const p = provider();

    expect(p.capabilities).toEqual(['image-generation', 'video-generation']);
    expect(DEFAULT_HIGGSFIELD_VIDEO_MODEL).toBe('kling-video/v3.0/std/text-to-video');
    expect(DEFAULT_HIGGSFIELD_IMAGE_MODEL).toBe('higgsfield-ai/soul/standard');
    expect(findHiggsfieldModel(DEFAULT_HIGGSFIELD_VIDEO_MODEL)?.type).toBe('video');
    expect(findHiggsfieldModel(DEFAULT_HIGGSFIELD_IMAGE_MODEL)?.type).toBe('image');
  });

  it('is not configured with a key in the wrong format', () => {
    expect(provider('only-a-key').isConfigured()).toBe(false);
    expect(provider('id:secret').isConfigured()).toBe(true);
  });

  describe('generateImage()', () => {
    it('submits to Soul and waits for the image URLs', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'completed', images: [{ url: 'https://cdn/i.jpg' }] }));

      const result = await provider().generateImage({ prompt: 'A golden dartboard', width: 1600, height: 900 });

      expect(submittedUrl(fetchMock)).toBe('https://api.higgsfield.ai/higgsfield-ai/soul/standard');
      expect(submittedBody(fetchMock)).toEqual({ prompt: 'A golden dartboard', aspect_ratio: '16:9', batch_size: 1 });
      expect(result).toEqual({ images: [{ url: 'https://cdn/i.jpg' }], model: DEFAULT_HIGGSFIELD_IMAGE_MODEL });
    });

    it('requests four images when more than one is wanted', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'completed', images: [] }));

      await provider().generateImage({ prompt: 'x', count: 3 });

      expect(submittedBody(fetchMock).batch_size).toBe(4);
    });

    it('rejects a video model for image generation without spending credits', async () => {
      await expect(
        provider().generateImage({ prompt: 'x', model: 'kling-video/v3.0/std/text-to-video' })
      ).rejects.toThrow('not an image model');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('explains a moderation rejection', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }))
        .mockResolvedValueOnce(jsonResponse(200, { status: 'nsfw' }));

      await expect(provider().generateImage({ prompt: 'x' })).rejects.toThrow('content moderation');
    });
  });

  describe('generateVideo()', () => {
    it('submits a Kling 3.0 text-to-video request and returns the job id', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }));

      const result = await provider().generateVideo({ prompt: 'A dart hits bullseye', duration: 20, aspectRatio: '1:1' });

      expect(submittedUrl(fetchMock)).toBe('https://api.higgsfield.ai/kling-video/v3.0/std/text-to-video');
      expect(submittedBody(fetchMock)).toEqual({
        prompt: 'A dart hits bullseye',
        duration: 15,
        aspect_ratio: '1:1',
        sound: 'off',
      });
      expect(result).toEqual({ videoUrl: '', jobId: REQUEST_ID, model: DEFAULT_HIGGSFIELD_VIDEO_MODEL, duration: 15 });
    });

    it('builds the body from the model schema (Hailuo only allows 6 or 10 seconds)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }));

      const result = await provider().generateVideo({
        prompt: 'x',
        model: 'minimax/hailuo-2.3/standard/text-to-video',
        aspectRatio: '1:1',
      });

      expect(submittedBody(fetchMock)).toEqual({ prompt: 'x', duration: 6 });
      expect(result.duration).toBe(6);
    });

    it('refuses an image model for video generation', async () => {
      await expect(provider().generateVideo({ prompt: 'x', model: 'ideogram/v4.0' })).rejects.toThrow(
        'not a video model'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('uses a configured default video model', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }));

      await provider('id:secret', { defaultModel: 'kling-video/v2.5-turbo/pro/text-to-video' }).generateVideo({ prompt: 'x' });

      expect(submittedUrl(fetchMock)).toBe('https://api.higgsfield.ai/kling-video/v2.5-turbo/pro/text-to-video');
    });
  });

  describe('getJobStatus()', () => {
    it.each([
      ['queued', 'pending'],
      ['in_progress', 'processing'],
      ['completed', 'completed'],
      ['failed', 'failed'],
      ['nsfw', 'failed'],
      ['canceled', 'cancelled'],
    ])('maps %s to %s', async (higgsfield, expected) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { status: higgsfield, video: higgsfield === 'completed' ? { url: 'https://cdn/v.mp4' } : undefined })
      );

      const job = await provider().getJobStatus(REQUEST_ID);

      expect(job.status).toBe(expected);
      if (expected === 'completed') expect(job.resultUrl).toBe('https://cdn/v.mp4');
    });
  });

  it('reports image jobs as image jobs even before they finish', async () => {
    const p = provider();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { status: 'queued', request_id: REQUEST_ID }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'failed' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'queued' }));
    await p.generateImage({ prompt: 'x' }).catch(() => undefined);

    const job = await p.getJobStatus(REQUEST_ID);

    expect(job.type).toBe('image-generation');
  });

  it('lists the whole catalog with video and image categories', async () => {
    const models = await provider().listTextModels();

    expect(models).toHaveLength(30);
    expect(models.filter((m) => m.category === 'video')).toHaveLength(20);
    expect(models.find((m) => m.id === DEFAULT_HIGGSFIELD_IMAGE_MODEL)).toMatchObject({ category: 'image' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('getStatus()', () => {
    it('checks the key without spending credits', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, { detail: 'Not found' }));

      const status = await provider().getStatus();

      expect(status.available).toBe(true);
      expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('GET');
    });

    it('reports an invalid key', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: 'Invalid credentials' }));

      const status = await provider().getStatus();

      expect(status.available).toBe(false);
      expect(status.error).toContain('Invalid');
    });

    it('reports a key in the wrong format without calling the API', async () => {
      const status = await provider('nocolon').getStatus();

      expect(status.available).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
