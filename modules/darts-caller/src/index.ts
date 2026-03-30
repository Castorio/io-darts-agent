/**
 * Darts Caller Module for IO-Darts-Agent
 *
 * Announces scores, checkouts, and game events using TTS or audio files
 */

import { AutodartsModule, type ParsedEvent } from '@autodarts-hub/module-sdk';
import { EventMapper, type MappedCall } from './EventMapper.js';
import { CallQueue } from './CallQueue.js';
import { ScoreConverter } from './ScoreConverter.js';
import {
  type CallerModuleConfig,
  type CallRequest,
  DEFAULT_CALLER_CONFIG,
} from './types.js';

interface ModuleConfig {
  enabled?: boolean;
  callerType?: 'tts' | 'audio';
  ttsVoice?: string;
  ttsRate?: number;
  ttsPitch?: number;
  volume?: number;
  audioPackPath?: string;
  callScores?: boolean;
  callHighScoresOnly?: boolean;
  callCheckouts?: boolean;
  callPlayerChange?: boolean;
  callGameStart?: boolean;
  callGameOver?: boolean;
  call180?: boolean;
  callBusts?: boolean;
  delayMs?: number;
}

/**
 * Convert flat config to structured CallerModuleConfig
 */
function toCallerConfig(config: ModuleConfig): CallerModuleConfig {
  return {
    enabled: config.enabled ?? DEFAULT_CALLER_CONFIG.enabled,
    callerType: config.callerType ?? DEFAULT_CALLER_CONFIG.callerType,
    tts: {
      voice: config.ttsVoice ?? DEFAULT_CALLER_CONFIG.tts.voice,
      rate: config.ttsRate ?? DEFAULT_CALLER_CONFIG.tts.rate,
      pitch: config.ttsPitch ?? DEFAULT_CALLER_CONFIG.tts.pitch,
      volume: (config.volume ?? DEFAULT_CALLER_CONFIG.volume) / 100,
      language: DEFAULT_CALLER_CONFIG.tts.language,
    },
    audioPack: {
      packPath: config.audioPackPath ?? DEFAULT_CALLER_CONFIG.audioPack.packPath,
      fallbackToTts: DEFAULT_CALLER_CONFIG.audioPack.fallbackToTts,
    },
    scores: {
      enabled: config.callScores ?? DEFAULT_CALLER_CONFIG.scores.enabled,
      highScoresOnly: config.callHighScoresOnly ?? DEFAULT_CALLER_CONFIG.scores.highScoresOnly,
      minScore: DEFAULT_CALLER_CONFIG.scores.minScore,
      delay: config.delayMs ?? DEFAULT_CALLER_CONFIG.scores.delay,
    },
    checkouts: {
      enabled: config.callCheckouts ?? DEFAULT_CALLER_CONFIG.checkouts.enabled,
      announceRemaining: DEFAULT_CALLER_CONFIG.checkouts.announceRemaining,
      announceCheckoutPath: DEFAULT_CALLER_CONFIG.checkouts.announceCheckoutPath,
    },
    special: {
      call180: config.call180 ?? DEFAULT_CALLER_CONFIG.special.call180,
      callBust: config.callBusts ?? DEFAULT_CALLER_CONFIG.special.callBust,
      callGameStart: config.callGameStart ?? DEFAULT_CALLER_CONFIG.special.callGameStart,
      callGameOver: config.callGameOver ?? DEFAULT_CALLER_CONFIG.special.callGameOver,
      callPlayerChange: config.callPlayerChange ?? DEFAULT_CALLER_CONFIG.special.callPlayerChange,
    },
    volume: config.volume ?? DEFAULT_CALLER_CONFIG.volume,
    delayMs: config.delayMs ?? DEFAULT_CALLER_CONFIG.delayMs,
  };
}

/**
 * Darts Caller Module - Announces game events
 */
class DartsCallerModule extends AutodartsModule {
  private mapper: EventMapper;
  private queue: CallQueue;
  private callerConfig: CallerModuleConfig;
  private stats = {
    callsGenerated: 0,
    scoresAnnounced: 0,
    checkoutsAnnounced: 0,
    specialCalls: 0,
  };

  constructor() {
    super();
    this.callerConfig = DEFAULT_CALLER_CONFIG;
    this.mapper = new EventMapper(this.callerConfig);
    this.queue = new CallQueue(this.callerConfig.delayMs);

    // Setup queue callback
    this.queue.onPlayback((request) => this.handlePlayback(request));
  }

  /**
   * Initialize module with config
   */
  protected async onInit(config: Record<string, unknown>): Promise<void> {
    const moduleConfig = config as ModuleConfig;
    this.callerConfig = toCallerConfig(moduleConfig);

    this.mapper.updateConfig(this.callerConfig);
    this.queue.setDefaultDelay(this.callerConfig.delayMs);

    this.log('info', `Darts Caller initialized (type: ${this.callerConfig.callerType})`);
    this.updateStatus('ready', 'Caller ready', {
      callerType: this.callerConfig.callerType,
      enabled: this.callerConfig.enabled,
    });
  }

  /**
   * Handle incoming events
   */
  protected async onEvent(event: ParsedEvent): Promise<void> {
    if (!this.callerConfig.enabled) {
      return;
    }

    try {
      // Map event to calls
      const calls = this.mapper.mapEvent(event);

      if (calls.length > 0) {
        this.log('debug', `Processing ${calls.length} calls for ${event.type}`);

        // Add to queue
        for (const call of calls) {
          this.queue.enqueue(
            call.type,
            call.text,
            call.audioFile,
            call.priority
          );

          // Update stats
          this.stats.callsGenerated++;
          if (call.type === 'score') this.stats.scoresAnnounced++;
          if (call.type === 'checkout') this.stats.checkoutsAnnounced++;
          if (call.type === 'special') this.stats.specialCalls++;
        }
      }
    } catch (err) {
      const error = err as Error;
      this.log('error', `Failed to process event: ${error.message}`);
    }
  }

  /**
   * Handle playback request - send to frontend via status update
   */
  private handlePlayback(request: CallRequest): void {
    // Send call request to hub via updateStatus
    // The frontend listens for status updates and handles TTS/audio playback
    this.updateStatus('call', request.text, {
      request,
      config: {
        callerType: this.callerConfig.callerType,
        tts: this.callerConfig.tts,
        audioPack: this.callerConfig.audioPack,
      },
    });

    this.log('debug', `Sent call: ${request.text} (${request.type})`);
  }

  /**
   * Handle config updates
   */
  protected async onConfigUpdate(config: Record<string, unknown>, changedKeys: string[]): Promise<void> {
    await super.onConfigUpdate(config, changedKeys);

    const moduleConfig = config as ModuleConfig;
    this.callerConfig = toCallerConfig(moduleConfig);

    this.mapper.updateConfig(this.callerConfig);
    this.queue.setDefaultDelay(this.callerConfig.delayMs);

    this.log('info', 'Caller config updated');
  }

  /**
   * Handle shutdown
   */
  protected async onShutdown(reason: string): Promise<void> {
    this.log('info', `Shutting down Darts Caller: ${reason}`);

    // Clear queue
    this.queue.clear();
  }
}

// Start module
const module = new DartsCallerModule();
module.start().catch((err) => {
  console.error('Failed to start Darts Caller module:', err);
  process.exit(1);
});

export { DartsCallerModule, EventMapper, CallQueue, ScoreConverter };
export * from './types.js';
export * from './ScoreConverter.js';
