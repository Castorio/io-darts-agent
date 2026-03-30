/**
 * Game Display Module Event Handler
 *
 * Processes Autodarts events for the Game Display module.
 * The Game Display primarily uses WebSocket for real-time updates,
 * but this handler can be used for server-side event logging,
 * animation triggering, and statistics tracking.
 */
/**
 * Game Display Handler class
 */
export class GameDisplayHandler {
    config;
    eventCallbacks = [];
    // Statistics tracking
    stats = {
        eventsProcessed: 0,
        animationsTriggered: 0,
        matchesStarted: 0,
        matchesFinished: 0,
        throw180s: 0,
        checkouts: 0,
    };
    constructor(config) {
        this.config = config;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = config;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Register event callback
     */
    onEvent(callback) {
        this.eventCallbacks.push(callback);
    }
    /**
     * Remove event callback
     */
    offEvent(callback) {
        const index = this.eventCallbacks.indexOf(callback);
        if (index > -1) {
            this.eventCallbacks.splice(index, 1);
        }
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
            animationsTriggered: 0,
            matchesStarted: 0,
            matchesFinished: 0,
            throw180s: 0,
            checkouts: 0,
        };
    }
    /**
     * Handle an event
     */
    async handleEvent(event) {
        this.stats.eventsProcessed++;
        // Check for animation triggers
        const trigger = this.checkAnimationTrigger(event);
        // Update statistics based on event
        this.updateStats(event);
        // Notify callbacks
        for (const callback of this.eventCallbacks) {
            try {
                callback(event, trigger || undefined);
            }
            catch (error) {
                console.error('Game Display callback error:', error);
            }
        }
    }
    /**
     * Check if event should trigger an animation
     */
    checkAnimationTrigger(event) {
        const animations = this.config.animations;
        if (!animations?.enabled) {
            return null;
        }
        const eventType = event.type;
        const eventData = event.data;
        // Handle throw events
        if (eventType === 'throw.detected') {
            return this.checkThrowAnimation(eventData);
        }
        // Handle game finished (leg won)
        if (eventType === 'game.finished') {
            const config = animations.legWin;
            if (config?.enabled !== false) {
                this.stats.animationsTriggered++;
                return {
                    type: 'legWin',
                    config: config || { enabled: true },
                    playerIndex: eventData.winnerIndex,
                    playerName: eventData.winner,
                };
            }
        }
        // Handle match finished
        if (eventType === 'match.finished') {
            const config = animations.matchWin;
            if (config?.enabled !== false) {
                this.stats.animationsTriggered++;
                return {
                    type: 'matchWin',
                    config: config || { enabled: true },
                    playerName: eventData.winner,
                };
            }
        }
        return null;
    }
    /**
     * Check throw event for animation triggers
     */
    checkThrowAnimation(eventData) {
        const animations = this.config.animations;
        if (!animations)
            return null;
        const turnPoints = eventData.turnPoints || 0;
        const segment = eventData.segment;
        const multiplier = segment?.multiplier || 0;
        const number = segment?.number || 0;
        const playerIndex = eventData.playerIndex;
        const playerName = eventData.playerName;
        // Check for 180
        if (turnPoints === 180) {
            const config = animations.throw180;
            if (config?.enabled !== false) {
                this.stats.animationsTriggered++;
                this.stats.throw180s++;
                return {
                    type: '180',
                    config: config || { enabled: true },
                    playerConfig: this.getPlayerAnimationConfig(playerIndex, 'throw180'),
                    playerIndex,
                    playerName,
                };
            }
        }
        // Check for bust
        if (eventData.busted) {
            const config = animations.bust;
            if (config?.enabled !== false) {
                this.stats.animationsTriggered++;
                return {
                    type: 'bust',
                    config: config || { enabled: true },
                    playerIndex,
                    playerName,
                };
            }
        }
        // Check for double bull
        if (number === 25 && multiplier === 2) {
            const config = animations.doubleBull;
            if (config?.enabled !== false) {
                this.stats.animationsTriggered++;
                return {
                    type: 'doubleBull',
                    config: config || { enabled: true },
                    playerIndex,
                    playerName,
                };
            }
        }
        // Check for single bull
        if (number === 25 && multiplier === 1) {
            const config = animations.bull;
            if (config?.enabled !== false) {
                this.stats.animationsTriggered++;
                return {
                    type: 'bull',
                    config: config || { enabled: true },
                    playerIndex,
                    playerName,
                };
            }
        }
        // Check for high score
        const highScoreConfig = animations.highScore;
        const threshold = highScoreConfig?.threshold || 140;
        if (turnPoints >= threshold && turnPoints < 180) {
            if (highScoreConfig?.enabled !== false) {
                this.stats.animationsTriggered++;
                return {
                    type: 'highScore',
                    config: highScoreConfig || { enabled: true },
                    playerIndex,
                    playerName,
                };
            }
        }
        return null;
    }
    /**
     * Get player-specific animation config override
     */
    getPlayerAnimationConfig(playerIndex, animationType) {
        const playerAnimations = this.config.playerAnimations;
        if (!playerAnimations || playerAnimations.length === 0) {
            return undefined;
        }
        // Find config for this player
        const playerConfig = playerAnimations[playerIndex];
        if (!playerConfig) {
            return undefined;
        }
        return playerConfig[animationType];
    }
    /**
     * Update statistics based on event
     */
    updateStats(event) {
        const eventType = event.type;
        const eventData = event.data;
        if (eventType === 'match.start' || eventType === 'match.started') {
            this.stats.matchesStarted++;
        }
        if (eventType === 'match.finished') {
            this.stats.matchesFinished++;
        }
        if (eventType === 'game.finished') {
            const checkoutPath = eventData.checkoutPath;
            if (checkoutPath && checkoutPath.length > 0) {
                this.stats.checkouts++;
            }
        }
    }
    /**
     * Get animation duration based on speed setting
     */
    getAnimationDuration(baseDuration) {
        const speed = this.config.animationSpeed || 'normal';
        switch (speed) {
            case 'slow':
                return baseDuration * 1.5;
            case 'fast':
                return baseDuration * 0.7;
            default:
                return baseDuration;
        }
    }
    /**
     * Check if checkout should be shown
     */
    shouldShowCheckout(remaining) {
        if (!this.config.showCheckouts) {
            return false;
        }
        const threshold = this.config.checkoutThreshold || 170;
        return remaining <= threshold && remaining >= 2;
    }
}
/**
 * Create Game Display handler from module config
 */
export function createGameDisplayHandler(config) {
    return new GameDisplayHandler(config);
}
//# sourceMappingURL=GameDisplayHandler.js.map