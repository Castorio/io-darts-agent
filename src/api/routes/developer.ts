/**
 * Developer Mode API Routes
 *
 * Provides endpoints for simulating Autodarts events for testing purposes.
 * Only available when developerMode is enabled in settings.
 */

import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { ParsedEvent, AutodartsEventType } from '../../types/index.js';

/**
 * Simulated match player
 */
interface SimulatedPlayer {
  id: string;
  name: string;
  index: number;
  color?: string;
}

/**
 * Simulated match state
 */
interface SimulatedMatchState {
  matchId: string;
  players: SimulatedPlayer[];
  currentPlayerIndex: number;
  scores: number[];
  gameScores: number[];
  round: number;
  leg: number;
  set: number;
  turnScore: number;
  turnBusted: boolean;
  /** Darts of the current turn, sent as turns[-1].throws like Autodarts */
  turnThrows: Array<{ segment: { number: number; multiplier: number; bed: string; name: string } }>;
}

/**
 * Default simulated match state
 */
function createDefaultMatchState(): SimulatedMatchState {
  return {
    matchId: `sim-${Date.now()}`,
    players: [
      { id: 'sim-p1', name: 'Player 1', index: 0, color: '#3b82f6' },
      { id: 'sim-p2', name: 'Player 2', index: 1, color: '#ef4444' },
    ],
    currentPlayerIndex: 0,
    scores: [501, 501],
    gameScores: [0, 0],
    round: 1,
    leg: 1,
    set: 1,
    turnScore: 0,
    turnBusted: false,
    turnThrows: [],
  };
}

// Current simulated match state
let currentSimState: SimulatedMatchState | null = null;

/**
 * Helper to check if developer mode is enabled
 */
function isDeveloperModeEnabled(server: APIServer): boolean {
  const config = server.getConfig();
  return config?.developerMode === true;
}

/**
 * Helper to check authentication
 */
function isAuthorized(server: APIServer, session: { authenticated?: boolean } | undefined): boolean {
  if (!server.isAuthEnabled()) {
    return true;
  }
  return session?.authenticated === true;
}

export interface DeveloperDependencies {
  emitEvent: (event: ParsedEvent) => void;
}

/**
 * Register developer mode routes
 */
export function registerDeveloperRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: DeveloperDependencies
): void {
  /**
   * GET /api/developer/status - Check if developer mode is enabled
   */
  fastify.get<{
    Reply: { enabled: boolean; matchActive: boolean; matchState?: SimulatedMatchState };
  }>('/api/developer/status', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { enabled: false, matchActive: false };
    }

    const enabled = isDeveloperModeEnabled(server);
    return {
      enabled,
      matchActive: currentSimState !== null,
      matchState: enabled ? currentSimState || undefined : undefined,
    };
  });

  /**
   * POST /api/developer/simulate/match/start - Simulate match start
   */
  fastify.post<{
    Body: {
      players?: Array<{ name: string; color?: string }>;
      startScore?: number;
    };
    Reply: { success: boolean; error?: string; matchId?: string };
  }>('/api/developer/simulate/match/start', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!isDeveloperModeEnabled(server)) {
      void reply.code(403);
      return { success: false, error: 'Developer mode is not enabled' };
    }

    // Create new match state
    currentSimState = createDefaultMatchState();

    // Apply custom players if provided
    if (request.body.players && request.body.players.length > 0) {
      currentSimState.players = request.body.players.map((p, i) => ({
        id: `sim-p${i + 1}`,
        name: p.name,
        index: i,
        color: p.color,
      }));
      currentSimState.scores = request.body.players.map(() => request.body.startScore || 501);
      currentSimState.gameScores = request.body.players.map(() => 0);
    }

    // Apply custom start score
    if (request.body.startScore) {
      currentSimState.scores = currentSimState.scores.map(() => request.body.startScore!);
    }

    // Emit match.start event
    const event: ParsedEvent = {
      type: 'match.start',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'match.start', data: {} },
      data: {
        matchId: currentSimState.matchId,
        boardId: 'sim-board',
      },
    };
    deps.emitEvent(event);

    // Emit initial match.state event after a short delay
    setTimeout(() => {
      if (currentSimState) {
        emitMatchState(deps);
      }
    }, 100);

    console.log(`🎯 [DEV] Simulated match started: ${currentSimState.matchId}`);
    return { success: true, matchId: currentSimState.matchId };
  });

  /**
   * POST /api/developer/simulate/match/end - Simulate match end
   */
  fastify.post<{
    Body: { winner?: number; cancelled?: boolean };
    Reply: { success: boolean; error?: string };
  }>('/api/developer/simulate/match/end', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!isDeveloperModeEnabled(server)) {
      void reply.code(403);
      return { success: false, error: 'Developer mode is not enabled' };
    }

    if (!currentSimState) {
      return { success: false, error: 'No active simulated match' };
    }

    const matchId = currentSimState.matchId;
    const winner = request.body.winner ?? 0;

    if (request.body.cancelled) {
      // Emit match.delete event
      const event: ParsedEvent = {
        type: 'match.delete',
        timestamp: new Date(),
        raw: { channel: 'simulated', topic: 'match.delete', data: {} },
        data: {
          matchId,
          boardId: 'sim-board',
        },
      };
      deps.emitEvent(event);
      console.log(`🎯 [DEV] Simulated match cancelled: ${matchId}`);
    } else {
      // Emit match.finished event
      const event: ParsedEvent = {
        type: 'match.finished',
        timestamp: new Date(),
        raw: { channel: 'simulated', topic: 'match.finished', data: {} },
        data: {
          matchId,
          winner,
          winnerName: currentSimState.players[winner]?.name || 'Unknown',
          players: currentSimState.players,
        },
      };
      deps.emitEvent(event);
      console.log(`🎯 [DEV] Simulated match finished: ${matchId}, winner: ${winner}`);
    }

    currentSimState = null;
    return { success: true };
  });

  /**
   * POST /api/developer/simulate/throw - Simulate a throw
   */
  fastify.post<{
    Body: {
      number: number;
      multiplier: 1 | 2 | 3;
    };
    Reply: { success: boolean; error?: string; points?: number; remaining?: number };
  }>('/api/developer/simulate/throw', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!isDeveloperModeEnabled(server)) {
      void reply.code(403);
      return { success: false, error: 'Developer mode is not enabled' };
    }

    if (!currentSimState) {
      return { success: false, error: 'No active simulated match' };
    }

    const { number, multiplier } = request.body;
    const points = number * multiplier;
    const playerIdx = currentSimState.currentPlayerIndex;

    // Emit throw.detected event
    const throwEvent: ParsedEvent = {
      type: 'throw.detected',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'throw.detected', data: {} },
      data: {
        segment: {
          number,
          multiplier,
          bed: getBedName(number, multiplier),
        },
        coords: { x: 0, y: 0 },
        throwNumber: 1,
        boardId: 'sim-board',
        points,
        turnPoints: currentSimState.turnScore + points,
      },
    };
    deps.emitEvent(throwEvent);

    // Update state
    currentSimState.turnThrows.push({ segment: { number, multiplier, bed: getBedName(number, multiplier), name: segmentName(number, multiplier) } });
    const newScore = currentSimState.scores[playerIdx] - points;
    if (newScore < 0 || (newScore === 1) || (newScore === 0 && multiplier !== 2)) {
      // Bust
      currentSimState.turnBusted = true;
      currentSimState.turnScore = 0;
    } else {
      currentSimState.scores[playerIdx] = newScore;
      currentSimState.turnScore += points;
    }

    // Emit updated match.state
    emitMatchState(deps);

    console.log(`🎯 [DEV] Simulated throw: ${multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : ''}${number} = ${points} points`);
    return {
      success: true,
      points,
      remaining: currentSimState.scores[playerIdx],
    };
  });

  /**
   * POST /api/developer/simulate/turn/end - Simulate end of turn (player change)
   */
  fastify.post<{
    Reply: { success: boolean; error?: string; nextPlayer?: string };
  }>('/api/developer/simulate/turn/end', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!isDeveloperModeEnabled(server)) {
      void reply.code(403);
      return { success: false, error: 'Developer mode is not enabled' };
    }

    if (!currentSimState) {
      return { success: false, error: 'No active simulated match' };
    }

    const prevPlayer = currentSimState.currentPlayerIndex;
    const prevPlayerName = currentSimState.players[prevPlayer]?.name || 'Unknown';

    // Emit turn.finished event
    const turnFinishedEvent: ParsedEvent = {
      type: 'turn.finished',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'turn.finished', data: {} },
      data: {
        matchId: currentSimState.matchId,
        playerIndex: prevPlayer,
        playerName: prevPlayerName,
        turnScore: currentSimState.turnScore,
        turnPoints: currentSimState.turnScore,
        remaining: currentSimState.scores[prevPlayer],
        busted: currentSimState.turnBusted,
        round: currentSimState.round,
      },
    };
    deps.emitEvent(turnFinishedEvent);

    // Emit takeout.started event
    const takeoutStartEvent: ParsedEvent = {
      type: 'takeout.started',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'takeout.started', data: {} },
      data: { boardId: 'sim-board' },
    };
    deps.emitEvent(takeoutStartEvent);

    // Switch to next player
    currentSimState.currentPlayerIndex = (prevPlayer + 1) % currentSimState.players.length;
    currentSimState.turnScore = 0;
    currentSimState.turnBusted = false;
    currentSimState.turnThrows = [];

    // Increment round if we're back to player 0
    if (currentSimState.currentPlayerIndex === 0) {
      currentSimState.round++;
    }

    const nextPlayer = currentSimState.currentPlayerIndex;
    const nextPlayerName = currentSimState.players[nextPlayer]?.name || 'Unknown';

    // Emit takeout.finished event after short delay
    setTimeout(() => {
      const takeoutFinishEvent: ParsedEvent = {
        type: 'takeout.finished',
        timestamp: new Date(),
        raw: { channel: 'simulated', topic: 'takeout.finished', data: {} },
        data: { boardId: 'sim-board' },
      };
      deps.emitEvent(takeoutFinishEvent);

      // Emit player.change event
      if (currentSimState && currentSimState.players.length > 1) {
        const playerChangeEvent: ParsedEvent = {
          type: 'player.change',
          timestamp: new Date(),
          raw: { channel: 'simulated', topic: 'player.change', data: {} },
          data: {
            previousPlayer: prevPlayer,
            currentPlayer: nextPlayer,
            playerName: nextPlayerName,
            remaining: currentSimState.scores[nextPlayer],
          },
        };
        deps.emitEvent(playerChangeEvent);
      }

      // Emit updated match.state
      if (currentSimState) {
        emitMatchState(deps);
      }
    }, 500);

    console.log(`🎯 [DEV] Turn ended: ${prevPlayerName} -> ${nextPlayerName}`);
    return { success: true, nextPlayer: nextPlayerName };
  });

  /**
   * POST /api/developer/simulate/event - Simulate a custom event
   */
  fastify.post<{
    Body: {
      type: AutodartsEventType;
      data?: Record<string, unknown>;
    };
    Reply: { success: boolean; error?: string };
  }>('/api/developer/simulate/event', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!isDeveloperModeEnabled(server)) {
      void reply.code(403);
      return { success: false, error: 'Developer mode is not enabled' };
    }

    const { type, data } = request.body;

    const event: ParsedEvent = {
      type,
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: type, data: data || {} },
      data: data || {},
    };
    deps.emitEvent(event);

    console.log(`🎯 [DEV] Simulated custom event: ${type}`);
    return { success: true };
  });

  /**
   * GET /api/developer/scenarios - Get predefined test scenarios
   */
  fastify.get<{
    Reply: { scenarios: Array<{ id: string; name: string; description: string }> };
  }>('/api/developer/scenarios', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { scenarios: [] };
    }

    return {
      scenarios: [
        { id: '180', name: '180 Score', description: 'Simulate a 180 (3x Triple 20)' },
        { id: 'bust', name: 'Bust', description: 'Simulate a bust (overshot)' },
        { id: 'checkout', name: 'Checkout', description: 'Simulate a game winning checkout' },
        { id: 'bullseye', name: 'Bullseye', description: 'Simulate a double bull (50 points)' },
        { id: 'full-leg', name: 'Full Leg', description: 'Simulate a complete leg' },
      ],
    };
  });

  /**
   * POST /api/developer/scenarios/:id/run - Run a predefined scenario
   */
  fastify.post<{
    Params: { id: string };
    Reply: { success: boolean; error?: string };
  }>('/api/developer/scenarios/:id/run', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!isDeveloperModeEnabled(server)) {
      void reply.code(403);
      return { success: false, error: 'Developer mode is not enabled' };
    }

    const { id } = request.params;

    switch (id) {
      case '180':
        await run180Scenario(deps);
        break;
      case 'bust':
        await runBustScenario(deps);
        break;
      case 'checkout':
        await runCheckoutScenario(deps);
        break;
      case 'bullseye':
        await runBullseyeScenario(deps);
        break;
      case 'full-leg':
        await runFullLegScenario(deps);
        break;
      default:
        return { success: false, error: `Unknown scenario: ${id}` };
    }

    console.log(`🎯 [DEV] Ran scenario: ${id}`);
    return { success: true };
  });
}

/**
 * Helper to emit current match state
 */
function emitMatchState(deps: DeveloperDependencies): void {
  if (!currentSimState) return;

  const event: ParsedEvent = {
    type: 'match.state',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'match.state', data: {} },
    data: {
      id: currentSimState.matchId,
      matchId: currentSimState.matchId,
      player: currentSimState.currentPlayerIndex,
      playerName: currentSimState.players[currentSimState.currentPlayerIndex]?.name || 'Unknown',
      players: currentSimState.players.map((p) => ({
        id: p.id,
        name: p.name,
        index: p.index,
        color: p.color,
      })),
      // Same shape as Autodarts: gameScores = remaining points, scores = legs/sets won
      scores: currentSimState.players.map(() => ({ legs: 0, sets: 0 })),
      gameScores: currentSimState.scores,
      turnScore: currentSimState.turnScore,
      turnBusted: currentSimState.turnBusted,
      round: currentSimState.round,
      leg: currentSimState.leg,
      set: currentSimState.set,
      finished: false,
      winner: null,
      gameFinished: false,
      gameWinner: null,
      turns: [{ id: `${currentSimState.matchId}:${currentSimState.round}:${currentSimState.currentPlayerIndex}`, throws: currentSimState.turnThrows }],
      settings: { startScore: 501 },
    },
  };
  deps.emitEvent(event);
}

/** Segment name as Autodarts writes it (S20, D16, T19, 25, Bull) */
function segmentName(number: number, multiplier: number): string {
  if (number === 25) return multiplier === 2 ? 'Bull' : '25';
  if (number === 0) return 'Miss';
  return `${multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S'}${number}`;
}

/**
 * Helper to get bed name
 */
function getBedName(number: number, multiplier: number): string {
  if (number === 25 && multiplier === 2) return 'DoubleBull';
  if (number === 25 && multiplier === 1) return 'Bull';
  if (multiplier === 3) return `T${number}`;
  if (multiplier === 2) return `D${number}`;
  return `S${number}`;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scenario: 180
 */
async function run180Scenario(deps: DeveloperDependencies): Promise<void> {
  // Ensure match is active
  if (!currentSimState) {
    currentSimState = createDefaultMatchState();
    const startEvent: ParsedEvent = {
      type: 'match.start',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'match.start', data: {} },
      data: { matchId: currentSimState.matchId, boardId: 'sim-board' },
    };
    deps.emitEvent(startEvent);
    await delay(100);
    emitMatchState(deps);
    await delay(500);
  }

  // Throw 3x Triple 20
  for (let i = 0; i < 3; i++) {
    const throwEvent: ParsedEvent = {
      type: 'throw.detected',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'throw.detected', data: {} },
      data: {
        segment: { number: 20, multiplier: 3, bed: 'T20' },
        coords: { x: 0, y: 0 },
        throwNumber: i + 1,
        boardId: 'sim-board',
        points: 60,
        turnPoints: (i + 1) * 60,
      },
    };
    deps.emitEvent(throwEvent);

    currentSimState.turnScore += 60;
    currentSimState.scores[currentSimState.currentPlayerIndex] -= 60;
    currentSimState.turnThrows.push({ segment: { number: 20, multiplier: 3, bed: 'Triple', name: 'T20' } });
    emitMatchState(deps);

    await delay(300);
  }
}

/**
 * Scenario: Bust
 */
async function runBustScenario(deps: DeveloperDependencies): Promise<void> {
  // Ensure match is active with low score
  if (!currentSimState) {
    currentSimState = createDefaultMatchState();
    currentSimState.scores[0] = 32; // Low score that can bust
    const startEvent: ParsedEvent = {
      type: 'match.start',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'match.start', data: {} },
      data: { matchId: currentSimState.matchId, boardId: 'sim-board' },
    };
    deps.emitEvent(startEvent);
    await delay(100);
    emitMatchState(deps);
    await delay(500);
  }

  // Throw Triple 20 (60 points) to cause bust
  const throwEvent: ParsedEvent = {
    type: 'throw.detected',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'throw.detected', data: {} },
    data: {
      segment: { number: 20, multiplier: 3, bed: 'T20' },
      coords: { x: 0, y: 0 },
      throwNumber: 1,
      boardId: 'sim-board',
      points: 60,
      turnPoints: 60,
      busted: true,
    },
  };
  deps.emitEvent(throwEvent);

  currentSimState.turnBusted = true;
  currentSimState.turnScore = 0;
  emitMatchState(deps);
}

/**
 * Scenario: Checkout
 */
async function runCheckoutScenario(deps: DeveloperDependencies): Promise<void> {
  // Ensure match is active with checkout score
  if (!currentSimState) {
    currentSimState = createDefaultMatchState();
  }
  currentSimState.scores[currentSimState.currentPlayerIndex] = 40; // D20 checkout
  emitMatchState(deps);
  await delay(500);

  // Throw D20 for checkout
  const throwEvent: ParsedEvent = {
    type: 'throw.detected',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'throw.detected', data: {} },
    data: {
      segment: { number: 20, multiplier: 2, bed: 'D20' },
      coords: { x: 0, y: 0 },
      throwNumber: 1,
      boardId: 'sim-board',
      points: 40,
      turnPoints: 40,
    },
  };
  deps.emitEvent(throwEvent);

  currentSimState.scores[currentSimState.currentPlayerIndex] = 0;
  currentSimState.turnScore = 40;
  emitMatchState(deps);

  await delay(300);

  // Game finished event
  const gameFinishedEvent: ParsedEvent = {
    type: 'game.finished',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'game.finished', data: {} },
    data: {
      matchId: currentSimState.matchId,
      winner: currentSimState.currentPlayerIndex,
      winnerName: currentSimState.players[currentSimState.currentPlayerIndex]?.name || 'Unknown',
      leg: currentSimState.leg,
      set: currentSimState.set,
      players: currentSimState.players,
    },
  };
  deps.emitEvent(gameFinishedEvent);
}

/**
 * Scenario: Bullseye
 */
async function runBullseyeScenario(deps: DeveloperDependencies): Promise<void> {
  // Ensure match is active
  if (!currentSimState) {
    currentSimState = createDefaultMatchState();
    const startEvent: ParsedEvent = {
      type: 'match.start',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'match.start', data: {} },
      data: { matchId: currentSimState.matchId, boardId: 'sim-board' },
    };
    deps.emitEvent(startEvent);
    await delay(100);
    emitMatchState(deps);
    await delay(500);
  }

  // Throw Double Bull
  const throwEvent: ParsedEvent = {
    type: 'throw.detected',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'throw.detected', data: {} },
    data: {
      segment: { number: 25, multiplier: 2, bed: 'DoubleBull' },
      coords: { x: 0, y: 0 },
      throwNumber: 1,
      boardId: 'sim-board',
      points: 50,
      turnPoints: 50,
    },
  };
  deps.emitEvent(throwEvent);

  currentSimState.turnScore += 50;
  currentSimState.scores[currentSimState.currentPlayerIndex] -= 50;
  emitMatchState(deps);
}

/**
 * Scenario: Full Leg
 */
async function runFullLegScenario(deps: DeveloperDependencies): Promise<void> {
  // Start fresh match
  currentSimState = createDefaultMatchState();
  const startEvent: ParsedEvent = {
    type: 'match.start',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'match.start', data: {} },
    data: { matchId: currentSimState.matchId, boardId: 'sim-board' },
  };
  deps.emitEvent(startEvent);
  await delay(100);
  emitMatchState(deps);
  await delay(1000);

  // Simulate some throws for player 1
  const throws = [
    { number: 20, multiplier: 3 }, // T20
    { number: 20, multiplier: 3 }, // T20
    { number: 20, multiplier: 3 }, // T20 = 180
  ];

  for (const t of throws) {
    const points = t.number * t.multiplier;
    const throwEvent: ParsedEvent = {
      type: 'throw.detected',
      timestamp: new Date(),
      raw: { channel: 'simulated', topic: 'throw.detected', data: {} },
      data: {
        segment: { number: t.number, multiplier: t.multiplier, bed: getBedName(t.number, t.multiplier) },
        coords: { x: 0, y: 0 },
        throwNumber: 1,
        boardId: 'sim-board',
        points,
        turnPoints: currentSimState.turnScore + points,
      },
    };
    deps.emitEvent(throwEvent);

    currentSimState.turnScore += points;
    currentSimState.scores[currentSimState.currentPlayerIndex] -= points;
    emitMatchState(deps);

    await delay(500);
  }

  // End turn
  const turnEndEvent: ParsedEvent = {
    type: 'turn.finished',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'turn.finished', data: {} },
    data: {
      matchId: currentSimState.matchId,
      playerIndex: 0,
      playerName: currentSimState.players[0]?.name || 'Unknown',
      turnScore: currentSimState.turnScore,
      turnPoints: currentSimState.turnScore,
      remaining: currentSimState.scores[0],
      busted: false,
      round: currentSimState.round,
    },
  };
  deps.emitEvent(turnEndEvent);

  await delay(500);

  // Player change
  currentSimState.currentPlayerIndex = 1;
  currentSimState.turnScore = 0;

  const playerChangeEvent: ParsedEvent = {
    type: 'player.change',
    timestamp: new Date(),
    raw: { channel: 'simulated', topic: 'player.change', data: {} },
    data: {
      previousPlayer: 0,
      currentPlayer: 1,
      playerName: currentSimState.players[1]?.name || 'Unknown',
      remaining: currentSimState.scores[1],
    },
  };
  deps.emitEvent(playerChangeEvent);

  emitMatchState(deps);
}
