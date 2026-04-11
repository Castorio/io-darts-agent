/**
 * Trainer Module API Routes
 *
 * Custom API endpoints for the darts trainer module.
 * Provides training session management, practice routines, and statistics.
 */

import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';

/**
 * Training session types
 */
export type TrainingType =
  | 'checkout'
  | 'doubles'
  | 'scoring'
  | 'around-the-clock'
  | 'cricket'
  | 'custom';

/**
 * Training session difficulty
 */
export type TrainingDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Training session status
 */
export type SessionStatus = 'idle' | 'active' | 'paused' | 'completed';

/**
 * Training target
 */
export interface TrainingTarget {
  number: number;
  multiplier: 1 | 2 | 3;
  label: string;
  required: number;
  completed: number;
}

/**
 * Training session configuration
 */
export interface TrainingSessionConfig {
  type: TrainingType;
  difficulty: TrainingDifficulty;
  targets?: TrainingTarget[];
  rounds?: number;
  timeLimit?: number;
  checkoutStart?: number;
  checkoutEnd?: number;
  doublesOnly?: boolean;
  requireDouble?: boolean;
}

/**
 * Training session state
 */
export interface TrainingSession {
  id: string;
  config: TrainingSessionConfig;
  status: SessionStatus;
  startedAt: number;
  pausedAt?: number;
  completedAt?: number;
  currentRound: number;
  currentTarget?: TrainingTarget;
  targets: TrainingTarget[];
  stats: TrainingStats;
}

/**
 * Training statistics
 */
export interface TrainingStats {
  totalThrows: number;
  hits: number;
  misses: number;
  hitRate: number;
  averageScore: number;
  highestScore: number;
  doublesHit: number;
  doublesAttempted: number;
  doublesRate: number;
  triplesHit: number;
  bullsHit: number;
  streakCurrent: number;
  streakBest: number;
  timeSpent: number;
}

/**
 * Practice routine definition
 */
export interface PracticeRoutine {
  id: string;
  name: string;
  description: string;
  type: TrainingType;
  difficulty: TrainingDifficulty;
  duration: number;
  targets: TrainingTarget[];
  createdAt: number;
  isBuiltIn: boolean;
}

/**
 * Training history entry
 */
export interface TrainingHistoryEntry {
  id: string;
  routineId?: string;
  routineName?: string;
  type: TrainingType;
  difficulty: TrainingDifficulty;
  completedAt: number;
  duration: number;
  stats: TrainingStats;
}

// In-memory storage (would be replaced with proper database in production)
let currentSession: TrainingSession | null = null;
const trainingHistory: TrainingHistoryEntry[] = [];
const customRoutines: PracticeRoutine[] = [];

/**
 * Built-in practice routines
 */
const BUILTIN_ROUTINES: PracticeRoutine[] = [
  {
    id: 'checkout-practice',
    name: 'Checkout Practice',
    description: 'Practice finishing from common checkout scores (32-170)',
    type: 'checkout',
    difficulty: 'intermediate',
    duration: 20,
    targets: [
      { number: 32, multiplier: 2, label: 'D16', required: 3, completed: 0 },
      { number: 40, multiplier: 2, label: 'D20', required: 3, completed: 0 },
      { number: 50, multiplier: 2, label: 'Bull', required: 3, completed: 0 },
      { number: 36, multiplier: 2, label: 'D18', required: 3, completed: 0 },
    ],
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'doubles-round',
    name: 'Doubles Round the Clock',
    description: 'Hit each double from D1 to D20 and Bull',
    type: 'doubles',
    difficulty: 'advanced',
    duration: 30,
    targets: Array.from({ length: 20 }, (_, i) => ({
      number: i + 1,
      multiplier: 2 as const,
      label: `D${i + 1}`,
      required: 1,
      completed: 0,
    })).concat([{ number: 25, multiplier: 2, label: 'Bull', required: 1, completed: 0 }]),
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'scoring-drills',
    name: 'T20 Scoring Drills',
    description: 'Practice hitting Triple 20 consistently',
    type: 'scoring',
    difficulty: 'intermediate',
    duration: 15,
    targets: [
      { number: 20, multiplier: 3, label: 'T20', required: 10, completed: 0 },
    ],
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'around-the-clock',
    name: 'Around the Clock',
    description: 'Hit numbers 1 through 20 in order',
    type: 'around-the-clock',
    difficulty: 'beginner',
    duration: 15,
    targets: Array.from({ length: 20 }, (_, i) => ({
      number: i + 1,
      multiplier: 1 as const,
      label: `${i + 1}`,
      required: 1,
      completed: 0,
    })),
    createdAt: 0,
    isBuiltIn: true,
  },
  {
    id: 'cricket-numbers',
    name: 'Cricket Numbers',
    description: 'Practice hitting 15-20 and Bull',
    type: 'cricket',
    difficulty: 'intermediate',
    duration: 20,
    targets: [
      { number: 15, multiplier: 1, label: '15', required: 3, completed: 0 },
      { number: 16, multiplier: 1, label: '16', required: 3, completed: 0 },
      { number: 17, multiplier: 1, label: '17', required: 3, completed: 0 },
      { number: 18, multiplier: 1, label: '18', required: 3, completed: 0 },
      { number: 19, multiplier: 1, label: '19', required: 3, completed: 0 },
      { number: 20, multiplier: 1, label: '20', required: 3, completed: 0 },
      { number: 25, multiplier: 1, label: 'Bull', required: 3, completed: 0 },
    ],
    createdAt: 0,
    isBuiltIn: true,
  },
];

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create default stats
 */
function createDefaultStats(): TrainingStats {
  return {
    totalThrows: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    averageScore: 0,
    highestScore: 0,
    doublesHit: 0,
    doublesAttempted: 0,
    doublesRate: 0,
    triplesHit: 0,
    bullsHit: 0,
    streakCurrent: 0,
    streakBest: 0,
    timeSpent: 0,
  };
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

export interface TrainerDependencies {
  emitEvent: (event: unknown) => void;
}

/**
 * Register trainer module routes
 */
export function registerTrainerRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  _deps: TrainerDependencies
): void {
  // ============================================
  // Session Management
  // ============================================

  /**
   * GET /api/trainer/session - Get current training session
   */
  fastify.get<{
    Reply: { session: TrainingSession | null };
  }>('/api/trainer/session', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { session: null };
    }

    return { session: currentSession };
  });

  /**
   * POST /api/trainer/session/start - Start a new training session
   */
  fastify.post<{
    Body: TrainingSessionConfig;
    Reply: { success: boolean; error?: string; session?: TrainingSession };
  }>('/api/trainer/session/start', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (currentSession && currentSession.status === 'active') {
      return { success: false, error: 'A training session is already active' };
    }

    const config = request.body;
    let targets: TrainingTarget[] = [];

    // Generate targets based on training type
    if (config.targets && config.targets.length > 0) {
      targets = config.targets.map((t) => ({ ...t, completed: 0 }));
    } else {
      switch (config.type) {
        case 'checkout':
          targets = generateCheckoutTargets(config);
          break;
        case 'doubles':
          targets = generateDoublesTargets(config);
          break;
        case 'scoring':
          targets = generateScoringTargets(config);
          break;
        case 'around-the-clock':
          targets = generateAroundTheClockTargets();
          break;
        case 'cricket':
          targets = generateCricketTargets();
          break;
        default:
          targets = [];
      }
    }

    currentSession = {
      id: generateId(),
      config,
      status: 'active',
      startedAt: Date.now(),
      currentRound: 1,
      currentTarget: targets[0] || undefined,
      targets,
      stats: createDefaultStats(),
    };

    console.log(`🎯 [TRAINER] Training session started: ${config.type}`);
    return { success: true, session: currentSession };
  });

  /**
   * POST /api/trainer/session/pause - Pause current session
   */
  fastify.post<{
    Reply: { success: boolean; error?: string };
  }>('/api/trainer/session/pause', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!currentSession) {
      return { success: false, error: 'No active training session' };
    }

    if (currentSession.status !== 'active') {
      return { success: false, error: 'Session is not active' };
    }

    currentSession.status = 'paused';
    currentSession.pausedAt = Date.now();
    currentSession.stats.timeSpent += Date.now() - currentSession.startedAt;

    console.log(`⏸️ [TRAINER] Training session paused`);
    return { success: true };
  });

  /**
   * POST /api/trainer/session/resume - Resume paused session
   */
  fastify.post<{
    Reply: { success: boolean; error?: string };
  }>('/api/trainer/session/resume', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!currentSession) {
      return { success: false, error: 'No active training session' };
    }

    if (currentSession.status !== 'paused') {
      return { success: false, error: 'Session is not paused' };
    }

    currentSession.status = 'active';
    currentSession.startedAt = Date.now();
    currentSession.pausedAt = undefined;

    console.log(`▶️ [TRAINER] Training session resumed`);
    return { success: true };
  });

  /**
   * POST /api/trainer/session/end - End current session
   */
  fastify.post<{
    Reply: { success: boolean; error?: string; stats?: TrainingStats };
  }>('/api/trainer/session/end', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!currentSession) {
      return { success: false, error: 'No active training session' };
    }

    // Finalize stats
    const now = Date.now();
    if (currentSession.status === 'active') {
      currentSession.stats.timeSpent += now - currentSession.startedAt;
    }
    currentSession.status = 'completed';
    currentSession.completedAt = now;

    // Calculate final stats
    const stats = currentSession.stats;
    if (stats.totalThrows > 0) {
      stats.hitRate = (stats.hits / stats.totalThrows) * 100;
    }
    if (stats.doublesAttempted > 0) {
      stats.doublesRate = (stats.doublesHit / stats.doublesAttempted) * 100;
    }

    // Add to history
    const historyEntry: TrainingHistoryEntry = {
      id: generateId(),
      type: currentSession.config.type,
      difficulty: currentSession.config.difficulty,
      completedAt: now,
      duration: stats.timeSpent,
      stats: { ...stats },
    };
    trainingHistory.unshift(historyEntry);

    // Keep only last 100 entries
    if (trainingHistory.length > 100) {
      trainingHistory.pop();
    }

    console.log(`🏁 [TRAINER] Training session ended. Hit rate: ${stats.hitRate.toFixed(1)}%`);

    const finalStats = { ...stats };
    currentSession = null;

    return { success: true, stats: finalStats };
  });

  /**
   * POST /api/trainer/session/throw - Record a throw
   */
  fastify.post<{
    Body: {
      number: number;
      multiplier: 1 | 2 | 3;
      isHit?: boolean;
    };
    Reply: { success: boolean; error?: string; session?: TrainingSession };
  }>('/api/trainer/session/throw', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    if (!currentSession || currentSession.status !== 'active') {
      return { success: false, error: 'No active training session' };
    }

    const { number, multiplier, isHit } = request.body;
    const score = number * multiplier;
    const stats = currentSession.stats;

    stats.totalThrows++;

    // Determine if this throw hits the current target
    const target = currentSession.currentTarget;
    const hitTarget = target
      ? target.number === number && target.multiplier === multiplier
      : false;

    const wasHit = isHit !== undefined ? isHit : hitTarget;

    if (wasHit) {
      stats.hits++;
      stats.streakCurrent++;
      if (stats.streakCurrent > stats.streakBest) {
        stats.streakBest = stats.streakCurrent;
      }

      // Update target progress
      if (target && hitTarget) {
        target.completed++;
        if (target.completed >= target.required) {
          // Move to next target
          const currentIdx = currentSession.targets.indexOf(target);
          if (currentIdx < currentSession.targets.length - 1) {
            currentSession.currentTarget = currentSession.targets[currentIdx + 1];
          } else {
            // All targets completed
            currentSession.currentTarget = undefined;
          }
        }
      }
    } else {
      stats.misses++;
      stats.streakCurrent = 0;
    }

    // Track special throws
    if (multiplier === 2) {
      stats.doublesAttempted++;
      if (wasHit) {
        stats.doublesHit++;
      }
    }
    if (multiplier === 3 && wasHit) {
      stats.triplesHit++;
    }
    if (number === 25 && wasHit) {
      stats.bullsHit++;
    }

    // Update score stats
    if (wasHit) {
      if (score > stats.highestScore) {
        stats.highestScore = score;
      }
      stats.averageScore =
        (stats.averageScore * (stats.hits - 1) + score) / stats.hits;
    }

    // Update hit rate
    stats.hitRate = (stats.hits / stats.totalThrows) * 100;
    if (stats.doublesAttempted > 0) {
      stats.doublesRate = (stats.doublesHit / stats.doublesAttempted) * 100;
    }

    return { success: true, session: currentSession };
  });

  // ============================================
  // Practice Routines
  // ============================================

  /**
   * GET /api/trainer/routines - Get all practice routines
   */
  fastify.get<{
    Reply: { routines: PracticeRoutine[] };
  }>('/api/trainer/routines', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { routines: [] };
    }

    return { routines: [...BUILTIN_ROUTINES, ...customRoutines] };
  });

  /**
   * GET /api/trainer/routines/:id - Get a specific routine
   */
  fastify.get<{
    Params: { id: string };
    Reply: { routine: PracticeRoutine | null };
  }>('/api/trainer/routines/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { routine: null };
    }

    const { id } = request.params;
    const routine =
      BUILTIN_ROUTINES.find((r) => r.id === id) ||
      customRoutines.find((r) => r.id === id);

    return { routine: routine || null };
  });

  /**
   * POST /api/trainer/routines - Create a custom routine
   */
  fastify.post<{
    Body: Omit<PracticeRoutine, 'id' | 'createdAt' | 'isBuiltIn'>;
    Reply: { success: boolean; error?: string; routine?: PracticeRoutine };
  }>('/api/trainer/routines', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const routine: PracticeRoutine = {
      ...request.body,
      id: generateId(),
      createdAt: Date.now(),
      isBuiltIn: false,
    };

    customRoutines.push(routine);
    console.log(`📝 [TRAINER] Custom routine created: ${routine.name}`);

    return { success: true, routine };
  });

  /**
   * DELETE /api/trainer/routines/:id - Delete a custom routine
   */
  fastify.delete<{
    Params: { id: string };
    Reply: { success: boolean; error?: string };
  }>('/api/trainer/routines/:id', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    // Cannot delete built-in routines
    if (BUILTIN_ROUTINES.some((r) => r.id === id)) {
      return { success: false, error: 'Cannot delete built-in routines' };
    }

    const idx = customRoutines.findIndex((r) => r.id === id);
    if (idx === -1) {
      return { success: false, error: 'Routine not found' };
    }

    customRoutines.splice(idx, 1);
    console.log(`🗑️ [TRAINER] Custom routine deleted: ${id}`);

    return { success: true };
  });

  /**
   * POST /api/trainer/routines/:id/start - Start a routine
   */
  fastify.post<{
    Params: { id: string };
    Reply: { success: boolean; error?: string; session?: TrainingSession };
  }>('/api/trainer/routines/:id/start', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;
    const routine =
      BUILTIN_ROUTINES.find((r) => r.id === id) ||
      customRoutines.find((r) => r.id === id);

    if (!routine) {
      return { success: false, error: 'Routine not found' };
    }

    if (currentSession && currentSession.status === 'active') {
      return { success: false, error: 'A training session is already active' };
    }

    const targets = routine.targets.map((t) => ({ ...t, completed: 0 }));

    currentSession = {
      id: generateId(),
      config: {
        type: routine.type,
        difficulty: routine.difficulty,
        targets: routine.targets,
        timeLimit: routine.duration * 60 * 1000,
      },
      status: 'active',
      startedAt: Date.now(),
      currentRound: 1,
      currentTarget: targets[0] || undefined,
      targets,
      stats: createDefaultStats(),
    };

    console.log(`🎯 [TRAINER] Routine started: ${routine.name}`);
    return { success: true, session: currentSession };
  });

  // ============================================
  // Training History
  // ============================================

  /**
   * GET /api/trainer/history - Get training history
   */
  fastify.get<{
    Querystring: { limit?: number; offset?: number; type?: TrainingType };
    Reply: { history: TrainingHistoryEntry[]; total: number };
  }>('/api/trainer/history', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { history: [], total: 0 };
    }

    const { limit = 20, offset = 0, type } = request.query;

    let filtered = trainingHistory;
    if (type) {
      filtered = trainingHistory.filter((h) => h.type === type);
    }

    const total = filtered.length;
    const history = filtered.slice(offset, offset + limit);

    return { history, total };
  });

  /**
   * GET /api/trainer/stats - Get aggregated training statistics
   */
  fastify.get<{
    Querystring: { period?: 'day' | 'week' | 'month' | 'all' };
    Reply: {
      totalSessions: number;
      totalTime: number;
      averageHitRate: number;
      averageDoublesRate: number;
      bestStreak: number;
      mostPracticed: TrainingType | null;
      improvementTrend: number;
    };
  }>('/api/trainer/stats', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return {
        totalSessions: 0,
        totalTime: 0,
        averageHitRate: 0,
        averageDoublesRate: 0,
        bestStreak: 0,
        mostPracticed: null,
        improvementTrend: 0,
      };
    }

    const { period = 'all' } = request.query;

    let cutoff = 0;
    const now = Date.now();
    switch (period) {
      case 'day':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    const filtered = period === 'all'
      ? trainingHistory
      : trainingHistory.filter((h) => h.completedAt >= cutoff);

    if (filtered.length === 0) {
      return {
        totalSessions: 0,
        totalTime: 0,
        averageHitRate: 0,
        averageDoublesRate: 0,
        bestStreak: 0,
        mostPracticed: null,
        improvementTrend: 0,
      };
    }

    const totalSessions = filtered.length;
    const totalTime = filtered.reduce((sum, h) => sum + h.duration, 0);
    const averageHitRate =
      filtered.reduce((sum, h) => sum + h.stats.hitRate, 0) / totalSessions;
    const averageDoublesRate =
      filtered.reduce((sum, h) => sum + h.stats.doublesRate, 0) / totalSessions;
    const bestStreak = Math.max(...filtered.map((h) => h.stats.streakBest));

    // Count types
    const typeCounts: Record<string, number> = {};
    for (const h of filtered) {
      typeCounts[h.type] = (typeCounts[h.type] || 0) + 1;
    }
    const mostPracticed = Object.entries(typeCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] as TrainingType | undefined;

    // Calculate improvement trend (compare recent half to older half)
    let improvementTrend = 0;
    if (filtered.length >= 4) {
      const mid = Math.floor(filtered.length / 2);
      const recent = filtered.slice(0, mid);
      const older = filtered.slice(mid);
      const recentAvg =
        recent.reduce((sum, h) => sum + h.stats.hitRate, 0) / recent.length;
      const olderAvg =
        older.reduce((sum, h) => sum + h.stats.hitRate, 0) / older.length;
      improvementTrend = recentAvg - olderAvg;
    }

    return {
      totalSessions,
      totalTime,
      averageHitRate,
      averageDoublesRate,
      bestStreak,
      mostPracticed: mostPracticed || null,
      improvementTrend,
    };
  });
}

// ============================================
// Target Generators
// ============================================

function generateCheckoutTargets(config: TrainingSessionConfig): TrainingTarget[] {
  const start = config.checkoutStart || 32;
  const end = config.checkoutEnd || 170;
  const targets: TrainingTarget[] = [];

  // Common checkout scores
  const checkouts = [32, 36, 40, 50, 60, 64, 72, 80, 84, 96, 100, 104, 120, 121, 130, 140, 150, 160, 167, 170];

  for (const score of checkouts) {
    if (score >= start && score <= end) {
      targets.push({
        number: score,
        multiplier: 1,
        label: `${score}`,
        required: 3,
        completed: 0,
      });
    }
  }

  return targets;
}

function generateDoublesTargets(config: TrainingSessionConfig): TrainingTarget[] {
  const targets: TrainingTarget[] = [];

  for (let i = 1; i <= 20; i++) {
    targets.push({
      number: i,
      multiplier: 2,
      label: `D${i}`,
      required: config.doublesOnly ? 3 : 1,
      completed: 0,
    });
  }

  // Add Bull
  targets.push({
    number: 25,
    multiplier: 2,
    label: 'Bull',
    required: config.doublesOnly ? 3 : 1,
    completed: 0,
  });

  return targets;
}

function generateScoringTargets(_config: TrainingSessionConfig): TrainingTarget[] {
  const targets: TrainingTarget[] = [];

  // T20, T19, T18 for scoring practice
  for (const num of [20, 19, 18]) {
    targets.push({
      number: num,
      multiplier: 3,
      label: `T${num}`,
      required: 10,
      completed: 0,
    });
  }

  return targets;
}

function generateAroundTheClockTargets(): TrainingTarget[] {
  return Array.from({ length: 20 }, (_, i) => ({
    number: i + 1,
    multiplier: 1 as const,
    label: `${i + 1}`,
    required: 1,
    completed: 0,
  }));
}

function generateCricketTargets(): TrainingTarget[] {
  const targets: TrainingTarget[] = [];

  for (const num of [15, 16, 17, 18, 19, 20]) {
    targets.push({
      number: num,
      multiplier: 1,
      label: `${num}`,
      required: 3,
      completed: 0,
    });
  }

  targets.push({
    number: 25,
    multiplier: 1,
    label: 'Bull',
    required: 3,
    completed: 0,
  });

  return targets;
}
