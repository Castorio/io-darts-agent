import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { AnimationGeneratorService } from './AnimationGeneratorService.js';
import type { AIProvider } from './providers/AIProvider.js';
import type { AnimationJob, ProviderJobStatus } from './types/animation.js';

function fakeProvider(id: string, statuses: Array<ProviderJobStatus | Error>) {
  const queue = [...statuses];
  return {
    name: id,
    id,
    isConfigured: () => true,
    generate: vi.fn().mockResolvedValue({ success: true, jobId: `${id}-job` }),
    getJobStatus: vi.fn(async () => {
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      if (next instanceof Error) throw next;
      return next;
    }),
    cancelJob: vi.fn().mockResolvedValue(true),
    downloadResult: vi.fn(async (_url: string, outputPath: string) => {
      writeFileSync(outputPath, 'video');
    }),
  } satisfies AIProvider & Record<string, unknown>;
}

async function settle(service: AnimationGeneratorService, jobId: string, timeoutMs = 3000): Promise<AnimationJob> {
  const start = Date.now();
  for (;;) {
    const job = service.getJob(jobId)!;
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    if (Date.now() - start > timeoutMs) return job;
    await new Promise((r) => setTimeout(r, 10));
  }
}

const style = { id: 'neon', name: 'Neon', prompt: 'neon glow', colors: ['#fff'] } as never;

describe('AnimationGeneratorService job lifecycle', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'anim-gen-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function service(provider: AIProvider, extra: Record<string, unknown> = {}) {
    return new AnimationGeneratorService({ outputDir: dir, provider, pollInterval: 5, ...extra });
  }

  it('rejects an unknown event type before it reaches the engine or a file name', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'pending', progress: 0 }]);
    const s = service(provider);
    await s.init();

    for (const eventType of ['"; touch /tmp/pwned; "', '../../etc/x']) {
      await expect(s.generateSingle({ eventType: eventType as never, style })).rejects.toThrow('Unknown event type');
    }
    expect(provider.generate).not.toHaveBeenCalled();
    expect(s.getJobs()).toHaveLength(0);
  });

  it('keeps the original video as mp4 when the transparency step fails', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'completed', progress: 100, resultUrl: 'https://cdn/a.mp4' }]);
    const s = service(provider, { postProcess: vi.fn().mockResolvedValue(false) });
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    const done = await settle(s, job.id);

    expect(done.status).toBe('completed');
    expect(done.resultFilename).toBe(`bull_${job.id}.mp4`);
    expect(done.resultUrl).toBe(`/api/media/files/animation/ai-generated/neon/bull_${job.id}.mp4`);
    expect(readFileSync(path.join(dir, 'ai-generated/neon', done.resultFilename!), 'utf8')).toBe('video');
    expect(existsSync(path.join(dir, 'ai-generated/neon', `bull_${job.id}.webm`))).toBe(false);
    expect(provider.downloadResult).toHaveBeenCalledTimes(1);
  });

  it('stores a transparent webm when the transparency step succeeds', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'completed', progress: 100, resultUrl: 'https://cdn/a.mp4' }]);
    const postProcess = vi.fn(async (_input: string, output: string) => {
      writeFileSync(output, 'webm');
      return true;
    });
    const s = service(provider, { postProcess });
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    const done = await settle(s, job.id);

    expect(done.resultFilename).toBe(`bull_${job.id}.webm`);
    expect(existsSync(path.join(dir, 'ai-generated/neon', `bull_${job.id}_temp.mp4`))).toBe(false);
  });

  it('keeps polling and downloading with the engine that started the job', async () => {
    const runway = fakeProvider('runway', [
      { status: 'processing', progress: 50 },
      { status: 'processing', progress: 60 },
      { status: 'completed', progress: 100, resultUrl: 'https://cdn/a.mp4' },
    ]);
    const higgsfield = fakeProvider('higgsfield', [{ status: 'pending', progress: 0 }]);
    const s = service(runway);
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    s.setProvider(higgsfield);
    const done = await settle(s, job.id);

    expect(done.status).toBe('completed');
    expect(higgsfield.getJobStatus).not.toHaveBeenCalled();
    expect(higgsfield.downloadResult).not.toHaveBeenCalled();
    expect(runway.downloadResult).toHaveBeenCalled();
  });

  it('survives a transient polling error', async () => {
    const provider = fakeProvider('higgsfield', [
      new Error('fetch failed'),
      { status: 'completed', progress: 100, resultUrl: 'https://cdn/a.mp4' },
    ]);
    const s = service(provider);
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });

    expect((await settle(s, job.id)).status).toBe('completed');
  });

  it('fails after repeated polling errors', async () => {
    const provider = fakeProvider('higgsfield', [new Error('fetch failed')]);
    const s = service(provider, { maxPollErrors: 3 });
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    const done = await settle(s, job.id);

    expect(done.status).toBe('failed');
    expect(provider.getJobStatus).toHaveBeenCalledTimes(3);
  });

  it('fails a completed job that has no result URL instead of hanging', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'completed', progress: 100 }]);
    const s = service(provider);
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    const done = await settle(s, job.id);

    expect(done.status).toBe('failed');
    expect(done.error).toContain('no result');
  });

  it('gives up on a job that never finishes', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'pending', progress: 0 }]);
    const s = service(provider, { jobTimeoutMs: 100 });
    await s.init();

    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    const done = await settle(s, job.id);

    expect(done.status).toBe('failed');
    expect(done.error).toContain('did not finish');
  });

  it('keeps a job running when the provider refuses to cancel it', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'processing', progress: 50 }]);
    provider.cancelJob.mockResolvedValue(false);
    const s = service(provider, { jobTimeoutMs: 200 });
    await s.init();
    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    await new Promise((r) => setTimeout(r, 30));

    const cancelled = await s.cancelJob(job.id);

    expect(cancelled).toBe(false);
    expect(s.getJob(job.id)!.status).toBe('processing');
  });

  it('stops polling a cancelled job', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'processing', progress: 50 }]);
    const s = service(provider);
    await s.init();
    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    await new Promise((r) => setTimeout(r, 30));

    await s.cancelJob(job.id);
    const callsAfterCancel = provider.getJobStatus.mock.calls.length;
    await new Promise((r) => setTimeout(r, 50));

    expect(s.getJob(job.id)!.status).toBe('cancelled');
    expect(provider.getJobStatus.mock.calls.length).toBeLessThanOrEqual(callsAfterCancel + 1);
  });

  it('cancels at the engine when a job is cancelled before the engine accepted it', async () => {
    const provider = fakeProvider('higgsfield', [{ status: 'processing', progress: 50 }]);
    let accept!: (value: { success: boolean; jobId: string }) => void;
    provider.generate.mockReturnValue(new Promise((r) => (accept = r)));
    const s = service(provider);
    await s.init();
    const job = await s.generateSingle({ eventType: 'bull' as never, style });

    expect(await s.cancelJob(job.id)).toBe(true);
    accept({ success: true, jobId: 'late-job' });
    await new Promise((r) => setTimeout(r, 30));

    expect(s.getJob(job.id)!.status).toBe('cancelled');
    expect(provider.cancelJob).toHaveBeenCalledWith('late-job');
    expect(provider.getJobStatus).not.toHaveBeenCalled();
  });

  it('forgets the engine of jobs that failed to start or were deleted', async () => {
    const failing = fakeProvider('higgsfield', []);
    failing.generate.mockResolvedValue({ success: false, error: 'Higgsfield: not enough credits' });
    const s = service(failing);
    await s.init();
    const failed = await s.generateSingle({ eventType: 'bull' as never, style });
    await settle(s, failed.id);

    const running = fakeProvider('runway', [{ status: 'processing', progress: 50 }]);
    s.setProvider(running);
    const job = await s.generateSingle({ eventType: 'bull' as never, style });
    await new Promise((r) => setTimeout(r, 20));
    await s.deleteJob(job.id);

    expect((s as unknown as { jobProviders: Map<string, unknown> }).jobProviders.size).toBe(0);
  });
});
