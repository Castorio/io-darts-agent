/**
 * Darts Caller Module Event Handler
 *
 * Processes Autodarts events and generates speech/audio calls
 * Audio is played locally on the server machine
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ParsedEvent } from './types/hub-types.js';
import type { ElevenLabsService } from './ElevenLabsService.js';
import { intentAudioPath, readPackMetadata, type VoicePackGenerator } from './VoicePackGenerator.js';
import { LocalAudioPlayer } from './LocalAudioPlayer.js';
import { closedFile, closedText, marksFile, marksText } from './cricketPhrases.js';

import {
  normalizeDartsCallerConfig,
  type CallerType,
  type CallSettings,
  type TtsSettings,
  type ElevenlabsSettings,
  type NormalizedDartsCallerConfig,
} from './config.js';

export type { CallerType } from './config.js';

/**
 * Browser TTS parameters sent along with a TTS call request
 */
export interface CallRequestTts {
  voice: string;
  rate: number;
  pitch: number;
  /** 0 to 100 */
  volume: number;
  /** BCP 47 language tag for the utterance */
  lang: string;
}

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
  callerType?: CallerType;
  tts?: CallRequestTts;
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
 * Darts Caller configuration as the handler holds it: the normalized shape
 * (see config.ts) plus the runtime voice packs directory.
 */
export type DartsCallerConfig = NormalizedDartsCallerConfig & {
  voicePacksDir?: string;
};

const UTTERANCE_LANG: Record<NormalizedDartsCallerConfig['language'], string> = {
  en: 'en-GB',
  de: 'de-DE',
};

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
/**
 * Match state interface for tracking current game state
 */
interface MatchState {
  players: Array<{ name: string; remaining?: number; color?: string }>;
  currentPlayerIndex: number;
  startScore?: number;
}

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
  private currentMatchState: MatchState | null = null;
  /** Game mode remembered from the most recent event that carried data.game */
  private gameMode: string | undefined;

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

  constructor(config: object) {
    const raw = config as Record<string, unknown>;
    this.config = {
      ...normalizeDartsCallerConfig(raw),
      voicePacksDir: typeof raw.voicePacksDir === 'string' ? raw.voicePacksDir : undefined,
    };

    // Initialize local audio player
    this.audioPlayer = new LocalAudioPlayer({
      volume: this.config.volume,
    });
  }

  private getCallSetting<K extends keyof CallSettings>(key: K): CallSettings[K] {
    return this.config.callSettings[key];
  }

  // TTS settings are sent to the frontend with every TTS call request
  getTtsSetting<K extends keyof TtsSettings>(key: K): TtsSettings[K] {
    return this.config.ttsSettings[key];
  }

  private getVoicepackId(): string | undefined {
    return this.config.voicepackSettings.packId || undefined;
  }

  private getElevenlabsSetting<K extends keyof ElevenlabsSettings>(key: K): ElevenlabsSettings[K] {
    return this.config.elevenlabsSettings[key];
  }

  private getAudioPackPath(): string | undefined {
    return this.config.audioSettings.packPath || undefined;
  }

  private buildTtsPayload(): CallRequestTts {
    return {
      voice: this.config.ttsSettings.voice,
      rate: this.config.ttsSettings.rate,
      pitch: this.config.ttsSettings.pitch,
      volume: this.config.volume,
      lang: UTTERANCE_LANG[this.config.language],
    };
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
  updateConfig(config: object): void {
    const raw = config as Record<string, unknown>;
    const voicePacksDir = typeof raw.voicePacksDir === 'string' ? raw.voicePacksDir : this.config.voicePacksDir;
    this.config = {
      ...normalizeDartsCallerConfig({ ...this.config, ...raw }),
      voicePacksDir,
    };
    this.audioPlayer.setVolume(this.config.volume);
  }

  /**
   * Get current configuration
   */
  getConfig(): DartsCallerConfig {
    return structuredClone(this.config);
  }

  /**
   * Check if caller is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
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
              const metadata = readPackMetadata(metadataPath);
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
      // Silently return - voice pack generator is optional (requires ElevenLabs API key)
      // Player names will still work if audio files already exist in the voice pack
      return;
    }

    // Get pack info to get voiceId
    const packInfo = this.voicePackGenerator.getPackInfo(voicePackId);
    if (!packInfo) {
      console.log(`⚠️ Voice pack "${voicePackId}" not found - packInfo is null`);
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
      // Generate all missing names with the pack's language for proper pronunciation
      console.log(`🎤 Generating with language: ${packInfo.language}`);
      const result = await this.voicePackGenerator.generatePlayerNames(
        voicePackId,
        missingNames,
        packInfo.voiceId,
        {
          // Use the same settings as the pack was generated with (if available)
          stability: 0.5,
          similarityBoost: 0.75,
          // Pass the voicepack's language for proper pronunciation model selection
          language: packInfo.language,
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
   * Handle player change event with waiting for audio generation if needed
   */
  private async handlePlayerChange(playerName: string, remaining?: number): Promise<void> {
    // Wait for audio generation if in progress (max 10 seconds)
    if (this.playerNameGenerationInProgress.has(playerName)) {
      console.log(`🎤 Waiting for audio generation of "${playerName}"...`);
      const maxWaitTime = 10000; // 10 seconds
      const checkInterval = 200; // Check every 200ms
      let waited = 0;

      while (this.playerNameGenerationInProgress.has(playerName) && waited < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }

      if (waited >= maxWaitTime) {
        console.log(`⚠️ Timeout waiting for audio generation of "${playerName}"`);
      } else {
        console.log(`✅ Audio generation for "${playerName}" completed after ${waited}ms`);
      }
    }

    const playerAudioFile = this.getPlayerAudioFile(playerName);
    const hasAudio = this.hasPlayerAudio(playerName);

    if (remaining && this.shouldCallRequiredScore(remaining)) {
      // Announce player name first, then checkout requirement
      if (this.config.callerType === 'voicepack' && hasAudio) {
        console.log(`🔊 Playing player audio for "${playerName}" (file: ${playerAudioFile})`);
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
        console.log(`🔊 Fallback announcement for "${playerName}" (hasAudio: ${hasAudio})`);
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
      if (this.config.callerType === 'voicepack' && hasAudio) {
        console.log(`🔊 Playing player audio for "${playerName}" (file: ${playerAudioFile})`);
        this.generateCall('player', playerName, playerAudioFile, 3);
      } else {
        console.log(`🔊 Fallback announcement for "${playerName}" (hasAudio: ${hasAudio})`);
        this.generateCall('player', playerName, undefined, 3);
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
   * Handle an event. Processing is synchronous; the promise keeps the handler
   * interface and turns a throw into a rejection for the caller's catch.
   */
  handleEvent(event: ParsedEvent): Promise<void> {
    return new Promise<void>((resolve) => {
      this.processEvent(event);
      resolve();
    });
  }

  private processEvent(event: ParsedEvent): void {
    this.stats.eventsProcessed++;

    if (!this.isEnabled()) {
      return;
    }

    const eventType = event.type as string;
    const eventData = event.data as Record<string, unknown>;

    // Remember the game mode (x01/cricket/tactics/other) from the most recent
    // event that carried it, so turn.finished and player.change can branch on
    // it. Reset on a new or deleted match so a stale mode never lingers.
    if (
      eventType === 'match.start' ||
      eventType === 'match.started' ||
      eventType === 'match.delete' ||
      eventType === 'match.deleted'
    ) {
      this.gameMode = undefined;
    } else {
      const game = eventData.game as { mode?: unknown } | undefined;
      if (typeof game?.mode === 'string') {
        this.gameMode = game.mode;
      }
    }

    switch (eventType) {
      case 'match.start':
      case 'match.started':
        // Reset known players and match state for new match
        this.knownPlayerNames.clear();
        this.currentMatchState = null;
        if (this.getCallSetting('gameStart')) {
          this.generateCall('game', 'Game on!', 'game_on', 10);
        }
        break;

      case 'match.state':
        // Process players from match state to generate missing voice files
        // And store match state for later use (e.g., getting remaining score)
        {
          const players = eventData.players as Array<{ name: string; remaining?: number; color?: string; [key: string]: unknown }> | undefined;
          const currentPlayerIndex = eventData.player as number ?? 0;
          // Remaining points per array position; `scores` are legs/sets won, not points
          const remainingScores = eventData.gameScores as number[] | undefined;
          const startScore = eventData.startScore as number | undefined;

          if (players && players.length > 0) {
            // Update match state with current scores
            this.currentMatchState = {
              players: players.map((p, idx) => ({
                name: p.name,
                remaining: typeof remainingScores?.[idx] === 'number' ? remainingScores[idx] : p.remaining,
                color: p.color,
              })),
              currentPlayerIndex,
              startScore,
            };

            console.log(`📊 Match state updated:`, JSON.stringify(this.currentMatchState, null, 2));

            // Fire and forget - don't block event processing
            this.processMatchPlayers(players).catch((err) => {
              console.error('Error processing match players:', err);
            });
          }
        }
        break;

      case 'match.finished':
        if (this.getCallSetting('gameOver')) {
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
        if (this.getCallSetting('gameOver')) {
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
        console.log(`📥 Received player.changed event:`, JSON.stringify(eventData, null, 2));
        if (this.getCallSetting('playerChange')) {
          const playerName = eventData.playerName as string;
          const playerIndex = eventData.playerIndex as number | undefined;

          // Get remaining from event data, or fall back to stored match state
          let remaining = eventData.remaining as number | undefined;

          if (!remaining && this.currentMatchState) {
            // Try to get remaining from match state by player name or index
            if (playerIndex !== undefined && this.currentMatchState.players[playerIndex]) {
              remaining = this.currentMatchState.players[playerIndex].remaining;
              console.log(`📊 Got remaining from match state by index ${playerIndex}: ${remaining}`);
            } else {
              // Find by name
              const player = this.currentMatchState.players.find(p => p.name === playerName);
              if (player) {
                remaining = player.remaining;
                console.log(`📊 Got remaining from match state by name "${playerName}": ${remaining}`);
              }
            }
          }

          console.log(`🎯 Player change: "${playerName}", remaining: ${remaining}, callCheckouts: ${this.getCallSetting('checkouts')}, isCheckout: ${remaining ? this.isCheckoutPossible(remaining) : 'N/A'}`);
          if (playerName) {
            // Cricket/Tactics "remaining" is points, not a dart countdown, so
            // never treat it as a checkout requirement - only the name is announced.
            const effectiveRemaining = this.isCricketMode() ? undefined : remaining;
            // Handle player change asynchronously to wait for audio generation if needed
            this.handlePlayerChange(playerName, effectiveRemaining).catch((err) => {
              console.error('Error handling player change:', err);
            });
          }
        }
        break;

      case 'turn.finished':
        console.log(`📥 Received turn.finished event:`, JSON.stringify(eventData, null, 2));
        this.handleTurnFinished(eventData);
        break;

      case 'cricket.closed':
        if (this.getCallSetting('cricketClosed')) {
          const field = eventData.field as string;
          // The field ends up in an audio file name; only ever accept a real
          // Cricket field so a malformed event can never reach the filesystem.
          if (typeof field === 'string' && /^(1[0-9]|20|25)$/.test(field)) {
            this.generateCall('special', closedText(field, this.config.language), closedFile(field), 7);
            this.stats.specialCalls++;
          }
        }
        break;

      case 'throw.detected':
        // Individual throw detection - busts are handled in turn.finished
        break;
    }
  }

  /**
   * Whether the remembered game mode is Cricket or Tactics (same Cricket rules)
   */
  private isCricketMode(): boolean {
    return this.gameMode === 'cricket' || this.gameMode === 'tactics';
  }

  /**
   * Handle turn finished event
   */
  private handleTurnFinished(eventData: Record<string, unknown>): void {
    // Cricket/Tactics have no bust, 180 or score concept the way X01 does: the
    // only thing worth announcing is a strong turn (enough marks in one turn).
    if (this.isCricketMode()) {
      this.handleCricketTurnFinished(eventData);
      return;
    }

    // Support both turnPoints and turnScore (Autodarts API uses turnScore)
    const turnPoints = (eventData.turnPoints as number) ?? (eventData.turnScore as number) ?? 0;
    const remaining = (eventData.remaining as number) || 0;
    const busted = eventData.busted as boolean;

    // Check for bulls in the throws array
    // Autodarts format: throws is an array of { segment: { bed, multiplier, number, name }, coords, throw }
    const throws = eventData.throws as Array<{
      segment?: { bed?: string; multiplier?: number; number?: number; name?: string };
      coords?: unknown;
      throw?: number;
    }> | undefined;
    let hasBull = false;
    let hasDoubleBull = false;

    if (throws && Array.isArray(throws)) {
      for (const throwData of throws) {
        const segment = throwData.segment;
        if (!segment) continue;

        // Autodarts uses segment.bed to indicate the type:
        // - "Bull" = Single Bull (25 points)
        // - "DoubleBull" = Double Bull / Bullseye (50 points)
        const bed = segment.bed?.toLowerCase() || '';
        const number = segment.number ?? 0;

        if (bed === 'doublebull' || (number === 25 && segment.multiplier === 2)) {
          hasDoubleBull = true;
        } else if (bed === 'bull' || (number === 25 && segment.multiplier === 1)) {
          hasBull = true;
        }
      }
    }

    console.log(`🎯 Turn throws:`, JSON.stringify(throws?.map(t => t.segment) ?? []));

    console.log(`🎯 Turn finished: ${turnPoints} points, ${remaining} remaining, busted: ${busted}, bull: ${hasBull}, doubleBull: ${hasDoubleBull}`);

    // Handle busted turn
    if (busted) {
      if (this.getCallSetting('busts')) {
        this.generateCall('special', 'Bust!', 'bust', 8);
        this.stats.specialCalls++;
      }
      return;
    }

    // Handle double bull (bullseye) - highest priority after 180
    if (hasDoubleBull && this.getCallSetting('doubleBulls')) {
      this.generateCall('special', 'Bullseye!', 'double_bull', 9);
      this.stats.specialCalls++;
      // Continue to also call the score
    }

    // Handle single bull
    if (hasBull && !hasDoubleBull && this.getCallSetting('bulls')) {
      this.generateCall('special', 'Bull!', 'bull', 7);
      this.stats.specialCalls++;
      // Continue to also call the score
    }

    // Check for 180
    if (turnPoints === 180 && this.getCallSetting('special180')) {
      this.generateCall('special', 'One hundred and eighty!', '180', 10);
      this.stats.specialCalls++;
      return;
    }

    // Call score
    if (this.getCallSetting('scores')) {
      // Check if we should only call high scores
      if (this.getCallSetting('highScoresOnly') && turnPoints < 100) {
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
   * Handle a Cricket/Tactics turn.finished: announce the strong turn (once per
   * turn, using the whole turn's marks so the number is correct) and nothing else.
   */
  private handleCricketTurnFinished(eventData: Record<string, unknown>): void {
    if (!this.getCallSetting('cricketMarks')) {
      return;
    }

    const rawTurnMarks = eventData.turnMarks;
    if (!Number.isFinite(rawTurnMarks)) {
      return;
    }
    // Number.isFinite rejects non-numbers and NaN/Infinity alike (unlike a
    // plain `typeof === 'number'` check, which lets NaN through and recurses
    // forever in scoreToEnglish/scoreToGerman).
    const turnMarks = rawTurnMarks as number;

    if (turnMarks < this.getCallSetting('cricketMarksThreshold')) {
      return;
    }

    this.generateCall('special', marksText(turnMarks, this.config.language), marksFile(turnMarks), 7);
    this.stats.specialCalls++;
  }

  /**
   * Check if a checkout is possible
   */
  private shouldCallRequiredScore(remaining: number): boolean {
    return (
      this.getCallSetting('checkouts') &&
      remaining <= this.getCallSetting('checkoutThreshold') &&
      this.isCheckoutPossible(remaining)
    );
  }

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
      callerType: this.config.callerType,
      ...(this.config.callerType === 'tts' ? { tts: this.buildTtsPayload() } : {}),
    };

    this.stats.callsGenerated++;

    // Apply delay if configured
    const delay = this.config.delayMs;

    const playLocalAudio = async (): Promise<void> => {
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

  /**
   * Execute an intent action
   * Called when an intent subscription triggers for this module
   */
  async executeIntentAction(
    intent: { id: string; source: string; payload: Record<string, unknown> },
    action: { type: string; config?: Record<string, unknown> }
  ): Promise<void> {
    const { type, config = {} } = action;
    console.log(`🎙️  [Caller] Executing intent action: ${type} for intent ${intent.id}`);

    switch (type) {
      case 'playPhrase': {
        const phrase = config.phrase as string;
        if (phrase) {
          // Map phrase to audio file
          const phraseMap: Record<string, string> = {
            oneEighty: '180',
            oneSeventyOne: '171',
            gameShot: 'game_shot',
            matchShot: 'match_shot',
            bust: 'bust',
            noScore: 'no_score',
            gameOn: 'game_on',
            matchOn: 'match_on',
          };
          const audioName = phraseMap[phrase] || phrase;
          await this.playIntentAudioFile(audioName);
        }
        break;
      }

      case 'sayText': {
        const text = config.text as string;
        if (text) {
          // Use TTS to say the text - emit as a special call
          this.emitCallRequest({
            id: `intent-${intent.id}-${Date.now()}`,
            type: 'special',
            text,
            priority: 5,
            timestamp: Date.now(),
            tts: this.buildTtsPayload(),
          });
        }
        break;
      }

      case 'playScore': {
        const field = config.field as string || 'score';
        const score = intent.payload[field] as number;
        if (score !== undefined) {
          // Call the score using the same method as regular score calls
          this.emitCallRequest({
            id: `intent-${intent.id}-${Date.now()}`,
            type: 'score',
            text: String(score),
            priority: 5,
            timestamp: Date.now(),
            tts: this.buildTtsPayload(),
          });
        }
        break;
      }

      case 'playFile': {
        const file = config.file as string;
        if (file) {
          await this.playIntentAudioFile(file);
        }
        break;
      }

      default:
        console.warn(`🎙️  [Caller] Unknown intent action type: ${type}`);
    }
  }

  /**
   * Play an audio file by name (for intents)
   */
  private async playIntentAudioFile(name: string): Promise<void> {
    const voicePackId = this.getVoicepackId();
    const voicePacksDir = this.config.voicePacksDir;
    if (voicePackId && voicePacksDir) {
      const filePath = intentAudioPath(voicePacksDir, voicePackId, name);
      if (!filePath) {
        console.warn(`🎙️  [Caller] Refused audio file name from intent: ${name}`);
        return;
      }
      try {
        await this.audioPlayer.playFile(filePath, 10, name);
      } catch (error) {
        console.warn(`🎙️  [Caller] Failed to play audio file: ${filePath}`);
      }
    }
  }
}

/**
 * Create Darts Caller handler from module config
 */
export function createDartsCallerHandler(
  config: Record<string, unknown>
): DartsCallerHandler {
  return new DartsCallerHandler(config);
}
