/**
 * Higgsfield animation engine
 *
 * Adapts the Higgsfield AI provider (configured in the AI settings) to the
 * animation generator's provider interface.
 */

import { BaseAIProvider } from './AIProvider.js';
import { buildAnimationPrompt } from './animationPrompt.js';
import type { HiggsfieldProvider } from '../../ai/providers/HiggsfieldProvider.js';
import type {
  AnimationGenerationOptions,
  ProviderGenerationResult,
  ProviderJobStatus,
} from '../types/animation.js';

function aspectRatio(options?: AnimationGenerationOptions): '16:9' | '9:16' | '1:1' {
  const width = options?.width ?? 512;
  const height = options?.height ?? 512;
  if (width > height) return '16:9';
  if (height > width) return '9:16';
  return '1:1';
}

export class HiggsfieldAnimationProvider extends BaseAIProvider {
  readonly name = 'Higgsfield';
  readonly id = 'higgsfield';

  constructor(private readonly provider: HiggsfieldProvider) {
    super({ apiKey: provider.config.apiKey });
  }

  override isConfigured(): boolean {
    return this.provider.isAvailable();
  }

  async generate(prompt: string, options?: AnimationGenerationOptions): Promise<ProviderGenerationResult> {
    try {
      const result = await this.provider.generateVideo({
        prompt: buildAnimationPrompt(prompt, options),
        duration: options?.duration ?? 5,
        aspectRatio: aspectRatio(options),
      });
      return { success: true, jobId: result.jobId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getJobStatus(jobId: string): Promise<ProviderJobStatus> {
    const job = await this.provider.getJobStatus(jobId);
    switch (job.status) {
      case 'pending':
        return { status: 'pending', progress: 0 };
      case 'processing':
        return { status: 'processing', progress: 50 };
      case 'completed':
        return { status: 'completed', progress: 100, resultUrl: job.resultUrl };
      default:
        return { status: 'failed', progress: 0, error: job.error };
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return this.provider.cancelJob(jobId);
  }
}
