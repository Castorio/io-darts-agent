/**
 * TTS Services
 *
 * Re-exports TTS services from darts-caller module
 */

export {
  ElevenLabsService,
  VoicePackGenerator,
} from '../../../modules/darts-caller/src/index.js';

export type {
  ElevenLabsConfig,
  ElevenLabsVoice,
  VoiceSettings,
  GenerationOptions,
  GenerationStatus,
  GenerationProgress,
  VoicePackConfig,
} from '../../../modules/darts-caller/src/index.js';

// Factory function for backward compatibility
import { ElevenLabsService } from '../../../modules/darts-caller/src/index.js';
import type { ElevenLabsConfig } from '../../../modules/darts-caller/src/index.js';
export function createElevenLabsService(config: ElevenLabsConfig): ElevenLabsService {
  return new ElevenLabsService(config);
}

import { VoicePackGenerator } from '../../../modules/darts-caller/src/index.js';
export function createVoicePackGenerator(
  elevenLabs: ElevenLabsService,
  outputDir: string
): VoicePackGenerator {
  return new VoicePackGenerator(elevenLabs, outputDir);
}
