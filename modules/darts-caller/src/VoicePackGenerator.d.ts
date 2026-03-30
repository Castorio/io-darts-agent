/**
 * Voice Pack Generator
 *
 * Generates complete voice packs for darts caller using ElevenLabs TTS
 */
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
export declare class VoicePackGenerator {
    private elevenLabsService;
    private outputDir;
    private currentProgress;
    private cancelRequested;
    private progressCallbacks;
    constructor(elevenLabsService: ElevenLabsService, outputDir: string);
    /**
     * Subscribe to progress updates
     */
    onProgress(callback: (progress: GenerationProgress) => void): () => void;
    /**
     * Emit progress update
     */
    private emitProgress;
    /**
     * Get current progress
     */
    getProgress(): GenerationProgress | null;
    /**
     * Check if generation is in progress
     */
    isGenerating(): boolean;
    /**
     * Cancel current generation
     */
    cancel(): void;
    /**
     * Generate a complete voice pack
     */
    generate(config: VoicePackConfig): Promise<GenerationProgress>;
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
    }>;
    /**
     * Delete a voice pack
     */
    deletePack(packId: string): boolean;
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
    } | null;
    private delay;
}
export declare function createVoicePackGenerator(elevenLabsService: ElevenLabsService, outputDir: string): VoicePackGenerator;
//# sourceMappingURL=VoicePackGenerator.d.ts.map