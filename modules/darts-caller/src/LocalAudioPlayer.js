/**
 * Local Audio Player
 *
 * Plays audio files locally on the server using system audio
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
/**
 * Local audio player that plays audio on the server machine
 */
export class LocalAudioPlayer {
    config;
    queue = [];
    isPlaying = false;
    currentProcess = null;
    tempDir;
    tempFiles = new Set();
    constructor(config = {}) {
        this.config = {
            volume: 80,
            ...config,
        };
        this.tempDir = config.tempDir || path.join(os.tmpdir(), 'darts-caller-audio');
        this.ensureTempDir();
    }
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Get the appropriate audio player command for the current OS
     */
    getPlayerCommand() {
        const platform = os.platform();
        // Allow override via config
        if (this.config.player) {
            return {
                cmd: this.config.player,
                args: (filePath) => [filePath],
            };
        }
        switch (platform) {
            case 'darwin': // macOS
                return {
                    cmd: 'afplay',
                    args: (filePath) => {
                        const args = [filePath];
                        // afplay volume is 0-1, convert from 0-100
                        if (this.config.volume !== undefined) {
                            args.push('-v', String(this.config.volume / 100));
                        }
                        return args;
                    },
                };
            case 'win32': // Windows
                return {
                    cmd: 'powershell',
                    args: (filePath) => [
                        '-c',
                        `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`,
                    ],
                };
            case 'linux':
            default:
                // Try aplay (ALSA), paplay (PulseAudio), or mpg123
                return {
                    cmd: 'mpg123',
                    args: (filePath) => {
                        const args = ['-q', filePath]; // -q for quiet mode
                        return args;
                    },
                };
        }
    }
    /**
     * Set volume (0-100)
     */
    setVolume(volume) {
        this.config.volume = Math.max(0, Math.min(100, volume));
    }
    /**
     * Get current volume
     */
    getVolume() {
        return this.config.volume ?? 80;
    }
    /**
     * Play an audio file
     */
    async playFile(filePath, priority = 5, text) {
        if (!fs.existsSync(filePath)) {
            console.error(`Audio file not found: ${filePath}`);
            return;
        }
        const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.enqueue({ id, filePath, priority, text });
    }
    /**
     * Play audio from a buffer (writes to temp file first)
     */
    async playBuffer(buffer, priority = 5, text) {
        const id = `buffer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.enqueue({ id, buffer, priority, text });
    }
    /**
     * Add audio to queue
     */
    enqueue(audio) {
        // Insert by priority (higher priority = earlier in queue)
        let insertIndex = this.queue.length;
        for (let i = 0; i < this.queue.length; i++) {
            if (audio.priority > this.queue[i].priority) {
                insertIndex = i;
                break;
            }
        }
        this.queue.splice(insertIndex, 0, audio);
        // Start processing if not already playing
        if (!this.isPlaying) {
            this.processQueue();
        }
    }
    /**
     * Process the audio queue
     */
    async processQueue() {
        if (this.isPlaying || this.queue.length === 0) {
            return;
        }
        this.isPlaying = true;
        while (this.queue.length > 0) {
            const audio = this.queue.shift();
            let filePath = audio.filePath;
            try {
                // If we have a buffer, write it to a temp file
                if (audio.buffer && !filePath) {
                    filePath = path.join(this.tempDir, `${audio.id}.mp3`);
                    fs.writeFileSync(filePath, audio.buffer);
                    this.tempFiles.add(filePath);
                }
                if (filePath) {
                    if (audio.text) {
                        console.log(`🔊 Playing: "${audio.text}"`);
                    }
                    await this.playFileInternal(filePath);
                }
            }
            catch (error) {
                console.error('Error playing audio:', error);
            }
            finally {
                // Clean up temp file if we created one
                if (audio.buffer && filePath && this.tempFiles.has(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        this.tempFiles.delete(filePath);
                    }
                    catch {
                        // Ignore cleanup errors
                    }
                }
            }
        }
        this.isPlaying = false;
    }
    /**
     * Internal method to play a file using system command
     */
    playFileInternal(filePath) {
        return new Promise((resolve, reject) => {
            const player = this.getPlayerCommand();
            try {
                this.currentProcess = spawn(player.cmd, player.args(filePath), {
                    stdio: ['ignore', 'ignore', 'pipe'],
                });
                this.currentProcess.on('close', (code) => {
                    this.currentProcess = null;
                    if (code === 0) {
                        resolve();
                    }
                    else {
                        // Don't reject on non-zero exit, just log
                        console.warn(`Audio player exited with code ${code}`);
                        resolve();
                    }
                });
                this.currentProcess.on('error', (err) => {
                    this.currentProcess = null;
                    console.error('Audio player error:', err.message);
                    // Try fallback players on Linux
                    if (os.platform() === 'linux' && player.cmd === 'mpg123') {
                        this.tryFallbackPlayer(filePath).then(resolve).catch(reject);
                    }
                    else {
                        resolve(); // Don't block on audio errors
                    }
                });
            }
            catch (error) {
                console.error('Failed to spawn audio player:', error);
                resolve(); // Don't block on audio errors
            }
        });
    }
    /**
     * Try fallback audio players on Linux
     */
    async tryFallbackPlayer(filePath) {
        const fallbacks = ['aplay', 'paplay', 'ffplay'];
        for (const cmd of fallbacks) {
            try {
                await new Promise((resolve, reject) => {
                    const args = cmd === 'ffplay' ? ['-nodisp', '-autoexit', filePath] : [filePath];
                    const proc = spawn(cmd, args, { stdio: 'ignore' });
                    proc.on('close', (code) => {
                        if (code === 0)
                            resolve();
                        else
                            reject(new Error(`${cmd} exited with ${code}`));
                    });
                    proc.on('error', reject);
                });
                return; // Success
            }
            catch {
                // Try next fallback
            }
        }
        console.warn('No audio player available. Install mpg123, aplay, paplay, or ffplay.');
    }
    /**
     * Stop current playback and clear queue
     */
    stop() {
        // Clear the queue
        this.queue = [];
        // Kill current process
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
        this.isPlaying = false;
    }
    /**
     * Skip current audio and play next in queue
     */
    skip() {
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
        }
    }
    /**
     * Get queue length
     */
    getQueueLength() {
        return this.queue.length;
    }
    /**
     * Check if currently playing
     */
    getIsPlaying() {
        return this.isPlaying;
    }
    /**
     * Clean up temp files
     */
    cleanup() {
        for (const filePath of this.tempFiles) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            catch {
                // Ignore cleanup errors
            }
        }
        this.tempFiles.clear();
    }
}
/**
 * Create a local audio player instance
 */
export function createLocalAudioPlayer(config) {
    return new LocalAudioPlayer(config);
}
//# sourceMappingURL=LocalAudioPlayer.js.map