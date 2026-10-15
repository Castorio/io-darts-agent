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
  async init(): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Load persisted jobs
    await this.loadJobs();
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
  async generateSingle(request: SingleGenerationRequest): Promise<AnimationJob> {
    if (!this.provider) {
      throw new Error('No AI provider configured');
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
    await this.saveJobs();

    // Start generation in background
    this.startGeneration(job, request.options);

    return job;
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
    await this.saveJobs();

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
    await this.saveJobs();

    return true;
  }

  /**
   * Clear completed/failed jobs
   */
  async clearFinishedJobs(): Promise<number> {
    let count = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(id);
        this.jobProviders.delete(id);
        count++;
      }
    }
    await this.saveJobs();
    return count;
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
      await this.saveJobs();
      return;
    }
    this.jobProviders.set(job.id, provider);

    try {
      job.status = 'queued';
      job.startedAt = new Date();
      await this.saveJobs();

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
        await this.saveJobs();
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
      await this.saveJobs();

      // Poll for completion
      this.pollJobStatus(job);
    } catch (error) {
      this.jobProviders.delete(job.id);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      await this.saveJobs();
    }
  }

  /**
   * Poll the job's own engine until it finishes. Transient errors are
   * retried; the job fails after repeated errors or when it runs too long.
   */
  private async pollJobStatus(job: AnimationJob): Promise<void> {
    const provider = this.jobProviders.get(job.id);
    if (!provider || !job.providerJobId) return;

    const startedAt = job.startedAt?.getTime() ?? Date.now();
    let consecutiveErrors = 0;

    const fail = async (error: string) => {
      this.jobProviders.delete(job.id);
      job.status = 'failed';
      job.error = error;
      job.completedAt = new Date();
      await this.saveJobs();
    };

    const poll = async () => {
      // Cancelled or deleted in the meantime
      if (job.status !== 'processing' || !this.jobs.has(job.id)) return;

      if (Date.now() - startedAt > this.jobTimeoutMs) {
        await fail('Generation did not finish in time');
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
            await fail('Generation finished with no result URL');
          }
        } else if (status.status === 'failed') {
          await fail(status.error ?? 'Generation failed');
        } else {
          await this.saveJobs();
          setTimeout(poll, this.pollInterval);
        }
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= this.maxPollErrors) {
          await fail(error instanceof Error ? error.message : 'Polling error');
        } else {
          setTimeout(poll, this.pollInterval);
        }
      }
    };

    void poll();
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
      const tempFilename = `${job.eventType}_${job.id}_temp.mp4`;
      const filename = `${job.eventType}_${job.id}.webm`;
      const tempPath = path.join(folderPath, tempFilename);
      const outputPath = path.join(folderPath, filename);

      // Download result to temp file
      await provider.downloadResult(resultUrl, tempPath);

      // Post-process: Remove black background and create transparent WebM
      const transparentSuccess = await this.removeBlackBackground(tempPath, outputPath);

      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      if (!transparentSuccess) {
        // If FFmpeg failed, try to use the original file
        console.warn('[AnimationGenerator] FFmpeg post-processing failed, using original');
        // Re-download to final path
        await provider.downloadResult(resultUrl, outputPath);
      }

      job.status = 'completed';
      job.progress = 100;
      // URL includes subfolder path
      job.resultUrl = `/api/media/files/animation/${folderName}/${filename}`;
      job.resultFilename = filename;
      job.completedAt = new Date();
      await this.saveJobs();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Download failed';
      job.completedAt = new Date();
      await this.saveJobs();
    }
  }

  /**
   * Remove black background from video using FFmpeg
   * Creates a WebM with alpha channel transparency
   */
  private async removeBlackBackground(inputPath: string, outputPath: string): Promise<boolean> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Use FFmpeg to convert black pixels to transparent
      // colorkey filter: makes the specified color transparent
      // - color: black (0x000000)
      // - similarity: how close colors need to be (0.1 = 10% tolerance)
      // - blend: edge blending (0.1 for smooth edges)
      const ffmpegCommand = `ffmpeg -y -i "${inputPath}" -vf "colorkey=0x000000:0.15:0.1" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 "${outputPath}"`;

      await execAsync(ffmpegCommand, { timeout: 60000 });

      // Verify output exists
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 0) {
          console.log('[AnimationGenerator] Successfully created transparent WebM:', outputPath);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[AnimationGenerator] FFmpeg error:', error);
      return false;
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
  private async loadJobs(): Promise<void> {
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
  private async saveJobs(): Promise<void> {
    try {
      const jobsArray = Array.from(this.jobs.values());
      fs.writeFileSync(this.jobsFilePath, JSON.stringify(jobsArray, null, 2));
    } catch (error) {
      console.error('Failed to save animation jobs:', error);
    }
  }
}
