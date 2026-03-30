/**
 * Local Audio Player
 *
 * Plays audio files locally on the server using system audio
 */
export interface LocalAudioPlayerConfig {
    volume?: number;
    player?: string;
    tempDir?: string;
}
/**
 * Local audio player that plays audio on the server machine
 */
export declare class LocalAudioPlayer {
    private config;
    private queue;
    private isPlaying;
    private currentProcess;
    private tempDir;
    private tempFiles;
    constructor(config?: LocalAudioPlayerConfig);
    private ensureTempDir;
    /**
     * Get the appropriate audio player command for the current OS
     */
    private getPlayerCommand;
    /**
     * Set volume (0-100)
     */
    setVolume(volume: number): void;
    /**
     * Get current volume
     */
    getVolume(): number;
    /**
     * Play an audio file
     */
    playFile(filePath: string, priority?: number, text?: string): Promise<void>;
    /**
     * Play audio from a buffer (writes to temp file first)
     */
    playBuffer(buffer: Buffer, priority?: number, text?: string): Promise<void>;
    /**
     * Add audio to queue
     */
    private enqueue;
    /**
     * Process the audio queue
     */
    private processQueue;
    /**
     * Internal method to play a file using system command
     */
    private playFileInternal;
    /**
     * Try fallback audio players on Linux
     */
    private tryFallbackPlayer;
    /**
     * Stop current playback and clear queue
     */
    stop(): void;
    /**
     * Skip current audio and play next in queue
     */
    skip(): void;
    /**
     * Get queue length
     */
    getQueueLength(): number;
    /**
     * Check if currently playing
     */
    getIsPlaying(): boolean;
    /**
     * Clean up temp files
     */
    cleanup(): void;
}
/**
 * Create a local audio player instance
 */
export declare function createLocalAudioPlayer(config?: LocalAudioPlayerConfig): LocalAudioPlayer;
//# sourceMappingURL=LocalAudioPlayer.d.ts.map