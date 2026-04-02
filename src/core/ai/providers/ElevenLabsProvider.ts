/**
 * ElevenLabs Provider
 *
 * Provider implementation for ElevenLabs TTS API
 */

import { BaseAIProvider } from '../AIProvider.js';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AICapability,
  TTSRequest,
  TTSResponse,
} from '../types.js';

/**
 * ElevenLabs voice info
 */
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

/**
 * ElevenLabs-specific configuration
 */
export interface ElevenLabsProviderConfig extends AIProviderConfig {
  type: 'elevenlabs';
  options?: {
    /** Default model */
    model?: string;
    /** Default voice ID */
    defaultVoice?: string;
    /** Stability (0-1) */
    stability?: number;
    /** Similarity boost (0-1) */
    similarityBoost?: number;
    /** Style (0-1) */
    style?: number;
    /** Use speaker boost */
    useSpeakerBoost?: boolean;
  };
}

/**
 * ElevenLabs Provider implementation
 */
export class ElevenLabsProvider extends BaseAIProvider {
  readonly capabilities: AICapability[] = ['audio-tts'];

  private baseUrl = 'https://api.elevenlabs.io/v1';
  private voicesCache: ElevenLabsVoice[] | null = null;
  private subscriptionCache: {
    character_count: number;
    character_limit: number;
  } | null = null;

  constructor(config: ElevenLabsProviderConfig) {
    super(config);
  }

  protected override getAuthHeaders(): Record<string, string> {
    return {
      'xi-api-key': this.config.apiKey,
    };
  }

  /**
   * Get provider status with subscription info
   */
  override async getStatus(): Promise<AIProviderStatus> {
    const baseStatus = await super.getStatus();

    // Only verify API if provider is configured (has API key)
    // This allows testing the connection even when disabled
    if (baseStatus.configured) {
      try {
        // Clear cache to force fresh API call
        this.subscriptionCache = null;
        const subscription = await this.getSubscription();
        baseStatus.rateLimit = {
          remaining: subscription.character_limit - subscription.character_count,
          total: subscription.character_limit,
        };
        // API call succeeded, mark as available (connection works)
        // Note: available for actual use still depends on enabled state
        baseStatus.available = this.isAvailable();
      } catch (error) {
        baseStatus.available = false;
        // Parse error to provide more specific feedback
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          baseStatus.error = 'Invalid API key';
        } else if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
          baseStatus.error = 'Connection timeout';
        } else if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
          baseStatus.error = 'Network error - check your internet connection';
        } else {
          baseStatus.error = `Connection failed: ${errorMessage.substring(0, 100)}`;
        }
      }
    }

    return baseStatus;
  }

  /**
   * Get subscription info
   */
  async getSubscription(): Promise<{
    character_count: number;
    character_limit: number;
  }> {
    if (!this.subscriptionCache) {
      const response = await this.fetchJson<{
        character_count: number;
        character_limit: number;
      }>(`${this.baseUrl}/user/subscription`, {
        method: 'GET',
      });
      this.subscriptionCache = response;
    }
    return this.subscriptionCache;
  }

  /**
   * Get available voices
   */
  async getVoices(forceRefresh = false): Promise<ElevenLabsVoice[]> {
    if (!this.voicesCache || forceRefresh) {
      const response = await this.fetchJson<{ voices: ElevenLabsVoice[] }>(
        `${this.baseUrl}/voices`,
        { method: 'GET' }
      );
      this.voicesCache = response.voices;
    }
    return this.voicesCache;
  }

  /**
   * Find voice by name or ID
   */
  async findVoice(nameOrId: string): Promise<ElevenLabsVoice | undefined> {
    const voices = await this.getVoices();
    return voices.find(
      (v) =>
        v.voice_id === nameOrId ||
        v.name.toLowerCase() === nameOrId.toLowerCase()
    );
  }

  /**
   * Generate speech
   */
  async generateSpeech(request: TTSRequest): Promise<TTSResponse> {
    const options = (this.config as ElevenLabsProviderConfig).options;
    const model = request.model || options?.model || 'eleven_multilingual_v2';

    // Resolve voice ID
    let voiceId = request.voice;
    if (!voiceId.match(/^[a-zA-Z0-9]{20,}$/)) {
      // Looks like a name, try to resolve
      const voice = await this.findVoice(voiceId);
      if (voice) {
        voiceId = voice.voice_id;
      } else {
        // Use default voice
        voiceId = options?.defaultVoice || '21m00Tcm4TlvDq8ikWAM'; // Rachel
      }
    }

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: this.getAudioMimeType(request.format || 'mp3'),
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          text: request.text,
          model_id: model,
          voice_settings: {
            stability: request.stability ?? options?.stability ?? 0.5,
            similarity_boost: request.similarityBoost ?? options?.similarityBoost ?? 0.75,
            style: options?.style ?? 0,
            use_speaker_boost: options?.useSpeakerBoost ?? true,
          },
        }),
      }
    );

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Invalidate subscription cache (character count changed)
    this.subscriptionCache = null;

    return {
      audioBase64: base64,
      model,
      charactersUsed: request.text.length,
    };
  }

  /**
   * Generate speech and save to file
   */
  async generateSpeechToFile(
    request: TTSRequest,
    outputPath: string
  ): Promise<TTSResponse> {
    const response = await this.generateSpeech(request);

    if (response.audioBase64) {
      const fs = await import('fs');
      const path = await import('path');

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(outputPath, Buffer.from(response.audioBase64, 'base64'));
      response.audioUrl = outputPath;
    }

    return response;
  }

  /**
   * Get audio MIME type
   */
  private getAudioMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };
    return mimeTypes[format] || 'audio/mpeg';
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.voicesCache = null;
    this.subscriptionCache = null;
  }
}

/**
 * Create ElevenLabs provider
 */
export function createElevenLabsProvider(
  config: ElevenLabsProviderConfig
): ElevenLabsProvider {
  return new ElevenLabsProvider(config);
}
