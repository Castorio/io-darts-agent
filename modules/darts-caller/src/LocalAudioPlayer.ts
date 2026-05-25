/**
 * Local Audio Player
 *
 * Plays audio files locally on the server using system audio
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface LocalAudioPlayerConfig {
  volume?: number; // 0-100
  player?: string; // Override default player
  tempDir?: string; // Directory for temp files
}

interface QueuedAudio {
  id: string;
  filePath?: string;
  buffer?: Buffer;
  priority: number;
  text?: string; // For logging
}

/**
 * Local audio player that plays audio on the server machine
 */
export class LocalAudioPlayer {
  private config: LocalAudioPlayerConfig;
  private queue: QueuedAudio[] = [];
  private isPlaying = false;
  private currentProcess: ChildProcess | null = null;
  private tempDir: string;
  private tempFiles: Set<string> = new Set();

  constructor(config: LocalAudioPlayerConfig = {}) {
    this.config = {
      volume: 80,
      ...config,
    };
    this.tempDir = config.tempDir || path.join(os.tmpdir(), 'darts-caller-audio');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get the appropriate audio player command for the current OS
   */
  private getPlayerCommand(): { cmd: string; args: (filePath: string) => string[] } {
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
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(100, volume));
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.config.volume ?? 80;
  }

  /**
   * Play an audio file
   */
  async playFile(filePath: string, priority = 5, text?: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.error(`Audio file not found: ${filePath}`);
      return;
    }

    const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.enqueue({ id, filePath, priority, text });
  }

  /**
   * Play audio from a buffer (writes to temp file first)
   */
  async playBuffer(buffer: Buffer, priority = 5, text?: string): Promise<void> {
    const id = `buffer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.enqueue({ id, buffer, priority, text });
  }

  /**
   * Add audio to queue
   */
  private enqueue(audio: QueuedAudio): void {
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
  private async processQueue(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;

    while (this.queue.length > 0) {
      const audio = this.queue.shift()!;
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
      } catch (error) {
        console.error('Error playing audio:', error);
      } finally {
        // Clean up temp file if we created one
        if (audio.buffer && filePath && this.tempFiles.has(filePath)) {
          try {
            fs.unlinkSync(filePath);
            this.tempFiles.delete(filePath);
          } catch {
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
  private playFileInternal(filePath: string): Promise<void> {
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
          } else {
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
          } else {
            resolve(); // Don't block on audio errors
          }
        });
      } catch (error) {
        console.error('Failed to spawn audio player:', error);
        resolve(); // Don't block on audio errors
      }
    });
  }

  /**
   * Try fallback audio players on Linux
   */
  private async tryFallbackPlayer(filePath: string): Promise<void> {
    const fallbacks = ['aplay', 'paplay', 'ffplay'];

    for (const cmd of fallbacks) {
      try {
        await new Promise<void>((resolve, reject) => {
          const args = cmd === 'ffplay' ? ['-nodisp', '-autoexit', filePath] : [filePath];
          const proc = spawn(cmd, args, { stdio: 'ignore' });

          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${cmd} exited with ${code}`));
          });

          proc.on('error', reject);
        });
        return; // Success
      } catch {
        // Try next fallback
      }
    }

    console.warn('No audio player available. Install mpg123, aplay, paplay, or ffplay.');
  }

  /**
   * Stop current playback and clear queue
   */
  stop(): void {
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
  skip(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Clean up temp files
   */
  cleanup(): void {
    for (const filePath of this.tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    this.tempFiles.clear();
  }
}

/**
 * Create a local audio player instance
 */
export function createLocalAudioPlayer(config?: LocalAudioPlayerConfig): LocalAudioPlayer {
  return new LocalAudioPlayer(config);
}
