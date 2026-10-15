import { describe, it, expect, vi } from 'vitest';
import { HiggsfieldAnimationProvider } from './HiggsfieldAnimationProvider.js';
import type { AIJob } from '../../ai/types.js';

const JOB_ID = 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff';

function fakeProvider(overrides: Record<string, unknown> = {}) {
  return {
    config: { id: 'higgsfield', apiKey: 'id:secret' },
    isAvailable: vi.fn(() => true),
    generateVideo: vi.fn().mockResolvedValue({ videoUrl: '', jobId: JOB_ID, model: 'm', duration: 5 }),
    getJobStatus: vi.fn(),
    cancelJob: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function job(status: AIJob['status'], extra: Partial<AIJob> = {}): AIJob {
  return {
    id: JOB_ID, providerId: 'higgsfield', providerJobId: JOB_ID, type: 'video-generation',
    status, createdAt: new Date(), updatedAt: new Date(), ...extra,
  };
}

describe('HiggsfieldAnimationProvider', () => {
  it('identifies itself as the higgsfield engine', () => {
    const adapter = new HiggsfieldAnimationProvider(fakeProvider() as never);

    expect(adapter.id).toBe('higgsfield');
    expect(adapter.isConfigured()).toBe(true);
  });

  it('starts a muted square video with the animation prompt', async () => {
    const provider = fakeProvider();
    const adapter = new HiggsfieldAnimationProvider(provider as never);

    const result = await adapter.generate('Golden 180', { duration: 4, width: 512, height: 512 });

    expect(result).toEqual({ success: true, jobId: JOB_ID });
    expect(provider.generateVideo).toHaveBeenCalledWith({
      prompt: expect.stringContaining('Golden 180, on a solid pure black #000000 background'),
      duration: 4,
      aspectRatio: '1:1',
    });
  });

  it('uses landscape and portrait ratios for wide and tall animations', async () => {
    const provider = fakeProvider();
    const adapter = new HiggsfieldAnimationProvider(provider as never);

    await adapter.generate('x', { width: 1280, height: 720 });
    await adapter.generate('x', { width: 720, height: 1280 });

    expect(provider.generateVideo.mock.calls.map((c) => c[0].aspectRatio)).toEqual(['16:9', '9:16']);
  });

  it('reports a failed start instead of throwing', async () => {
    const provider = fakeProvider({ generateVideo: vi.fn().mockRejectedValue(new Error('Higgsfield: not enough credits')) });
    const adapter = new HiggsfieldAnimationProvider(provider as never);

    await expect(adapter.generate('x')).resolves.toEqual({ success: false, error: 'Higgsfield: not enough credits' });
  });

  it.each([
    ['pending', { status: 'pending', progress: 0 }],
    ['processing', { status: 'processing', progress: 50 }],
    ['completed', { status: 'completed', progress: 100, resultUrl: 'https://cdn/v.mp4' }],
    ['failed', { status: 'failed', progress: 0, error: 'Higgsfield content moderation rejected the request' }],
    ['cancelled', { status: 'failed', progress: 0, error: 'Higgsfield request was canceled' }],
  ] as const)('maps job status %s', async (status, expected) => {
    const extra = status === 'completed'
      ? { resultUrl: 'https://cdn/v.mp4' }
      : status === 'failed'
        ? { error: 'Higgsfield content moderation rejected the request' }
        : status === 'cancelled'
          ? { error: 'Higgsfield request was canceled' }
          : {};
    const provider = fakeProvider({ getJobStatus: vi.fn().mockResolvedValue(job(status, extra)) });
    const adapter = new HiggsfieldAnimationProvider(provider as never);

    await expect(adapter.getJobStatus(JOB_ID)).resolves.toEqual(expected);
  });

  it('cancels through the provider', async () => {
    const provider = fakeProvider();

    await expect(new HiggsfieldAnimationProvider(provider as never).cancelJob(JOB_ID)).resolves.toBe(true);
    expect(provider.cancelJob).toHaveBeenCalledWith(JOB_ID);
  });
});
