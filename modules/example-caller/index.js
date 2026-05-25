/**
 * Example Caller Module for IO-Darts-Agent
 *
 * This is a simple example module that demonstrates how to:
 * - Connect to the hub
 * - Receive events
 * - Use configuration
 * - Log messages
 *
 * In a real module, you would add actual calling logic (TTS, sound files, etc.)
 */

import * as net from 'net';

const SOCKET_PATH = process.env.AUTODARTS_SOCKET_PATH;
const MODULE_ID = process.env.AUTODARTS_MODULE_ID || 'example-caller';

let socket = null;
let config = {};
let messageBuffer = '';
let currentTurnScore = 0;

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
  config = payload.config;
  log('info', 'Module initialized', { config });
}

/**
 * Handle event from hub
 */
function handleEvent(event) {
  if (!config.enabled) {
    return;
  }

  switch (event.type) {
    case 'match.start':
      handleMatchStart(event.data);
      break;
    case 'throw.detected':
      handleThrow(event.data);
      break;
    case 'player.change':
      handlePlayerChange(event.data);
      break;
    case 'game.finished':
      handleGameFinished(event.data);
      break;
    case 'match.finished':
      handleMatchFinished(event.data);
      break;
  }
}

/**
 * Handle match start
 */
function handleMatchStart(data) {
  currentTurnScore = 0;
  const message = config.language === 'de' ? 'Spiel gestartet!' : 'Game on!';
  call(message);
  log('info', 'Match started', { matchId: data.matchId });
}

/**
 * Handle throw
 */
function handleThrow(data) {
  const { segment, throwNumber } = data;
  const score = segment.multiplier * segment.number;

  currentTurnScore += score;

  // Call the throw
  call(formatThrow(segment));

  // Check for special calls
  if (throwNumber === 3) {
    callTurnScore(currentTurnScore);
    currentTurnScore = 0;
  }
}

/**
 * Handle player change
 */
function handlePlayerChange(data) {
  currentTurnScore = 0;
  const message = config.language === 'de'
    ? `${data.playerName} ist dran`
    : `${data.playerName}'s turn`;
  call(message);
}

/**
 * Handle game finished
 */
function handleGameFinished(data) {
  const message = config.language === 'de'
    ? `${data.winnerName} gewinnt das Leg!`
    : `${data.winnerName} wins the leg!`;
  call(message);
}

/**
 * Handle match finished
 */
function handleMatchFinished(data) {
  const message = config.language === 'de'
    ? `${data.winnerName} gewinnt das Match!`
    : `${data.winnerName} wins the match!`;
  call(message);
}

/**
 * Format throw for calling
 */
function formatThrow(segment) {
  const { name, multiplier, number } = segment;

  if (multiplier === 0) {
    return config.language === 'de' ? 'Außen' : 'Outside';
  }

  if (number === 25) {
    if (multiplier === 2) {
      return config.language === 'de' ? 'Bull' : 'Bullseye';
    }
    return 'Bull';
  }

  const prefix = multiplier === 3 ? 'Triple' : multiplier === 2 ? 'Double' : '';
  const prefixDe = multiplier === 3 ? 'Triple' : multiplier === 2 ? 'Doppel' : '';

  if (config.language === 'de') {
    return prefix ? `${prefixDe} ${number}` : `${number}`;
  }

  return prefix ? `${prefix} ${number}` : `${number}`;
}

/**
 * Call turn score
 */
function callTurnScore(score) {
  if (score === 180) {
    call(config.language === 'de' ? 'Einhundertachtzig!' : 'One hundred and eighty!');
    return;
  }

  if (config.callHighScores && score >= 100) {
    call(score.toString());
  }
}

/**
 * Simulate calling (in real module: TTS or sound playback)
 */
function call(text) {
  console.log(`🔊 CALL: ${text}`);
  // In a real module, you would:
  // - Use a TTS engine (e.g., say on macOS, espeak on Linux)
  // - Play pre-recorded sound files
  // - Send to external calling service
}

/**
 * Handle config update
 */
function handleConfigUpdate(payload) {
  config = payload.config;
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
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Start the module
connect();
