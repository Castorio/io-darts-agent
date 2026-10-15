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

/**
 * A pack id is used as a folder name below the voice pack directory,
 * so it must be a single plain path segment.
 */
export function isValidPackId(packId: unknown): packId is string {
  return (
    typeof packId === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(packId) &&
    !packId.includes('..')
  );
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

    if (!isValidPackId(config.packId)) {
      throw new Error('Invalid voice pack id');
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
    if (!isValidPackId(packId)) return false;
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
    if (!isValidPackId(packId)) return null;
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

  /**
   * Check if a player name audio file exists in a pack
   */
  hasPlayerName(packId: string, playerName: string): boolean {
    if (!isValidPackId(packId)) return false;
    const packDir = path.join(this.outputDir, packId);
    const filename = this.sanitizePlayerNameForFilename(playerName);
    const filePath = path.join(packDir, `player_${filename}.mp3`);
    return fs.existsSync(filePath);
  }

  /**
   * Get existing player names in a pack
   */
  getExistingPlayerNames(packId: string): string[] {
    if (!isValidPackId(packId)) return [];
    const packDir = path.join(this.outputDir, packId);

    if (!fs.existsSync(packDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(packDir);
      return files
        .filter((f) => f.startsWith('player_') && f.endsWith('.mp3'))
        .map((f) => f.slice(7, -4)); // Remove 'player_' prefix and '.mp3' suffix
    } catch {
      return [];
    }
  }

  /**
   * Generate a single player name audio file on-demand
   * @param packId - Voice pack ID
   * @param playerName - Player name to generate
   * @param voiceId - ElevenLabs voice ID
   * @param options - Generation options including language for proper pronunciation
   */
  async generatePlayerName(
    packId: string,
    playerName: string,
    voiceId: string,
    options?: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      language?: string;
    }
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!isValidPackId(packId)) return { success: false, error: 'Invalid voice pack id' };
    const packDir = path.join(this.outputDir, packId);
    const filename = this.sanitizePlayerNameForFilename(playerName);
    const outputPath = path.join(packDir, `player_${filename}.mp3`);

    // Check if already exists
    if (fs.existsSync(outputPath)) {
      console.log(`✅ Player name audio already exists: ${outputPath}`);
      return { success: true, filePath: outputPath };
    }

    // Ensure pack directory exists
    if (!fs.existsSync(packDir)) {
      fs.mkdirSync(packDir, { recursive: true });
    }

    try {
      // Determine the appropriate model based on language
      // ElevenLabs multilingual_v2 supports many languages
      // For German, we can also use the turbo_v2_5 model which has good German support
      let modelId = options?.modelId;
      if (!modelId && options?.language) {
        // Use eleven_multilingual_v2 for non-English languages by default
        // This model has better pronunciation for names in different languages
        if (options.language !== 'en') {
          modelId = 'eleven_multilingual_v2';
        }
      }

      // Get language-specific context phrases to help ElevenLabs pronounce the name correctly
      // The previous_text and next_text parameters provide context WITHOUT being included in the output
      const contextPhrases = this.getLanguageContextForPlayerName(options?.language);

      console.log(`🎤 Generating player name audio for: "${playerName}" (language: ${options?.language ?? 'default'}, model: ${modelId ?? 'default'}, context: ${contextPhrases.previousText || 'none'})`);

      await this.elevenLabsService.generateSpeechToFile(
        playerName,
        outputPath,
        {
          voiceId,
          modelId,
          voiceSettings: {
            stability: options?.stability ?? 0.5,
            similarity_boost: options?.similarityBoost ?? 0.75,
          },
          // Pass language code for proper pronunciation of names
          languageCode: options?.language,
          // Add language context phrases - these help ElevenLabs understand the language
          // without being included in the actual audio output
          previousText: contextPhrases.previousText,
          nextText: contextPhrases.nextText,
        }
      );

      console.log(`✅ Generated player name audio: ${outputPath}`);
      return { success: true, filePath: outputPath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to generate player name audio for "${playerName}":`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Generate multiple player names (batch operation)
   * @param packId - Voice pack ID
   * @param playerNames - Array of player names to generate
   * @param voiceId - ElevenLabs voice ID
   * @param options - Generation options including language for proper pronunciation
   */
  async generatePlayerNames(
    packId: string,
    playerNames: string[],
    voiceId: string,
    options?: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      language?: string;
    }
  ): Promise<{
    success: boolean;
    generated: string[];
    skipped: string[];
    failed: Array<{ name: string; error: string }>;
  }> {
    const generated: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const name of playerNames) {
      // Check if already exists
      if (this.hasPlayerName(packId, name)) {
        skipped.push(name);
        continue;
      }

      const result = await this.generatePlayerName(packId, name, voiceId, options);

      if (result.success) {
        generated.push(name);
      } else {
        failed.push({ name, error: result.error || 'Unknown error' });
      }

      // Small delay between API calls to avoid rate limiting
      if (generated.length > 0 || failed.length > 0) {
        await this.delay(100);
      }
    }

    return {
      success: failed.length === 0,
      generated,
      skipped,
      failed,
    };
  }

  /**
   * Sanitize player name for use as filename
   * Converts to lowercase, replaces spaces with underscores, removes special characters
   */
  private sanitizePlayerNameForFilename(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_äöüß]/gi, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Get the audio file path for a player name
   */
  getPlayerNameAudioPath(packId: string, playerName: string): string | null {
    if (!isValidPackId(packId)) return null;
    const packDir = path.join(this.outputDir, packId);
    const filename = this.sanitizePlayerNameForFilename(playerName);
    const filePath = path.join(packDir, `player_${filename}.mp3`);

    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get language-specific context phrases for player name pronunciation
   *
   * ElevenLabs supports previous_text and next_text parameters that provide
   * context for pronunciation WITHOUT being included in the audio output.
   * This is the cleanest way to ensure correct language pronunciation for names.
   *
   * The context phrases help ElevenLabs:
   * 1. Understand the target language for proper phonetics
   * 2. Apply appropriate intonation and accent
   * 3. Handle language-specific characters correctly (ä, ö, ü, ß, etc.)
   */
  private getLanguageContextForPlayerName(language?: string): { previousText?: string; nextText?: string } {
    // If no language specified or English, no context needed
    if (!language || language === 'en') {
      return {};
    }

    // Language-specific context phrases
    // These are NOT spoken, they just set the language context
    const contextPhrases: Record<string, { previousText: string; nextText: string }> = {
      // German context - typical darts announcer phrases
      'de': {
        previousText: 'Und es spielt jetzt am Oche:',
        nextText: 'ist am Wurf.',
      },
      // Spanish context
      'es': {
        previousText: 'Y ahora en la línea de tiro:',
        nextText: 'está tirando.',
      },
      // French context
      'fr': {
        previousText: 'Et maintenant au pas de tir:',
        nextText: 'lance ses fléchettes.',
      },
      // Dutch context
      'nl': {
        previousText: 'En nu aan de oche:',
        nextText: 'gooit.',
      },
      // Italian context
      'it': {
        previousText: 'E ora alla linea di tiro:',
        nextText: 'sta lanciando.',
      },
    };

    return contextPhrases[language] || {};
  }

  /**
   * Get the output directory path
   */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * Import a voice pack from extracted files
   * @param tempDir - Directory containing extracted pack files
   * @returns Import result with pack info or error
   */
  async importPack(tempDir: string): Promise<{
    success: boolean;
    packId?: string;
    packName?: string;
    error?: string;
  }> {
    try {
      // Find metadata.json - could be in root or in a subdirectory
      let metadataPath = path.join(tempDir, 'metadata.json');
      let sourceDir = tempDir;

      if (!fs.existsSync(metadataPath)) {
        // Check if there's a single subdirectory containing metadata.json
        const entries = fs.readdirSync(tempDir, { withFileTypes: true });
        const subdirs = entries.filter(e => e.isDirectory());

        for (const subdir of subdirs) {
          const subMetadataPath = path.join(tempDir, subdir.name, 'metadata.json');
          if (fs.existsSync(subMetadataPath)) {
            metadataPath = subMetadataPath;
            sourceDir = path.join(tempDir, subdir.name);
            break;
          }
        }

        if (!fs.existsSync(metadataPath)) {
          return {
            success: false,
            error: 'No metadata.json found in the ZIP file',
          };
        }
      }

      // Parse metadata
      let metadata: {
        id?: string;
        name?: string;
        voiceId?: string;
        language?: string;
        generatedAt?: string;
        totalFiles?: number;
        successfulFiles?: number;
      };

      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      } catch {
        return {
          success: false,
          error: 'Invalid metadata.json format',
        };
      }

      // Validate required fields
      if (!metadata.id || !metadata.name) {
        return {
          success: false,
          error: 'metadata.json must contain id and name fields',
        };
      }

      const packId = metadata.id;
      if (!isValidPackId(packId)) {
        return { success: false, error: 'metadata.json contains an invalid pack id' };
      }
      const packDir = path.join(this.outputDir, packId);

      // Check if pack already exists
      if (fs.existsSync(packDir)) {
        return {
          success: false,
          error: `Voice pack '${packId}' already exists. Delete it first to import a new version.`,
        };
      }

      // Create pack directory
      fs.mkdirSync(packDir, { recursive: true });

      // Copy all files from source to pack directory
      const files = fs.readdirSync(sourceDir);
      let copiedCount = 0;

      for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(packDir, file);

        // Only copy files (not directories)
        const stat = fs.statSync(sourcePath);
        if (stat.isFile()) {
          fs.copyFileSync(sourcePath, destPath);
          copiedCount++;
        }
      }

      // Update metadata with import info
      const updatedMetadata = {
        ...metadata,
        importedAt: new Date().toISOString(),
        importedFiles: copiedCount,
      };

      fs.writeFileSync(
        path.join(packDir, 'metadata.json'),
        JSON.stringify(updatedMetadata, null, 2)
      );

      return {
        success: true,
        packId,
        packName: metadata.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown import error',
      };
    }
  }
}

export function createVoicePackGenerator(
  elevenLabsService: ElevenLabsService,
  outputDir: string
): VoicePackGenerator {
  return new VoicePackGenerator(elevenLabsService, outputDir);
}
