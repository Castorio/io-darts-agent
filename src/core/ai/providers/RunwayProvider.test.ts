import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunwayProvider, type RunwayProviderConfig } from './RunwayProvider.js';
import { RUNWAY_TEXT_TO_VIDEO_MODELS } from './runwayCatalog.js';

const TASK_ID = '0b3f6a8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function provider(options?: RunwayProviderConfig['options']): RunwayProvider {
  return new RunwayProvider({ id: 'runway', type: 'runway', name: 'Runway ML', apiKey: 'key', maxRetries: 1, options });
}

function posted(fetchMock: ReturnType<typeof vi.fn>): { url: string; body: Record<string, unknown> } {
  const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit).method === 'POST')!;
  return { url: call[0] as string, body: JSON.parse((call[1] as RequestInit).body as string) };
}

describe('Runway AI provider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { id: TASK_ID, estimatedCost: { credits: 60 } }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists the text_to_video catalog as video models', async () => {
    const models = await provider().listTextModels();

    expect(models).toHaveLength(RUNWAY_TEXT_TO_VIDEO_MODELS.length);
    expect(models[0]).toEqual({ id: 'gen4.5', name: 'Gen-4.5', category: 'video' });
    expect(models.every((m) => m.category === 'video')).toBe(true);
  });

  it('uses Gen-4.5 when no model is saved', async () => {
    const result = await provider().generateVideo({ prompt: 'x' });

    const { url, body } = posted(fetchMock);
    expect(url).toBe('https://api.dev.runwayml.com/v1/text_to_video');
    expect(body).toEqual({ model: 'gen4.5', promptText: 'x', ratio: '1280:720', duration: 5 });
    expect(result).toMatchObject({ jobId: TASK_ID, model: 'gen4.5', duration: 5 });
  });

  it('uses the saved model and picks up a changed setting without a restart', async () => {
    const p = provider({ defaultModel: 'kling3.0_standard' });
    await p.generateVideo({ prompt: 'x', aspectRatio: '1:1', duration: 20 });
    expect(posted(fetchMock).body).toEqual({
      model: 'kling3.0_standard', promptText: 'x', ratio: '960:960', duration: 15, audio: false,
    });

    // AIProviderService.updateProviderConfig replaces config.options
    (p.config as { options?: Record<string, unknown> }).options = { defaultModel: 'veo3.1_fast' };
    fetchMock.mockClear();
    await p.generateVideo({ prompt: 'x', aspectRatio: '9:16' });
    expect(posted(fetchMock).body).toMatchObject({ model: 'veo3.1_fast', ratio: '720:1280', duration: 4 });
  });

  it('replaces a retired saved model with the default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await provider({ defaultModel: 'gen3a_turbo' }).generateVideo({ prompt: 'x' });

    expect(posted(fetchMock).body.model).toBe('gen4.5');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('gen3a_turbo'));
  });

  it('derives the orientation from width and height', async () => {
    await provider().generateVideo({ prompt: 'x', width: 720, height: 1280 });

    expect(posted(fetchMock).body.ratio).toBe('720:1280');
  });

  it('cancels a task with DELETE /v1/tasks/{id}', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await provider().cancelJob(TASK_ID)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.dev.runwayml.com/v1/tasks/${TASK_ID}`);
    expect(init.method).toBe('DELETE');
  });

  it('sends a generation exactly once when Runway answers 500', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(500, { error: 'internal' }));

    await expect(provider().generateVideo({ prompt: 'x' })).rejects.toThrow(/Runway.*500.*not retried/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends an image_to_video generation exactly once on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(provider().generateVideo({ prompt: 'x', imageUrl: 'https://img/x.png' })).rejects.toThrow(/not retried/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still retries the task status after a server error', async () => {
    vi.useFakeTimers();
    try {
      const p = new RunwayProvider({ id: 'runway', type: 'runway', name: 'Runway ML', apiKey: 'key', maxRetries: 3 });
      fetchMock
        .mockImplementationOnce(async () => jsonResponse(502, {}))
        .mockImplementationOnce(async () => jsonResponse(200, { id: TASK_ID, status: 'PENDING', createdAt: '2026-10-16T00:00:00Z' }));

      const status = p.getJobStatus(TASK_ID);
      await vi.runAllTimersAsync();

      expect(await status).toMatchObject({ status: 'pending' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports progress in percent and throttled tasks as pending', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: TASK_ID, status: 'RUNNING', progress: 0.5, createdAt: '2026-10-16T00:00:00Z' })
    );
    expect(await provider().getJobStatus(TASK_ID)).toMatchObject({ status: 'processing', progress: 50 });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: TASK_ID, status: 'THROTTLED', createdAt: '2026-10-16T00:00:00Z' }));
    expect(await provider().getJobStatus(TASK_ID)).toMatchObject({ status: 'pending' });
  });
});
