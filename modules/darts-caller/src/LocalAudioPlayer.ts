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

export interface PlayerCommand {
  cmd: string;
  args: (filePath: string) => string[];
}

type SpawnFn = (cmd: string, args: string[], options: object) => ChildProcess;

/**
 * Linux players that can decode the MP3 voice pack files, in order of
 * preference. aplay is not one of them: it plays MP3 data as raw PCM,
 * which comes out of the speakers as noise.
 */
export function linuxPlayerCandidates(volume: number): PlayerCommand[] {
  const level = Math.max(0, Math.min(100, Math.round(volume)));
  return [
    // -f: output scale, 32768 is 100 %
    { cmd: 'mpg123', args: (filePath): string[] => ['-q', '-f', String(Math.round(32768 * level / 100)), filePath] },
    // ffplay is part of ffmpeg, which the hub also uses for animations
    {
      cmd: 'ffplay',
      args: (filePath): string[] => ['-nodisp', '-autoexit', '-loglevel', 'error', '-volume', String(level), filePath],
    },
  ];
}

/**
 * Play the file with the first installed player
 *
 * Moves on to the next player only if a command is not installed; a
 * player that runs but fails is not retried with another one.
 * Returns the player used, or null if none is installed.
 */
export function playWithFirstAvailable(
  candidates: PlayerCommand[],
  filePath: string,
  spawnFn: SpawnFn = spawn as SpawnFn,
  onSpawn?: (proc: ChildProcess | null) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    const tryAt = (index: number): void => {
      const player = candidates[index];
      if (!player) {
        onSpawn?.(null);
        resolve(null);
        return;
      }
      let proc: ChildProcess;
      try {
        proc = spawnFn(player.cmd, player.args(filePath), { stdio: ['ignore', 'ignore', 'pipe'] });
      } catch {
        tryAt(index + 1);
        return;
      }
      onSpawn?.(proc);
      // Node emits close (code -2) after a spawn error; only the first event counts
      let settled = false;
      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (settled) return;
        settled = true;
        if (err.code === 'ENOENT') {
          tryAt(index + 1);
        } else {
          console.error(`Audio player ${player.cmd} failed:`, err.message);
          onSpawn?.(null);
          resolve(player.cmd);
        }
      });
      proc.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        if (code !== 0) {
          console.warn(`Audio player ${player.cmd} exited with code ${code}`);
        }
        onSpawn?.(null);
        resolve(player.cmd);
      });
    };
    tryAt(0);
  });
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
        args: (filePath): string[] => [filePath],
      };
    }

    switch (platform) {
      case 'darwin': // macOS
        return {
          cmd: 'afplay',
          args: (filePath): string[] => {
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
          args: (filePath): string[] => [
            '-c',
            // Single-quoted PowerShell string: a ' in the path must be doubled,
            // otherwise the path could end the string and inject commands
            `(New-Object Media.SoundPlayer '${filePath.replace(/'/g, "''")}').PlaySync()`,
          ],
        };

      case 'linux':
      default:
        // Linux normally goes through linuxPlayerCandidates (see playFileInternal)
        return linuxPlayerCandidates(this.config.volume ?? 80)[0];
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
  playFile(filePath: string, priority = 5, text?: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.error(`Audio file not found: ${filePath}`);
      return Promise.resolve();
    }

    const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.enqueue({ id, filePath, priority, text });
    return Promise.resolve();
  }

  /**
   * Play audio from a buffer (writes to temp file first)
   */
  playBuffer(buffer: Buffer, priority = 5, text?: string): Promise<void> {
    const id = `buffer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.enqueue({ id, buffer, priority, text });
    return Promise.resolve();
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
    // processQueue catches errors per item and never rejects
    if (!this.isPlaying) {
      void this.processQueue();
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
    if (os.platform() === 'linux' && !this.config.player) {
      return playWithFirstAvailable(
        linuxPlayerCandidates(this.config.volume ?? 80),
        filePath,
        spawn as SpawnFn,
        (proc) => {
          this.currentProcess = proc;
        }
      ).then((used) => {
        if (!used) {
          console.warn('No MP3 audio player found. Install ffmpeg (ffplay) or mpg123.');
        }
      });
    }

    return new Promise((resolve) => {
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
          resolve(); // Don't block on audio errors
        });
      } catch (error) {
        console.error('Failed to spawn audio player:', error);
        resolve(); // Don't block on audio errors
      }
    });
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
