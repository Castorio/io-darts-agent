/**
 * Darts Caller Module Event Handler
 *
 * Processes Autodarts events and generates speech/audio calls
 * Audio is played locally on the server machine
 */
import type { ParsedEvent } from '../../../src/types/index.js';
import type { ElevenLabsService } from './ElevenLabsService.js';
/**
 * Caller type options
 */
export type CallerType = 'tts' | 'audio' | 'elevenlabs' | 'voicepack';
/**
 * Call request for the frontend
 */
export interface CallRequest {
    id: string;
    type: 'score' | 'checkout' | 'player' | 'game' | 'special';
    text: string;
    audioFile?: string;
    priority: number;
    timestamp: number;
}
/**
 * ElevenLabs configuration
 */
export interface ElevenLabsCallerConfig {
    apiKey?: string;
    voiceId?: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    enableCache?: boolean;
}
/**
 * Darts Caller configuration
 */
export interface DartsCallerConfig {
    enabled?: boolean;
    callerType?: CallerType;
    ttsVoice?: string;
    ttsRate?: number;
    ttsPitch?: number;
    volume?: number;
    audioPackPath?: string;
    voicePackId?: string;
    voicePacksDir?: string;
    callScores?: boolean;
    callHighScoresOnly?: boolean;
    callCheckouts?: boolean;
    callPlayerChange?: boolean;
    callGameStart?: boolean;
    callGameOver?: boolean;
    call180?: boolean;
    callBusts?: boolean;
    delayMs?: number;
    language?: string;
    elevenlabs?: ElevenLabsCallerConfig;
}
/**
 * Callback for call requests
 */
export type CallRequestCallback = (request: CallRequest) => void;
/**
 * Darts Caller Handler class
 */
export declare class DartsCallerHandler {
    private config;
    private callbackQueue;
    private callRequestCallbacks;
    private callIdCounter;
    private elevenLabsService;
    private voicePackCache;
    private audioPlayer;
    private stats;
    constructor(config: DartsCallerConfig);
    /**
     * Set ElevenLabs service for TTS
     */
    setElevenLabsService(service: ElevenLabsService | null): void;
    /**
     * Get ElevenLabs service
     */
    getElevenLabsService(): ElevenLabsService | null;
    /**
     * Register a callback for call requests
     */
    onCallRequest(callback: CallRequestCallback): () => void;
    /**
     * Emit a call request to all subscribers
     */
    private emitCallRequest;
    /**
     * Update configuration
     */
    updateConfig(config: DartsCallerConfig): void;
    /**
     * Get current configuration
     */
    getConfig(): DartsCallerConfig;
    /**
     * Check if caller is enabled
     */
    isEnabled(): boolean;
    /**
     * Get statistics
     */
    getStats(): typeof this.stats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Set the voice packs directory
     */
    setVoicePacksDir(dir: string): void;
    /**
     * Get available voice packs
     */
    getAvailableVoicePacks(): Array<{
        id: string;
        name: string;
        language: string;
    }>;
    /**
     * Clear voice pack cache
     */
    clearVoicePackCache(): void;
    /**
     * Handle an event
     */
    handleEvent(event: ParsedEvent): Promise<void>;
    /**
     * Handle turn finished event
     */
    private handleTurnFinished;
    /**
     * Check if a checkout is possible
     */
    private isCheckoutPossible;
    /**
     * Convert score to spoken text
     */
    private scoreToText;
    /**
     * Convert number to text (0-99)
     */
    private numberToText;
    /**
     * Get audio file name for a score
     */
    private scoreToAudioFile;
    /**
     * Generate and play audio locally on the server
     */
    private generateCall;
    /**
     * Resolve audio file path
     */
    private resolveAudioFile;
    /**
     * Get pending calls in the queue
     */
    getPendingCalls(): CallRequest[];
    /**
     * Clear the call queue
     */
    clearQueue(): void;
    /**
     * Stop current audio playback
     */
    stopPlayback(): void;
    /**
     * Skip current audio and play next
     */
    skipCurrent(): void;
    /**
     * Get audio player status
     */
    getAudioStatus(): {
        isPlaying: boolean;
        queueLength: number;
    };
    /**
     * Cleanup resources
     */
    cleanup(): void;
}
/**
 * Create Darts Caller handler from module config
 */
export declare function createDartsCallerHandler(config: Record<string, unknown>): DartsCallerHandler;
//# sourceMappingURL=DartsCallerHandler.d.ts.map