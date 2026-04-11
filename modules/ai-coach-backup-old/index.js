/**
 * AI Coach Module for IO-Darts-Agent
 *
 * SDK-based module that provides intelligent coaching tips,
 * encouragement, and performance analysis during darts matches.
 */

import * as net from 'net';

const SOCKET_PATH = process.env.AUTODARTS_SOCKET_PATH;
const MODULE_ID = process.env.AUTODARTS_MODULE_ID || 'ai-coach';

let socket = null;
let config = {};
let messageBuffer = '';

// Match state
let currentMatchId = null;
let turnCounter = 0;
let lastTipTurn = 0;
let consecutiveGoodScores = 0;
let consecutiveBadScores = 0;
const matchStats = new Map();

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  enabled: true,
  coachingMode: 'balanced',
  tipFrequency: 6,
  voiceOutput: true,
  comparisonSettings: {
    enableComparison: true,
    comparisonPeriod: 'lastSession',
    showWhenBetter: true,
    showWhenWorse: true,
  },
  tipCategories: {
    checkoutTips: true,
    consistencyTips: true,
    mentalTips: true,
    encouragement: true,
    improvementSuggestions: true,
  },
  triggerSettings: {
    onMatchStart: true,
    onHighScore: true,
    on180: true,
    onBust: true,
    onMissedDouble: true,
    onCheckout: true,
    onMatchEnd: true,
    onStreakDetected: true,
  },
  aiSettings: {
    personality: 'supportive',
    tipLength: 'medium',
  },
};

/**
 * Encouraging messages for different situations
 */
const ENCOURAGEMENT_MESSAGES = {
  supportive: {
    matchStart: [
      "Let's have a great game! Focus on your rhythm.",
      "You've got this! Take your time with each throw.",
      'Time to play some darts! Remember to breathe and stay relaxed.',
    ],
    highScore: [
      'Great throw! Keep that momentum going.',
      'Nice one! Your grouping is looking good.',
      'Excellent scoring! Stay focused.',
    ],
    on180: [
      "MAXIMUM! What a throw! You're on fire!",
      "Perfect 180! That's the form we love to see!",
      'ONE HUNDRED AND EIGHTY! Brilliant!',
    ],
    onBust: [
      'No worries, shake it off. Next turn is yours.',
      'It happens to everyone. Reset and go again.',
      'Stay positive! Focus on the next opportunity.',
    ],
    onCheckout: [
      'Clean finish! Great composure under pressure.',
      "That's how you close out a leg! Well done.",
      'Brilliant checkout! Clinical finishing.',
    ],
    matchEnd: [
      "Good game! Let's look at what went well.",
      'Well played! Every match is a learning opportunity.',
      "Thanks for playing! Here's your performance summary.",
    ],
  },
  analytical: {
    matchStart: [
      'Match starting. Focus on consistent grouping.',
      'Remember: setup shots are just as important as finishes.',
      'Key focus: maintain your throwing rhythm throughout.',
    ],
    highScore: [
      'Good scoring. Your average is trending upward.',
      'Solid throw. Consistency is key.',
      'Nice score. Keep tracking your target areas.',
    ],
    on180: [
      'Maximum achieved. Perfect dart placement on T20.',
      '180 registered. Your T20 accuracy is excellent today.',
      'Perfect score. Maintain that throwing line.',
    ],
    onBust: [
      'Bust recorded. Consider your checkout path earlier.',
      'Over-score detected. Adjust your strategy for outshot.',
      'Bust situation. Analyze the optimal path next time.',
    ],
    onCheckout: [
      'Successful checkout. Good dart selection.',
      'Leg won. Your doubles percentage is solid.',
      'Clean finish. The setup was well calculated.',
    ],
    matchEnd: [
      "Match complete. Let's review the statistics.",
      'Final analysis: here are your key metrics.',
      'Match summary: performance data compiled.',
    ],
  },
  competitive: {
    matchStart: [
      "Time to dominate! Show them what you've got.",
      "Let's crush this match! Full focus, maximum effort.",
      'Game on! Every dart counts. Make them all matter.',
    ],
    highScore: [
      "That's the spirit! Keep the pressure on.",
      'Good hit! Now do it again.',
      "Strong throw! Don't let up now.",
    ],
    on180: [
      "180! That's championship form right there!",
      "MAXIMUM! Now that's how champions throw!",
      'Perfect 180! Keep that intensity!',
    ],
    onBust: [
      'Shake it off! Champions recover fast.',
      'Refocus! Next throw, take control back.',
      'Reset! Show them your comeback game.',
    ],
    onCheckout: [
      "Yes! That's a killer finish!",
      'Boom! Clinical under pressure!',
      "That's how winners close out legs!",
    ],
    matchEnd: [
      "Match done! Time to analyze and improve.",
      "Good fight! Let's see where we can get even better.",
      'Match complete! On to the next challenge.',
    ],
  },
  humorous: {
    matchStart: [
      "Alright, let's see if those darts still remember how to fly straight!",
      'May your throws be true and your bounceouts be few!',
      'Time to play! Remember, the board is your friend, not your enemy.',
    ],
    highScore: [
      "Look at you go! The board didn't see that coming.",
      "Nice! Even I'm impressed, and I'm just a coach.",
      "Well well, someone's been eating their Wheaties!",
    ],
    on180: [
      '180! Did you just do that on purpose?! Amazing!',
      'MAXIMUM! Quick, someone call the darts police!',
      "One-eighty! I'm running out of things to say!",
    ],
    onBust: [
      'Oops! Even the best overachieve sometimes.',
      'Happens to the best of us! Math is hard.',
      'The board giveth and the board taketh away.',
    ],
    onCheckout: [
      "And that's how it's done! Smooth as butter.",
      'Clean checkout! The crowd goes mild!',
      'Finished! The dartboard surrenders!',
    ],
    matchEnd: [
      'That was fun! Well, for me at least - I just watched.',
      'Good match! Time for a virtual high five.',
      'Match over! You survived my coaching!',
    ],
  },
};

/**
 * Connect to the hub
 */
function connect() {
  if (!SOCKET_PATH) {
    console.error('AUTODARTS_SOCKET_PATH not set');
    process.exit(1);
  }

  socket = net.createConnection(SOCKET_PATH, () => {
    console.log('Connected to hub');
    sendReady();
  });

  socket.on('data', (data) => {
    messageBuffer += data.toString();
    processMessages();
  });

  socket.on('close', () => {
    console.log('Disconnected from hub');
    process.exit(0);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
}

/**
 * Process incoming messages
 */
function processMessages() {
  const parts = messageBuffer.split('\n');
  messageBuffer = parts.pop() || '';

  for (const part of parts) {
    if (part.trim()) {
      try {
        const message = JSON.parse(part);
        handleMessage(message);
      } catch (e) {
        console.error('Failed to parse message:', e.message);
      }
    }
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(message) {
  switch (message.type) {
    case 'init':
      handleInit(message.payload);
      break;
    case 'event':
      handleEvent(message.payload.event);
      break;
    case 'config.update':
      handleConfigUpdate(message.payload);
      break;
    case 'shutdown':
      handleShutdown(message.payload);
      break;
    case 'ping':
      sendPong();
      break;
  }
}

/**
 * Handle initialization
 */
function handleInit(payload) {
  config = mergeConfig(DEFAULT_CONFIG, payload.config);
  log('info', 'AI Coach initialized', { config });
}

/**
 * Merge configuration with defaults
 */
function mergeConfig(defaults, overrides) {
  return {
    ...defaults,
    ...overrides,
    comparisonSettings: {
      ...defaults.comparisonSettings,
      ...overrides?.comparisonSettings,
    },
    tipCategories: {
      ...defaults.tipCategories,
      ...overrides?.tipCategories,
    },
    triggerSettings: {
      ...defaults.triggerSettings,
      ...overrides?.triggerSettings,
    },
    aiSettings: {
      ...defaults.aiSettings,
      ...overrides?.aiSettings,
    },
  };
}

/**
 * Handle event from hub
 */
function handleEvent(event) {
  if (!config.enabled) {
    return;
  }

  const triggers = config.triggerSettings || {};

  switch (event.type) {
    case 'match.start':
      if (triggers.onMatchStart) handleMatchStart(event.data);
      break;
    case 'match.finished':
    case 'match.result':
      if (triggers.onMatchEnd) handleMatchEnd(event.data);
      break;
    case 'throw.180':
      if (triggers.on180) handle180(event.data);
      break;
    case 'throw.highfinish':
      if (triggers.onCheckout) handleHighFinish(event.data);
      break;
    case 'throw.bust':
      if (triggers.onBust) handleBust(event.data);
      break;
    case 'turn.finished':
      turnCounter++;
      handleTurnFinished(event.data);
      break;
    case 'match.state':
      handleMatchState(event.data);
      break;
    case 'game.finished':
      if (triggers.onCheckout) handleGameFinished(event.data);
      break;
  }
}

/**
 * Get a random message from a category
 */
function getRandomMessage(category) {
  const personality = config.aiSettings?.personality || 'supportive';
  const messages =
    ENCOURAGEMENT_MESSAGES[personality]?.[category] ||
    ENCOURAGEMENT_MESSAGES.supportive[category];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Generate a unique tip ID
 */
function generateTipId() {
  return `tip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Emit a coaching tip
 */
function emitTip(type, text, priority = 5, playerName = null) {
  const tip = {
    tipId: generateTipId(),
    type,
    text,
    priority,
    voiceOutput: config.voiceOutput,
    playerName,
    timestamp: Date.now(),
  };

  // Log the tip
  console.log(`🧠 AI Coach: [${type}] ${text}`);
  log('info', `Tip: ${text}`, { type, priority });

  // Emit intent to hub
  emitIntent('ai-coach.tip.generated', tip);
}

/**
 * Check if we should generate a periodic tip
 */
function shouldGenerateTip() {
  if (!config.enabled) return false;

  const mode = config.coachingMode || 'balanced';
  const frequency = config.tipFrequency || 6;

  if (mode === 'minimal') return false;
  if (frequency === 0) return false;

  const turnsSinceLastTip = turnCounter - lastTipTurn;
  return turnsSinceLastTip >= frequency;
}

/**
 * Handle match start
 */
function handleMatchStart(data) {
  currentMatchId = data?.matchId || null;
  turnCounter = 0;
  lastTipTurn = 0;
  consecutiveGoodScores = 0;
  consecutiveBadScores = 0;
  matchStats.clear();

  const message = getRandomMessage('matchStart');
  emitTip('encouragement', message, 7);
}

/**
 * Handle match end
 */
function handleMatchEnd(_data) {
  const message = getRandomMessage('matchEnd');
  emitTip('general', message, 8);

  // Generate performance summary
  if (config.comparisonSettings?.enableComparison) {
    generateMatchSummary();
  }
}

/**
 * Handle 180
 */
function handle180(_data) {
  const message = getRandomMessage('on180');
  emitTip('encouragement', message, 10);
  consecutiveGoodScores++;
  consecutiveBadScores = 0;
}

/**
 * Handle high finish
 */
function handleHighFinish(data) {
  const score = data?.checkout || data?.score;
  const message = `${getRandomMessage('onCheckout')} ${score ? `A ${score} finish!` : ''}`;
  emitTip('encouragement', message.trim(), 9);
}

/**
 * Handle bust
 */
function handleBust(_data) {
  const message = getRandomMessage('onBust');
  emitTip('mental', message, 6);
  consecutiveBadScores++;
  consecutiveGoodScores = 0;

  // Detect bad streak
  if (consecutiveBadScores >= 3 && config.triggerSettings?.onStreakDetected) {
    emitTip(
      'mental',
      'You seem to be in a tough spot. Take a deep breath, reset your stance, and trust your throw.',
      7
    );
    emitIntent('ai-coach.streak.detected', {
      type: 'bad',
      count: consecutiveBadScores,
    });
  }
}

/**
 * Handle turn finished
 */
function handleTurnFinished(data) {
  const score = data?.score || data?.points || 0;

  // Track scoring patterns
  if (score >= 100) {
    consecutiveGoodScores++;
    consecutiveBadScores = 0;

    // High score feedback
    if (config.triggerSettings?.onHighScore && score >= 100) {
      const message = getRandomMessage('highScore');
      emitTip('encouragement', message, 5);
    }
  } else if (score < 40) {
    consecutiveBadScores++;
    consecutiveGoodScores = 0;
  }

  // Detect good streak
  if (
    consecutiveGoodScores >= 3 &&
    config.triggerSettings?.onStreakDetected &&
    shouldGenerateTip()
  ) {
    emitTip(
      'encouragement',
      "You're on a roll! Keep that rhythm going, you're in the zone!",
      6
    );
    emitIntent('ai-coach.streak.detected', {
      type: 'good',
      count: consecutiveGoodScores,
    });
    lastTipTurn = turnCounter;
  }

  // Periodic tips based on frequency
  if (shouldGenerateTip()) {
    generatePeriodicTip();
    lastTipTurn = turnCounter;
  }
}

/**
 * Handle match state updates
 */
function handleMatchState(data) {
  const players = data?.players;

  if (players) {
    for (const player of players) {
      const playerId = player.id || player.name;
      const playerName = player.name;

      if (!matchStats.has(playerId)) {
        matchStats.set(playerId, {
          matchId: currentMatchId || '',
          playerId,
          playerName,
          average: 0,
          checkoutRate: 0,
          count180s: 0,
          highestScore: 0,
          totalDarts: 0,
          bustCount: 0,
          turnCount: 0,
          scores: [],
        });
      }

      // Update stats from player data
      const stats = matchStats.get(playerId);
      if (player.average !== undefined) stats.average = player.average;
      if (player.checkoutRate !== undefined) stats.checkoutRate = player.checkoutRate;
    }
  }
}

/**
 * Handle game finished (leg won)
 */
function handleGameFinished(data) {
  const winner = data?.winner || data?.winnerName;

  if (winner && config.tipCategories?.encouragement) {
    emitTip('encouragement', 'Great leg! Keep the momentum going.', 7, winner);
  }
}

/**
 * Generate periodic tip based on coaching mode
 */
function generatePeriodicTip() {
  const categories = config.tipCategories || {};
  const tips = [];

  if (categories.checkoutTips) {
    tips.push({
      type: 'checkout',
      message: 'Remember: a good setup shot is often more valuable than going for the big number.',
    });
  }
  if (categories.consistencyTips) {
    tips.push({
      type: 'consistency',
      message: 'Focus on a consistent throwing motion. Same stance, same release, same follow-through.',
    });
  }
  if (categories.mentalTips) {
    tips.push({
      type: 'mental',
      message: "Stay in the present. Don't think about the last throw or the next - just this one.",
    });
  }
  if (categories.improvementSuggestions) {
    tips.push({
      type: 'improvement',
      message: 'Try to notice patterns in your misses. Are they consistently left, right, high, or low?',
    });
  }

  if (tips.length > 0) {
    const selected = tips[Math.floor(Math.random() * tips.length)];
    emitTip(selected.type, selected.message, 4);
  }
}

/**
 * Generate match summary
 */
function generateMatchSummary() {
  for (const [playerId, stats] of matchStats) {
    const summaryParts = [];

    if (stats.average > 0) {
      summaryParts.push(`Average: ${stats.average.toFixed(1)}`);
    }
    if (stats.count180s > 0) {
      summaryParts.push(`180s: ${stats.count180s}`);
    }
    if (stats.checkoutRate > 0) {
      summaryParts.push(`Checkout: ${(stats.checkoutRate * 100).toFixed(0)}%`);
    }

    if (summaryParts.length > 0) {
      const summaryText = `${stats.playerName}'s match summary: ${summaryParts.join(', ')}`;
      emitTip('general', summaryText, 6, stats.playerName);

      emitIntent('ai-coach.summary.ready', {
        matchId: currentMatchId || '',
        playerName: stats.playerName,
        summary: summaryText,
      });
    }
  }
}

/**
 * Handle config update
 */
function handleConfigUpdate(payload) {
  config = mergeConfig(config, payload.config);
  log('info', 'Config updated', { changedKeys: payload.changedKeys });
}

/**
 * Handle shutdown
 */
function handleShutdown(payload) {
  log('info', `Shutdown requested: ${payload.reason}`);
  setTimeout(() => {
    process.exit(0);
  }, 100);
}

/**
 * Send ready signal
 */
function sendReady() {
  send({
    id: generateId(),
    type: 'ready',
    timestamp: Date.now(),
    payload: {
      moduleId: MODULE_ID,
      version: '1.0.0',
    },
  });
}

/**
 * Send pong response
 */
function sendPong() {
  send({
    id: generateId(),
    type: 'pong',
    timestamp: Date.now(),
    payload: {},
  });
}

/**
 * Log to hub
 */
function log(level, message, context = {}) {
  send({
    id: generateId(),
    type: 'log',
    timestamp: Date.now(),
    payload: { level, message, context },
  });
}

/**
 * Emit intent to hub
 */
function emitIntent(intentId, payload = {}) {
  send({
    id: generateId(),
    type: 'intent.emit',
    timestamp: Date.now(),
    payload: {
      moduleId: MODULE_ID,
      intentId,
      payload,
    },
  });
}

/**
 * Send message to hub
 */
function send(message) {
  if (socket) {
    socket.write(JSON.stringify(message) + '\n');
  }
}

/**
 * Generate unique message ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Start the module
connect();
