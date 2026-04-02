/**
 * ElevenLabs Text-to-Speech Service
 *
 * Provides high-quality TTS using the ElevenLabs API
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * ElevenLabs voice model
 */
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

/**
 * ElevenLabs voice settings
 */
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

/**
 * ElevenLabs configuration
 */
export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  cacheDir?: string;
  enableCache?: boolean;
}

/**
 * Generation options
 */
export interface GenerationOptions {
  voiceId?: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_22050' | 'pcm_44100';
  /** Language code for pronunciation (e.g., 'de' for German, 'en' for English) */
  languageCode?: string;
  /** Previous text for context (not included in output, helps with pronunciation) */
  previousText?: string;
  /** Next text for context (not included in output, helps with pronunciation) */
  nextText?: string;
}

/**
 * Cache entry metadata
 */
interface CacheEntry {
  text: string;
  voiceId: string;
  modelId: string;
  createdAt: number;
  filePath: string;
}

/**
 * Default voice settings
 */
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
};

/**
 * Default model ID (multilingual v2)
 */
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

/**
 * ElevenLabs API base URL
 */
const API_BASE_URL = 'https://api.elevenlabs.io/v1';

export class ElevenLabsService {
  private config: ElevenLabsConfig;
  private cacheIndex: Map<string, CacheEntry> = new Map();
  private initialized = false;

  constructor(config: ElevenLabsConfig) {
    this.config = {
      ...config,
      cacheDir: config.cacheDir || './cache/elevenlabs',
      enableCache: config.enableCache ?? true,
    };
  }

  /**
   * Initialize the service
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Create cache directory
    if (this.config.enableCache && this.config.cacheDir) {
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      }

      // Load cache index
      await this.loadCacheIndex();
    }

    this.initialized = true;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Get the current API key (for comparison)
   */
  getApiKey(): string {
    return this.config.apiKey;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ElevenLabsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${API_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch voices: ${response.status} - ${error}`);
    }

    const data = await response.json() as { voices: ElevenLabsVoice[] };
    return data.voices;
  }

  /**
   * Get a specific voice
   */
  async getVoice(voiceId: string): Promise<ElevenLabsVoice | null> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${API_BASE_URL}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': this.config.apiKey,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch voice: ${response.status} - ${error}`);
    }

    return response.json() as Promise<ElevenLabsVoice>;
  }

  /**
   * Generate speech from text
   */
  async generateSpeech(
    text: string,
    options?: GenerationOptions
  ): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const voiceId = options?.voiceId || this.config.voiceId;
    if (!voiceId) {
      throw new Error('Voice ID not specified');
    }

    const modelId = options?.modelId || this.config.modelId || DEFAULT_MODEL_ID;
    const voiceSettings = options?.voiceSettings || this.config.voiceSettings || DEFAULT_VOICE_SETTINGS;

    // Check cache first
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(text, voiceId, modelId);
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Build request body
    const requestBody: Record<string, unknown> = {
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    };

    // Add language_code for multilingual models to ensure correct pronunciation
    // This is especially important for names which can be pronounced differently in different languages
    if (options?.languageCode) {
      requestBody.language_code = options.languageCode;
      console.log(`🌐 Using language code: ${options.languageCode} for TTS`);
    }

    // Add previous_text and next_text for contextual pronunciation
    // These are NOT included in the output but help ElevenLabs understand the language context
    // This is particularly useful for names that might otherwise be mispronounced
    if (options?.previousText) {
      requestBody.previous_text = options.previousText;
      console.log(`🌐 Using previous_text context: "${options.previousText}"`);
    }
    if (options?.nextText) {
      requestBody.next_text = options.nextText;
      console.log(`🌐 Using next_text context: "${options.nextText}"`);
    }

    // Generate speech
    const response = await fetch(
      `${API_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate speech: ${response.status} - ${error}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Save to cache
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(text, voiceId, modelId);
      await this.saveToCache(cacheKey, audioBuffer, text, voiceId, modelId);
    }

    return audioBuffer;
  }

  /**
   * Generate speech and save to file
   */
  async generateSpeechToFile(
    text: string,
    outputPath: string,
    options?: GenerationOptions
  ): Promise<string> {
    const audioBuffer = await this.generateSpeech(text, options);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, audioBuffer);
    return outputPath;
  }

  /**
   * Get user subscription info
   */
  async getSubscriptionInfo(): Promise<{
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
    allowed_to_extend_character_limit: boolean;
    next_character_count_reset_unix: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${API_BASE_URL}/user/subscription`, {
      headers: {
        'xi-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch subscription: ${response.status} - ${error}`);
    }

    return response.json() as Promise<{
      character_count: number;
      character_limit: number;
      can_extend_character_limit: boolean;
      allowed_to_extend_character_limit: boolean;
      next_character_count_reset_unix: number;
    }>;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(text: string, voiceId: string, modelId: string): string {
    const data = `${text}|${voiceId}|${modelId}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get audio from cache
   */
  private async getFromCache(cacheKey: string): Promise<Buffer | null> {
    const entry = this.cacheIndex.get(cacheKey);
    if (!entry) return null;

    if (fs.existsSync(entry.filePath)) {
      return fs.readFileSync(entry.filePath);
    }

    // Entry exists but file missing - remove from index
    this.cacheIndex.delete(cacheKey);
    return null;
  }

  /**
   * Save audio to cache
   */
  private async saveToCache(
    cacheKey: string,
    audio: Buffer,
    text: string,
    voiceId: string,
    modelId: string
  ): Promise<void> {
    if (!this.config.cacheDir) return;

    const filePath = path.join(this.config.cacheDir, `${cacheKey}.mp3`);
    fs.writeFileSync(filePath, audio);

    const entry: CacheEntry = {
      text,
      voiceId,
      modelId,
      createdAt: Date.now(),
      filePath,
    };

    this.cacheIndex.set(cacheKey, entry);
    await this.saveCacheIndex();
  }

  /**
   * Load cache index
   */
  private async loadCacheIndex(): Promise<void> {
    if (!this.config.cacheDir) return;

    const indexPath = path.join(this.config.cacheDir, 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        this.cacheIndex = new Map(Object.entries(data));
      } catch {
        this.cacheIndex = new Map();
      }
    }
  }

  /**
   * Save cache index
   */
  private async saveCacheIndex(): Promise<void> {
    if (!this.config.cacheDir) return;

    const indexPath = path.join(this.config.cacheDir, 'index.json');
    const data = Object.fromEntries(this.cacheIndex);
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (!this.config.cacheDir) return;

    for (const [, entry] of this.cacheIndex) {
      if (fs.existsSync(entry.filePath)) {
        fs.unlinkSync(entry.filePath);
      }
    }

    this.cacheIndex.clear();
    await this.saveCacheIndex();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { entries: number; sizeBytes: number } {
    let sizeBytes = 0;

    for (const entry of this.cacheIndex.values()) {
      if (fs.existsSync(entry.filePath)) {
        const stats = fs.statSync(entry.filePath);
        sizeBytes += stats.size;
      }
    }

    return {
      entries: this.cacheIndex.size,
      sizeBytes,
    };
  }
}

/**
 * Create ElevenLabs service from config
 */
export function createElevenLabsService(
  config: ElevenLabsConfig | Record<string, unknown>
): ElevenLabsService {
  return new ElevenLabsService(config as ElevenLabsConfig);
}
