/**
 * Animation Generator Service
 * Orchestrates AI-powered animation generation with style presets
 */

import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { AIProvider } from './providers/AIProvider.js';
import type {
  AnimationStyle,
  AnimationJob,
  DartEventType,
  AnimationGenerationOptions,
  SingleGenerationRequest,
  BatchGenerationRequest,
} from './types/animation.js';
import { DART_EVENT_TYPES, EVENT_PROMPT_TEMPLATES } from './types/animation.js';

/**
 * Style presets for animation generation
 */
export const STYLE_PRESETS: AnimationStyle[] = [
  {
    id: 'fire',
    name: 'Fire',
    prompt: 'Explosive fire and flames, burning embers, orange and red flames',
    category: 'effect',
    colors: ['#FF4500', '#FF6B00', '#FFD700'],
  },
  {
    id: 'ice',
    name: 'Ice',
    prompt: 'Crystalline ice shards, frost particles, cold blue and white',
    category: 'effect',
    colors: ['#00BFFF', '#87CEEB', '#FFFFFF'],
  },
  {
    id: 'neon',
    name: 'Neon',
    prompt: 'Vibrant neon lights, cyberpunk glow, electric purple and pink',
    category: 'effect',
    colors: ['#FF00FF', '#00FFFF', '#FF1493'],
  },
  {
    id: 'gold',
    name: 'Gold',
    prompt: 'Luxurious golden sparkles, glitter particles, shimmering gold',
    category: 'celebration',
    colors: ['#FFD700', '#FFC107', '#B8860B'],
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    prompt: 'Playful cartoon style explosion, comic book effects, bold colors',
    category: 'celebration',
    colors: ['#FF0000', '#FFFF00', '#00FF00'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    prompt: 'Clean minimalist design, geometric shapes, subtle movement',
    category: 'minimal',
    colors: ['#FFFFFF', '#808080', '#000000'],
  },
  {
    id: 'electric',
    name: 'Electric',
    prompt: 'Electric lightning bolts, sparks, energy discharge, blue electricity',
    category: 'effect',
    colors: ['#00BFFF', '#1E90FF', '#FFFFFF'],
  },
  {
    id: 'confetti',
    name: 'Confetti',
    prompt: 'Colorful confetti explosion, celebration streamers, party atmosphere',
    category: 'celebration',
    colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
  },
  {
    id: 'smoke',
    name: 'Smoke',
    prompt: 'Dramatic smoke clouds, mystical fog, swirling particles',
    category: 'effect',
    colors: ['#696969', '#A9A9A9', '#D3D3D3'],
  },
  {
    id: 'stars',
    name: 'Stars',
    prompt: 'Twinkling stars, cosmic sparkles, stellar explosion',
    category: 'celebration',
    colors: ['#FFD700', '#FFFFFF', '#FFA500'],
  },
];

/**
 * Animation Generator Service configuration
 */
export interface AnimationGeneratorConfig {
  /** Output directory for generated animations */
  outputDir: string;
  /** AI provider instance */
  provider?: AIProvider;
  /** Polling interval for job status (ms) */
  pollInterval?: number;
  /** Max concurrent jobs */
  maxConcurrent?: number;
  /** Consecutive status errors before a job is given up (default 5) */
  maxPollErrors?: number;
  /** Time after which a job that is still running is given up (default 30 min) */
  jobTimeoutMs?: number;
  /** Turns the downloaded video into a transparent WebM; false keeps the original (default FFmpeg) */
  postProcess?: (inputPath: string, outputPath: string) => Promise<boolean>;
}

/**
 * Animation Generator Service
 */
export class AnimationGeneratorService {
  private config: AnimationGeneratorConfig;
  private provider: AIProvider | null = null;
  private jobs: Map<string, AnimationJob> = new Map();
  private jobsFilePath: string;
  private pollInterval: number;
  private maxPollErrors: number;
  private jobTimeoutMs: number;
  // Engine that started each running job; switching engines must not affect it
  private jobProviders: Map<string, AIProvider> = new Map();

  constructor(config: AnimationGeneratorConfig) {
    this.config = config;
    this.provider = config.provider ?? null;
    this.pollInterval = config.pollInterval ?? 5000;
    this.maxPollErrors = config.maxPollErrors ?? 5;
    this.jobTimeoutMs = config.jobTimeoutMs ?? 30 * 60_000;
    this.jobsFilePath = path.join(config.outputDir, '.animation-jobs.json');
  }

  /**
   * Initialize the service
   */
  init(): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Load persisted jobs
    this.loadJobs();
    return Promise.resolve();
  }

  /**
   * Set the AI provider (or null to clear)
   */
  setProvider(provider: AIProvider | null): void {
    this.provider = provider;
  }

  /**
   * Check if provider is configured
   */
  isProviderConfigured(): boolean {
    return this.provider?.isConfigured() ?? false;
  }

  /**
   * Get all style presets
   */
  getStylePresets(): AnimationStyle[] {
    return [...STYLE_PRESETS];
  }

  /**
   * Get a specific style preset by ID
   */
  getStylePreset(id: string): AnimationStyle | undefined {
    return STYLE_PRESETS.find((s) => s.id === id);
  }

  /**
   * Get all dart event types
   */
  getEventTypes(): DartEventType[] {
    return [...DART_EVENT_TYPES];
  }

  /**
   * Generate a single animation
   */
  generateSingle(request: SingleGenerationRequest): Promise<AnimationJob> {
    if (!this.provider) {
      return Promise.reject(new Error('No AI provider configured'));
    }
    // The event type ends up in file names, so only known values pass
    if (!DART_EVENT_TYPES.includes(request.eventType)) {
      return Promise.reject(new Error(`Unknown event type: ${String(request.eventType).slice(0, 40)}`));
    }

    // Create job
    const job: AnimationJob = {
      id: uuidv4(),
      status: 'pending',
      eventType: request.eventType,
      style: request.style,
      customPrompt: request.customPrompt,
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.saveJobs();

    // Start generation in background; startGeneration records its own
    // failures on the job, the catch only guards against unexpected throws.
    void this.startGeneration(job, request.options).catch((error) => {
      console.error(`Animation generation ${job.id} failed unexpectedly:`, error);
    });

    return Promise.resolve(job);
  }

  /**
   * Generate animations for multiple events (batch)
   */
  async generateBatch(request: BatchGenerationRequest): Promise<AnimationJob[]> {
    const eventTypes = request.eventTypes ?? DART_EVENT_TYPES;
    const jobs: AnimationJob[] = [];

    for (const eventType of eventTypes) {
      const job = await this.generateSingle({
        eventType,
        style: request.style,
        options: request.options,
      });
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * Get all jobs
   */
  getJobs(): AnimationJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get a specific job
   */
  getJob(id: string): AnimationJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Cancel a job
   */
  async cancelJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    // Cancel at the engine that runs the job; some engines can only cancel queued work
    const provider = this.jobProviders.get(job.id);
    if (job.providerJobId && provider) {
      const cancelled = await provider.cancelJob(job.providerJobId);
      if (!cancelled) {
        return false;
      }
    }

    this.jobProviders.delete(job.id);
    job.status = 'cancelled';
    job.completedAt = new Date();
    this.saveJobs();

    return true;
  }

  /**
   * Delete a job and its result
   */
  async deleteJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    // Delete result file if exists
    if (job.resultFilename) {
      const filePath = path.join(this.config.outputDir, job.resultFilename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // A deleted job that is still running would keep generating (and billing)
    const provider = this.jobProviders.get(id);
    if (provider && job.providerJobId && (job.status === 'queued' || job.status === 'processing')) {
      await provider.cancelJob(job.providerJobId).catch(() => false);
    }
    this.jobProviders.delete(id);

    this.jobs.delete(id);
    this.saveJobs();

    return true;
  }

  /**
   * Clear completed/failed jobs
   */
  clearFinishedJobs(): Promise<number> {
    let count = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(id);
        this.jobProviders.delete(id);
        count++;
      }
    }
    this.saveJobs();
    return Promise.resolve(count);
  }

  /**
   * Start generation process for a job
   */
  private async startGeneration(
    job: AnimationJob,
    options?: AnimationGenerationOptions
  ): Promise<void> {
    const provider = this.provider;
    if (!provider) {
      job.status = 'failed';
      job.error = 'No AI provider configured';
      this.saveJobs();
      return;
    }
    this.jobProviders.set(job.id, provider);

    try {
      job.status = 'queued';
      job.startedAt = new Date();
      this.saveJobs();

      // Build the full prompt
      const prompt = this.buildFullPrompt(job.eventType, job.style, job.customPrompt);

      // Start generation - pass style colors for base image generation
      const result = await provider.generate(prompt, {
        ...options,
        format: 'webm',
        transparent: true,
        colors: job.style.colors,
      });

      // Cancelled or deleted while the engine was accepting the job
      if (job.status !== 'queued' || !this.jobs.has(job.id)) {
        this.jobProviders.delete(job.id);
        if (result.success && result.jobId) {
          await provider.cancelJob(result.jobId).catch(() => false);
        }
        return;
      }

      if (!result.success) {
        this.jobProviders.delete(job.id);
        job.status = 'failed';
        job.error = result.error ?? 'Generation failed';
        this.saveJobs();
        return;
      }

      // If immediate result (unlikely for video)
      if (result.resultUrl) {
        await this.handleCompletion(job, result.resultUrl, provider);
        return;
      }

      // Store provider job ID and start polling
      job.providerJobId = result.jobId;
      job.status = 'processing';
      this.saveJobs();

      // Poll for completion
      this.pollJobStatus(job);
    } catch (error) {
      this.jobProviders.delete(job.id);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      this.saveJobs();
    }
  }

  /**
   * Poll the job's own engine until it finishes. Transient errors are
   * retried; the job fails after repeated errors or when it runs too long.
   */
  private pollJobStatus(job: AnimationJob): void {
    const provider = this.jobProviders.get(job.id);
    if (!provider || !job.providerJobId) return;

    const startedAt = job.startedAt?.getTime() ?? Date.now();
    let consecutiveErrors = 0;

    const fail = (error: string): void => {
      this.jobProviders.delete(job.id);
      job.status = 'failed';
      job.error = error;
      job.completedAt = new Date();
      this.saveJobs();
    };

    const schedule = (): void => {
      setTimeout(() => {
        void poll().catch((error) => {
          console.error(`Animation polling ${job.id} failed unexpectedly:`, error);
        });
      }, this.pollInterval);
    };

    const poll = async (): Promise<void> => {
      // Cancelled or deleted in the meantime
      if (job.status !== 'processing' || !this.jobs.has(job.id)) return;

      if (Date.now() - startedAt > this.jobTimeoutMs) {
        fail('Generation did not finish in time');
        return;
      }

      try {
        const status = await provider.getJobStatus(job.providerJobId!);
        consecutiveErrors = 0;
        if (job.status !== 'processing') return;

        job.progress = status.progress;

        if (status.status === 'completed') {
          if (status.resultUrl) {
            await this.handleCompletion(job, status.resultUrl, provider);
          } else {
            fail('Generation finished with no result URL');
          }
        } else if (status.status === 'failed') {
          fail(status.error ?? 'Generation failed');
        } else {
          this.saveJobs();
          schedule();
        }
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= this.maxPollErrors) {
          fail(error instanceof Error ? error.message : 'Polling error');
        } else {
          schedule();
        }
      }
    };

    void poll().catch((error) => {
      console.error(`Animation polling ${job.id} failed unexpectedly:`, error);
    });
  }

  /**
   * Handle successful completion
   */
  private async handleCompletion(job: AnimationJob, resultUrl: string, provider: AIProvider): Promise<void> {
    this.jobProviders.delete(job.id);
    try {
      // Create subfolder structure: ai-generated/{styleId}
      const folderName = `ai-generated/${job.style.id}`;
      const folderPath = path.join(this.config.outputDir, folderName);

      // Ensure folder exists
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Generate filenames with event type for easy identification
      const baseName = `${job.eventType}_${job.id}`;
      const tempPath = path.join(folderPath, `${baseName}_temp.mp4`);
      const webmPath = path.join(folderPath, `${baseName}.webm`);

      // Download result to temp file
      await provider.downloadResult(resultUrl, tempPath);

      // Post-process: Remove black background and create transparent WebM
      const postProcess = this.config.postProcess ?? removeBlackBackground;
      let filename: string;
      if (await postProcess(tempPath, webmPath)) {
        filename = `${baseName}.webm`;
        fs.rmSync(tempPath, { force: true });
      } else {
        // Keep the original under its real container, not as .webm
        console.warn('[AnimationGenerator] FFmpeg post-processing failed, using original');
        fs.rmSync(webmPath, { force: true });
        filename = `${baseName}.mp4`;
        fs.renameSync(tempPath, path.join(folderPath, filename));
      }

      job.status = 'completed';
      job.progress = 100;
      // URL includes subfolder path
      job.resultUrl = `/api/media/files/animation/${folderName}/${filename}`;
      job.resultFilename = filename;
      job.completedAt = new Date();
      this.saveJobs();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Download failed';
      job.completedAt = new Date();
      this.saveJobs();
    }
  }

  /**
   * Build full prompt combining event template and style
   */
  private buildFullPrompt(
    eventType: DartEventType,
    style: AnimationStyle,
    customPrompt?: string
  ): string {
    const eventPrompt = EVENT_PROMPT_TEMPLATES[eventType] ?? eventType;
    const stylePrompt = style.prompt;

    if (customPrompt) {
      return `${customPrompt}, ${eventPrompt}, ${stylePrompt}`;
    }

    return `${eventPrompt}, ${stylePrompt}, animated visual effect`;
  }

  /**
   * Load jobs from persistent storage
   */
  private loadJobs(): void {
    try {
      if (fs.existsSync(this.jobsFilePath)) {
        const data = fs.readFileSync(this.jobsFilePath, 'utf-8');
        const jobsArray = JSON.parse(data) as AnimationJob[];

        for (const job of jobsArray) {
          // Convert date strings back to Date objects
          job.createdAt = new Date(job.createdAt);
          if (job.startedAt) job.startedAt = new Date(job.startedAt);
          if (job.completedAt) job.completedAt = new Date(job.completedAt);

          // Mark in-progress jobs as failed (they were interrupted)
          if (job.status === 'processing' || job.status === 'queued') {
            job.status = 'failed';
            job.error = 'Job was interrupted';
          }

          this.jobs.set(job.id, job);
        }
      }
    } catch (error) {
      console.error('Failed to load animation jobs:', error);
    }
  }

  /**
   * Save jobs to persistent storage
   */
  private saveJobs(): void {
    try {
      const jobsArray = Array.from(this.jobs.values());
      fs.writeFileSync(this.jobsFilePath, JSON.stringify(jobsArray, null, 2));
    } catch (error) {
      console.error('Failed to save animation jobs:', error);
    }
  }
}

/**
 * Remove black background from video using FFmpeg
 * Creates a WebM with alpha channel transparency
 */
async function removeBlackBackground(inputPath: string, outputPath: string): Promise<boolean> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');

  try {
    // colorkey: black becomes transparent (similarity 0.15, edge blend 0.1).
    // execFile passes the paths as arguments, no shell involved
    await promisify(execFile)(
      'ffmpeg',
      ['-y', '-i', inputPath, '-vf', 'colorkey=0x000000:0.15:0.1', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', outputPath],
      { timeout: 60000 }
    );

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log('[AnimationGenerator] Successfully created transparent WebM:', outputPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[AnimationGenerator] FFmpeg error:', error instanceof Error ? error.message : error);
    return false;
  }
}
