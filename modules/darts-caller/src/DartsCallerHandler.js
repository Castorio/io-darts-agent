/**
 * Darts Caller Module Event Handler
 *
 * Processes Autodarts events and generates speech/audio calls
 * Audio is played locally on the server machine
 */
import * as fs from 'fs';
import * as path from 'path';
import { LocalAudioPlayer } from './LocalAudioPlayer.js';
/**
 * Score to text mapping for special scores
 */
const SPECIAL_SCORES = {
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
    config;
    callbackQueue = [];
    callRequestCallbacks = [];
    callIdCounter = 0;
    elevenLabsService = null;
    voicePackCache = new Map();
    audioPlayer;
    // Statistics
    stats = {
        eventsProcessed: 0,
        callsGenerated: 0,
        scoresAnnounced: 0,
        checkoutsAnnounced: 0,
        specialCalls: 0,
        elevenLabsCalls: 0,
        voicePackCalls: 0,
    };
    constructor(config) {
        this.config = {
            enabled: true,
            callerType: 'voicepack', // Default to voicepack for local playback
            ttsRate: 1.0,
            ttsPitch: 1.0,
            volume: 80,
            callScores: true,
            callHighScoresOnly: false,
            callCheckouts: true,
            callPlayerChange: true,
            callGameStart: true,
            callGameOver: true,
            call180: true,
            callBusts: true,
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
     * Set ElevenLabs service for TTS
     */
    setElevenLabsService(service) {
        this.elevenLabsService = service;
    }
    /**
     * Get ElevenLabs service
     */
    getElevenLabsService() {
        return this.elevenLabsService;
    }
    /**
     * Register a callback for call requests
     */
    onCallRequest(callback) {
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
    emitCallRequest(request) {
        for (const callback of this.callRequestCallbacks) {
            callback(request);
        }
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Update audio player volume if changed
        if (config.volume !== undefined) {
            this.audioPlayer.setVolume(config.volume);
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Check if caller is enabled
     */
    isEnabled() {
        return this.config.enabled ?? true;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
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
    setVoicePacksDir(dir) {
        this.config.voicePacksDir = dir;
    }
    /**
     * Get available voice packs
     */
    getAvailableVoicePacks() {
        const voicePacksDir = this.config.voicePacksDir;
        if (!voicePacksDir || !fs.existsSync(voicePacksDir)) {
            return [];
        }
        const packs = [];
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
                        }
                        catch {
                            // Skip invalid metadata
                        }
                    }
                }
            }
        }
        catch {
            // Ignore errors reading directory
        }
        return packs;
    }
    /**
     * Clear voice pack cache
     */
    clearVoicePackCache() {
        this.voicePackCache.clear();
    }
    /**
     * Handle an event
     */
    async handleEvent(event) {
        this.stats.eventsProcessed++;
        if (!this.isEnabled()) {
            return;
        }
        const eventType = event.type;
        const eventData = event.data;
        switch (eventType) {
            case 'match.start':
            case 'match.started':
                if (this.config.callGameStart) {
                    this.generateCall('game', 'Game on!', 'game_on', 10);
                }
                break;
            case 'match.finished':
                if (this.config.callGameOver) {
                    const winner = eventData.winner;
                    const winnerName = winner?.name;
                    if (winnerName) {
                        this.generateCall('game', `Game shot and the match! ${winnerName}!`, 'match_shot', 10);
                    }
                    else {
                        this.generateCall('game', 'Game shot and the match!', 'match_shot', 10);
                    }
                }
                break;
            case 'game.finished':
                if (this.config.callGameOver) {
                    const gameWinner = eventData.winner;
                    const gameWinnerName = gameWinner?.name;
                    if (gameWinnerName) {
                        this.generateCall('game', `Game shot! ${gameWinnerName}!`, 'game_shot', 9);
                    }
                    else {
                        this.generateCall('game', 'Game shot!', 'game_shot', 9);
                    }
                }
                break;
            case 'player.change':
            case 'player.changed':
                if (this.config.callPlayerChange) {
                    const playerName = eventData.playerName;
                    const remaining = eventData.remaining;
                    if (playerName) {
                        if (remaining && this.config.callCheckouts && this.isCheckoutPossible(remaining)) {
                            this.generateCall('player', `${playerName}, you require ${remaining}`, `require_${remaining}`, 5);
                            this.stats.checkoutsAnnounced++;
                        }
                        else {
                            this.generateCall('player', playerName, undefined, 3);
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
    handleTurnFinished(eventData) {
        // Support both turnPoints and turnScore (Autodarts API uses turnScore)
        const turnPoints = eventData.turnPoints ?? eventData.turnScore ?? 0;
        const remaining = eventData.remaining || 0;
        const busted = eventData.busted;

        // Check for bulls in the throws array
        // Autodarts format: throws is an array of { segment: { bed, multiplier, number, name }, coords, throw }
        const throws = eventData.throws;
        let hasBull = false;
        let hasDoubleBull = false;

        if (throws && Array.isArray(throws)) {
            for (const throwData of throws) {
                const segment = throwData.segment;
                if (!segment) continue;

                // Autodarts uses segment.bed to indicate the type:
                // - "Bull" = Single Bull (25 points)
                // - "DoubleBull" = Double Bull / Bullseye (50 points)
                const bed = (segment.bed || '').toLowerCase();
                const number = segment.number ?? 0;

                if (bed === 'doublebull' || (number === 25 && segment.multiplier === 2)) {
                    hasDoubleBull = true;
                } else if (bed === 'bull' || (number === 25 && segment.multiplier === 1)) {
                    hasBull = true;
                }
            }
        }

        console.log(`🎯 Turn finished: ${turnPoints} points, ${remaining} remaining, busted: ${busted}, bull: ${hasBull}, doubleBull: ${hasDoubleBull}`);
        console.log(`🎯 Turn throws:`, JSON.stringify(throws?.map(t => t.segment) ?? []));

        // Handle busted turn
        if (busted) {
            const callBusts = this.config.callSettings?.busts ?? this.config.callBusts ?? true;
            if (callBusts) {
                this.generateCall('special', 'Bust!', 'bust', 8);
                this.stats.specialCalls++;
            }
            return;
        }

        // Handle double bull (bullseye) - highest priority after 180
        const callDoubleBulls = this.config.callSettings?.doubleBulls ?? this.config.callDoubleBulls ?? true;
        if (hasDoubleBull && callDoubleBulls) {
            this.generateCall('special', 'Bullseye!', 'double_bull', 9);
            this.stats.specialCalls++;
            // Continue to also call the score
        }

        // Handle single bull
        const callBulls = this.config.callSettings?.bulls ?? this.config.callBulls ?? true;
        if (hasBull && !hasDoubleBull && callBulls) {
            this.generateCall('special', 'Bull!', 'bull', 7);
            this.stats.specialCalls++;
            // Continue to also call the score
        }

        // Check for 180
        const call180 = this.config.callSettings?.special180 ?? this.config.call180 ?? true;
        if (turnPoints === 180 && call180) {
            this.generateCall('special', 'One hundred and eighty!', '180', 10);
            this.stats.specialCalls++;
            return;
        }
        // Call score
        const callScores = this.config.callSettings?.scores ?? this.config.callScores ?? true;
        if (callScores) {
            // Check if we should only call high scores
            const highScoresOnly = this.config.callSettings?.highScoresOnly ?? this.config.callHighScoresOnly ?? false;
            if (highScoresOnly && turnPoints < 100) {
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
    isCheckoutPossible(remaining) {
        // Standard checkout range in darts (2-170, excluding 169, 168, 166, 165, 163, 162, 159)
        if (remaining < 2 || remaining > 170)
            return false;
        const impossible = [169, 168, 166, 165, 163, 162, 159];
        return !impossible.includes(remaining);
    }
    /**
     * Convert score to spoken text
     */
    scoreToText(score) {
        if (score === 0)
            return 'No score';
        if (score === 180)
            return 'One hundred and eighty!';
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
    numberToText(num) {
        const ones = [
            'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
            'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
            'seventeen', 'eighteen', 'nineteen',
        ];
        const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        if (num < 20)
            return ones[num];
        const t = Math.floor(num / 10);
        const o = num % 10;
        return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
    }
    /**
     * Get audio file name for a score
     */
    scoreToAudioFile(score) {
        // Standard naming convention: score_XXX.mp3 or special names
        if (score === 180)
            return '180';
        if (score === 0)
            return 'no_score';
        return `score_${score}`;
    }
    /**
     * Generate and play audio locally on the server
     */
    generateCall(type, text, audioFile, priority) {
        const request = {
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
                const voicePackId = this.config.voicePackId;
                const voicePacksDir = this.config.voicePacksDir;
                if (!voicePackId) {
                    console.warn('⚠️  Voice pack type selected but no voicePackId configured');
                }
                else if (!voicePacksDir) {
                    console.warn('⚠️  Voice pack type selected but no voicePacksDir configured');
                }
                else if (audioFile) {
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
                }
                else {
                    try {
                        const audioBuffer = await this.elevenLabsService.generateSpeech(text, {
                            voiceId: this.config.elevenlabs?.voiceId,
                            modelId: this.config.elevenlabs?.modelId,
                            voiceSettings: {
                                stability: this.config.elevenlabs?.stability ?? 0.5,
                                similarity_boost: this.config.elevenlabs?.similarityBoost ?? 0.75,
                            },
                        });
                        console.log(`🔊 Playing ElevenLabs generated audio for: "${text}"`);
                        await this.audioPlayer.playBuffer(audioBuffer, priority, text);
                        this.stats.elevenLabsCalls++;
                        this.emitCallRequest(request);
                        return;
                    }
                    catch (error) {
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
        }
        else {
            playLocalAudio().catch(console.error);
        }
    }
    /**
     * Resolve audio file path
     */
    resolveAudioFile(filename) {
        const packPath = this.config.audioPackPath || 'caller/default';
        return `${packPath}/${filename}.mp3`;
    }
    /**
     * Get pending calls in the queue
     */
    getPendingCalls() {
        return [...this.callbackQueue];
    }
    /**
     * Clear the call queue
     */
    clearQueue() {
        this.callbackQueue = [];
    }
    /**
     * Stop current audio playback
     */
    stopPlayback() {
        this.audioPlayer.stop();
    }
    /**
     * Skip current audio and play next
     */
    skipCurrent() {
        this.audioPlayer.skip();
    }
    /**
     * Get audio player status
     */
    getAudioStatus() {
        return {
            isPlaying: this.audioPlayer.getIsPlaying(),
            queueLength: this.audioPlayer.getQueueLength(),
        };
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        this.audioPlayer.stop();
        this.audioPlayer.cleanup();
        this.voicePackCache.clear();
    }
}
/**
 * Create Darts Caller handler from module config
 */
export function createDartsCallerHandler(config) {
    return new DartsCallerHandler(config);
}
//# sourceMappingURL=DartsCallerHandler.js.map