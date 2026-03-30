/**
 * ElevenLabs Text-to-Speech Service
 *
 * Provides high-quality TTS using the ElevenLabs API
 */
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
}
export declare class ElevenLabsService {
    private config;
    private cacheIndex;
    private initialized;
    constructor(config: ElevenLabsConfig);
    /**
     * Initialize the service
     */
    init(): Promise<void>;
    /**
     * Check if API key is configured
     */
    isConfigured(): boolean;
    /**
     * Get the current API key (for comparison)
     */
    getApiKey(): string;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<ElevenLabsConfig>): void;
    /**
     * Get available voices
     */
    getVoices(): Promise<ElevenLabsVoice[]>;
    /**
     * Get a specific voice
     */
    getVoice(voiceId: string): Promise<ElevenLabsVoice | null>;
    /**
     * Generate speech from text
     */
    generateSpeech(text: string, options?: GenerationOptions): Promise<Buffer>;
    /**
     * Generate speech and save to file
     */
    generateSpeechToFile(text: string, outputPath: string, options?: GenerationOptions): Promise<string>;
    /**
     * Get user subscription info
     */
    getSubscriptionInfo(): Promise<{
        character_count: number;
        character_limit: number;
        can_extend_character_limit: boolean;
        allowed_to_extend_character_limit: boolean;
        next_character_count_reset_unix: number;
    }>;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Get audio from cache
     */
    private getFromCache;
    /**
     * Save audio to cache
     */
    private saveToCache;
    /**
     * Load cache index
     */
    private loadCacheIndex;
    /**
     * Save cache index
     */
    private saveCacheIndex;
    /**
     * Clear cache
     */
    clearCache(): Promise<void>;
    /**
     * Get cache stats
     */
    getCacheStats(): {
        entries: number;
        sizeBytes: number;
    };
}
/**
 * Create ElevenLabs service from config
 */
export declare function createElevenLabsService(config: ElevenLabsConfig | Record<string, unknown>): ElevenLabsService;
//# sourceMappingURL=ElevenLabsService.d.ts.map