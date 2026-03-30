/**
 * Voice Pack Generator
 *
 * Generates complete voice packs for darts caller using ElevenLabs TTS
 */

import * as fs from 'fs';
import * as path from 'path';
import { ElevenLabsService } from './ElevenLabsService.js';

/**
 * Voice pack generation status
 */
export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';

/**
 * Generation progress info
 */
export interface GenerationProgress {
  status: GenerationStatus;
  packId: string;
  packName: string;
  voiceId: string;
  totalFiles: number;
  completedFiles: number;
  currentFile?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  estimatedTimeRemaining?: number;
}

/**
 * Voice pack configuration
 */
export interface VoicePackConfig {
  packId: string;
  packName: string;
  voiceId: string;
  language: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

/**
 * Phrase entry for generation
 */
interface PhraseEntry {
  filename: string;
  text: string;
  category: string;
}

/**
 * Default phrases for a complete darts voice pack
 */
function getDefaultPhrases(language: string): PhraseEntry[] {
  const phrases: PhraseEntry[] = [];

  // Game events
  const gameEvents = language === 'de' ? {
    game_on: 'Spiel an!',
    game_shot: 'Game Shot!',
    match_shot: 'Game Shot und das Match!',
    bust: 'Überworfen!',
    no_score: 'Keine Punkte',
  } : {
    game_on: 'Game on!',
    game_shot: 'Game shot!',
    match_shot: 'Game shot and the match!',
    bust: 'Bust!',
    no_score: 'No score',
  };

  for (const [filename, text] of Object.entries(gameEvents)) {
    phrases.push({ filename, text, category: 'events' });
  }

  // Scores 0-180
  for (let score = 0; score <= 180; score++) {
    const text = language === 'de'
      ? scoreToGerman(score)
      : scoreToEnglish(score);
    phrases.push({
      filename: `score_${score}`,
      text,
      category: 'scores',
    });
  }

  // Special 180 celebration
  phrases.push({
    filename: '180',
    text: language === 'de' ? 'Einhundertachtzig!' : 'One hundred and eighty!',
    category: 'special',
  });

  // Checkout announcements (require X)
  const checkoutScores = getCheckoutScores();
  for (const score of checkoutScores) {
    const text = language === 'de'
      ? `Du brauchst ${scoreToGerman(score)}`
      : `You require ${scoreToEnglish(score)}`;
    phrases.push({
      filename: `require_${score}`,
      text,
      category: 'checkouts',
    });
  }

  return phrases;
}

/**
 * Get all possible checkout scores (2-170 excluding impossible)
 */
function getCheckoutScores(): number[] {
  const scores: number[] = [];
  const impossible = [169, 168, 166, 165, 163, 162, 159];

  for (let i = 2; i <= 170; i++) {
    if (!impossible.includes(i)) {
      scores.push(i);
    }
  }

  return scores;
}

/**
 * Convert number to English text
 */
function scoreToEnglish(score: number): string {
  if (score === 0) return 'No score';

  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (score < 20) return ones[score];
  if (score < 100) {
    const t = Math.floor(score / 10);
    const o = score % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  }

  const h = Math.floor(score / 100);
  const r = score % 100;
  const hundredPart = h === 1 ? 'one hundred' : `${ones[h]} hundred`;

  if (r === 0) return hundredPart;
  return `${hundredPart} and ${scoreToEnglish(r)}`;
}

/**
 * Convert number to German text
 */
function scoreToGerman(score: number): string {
  if (score === 0) return 'Null';

  const ones = [
    '', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
    'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn',
    'siebzehn', 'achtzehn', 'neunzehn',
  ];
  const tens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

  if (score < 20) return ones[score];
  if (score < 100) {
    const t = Math.floor(score / 10);
    const o = score % 10;
    if (o === 0) return tens[t];
    if (o === 1) return `einund${tens[t]}`;
    return `${ones[o]}und${tens[t]}`;
  }

  const h = Math.floor(score / 100);
  const r = score % 100;
  const hundredPart = h === 1 ? 'einhundert' : `${ones[h]}hundert`;

  if (r === 0) return hundredPart;
  return `${hundredPart}${scoreToGerman(r)}`;
}

export class VoicePackGenerator {
  private elevenLabsService: ElevenLabsService;
  private outputDir: string;
  private currentProgress: GenerationProgress | null = null;
  private cancelRequested = false;
  private progressCallbacks: ((progress: GenerationProgress) => void)[] = [];

  constructor(elevenLabsService: ElevenLabsService, outputDir: string) {
    this.elevenLabsService = elevenLabsService;
    this.outputDir = outputDir;
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: GenerationProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const idx = this.progressCallbacks.indexOf(callback);
      if (idx !== -1) {
        this.progressCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Emit progress update
   */
  private emitProgress(progress: GenerationProgress): void {
    this.currentProgress = progress;
    for (const callback of this.progressCallbacks) {
      callback(progress);
    }
  }

  /**
   * Get current progress
   */
  getProgress(): GenerationProgress | null {
    return this.currentProgress;
  }

  /**
   * Check if generation is in progress
   */
  isGenerating(): boolean {
    return this.currentProgress?.status === 'generating';
  }

  /**
   * Cancel current generation
   */
  cancel(): void {
    if (this.isGenerating()) {
      this.cancelRequested = true;
    }
  }

  /**
   * Generate a complete voice pack
   */
  async generate(config: VoicePackConfig): Promise<GenerationProgress> {
    if (this.isGenerating()) {
      throw new Error('Generation already in progress');
    }

    this.cancelRequested = false;

    const phrases = getDefaultPhrases(config.language);
    const packDir = path.join(this.outputDir, config.packId);

    // Create pack directory
    if (!fs.existsSync(packDir)) {
      fs.mkdirSync(packDir, { recursive: true });
    }

    const progress: GenerationProgress = {
      status: 'generating',
      packId: config.packId,
      packName: config.packName,
      voiceId: config.voiceId,
      totalFiles: phrases.length,
      completedFiles: 0,
      startedAt: Date.now(),
    };

    this.emitProgress(progress);

    const startTime = Date.now();
    let successCount = 0;

    try {
      for (let i = 0; i < phrases.length; i++) {
        if (this.cancelRequested) {
          progress.status = 'cancelled';
          progress.completedAt = Date.now();
          this.emitProgress(progress);
          return progress;
        }

        const phrase = phrases[i];
        progress.currentFile = phrase.filename;
        progress.completedFiles = i;

        // Estimate remaining time
        if (i > 0) {
          const avgTimePerFile = (Date.now() - startTime) / i;
          progress.estimatedTimeRemaining = Math.round((phrases.length - i) * avgTimePerFile);
        }

        this.emitProgress(progress);

        const outputPath = path.join(packDir, `${phrase.filename}.mp3`);

        // Skip if file already exists
        if (fs.existsSync(outputPath)) {
          successCount++;
          continue;
        }

        try {
          await this.elevenLabsService.generateSpeechToFile(
            phrase.text,
            outputPath,
            {
              voiceId: config.voiceId,
              modelId: config.modelId,
              voiceSettings: {
                stability: config.stability ?? 0.5,
                similarity_boost: config.similarityBoost ?? 0.75,
              },
            }
          );
          successCount++;

          // Small delay to avoid rate limiting
          await this.delay(100);
        } catch (error) {
          console.error(`Failed to generate ${phrase.filename}:`, error);
          // Continue with next file
        }
      }

      progress.status = 'completed';
      progress.completedFiles = phrases.length;
      progress.completedAt = Date.now();
      progress.currentFile = undefined;
      progress.estimatedTimeRemaining = undefined;

      // Save pack metadata
      const metadata = {
        id: config.packId,
        name: config.packName,
        voiceId: config.voiceId,
        language: config.language,
        generatedAt: new Date().toISOString(),
        totalFiles: phrases.length,
        successfulFiles: successCount,
      };

      fs.writeFileSync(
        path.join(packDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      this.emitProgress(progress);
      return progress;
    } catch (error) {
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : String(error);
      progress.completedAt = Date.now();
      this.emitProgress(progress);
      return progress;
    }
  }

  /**
   * List existing voice packs
   */
  listPacks(): Array<{
    id: string;
    name: string;
    voiceId: string;
    language: string;
    generatedAt: string;
    totalFiles: number;
  }> {
    const packs: Array<{
      id: string;
      name: string;
      voiceId: string;
      language: string;
      generatedAt: string;
      totalFiles: number;
    }> = [];

    if (!fs.existsSync(this.outputDir)) {
      return packs;
    }

    const entries = fs.readdirSync(this.outputDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = path.join(this.outputDir, entry.name, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            packs.push({
              id: metadata.id,
              name: metadata.name,
              voiceId: metadata.voiceId,
              language: metadata.language,
              generatedAt: metadata.generatedAt,
              totalFiles: metadata.totalFiles,
            });
          } catch {
            // Skip invalid metadata
          }
        }
      }
    }

    return packs;
  }

  /**
   * Delete a voice pack
   */
  deletePack(packId: string): boolean {
    const packDir = path.join(this.outputDir, packId);

    if (!fs.existsSync(packDir)) {
      return false;
    }

    // Remove all files in the pack directory
    const files = fs.readdirSync(packDir);
    for (const file of files) {
      fs.unlinkSync(path.join(packDir, file));
    }

    // Remove the directory
    fs.rmdirSync(packDir);
    return true;
  }

  /**
   * Get pack info
   */
  getPackInfo(packId: string): {
    id: string;
    name: string;
    voiceId: string;
    language: string;
    generatedAt: string;
    totalFiles: number;
    files: string[];
  } | null {
    const packDir = path.join(this.outputDir, packId);
    const metadataPath = path.join(packDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const files = fs.readdirSync(packDir).filter((f) => f.endsWith('.mp3'));

      return {
        id: metadata.id,
        name: metadata.name,
        voiceId: metadata.voiceId,
        language: metadata.language,
        generatedAt: metadata.generatedAt,
        totalFiles: metadata.totalFiles,
        files,
      };
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createVoicePackGenerator(
  elevenLabsService: ElevenLabsService,
  outputDir: string
): VoicePackGenerator {
  return new VoicePackGenerator(elevenLabsService, outputDir);
}
