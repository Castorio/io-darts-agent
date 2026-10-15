import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunwayProvider, createRunwayProvider } from './RunwayProvider.js';

const TASK_ID = '6f1c1b2e-6a7d-4c2a-9f8e-2b1d3c4e5f60';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function postedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit).method === 'POST')!;
  return JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
}

describe('Runway animation engine', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, { id: TASK_ID, estimatedCost: { credits: 60 } }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts a text_to_video task without a placeholder image', async () => {
    const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 1 });

    const result = await provider.generate('Golden 180', { duration: 5, width: 1280, height: 720 });

    expect(result).toEqual({ success: true, jobId: TASK_ID });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.dev.runwayml.com/v1/text_to_video');
    expect((init.headers as Record<string, string>)['X-Runway-Version']).toBe('2024-11-06');
    const body = postedBody(fetchMock);
    expect(body).toEqual({
      model: 'gen4.5',
      promptText: expect.stringContaining('Golden 180, on a solid pure black #000000 background'),
      ratio: '1280:720',
      duration: 5,
    });
    expect(JSON.stringify(body)).not.toContain('placehold');
  });

  it('uses the configured catalog model with its own ratio, duration and muted audio', async () => {
    const provider = new RunwayProvider({ apiKey: 'key', model: 'veo3.1_fast', maxRetries: 1 });

    await provider.generate('x', { duration: 5, width: 720, height: 1280 });

    expect(postedBody(fetchMock)).toMatchObject({ model: 'veo3.1_fast', ratio: '720:1280', duration: 4, audio: false });
  });

  it('falls back to the default model for a retired id and logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new RunwayProvider({ apiKey: 'key', model: 'gen3a_turbo', maxRetries: 1 });

    await provider.generate('x');

    expect(postedBody(fetchMock).model).toBe('gen4.5');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('gen3a_turbo'));
  });

  it('sends the configured seed', async () => {
    const provider = new RunwayProvider({ apiKey: 'key', seed: 7, maxRetries: 1 });

    await provider.generate('x');

    expect(postedBody(fetchMock).seed).toBe(7);
  });

  it('reports API validation errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Invalid ratio' }));
    const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 1 });

    const result = await provider.generate('x');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid ratio');
  });

  it('sends a generation exactly once when Runway answers 500', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(500, { error: 'internal' }));
    const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 3 });

    const result = await provider.generate('x');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: false, error: expect.stringMatching(/500.*not retried/) });
  });

  it('sends a generation exactly once on a network error or timeout', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 3 });

    const result = await provider.generate('x');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: false, error: expect.stringMatching(/not retried/) });
  });

  it('still retries the task status after a server error', async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockImplementationOnce(async () => jsonResponse(503, {}))
        .mockImplementationOnce(async () => jsonResponse(200, { id: TASK_ID, status: 'RUNNING', progress: 0.1, createdAt: 'x' }));
      const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 3 });

      const status = provider.getJobStatus(TASK_ID);
      await vi.runAllTimersAsync();

      expect(await status).toEqual({ status: 'processing', progress: 10 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps task states, including throttled tasks and 0-1 progress', async () => {
    const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 1 });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: TASK_ID, status: 'THROTTLED', createdAt: 'x' }));
    expect(await provider.getJobStatus(TASK_ID)).toEqual({ status: 'pending', progress: 0 });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: TASK_ID, status: 'RUNNING', progress: 0.42, createdAt: 'x' }));
    expect(await provider.getJobStatus(TASK_ID)).toEqual({ status: 'processing', progress: 42 });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: TASK_ID, status: 'SUCCEEDED', output: ['https://cdn.example/v.mp4'], createdAt: 'x' })
    );
    expect(await provider.getJobStatus(TASK_ID)).toEqual({
      status: 'completed',
      progress: 100,
      resultUrl: 'https://cdn.example/v.mp4',
    });
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.dev.runwayml.com/v1/tasks/${TASK_ID}`);
  });

  it('cancels a task with DELETE /v1/tasks/{id}', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const provider = new RunwayProvider({ apiKey: 'key', maxRetries: 1 });

    expect(await provider.cancelJob(TASK_ID)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.dev.runwayml.com/v1/tasks/${TASK_ID}`);
    expect(init.method).toBe('DELETE');
  });
});

describe('createRunwayProvider', () => {
  it('passes the model from the settings through', () => {
    const provider = createRunwayProvider({ apiKey: 'key', model: 'kling3.0_standard' });

    expect(provider?.model).toBe('kling3.0_standard');
  });

  it('uses the default model when none is configured', () => {
    expect(createRunwayProvider({ apiKey: 'key' })?.model).toBe('gen4.5');
  });

  it('returns null without a key', () => {
    vi.stubEnv('RUNWAY_API_KEY', '');
    expect(createRunwayProvider({})).toBeNull();
    vi.unstubAllEnvs();
  });
});
