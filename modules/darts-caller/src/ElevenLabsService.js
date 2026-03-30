/**
 * ElevenLabs Text-to-Speech Service
 *
 * Provides high-quality TTS using the ElevenLabs API
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
/**
 * Default voice settings
 */
const DEFAULT_VOICE_SETTINGS = {
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
    config;
    cacheIndex = new Map();
    initialized = false;
    constructor(config) {
        this.config = {
            ...config,
            cacheDir: config.cacheDir || './cache/elevenlabs',
            enableCache: config.enableCache ?? true,
        };
    }
    /**
     * Initialize the service
     */
    async init() {
        if (this.initialized)
            return;
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
    isConfigured() {
        return !!this.config.apiKey;
    }
    /**
     * Get the current API key (for comparison)
     */
    getApiKey() {
        return this.config.apiKey;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get available voices
     */
    async getVoices() {
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
        const data = await response.json();
        return data.voices;
    }
    /**
     * Get a specific voice
     */
    async getVoice(voiceId) {
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
        return response.json();
    }
    /**
     * Generate speech from text
     */
    async generateSpeech(text, options) {
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
        // Generate speech
        const response = await fetch(`${API_BASE_URL}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': this.config.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: modelId,
                voice_settings: voiceSettings,
            }),
        });
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
    async generateSpeechToFile(text, outputPath, options) {
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
    async getSubscriptionInfo() {
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
        return response.json();
    }
    /**
     * Generate cache key
     */
    getCacheKey(text, voiceId, modelId) {
        const data = `${text}|${voiceId}|${modelId}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }
    /**
     * Get audio from cache
     */
    async getFromCache(cacheKey) {
        const entry = this.cacheIndex.get(cacheKey);
        if (!entry)
            return null;
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
    async saveToCache(cacheKey, audio, text, voiceId, modelId) {
        if (!this.config.cacheDir)
            return;
        const filePath = path.join(this.config.cacheDir, `${cacheKey}.mp3`);
        fs.writeFileSync(filePath, audio);
        const entry = {
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
    async loadCacheIndex() {
        if (!this.config.cacheDir)
            return;
        const indexPath = path.join(this.config.cacheDir, 'index.json');
        if (fs.existsSync(indexPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
                this.cacheIndex = new Map(Object.entries(data));
            }
            catch {
                this.cacheIndex = new Map();
            }
        }
    }
    /**
     * Save cache index
     */
    async saveCacheIndex() {
        if (!this.config.cacheDir)
            return;
        const indexPath = path.join(this.config.cacheDir, 'index.json');
        const data = Object.fromEntries(this.cacheIndex);
        fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
    }
    /**
     * Clear cache
     */
    async clearCache() {
        if (!this.config.cacheDir)
            return;
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
    getCacheStats() {
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
export function createElevenLabsService(config) {
    return new ElevenLabsService(config);
}
//# sourceMappingURL=ElevenLabsService.js.map