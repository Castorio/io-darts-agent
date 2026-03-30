/**
 * Darts Caller Module Event Handler
 *
 * Processes Autodarts events and generates speech/audio calls
 * Audio is played locally on the server machine
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ParsedEvent } from '../../../src/types/index.js';
import type { ElevenLabsService } from './ElevenLabsService.js';
import type { VoicePackGenerator } from './VoicePackGenerator.js';
import { LocalAudioPlayer } from './LocalAudioPlayer.js';

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
 * TTS Settings group
 */
export interface TtsSettings {
  voice?: string;
  rate?: number;
  pitch?: number;
}

/**
 * Voice Pack Settings group
 */
export interface VoicepackSettings {
  packId?: string;
}

/**
 * ElevenLabs Settings group
 */
export interface ElevenlabsSettings {
  voiceId?: string;
  stability?: number;
  similarity?: number;
}

/**
 * Audio Settings group
 */
export interface AudioSettings {
  packPath?: string;
}

/**
 * Call Settings group
 */
export interface CallSettings {
  scores?: boolean;
  highScoresOnly?: boolean;
  checkouts?: boolean;
  playerChange?: boolean;
  gameStart?: boolean;
  gameOver?: boolean;
  special180?: boolean;
  busts?: boolean;
}

/**
 * Darts Caller configuration (supports both old flat and new grouped structure)
 */
export interface DartsCallerConfig {
  enabled?: boolean;
  callerType?: CallerType;
  language?: string;
  volume?: number;
  delayMs?: number;

  // New grouped structure
  ttsSettings?: TtsSettings;
  voicepackSettings?: VoicepackSettings;
  elevenlabsSettings?: ElevenlabsSettings;
  audioSettings?: AudioSettings;
  callSettings?: CallSettings;

  // Selected voice pack (from multi-pack UI)
  selectedVoicePackId?: string;

  // Legacy flat structure (for backward compatibility)
  ttsVoice?: string;
  ttsRate?: number;
  ttsPitch?: number;
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
  elevenlabs?: ElevenLabsCallerConfig;
}

/**
 * Callback for call requests
 */
export type CallRequestCallback = (request: CallRequest) => void;

/**
 * Score to text mapping for special scores
 */
const SPECIAL_SCORES: Record<number, string> = {
  180: 'ONE_HUNDRED_EIGHTY',
  171: 'ONE_HUNDRED_SEVENTY_ONE',
  170: 'ONE_HUNDRED_AND_SEVENTY',
  167: 'ONE_HUNDRED_AND_SIXTY_SEVEN',
  160: 'ONE_HUNDRED_AND_SIXTY',
  158: 'ONE_HUNDRED_AND_FIFTY_EIGHT',
  157: 'ONE_HUNDRED_AND_FIFTY_SEVEN',
  156: 'ONE_HUNDRED_AND_FIFTY_SIX',
  155: 'ONE_HUNDRED_AND_FIFTY_FIVE',
  154: 'ONE_HUNDRED_AND_FIFTY_FOUR',
  153: 'ONE_HUNDRED_AND_FIFTY_THREE',
  152: 'ONE_HUNDRED_AND_FIFTY_TWO',
  151: 'ONE_HUNDRED_AND_FIFTY_ONE',
  150: 'ONE_HUNDRED_AND_FIFTY',
  149: 'ONE_HUNDRED_AND_FORTY_NINE',
  148: 'ONE_HUNDRED_AND_FORTY_EIGHT',
  147: 'ONE_HUNDRED_AND_FORTY_SEVEN',
  146: 'ONE_HUNDRED_AND_FORTY_SIX',
  145: 'ONE_HUNDRED_AND_FORTY_FIVE',
  144: 'ONE_HUNDRED_AND_FORTY_FOUR',
  143: 'ONE_HUNDRED_AND_FORTY_THREE',
  142: 'ONE_HUNDRED_AND_FORTY_TWO',
  141: 'ONE_HUNDRED_AND_FORTY_ONE',
  140: 'ONE_HUNDRED_AND_FORTY',
  139: 'ONE_HUNDRED_AND_THIRTY_NINE',
  138: 'ONE_HUNDRED_AND_THIRTY_EIGHT',
  137: 'ONE_HUNDRED_AND_THIRTY_SEVEN',
  136: 'ONE_HUNDRED_AND_THIRTY_SIX',
  135: 'ONE_HUNDRED_AND_THIRTY_FIVE',
  134: 'ONE_HUNDRED_AND_THIRTY_FOUR',
  133: 'ONE_HUNDRED_AND_THIRTY_THREE',
  132: 'ONE_HUNDRED_AND_THIRTY_TWO',
  131: 'ONE_HUNDRED_AND_THIRTY_ONE',
  130: 'ONE_HUNDRED_AND_THIRTY',
  129: 'ONE_HUNDRED_AND_TWENTY_NINE',
  128: 'ONE_HUNDRED_AND_TWENTY_EIGHT',
  127: 'ONE_HUNDRED_AND_TWENTY_SEVEN',
  126: 'ONE_HUNDRED_AND_TWENTY_SIX',
  125: 'ONE_HUNDRED_AND_TWENTY_FIVE',
  124: 'ONE_HUNDRED_AND_TWENTY_FOUR',
  123: 'ONE_HUNDRED_AND_TWENTY_THREE',
  122: 'ONE_HUNDRED_AND_TWENTY_TWO',
  121: 'ONE_HUNDRED_AND_TWENTY_ONE',
  120: 'ONE_HUNDRED_AND_TWENTY',
  119: 'ONE_HUNDRED_AND_NINETEEN',
  118: 'ONE_HUNDRED_AND_EIGHTEEN',
  117: 'ONE_HUNDRED_AND_SEVENTEEN',
  116: 'ONE_HUNDRED_AND_SIXTEEN',
  115: 'ONE_HUNDRED_AND_FIFTEEN',
  114: 'ONE_HUNDRED_AND_FOURTEEN',
  113: 'ONE_HUNDRED_AND_THIRTEEN',
  112: 'ONE_HUNDRED_AND_TWELVE',
  111: 'ONE_HUNDRED_AND_ELEVEN',
  110: 'ONE_HUNDRED_AND_TEN',
  109: 'ONE_HUNDRED_AND_NINE',
  108: 'ONE_HUNDRED_AND_EIGHT',
  107: 'ONE_HUNDRED_AND_SEVEN',
  106: 'ONE_HUNDRED_AND_SIX',
  105: 'ONE_HUNDRED_AND_FIVE',
  104: 'ONE_HUNDRED_AND_FOUR',
  103: 'ONE_HUNDRED_AND_THREE',
  102: 'ONE_HUNDRED_AND_TWO',
  101: 'ONE_HUNDRED_AND_ONE',
  100: 'ONE_HUNDRED',
  26: 'TWENTY_SIX',
};

/**
 * Darts Caller Handler class
 */
export class DartsCallerHandler {
  private config: DartsCallerConfig;
  private callbackQueue: CallRequest[] = [];
  private callRequestCallbacks: CallRequestCallback[] = [];
  private callIdCounter = 0;
  private elevenLabsService: ElevenLabsService | null = null;
  private voicePackGenerator: VoicePackGenerator | null = null;
  private voicePackCache: Map<string, Buffer> = new Map();
  private audioPlayer: LocalAudioPlayer;
  private knownPlayerNames: Set<string> = new Set();
  private playerNameGenerationInProgress: Set<string> = new Set();

  // Statistics
  private stats = {
    eventsProcessed: 0,
    callsGenerated: 0,
    scoresAnnounced: 0,
    checkoutsAnnounced: 0,
    specialCalls: 0,
    elevenLabsCalls: 0,
    voicePackCalls: 0,
  };

  constructor(config: DartsCallerConfig) {
    this.config = {
      enabled: true,
      callerType: 'tts',
      volume: 80,
      delayMs: 200,
      language: 'en',
      ...config,
    };

    // Initialize local audio player
    this.audioPlayer = new LocalAudioPlayer({
      volume: this.config.volume,
    });
  }

  /**
   * Helper to get config values with support for both old and new structure
   */
  private getCallSetting(key: keyof CallSettings, legacyKey?: keyof DartsCallerConfig): boolean {
    // Check new grouped structure first
    if (this.config.callSettings && this.config.callSettings[key] !== undefined) {
      return this.config.callSettings[key] ?? true;
    }
    // Fall back to legacy flat structure
    if (legacyKey && this.config[legacyKey] !== undefined) {
      return this.config[legacyKey] as boolean;
    }
    // Default values
    const defaults: Record<keyof CallSettings, boolean> = {
      scores: true,
      highScoresOnly: false,
      checkouts: true,
      playerChange: true,
      gameStart: true,
      gameOver: true,
      special180: true,
      busts: true,
    };
    return defaults[key];
  }

  // TTS settings are sent to the frontend, not used in the handler
  getTtsSetting<K extends keyof TtsSettings>(key: K): TtsSettings[K] | undefined {
    if (this.config.ttsSettings && this.config.ttsSettings[key] !== undefined) {
      return this.config.ttsSettings[key];
    }
    // Legacy mapping
    const legacyMap: Record<keyof TtsSettings, keyof DartsCallerConfig> = {
      voice: 'ttsVoice',
      rate: 'ttsRate',
      pitch: 'ttsPitch',
    };
    return this.config[legacyMap[key]] as TtsSettings[K] | undefined;
  }

  private getVoicepackId(): string | undefined {
    // Priority: selectedVoicePackId (from multi-pack UI) > voicepackSettings > legacy voicePackId
    return this.config.selectedVoicePackId ?? this.config.voicepackSettings?.packId ?? this.config.voicePackId;
  }

  private getElevenlabsSetting<K extends keyof ElevenlabsSettings>(key: K): ElevenlabsSettings[K] | undefined {
    if (this.config.elevenlabsSettings && this.config.elevenlabsSettings[key] !== undefined) {
      return this.config.elevenlabsSettings[key];
    }
    // Legacy mapping
    if (this.config.elevenlabs) {
      const legacyMap: Record<keyof ElevenlabsSettings, keyof ElevenLabsCallerConfig> = {
        voiceId: 'voiceId',
        stability: 'stability',
        similarity: 'similarityBoost',
      };
      return this.config.elevenlabs[legacyMap[key]] as ElevenlabsSettings[K] | undefined;
    }
    return undefined;
  }

  private getAudioPackPath(): string | undefined {
    return this.config.audioSettings?.packPath ?? this.config.audioPackPath;
  }

  /**
   * Set ElevenLabs service for TTS
   */
  setElevenLabsService(service: ElevenLabsService | null): void {
    this.elevenLabsService = service;
  }

  /**
   * Get ElevenLabs service
   */
  getElevenLabsService(): ElevenLabsService | null {
    return this.elevenLabsService;
  }

  /**
   * Set Voice Pack Generator for dynamic player name generation
   */
  setVoicePackGenerator(generator: VoicePackGenerator | null): void {
    this.voicePackGenerator = generator;
  }

  /**
   * Get Voice Pack Generator
   */
  getVoicePackGenerator(): VoicePackGenerator | null {
    return this.voicePackGenerator;
  }

  /**
   * Register a callback for call requests
   */
  onCallRequest(callback: CallRequestCallback): () => void {
    this.callRequestCallbacks.push(callback);
    return () => {
      const idx = this.callRequestCallbacks.indexOf(callback);
      if (idx !== -1) {
        this.callRequestCallbacks.splice(idx, 1);
      }
    };
  }

  /**
   * Emit a call request to all subscribers
   */
  private emitCallRequest(request: CallRequest): void {
    for (const callback of this.callRequestCallbacks) {
      callback(request);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: DartsCallerConfig): void {
    this.config = { ...this.config, ...config };
    // Update audio player volume if changed
    if (config.volume !== undefined) {
      this.audioPlayer.setVolume(config.volume);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): DartsCallerConfig {
    return { ...this.config };
  }

  /**
   * Check if caller is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      eventsProcessed: 0,
      callsGenerated: 0,
      scoresAnnounced: 0,
      checkoutsAnnounced: 0,
      specialCalls: 0,
      elevenLabsCalls: 0,
      voicePackCalls: 0,
    };
  }

  /**
   * Set the voice packs directory
   */
  setVoicePacksDir(dir: string): void {
    this.config.voicePacksDir = dir;
  }

  /**
   * Get available voice packs
   */
  getAvailableVoicePacks(): Array<{ id: string; name: string; language: string }> {
    const voicePacksDir = this.config.voicePacksDir;
    if (!voicePacksDir || !fs.existsSync(voicePacksDir)) {
      return [];
    }

    const packs: Array<{ id: string; name: string; language: string }> = [];

    try {
      const entries = fs.readdirSync(voicePacksDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = path.join(voicePacksDir, entry.name, 'metadata.json');
          if (fs.existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
              packs.push({
                id: entry.name,
                name: metadata.packName || entry.name,
                language: metadata.language || 'en',
              });
            } catch {
              // Skip invalid metadata
            }
          }
        }
      }
    } catch {
      // Ignore errors reading directory
    }

    return packs;
  }

  /**
   * Clear voice pack cache
   */
  clearVoicePackCache(): void {
    this.voicePackCache.clear();
  }

  /**
   * Process player names from match data and generate missing voice files
   */
  async processMatchPlayers(players: Array<{ name: string; [key: string]: unknown }>): Promise<void> {
    if (this.config.callerType !== 'voicepack') {
      return;
    }

    const voicePackId = this.getVoicepackId();
    if (!voicePackId || !this.voicePackGenerator) {
      console.log('⚠️ Cannot process player names: no voice pack or generator configured');
      return;
    }

    // Get pack info to get voiceId
    const packInfo = this.voicePackGenerator.getPackInfo(voicePackId);
    if (!packInfo) {
      console.log(`⚠️ Voice pack "${voicePackId}" not found`);
      return;
    }

    const missingNames: string[] = [];

    for (const player of players) {
      const playerName = player.name;
      if (!playerName) continue;

      // Check if we already know this player
      if (this.knownPlayerNames.has(playerName)) {
        continue;
      }

      // Check if audio file exists
      if (this.voicePackGenerator.hasPlayerName(voicePackId, playerName)) {
        this.knownPlayerNames.add(playerName);
        console.log(`✅ Player "${playerName}" audio already exists`);
        continue;
      }

      // Skip if generation is already in progress for this name
      if (this.playerNameGenerationInProgress.has(playerName)) {
        continue;
      }

      missingNames.push(playerName);
    }

    if (missingNames.length === 0) {
      return;
    }

    console.log(`🎤 Generating audio for ${missingNames.length} new player(s): ${missingNames.join(', ')}`);

    // Mark as in progress
    for (const name of missingNames) {
      this.playerNameGenerationInProgress.add(name);
    }

    try {
      // Generate all missing names
      const result = await this.voicePackGenerator.generatePlayerNames(
        voicePackId,
        missingNames,
        packInfo.voiceId,
        {
          // Use the same settings as the pack was generated with (if available)
          stability: 0.5,
          similarityBoost: 0.75,
        }
      );

      // Update known names
      for (const name of result.generated) {
        this.knownPlayerNames.add(name);
        console.log(`✅ Generated audio for player: "${name}"`);
      }

      for (const name of result.skipped) {
        this.knownPlayerNames.add(name);
      }

      for (const failure of result.failed) {
        console.error(`❌ Failed to generate audio for "${failure.name}": ${failure.error}`);
      }
    } catch (error) {
      console.error('❌ Error generating player name audio:', error);
    } finally {
      // Clear in-progress flags
      for (const name of missingNames) {
        this.playerNameGenerationInProgress.delete(name);
      }
    }
  }

  /**
   * Get the audio file name for a player name
   */
  private getPlayerAudioFile(playerName: string): string {
    // Sanitize name for filename (same as VoicePackGenerator)
    const sanitized = playerName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_äöüß]/gi, '')
      .substring(0, 50);
    return `player_${sanitized}`;
  }

  /**
   * Check if a player audio file exists in the current voice pack
   */
  private hasPlayerAudio(playerName: string): boolean {
    const voicePackId = this.getVoicepackId();
    const voicePacksDir = this.config.voicePacksDir;

    if (!voicePackId || !voicePacksDir) {
      return false;
    }

    const playerAudioFile = this.getPlayerAudioFile(playerName);
    const filePath = path.join(voicePacksDir, voicePackId, `${playerAudioFile}.mp3`);
    return fs.existsSync(filePath);
  }

  /**
   * Handle an event
   */
  async handleEvent(event: ParsedEvent): Promise<void> {
    this.stats.eventsProcessed++;

    if (!this.isEnabled()) {
      return;
    }

    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    switch (eventType) {
      case 'match.start':
      case 'match.started':
        // Reset known players for new match
        this.knownPlayerNames.clear();
        if (this.getCallSetting('gameStart', 'callGameStart')) {
          this.generateCall('game', 'Game on!', 'game_on', 10);
        }
        break;

      case 'match.state':
        // Process players from match state to generate missing voice files
        {
          const players = eventData.players as Array<{ name: string; [key: string]: unknown }> | undefined;
          if (players && players.length > 0) {
            // Fire and forget - don't block event processing
            this.processMatchPlayers(players).catch((err) => {
              console.error('Error processing match players:', err);
            });
          }
        }
        break;

      case 'match.finished':
        if (this.getCallSetting('gameOver', 'callGameOver')) {
          const winner = eventData.winner as Record<string, unknown>;
          const winnerName = winner?.name as string;
          if (winnerName) {
            this.generateCall('game', `Game shot and the match! ${winnerName}!`, 'match_shot', 10);
          } else {
            this.generateCall('game', 'Game shot and the match!', 'match_shot', 10);
          }
        }
        break;

      case 'game.finished':
        if (this.getCallSetting('gameOver', 'callGameOver')) {
          const gameWinner = eventData.winner as Record<string, unknown>;
          const gameWinnerName = gameWinner?.name as string;
          if (gameWinnerName) {
            this.generateCall('game', `Game shot! ${gameWinnerName}!`, 'game_shot', 9);
          } else {
            this.generateCall('game', 'Game shot!', 'game_shot', 9);
          }
        }
        break;

      case 'player.change':
      case 'player.changed':
        if (this.getCallSetting('playerChange', 'callPlayerChange')) {
          const playerName = eventData.playerName as string;
          const remaining = eventData.remaining as number;
          if (playerName) {
            // First announce the player name (if voice pack mode and audio exists)
            const playerAudioFile = this.getPlayerAudioFile(playerName);

            if (remaining && this.getCallSetting('checkouts', 'callCheckouts') && this.isCheckoutPossible(remaining)) {
              // Announce player name first, then checkout requirement
              if (this.config.callerType === 'voicepack' && this.hasPlayerAudio(playerName)) {
                this.generateCall('player', playerName, playerAudioFile, 5);
                // Slight delay before checkout announcement
                setTimeout(() => {
                  this.generateCall(
                    'checkout',
                    `You require ${remaining}`,
                    `require_${remaining}`,
                    4
                  );
                }, 500);
              } else {
                // Fallback: combined announcement
                this.generateCall(
                  'player',
                  `${playerName}, you require ${remaining}`,
                  `require_${remaining}`,
                  5
                );
              }
              this.stats.checkoutsAnnounced++;
            } else {
              // Just announce player name
              if (this.config.callerType === 'voicepack' && this.hasPlayerAudio(playerName)) {
                this.generateCall('player', playerName, playerAudioFile, 3);
              } else {
                this.generateCall('player', playerName, undefined, 3);
              }
            }
          }
        }
        break;

      case 'turn.finished':
        console.log(`📥 Received turn.finished event:`, JSON.stringify(eventData, null, 2));
        this.handleTurnFinished(eventData);
        break;

      case 'throw.detected':
        // Individual throw detection - busts are handled in turn.finished
        break;
    }
  }

  /**
   * Handle turn finished event
   */
  private handleTurnFinished(eventData: Record<string, unknown>): void {
    // Support both turnPoints and turnScore (Autodarts API uses turnScore)
    const turnPoints = (eventData.turnPoints as number) ?? (eventData.turnScore as number) ?? 0;
    const remaining = (eventData.remaining as number) || 0;
    const busted = eventData.busted as boolean;

    console.log(`🎯 Turn finished: ${turnPoints} points, ${remaining} remaining, busted: ${busted}`);

    // Handle busted turn
    if (busted) {
      if (this.getCallSetting('busts', 'callBusts')) {
        this.generateCall('special', 'Bust!', 'bust', 8);
        this.stats.specialCalls++;
      }
      return;
    }

    // Check for 180
    if (turnPoints === 180 && this.getCallSetting('special180', 'call180')) {
      this.generateCall('special', 'One hundred and eighty!', '180', 10);
      this.stats.specialCalls++;
      return;
    }

    // Call score
    if (this.getCallSetting('scores', 'callScores')) {
      // Check if we should only call high scores
      if (this.getCallSetting('highScoresOnly', 'callHighScoresOnly') && turnPoints < 100) {
        return;
      }

      const scoreText = this.scoreToText(turnPoints);
      const audioFile = this.scoreToAudioFile(turnPoints);
      this.generateCall('score', scoreText, audioFile, 5);
      this.stats.scoresAnnounced++;
    }

    // NOTE: "You require X" checkout announcement is handled in player.change event
    // for the NEXT player, not for the current player after their turn
  }

  /**
   * Check if a checkout is possible
   */
  private isCheckoutPossible(remaining: number): boolean {
    // Standard checkout range in darts (2-170, excluding 169, 168, 166, 165, 163, 162, 159)
    if (remaining < 2 || remaining > 170) return false;
    const impossible = [169, 168, 166, 165, 163, 162, 159];
    return !impossible.includes(remaining);
  }

  /**
   * Convert score to spoken text
   */
  private scoreToText(score: number): string {
    if (score === 0) return 'No score';
    if (score === 180) return 'One hundred and eighty!';

    // Special pronunciation mappings
    if (SPECIAL_SCORES[score]) {
      return SPECIAL_SCORES[score].replace(/_/g, ' ').toLowerCase();
    }

    // Build text for other scores
    if (score >= 100) {
      const hundreds = Math.floor(score / 100);
      const remainder = score % 100;
      if (remainder === 0) {
        return hundreds === 1 ? 'One hundred' : `${hundreds} hundred`;
      }
      return `${hundreds === 1 ? 'One' : hundreds} hundred and ${this.numberToText(remainder)}`;
    }

    return this.numberToText(score);
  }

  /**
   * Convert number to text (0-99)
   */
  private numberToText(num: number): string {
    const ones = [
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
      'seventeen', 'eighteen', 'nineteen',
    ];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (num < 20) return ones[num];

    const t = Math.floor(num / 10);
    const o = num % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  }

  /**
   * Get audio file name for a score
   */
  private scoreToAudioFile(score: number): string {
    // Standard naming convention: score_XXX.mp3 or special names
    if (score === 180) return '180';
    if (score === 0) return 'no_score';
    return `score_${score}`;
  }

  /**
   * Generate and play audio locally on the server
   */
  private generateCall(
    type: CallRequest['type'],
    text: string,
    audioFile: string | undefined,
    priority: number
  ): void {
    const request: CallRequest = {
      id: `call_${++this.callIdCounter}_${Date.now()}`,
      type,
      text,
      audioFile,
      priority,
      timestamp: Date.now(),
    };

    this.stats.callsGenerated++;

    // Apply delay if configured
    const delay = this.config.delayMs || 0;

    const playLocalAudio = async () => {
      console.log(`🔊 Caller type: ${this.config.callerType}, audioFile: ${audioFile}`);

      // Voice Pack: Play pre-generated audio files locally
      if (this.config.callerType === 'voicepack') {
        const voicePackId = this.getVoicepackId();
        const voicePacksDir = this.config.voicePacksDir;

        if (!voicePackId) {
          console.warn('⚠️  Voice pack type selected but no voicePackId configured');
        } else if (!voicePacksDir) {
          console.warn('⚠️  Voice pack type selected but no voicePacksDir configured');
        } else if (audioFile) {
          const filePath = path.join(voicePacksDir, voicePackId, `${audioFile}.mp3`);
          if (fs.existsSync(filePath)) {
            console.log(`🔊 Playing voice pack file: ${filePath}`);
            await this.audioPlayer.playFile(filePath, priority, text);
            this.stats.voicePackCalls++;
            this.emitCallRequest(request);
            return;
          }
          console.warn(`⚠️  Voice pack audio not found: ${filePath}`);
        }
        // Fall through to emit request without audio
        this.emitCallRequest(request);
        return;
      }

      // ElevenLabs Live: Generate and play audio on-the-fly
      if (this.config.callerType === 'elevenlabs') {
        if (!this.elevenLabsService) {
          console.warn('⚠️  ElevenLabs type selected but no service configured');
        } else {
          try {
            const voiceId = this.getElevenlabsSetting('voiceId');
            const stability = this.getElevenlabsSetting('stability') ?? 0.5;
            const similarity = this.getElevenlabsSetting('similarity') ?? 0.75;

            const audioBuffer = await this.elevenLabsService.generateSpeech(text, {
              voiceId,
              voiceSettings: {
                stability,
                similarity_boost: similarity,
              },
            });
            console.log(`🔊 Playing ElevenLabs generated audio for: "${text}"`);
            await this.audioPlayer.playBuffer(audioBuffer, priority, text);
            this.stats.elevenLabsCalls++;
            this.emitCallRequest(request);
            return;
          } catch (error) {
            console.error('❌ ElevenLabs TTS failed:', error);
          }
        }
        // Fall through to emit request without audio
        this.emitCallRequest(request);
        return;
      }

      // Audio Files: Play static audio files locally
      if (this.config.callerType === 'audio' && audioFile) {
        const filePath = this.resolveAudioFile(audioFile);
        if (fs.existsSync(filePath)) {
          console.log(`🔊 Playing audio file: ${filePath}`);
          await this.audioPlayer.playFile(filePath, priority, text);
          this.emitCallRequest(request);
          return;
        }
        console.warn(`⚠️  Audio file not found: ${filePath}`);
        this.emitCallRequest(request);
        return;
      }

      // TTS: Emit request for frontend/browser playback
      if (this.config.callerType === 'tts') {
        console.log(`🗣️  TTS (browser): "${text}"`);
        this.emitCallRequest(request);
        return;
      }

      // Unknown caller type - just emit
      console.warn(`⚠️  Unknown caller type: ${this.config.callerType}`);
      this.emitCallRequest(request);
    };

    if (delay > 0) {
      setTimeout(() => {
        playLocalAudio().catch(console.error);
      }, delay);
    } else {
      playLocalAudio().catch(console.error);
    }
  }

  /**
   * Resolve audio file path
   */
  private resolveAudioFile(filename: string): string {
    const packPath = this.getAudioPackPath() || 'caller/default';
    return `${packPath}/${filename}.mp3`;
  }

  /**
   * Get pending calls in the queue
   */
  getPendingCalls(): CallRequest[] {
    return [...this.callbackQueue];
  }

  /**
   * Clear the call queue
   */
  clearQueue(): void {
    this.callbackQueue = [];
  }

  /**
   * Stop current audio playback
   */
  stopPlayback(): void {
    this.audioPlayer.stop();
  }

  /**
   * Skip current audio and play next
   */
  skipCurrent(): void {
    this.audioPlayer.skip();
  }

  /**
   * Get audio player status
   */
  getAudioStatus(): { isPlaying: boolean; queueLength: number } {
    return {
      isPlaying: this.audioPlayer.getIsPlaying(),
      queueLength: this.audioPlayer.getQueueLength(),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.audioPlayer.stop();
    this.audioPlayer.cleanup();
    this.voicePackCache.clear();
  }
}

/**
 * Create Darts Caller handler from module config
 */
export function createDartsCallerHandler(
  config: Record<string, unknown>
): DartsCallerHandler {
  return new DartsCallerHandler(config as DartsCallerConfig);
}
