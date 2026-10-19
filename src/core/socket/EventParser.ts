import { LegTally, type LegTallySnapshot } from '../game/legTally.js';
import type {
  AutodartsMessage,
  ParsedEvent,
  BoardStateData,
  BoardEventData,
  MatchStartData,
  MatchDeleteData,
  MatchFinishData,
  MatchStateData,
  MatchResultData,
  ThrowSegment,
  ThrowCoords,
  CricketClosedData,
} from '../../types/index.js';
import {
  gameContextOf,
  isCricketMode,
  segmentsOf,
  closedFields,
  cricketStateOf,
  throwMarks,
  type CricketSegments,
} from '../game/cricket.js';

export interface EventParserOptions {
  debug?: boolean;
}

export class EventParser {
  private boardId: string;
  private debug: boolean;
  private currentMatchId: string | null = null;
  private lastPlayerIndex: number | null = null;
  // Who was at the board, by stable player.index within variant/set/leg:
  // the players array rotates between legs, so array positions alone miss
  // the change to the starting player of the next leg
  private lastTurnOwnerKey: string | null = null;
  // Legs and sets won per player.index, counted by the hub
  private readonly legTally = new LegTally();
  // Leg (match:set:leg) whose game.finished was already reported
  private lastFinishedLegKey: string | null = null;
  private currentMatchState: MatchStateData | null = null;
  private lastMatchUpdate: Date | null = null;
  private lastRound: number | null = null;
  private lastTurnScore: number | null = null;
  private lastTurnBusted: boolean = false;
  private lastGameScores: number[] = [];
  private lastDartsInTurn: number = 0;
  private lastCricketSegments: CricketSegments | null = null;
  private lastCricketKey: string | null = null;
  private lastCricketLegKey: string | null = null;
  private cricketClosed = new Set<string>();

  constructor(boardId: string, options: EventParserOptions = {}) {
    this.boardId = boardId;
    this.debug = options.debug ?? false;
  }

  /**
   * Reset Cricket tracking state (per-match/leg bookkeeping for cricket.state
   * and cricket.closed deduplication)
   */
  private resetCricket(): void {
    this.lastCricketSegments = null;
    this.lastCricketKey = null;
    this.lastCricketLegKey = null;
    this.cricketClosed.clear();
  }

  /**
   * Mark a connection gap (e.g. an Autodarts WebSocket reconnect). Clears the
   * Cricket segment baseline used to diff newly-closed fields, so the first
   * state received after the gap cannot be compared against stale,
   * pre-outage segments and misreport fields as "just closed". The close
   * dedupe set and the current match/leg identity are kept, so a field that
   * was already reported closed before the gap is not re-reported.
   */
  markGap(): void {
    this.lastCricketSegments = null;
  }

  /**
   * Get the current match ID (if any)
   */
  getMatchId(): string | null {
    return this.currentMatchId;
  }

  /**
   * Set the current match ID manually
   */
  setMatchId(matchId: string | null): void {
    this.currentMatchId = matchId;
    if (!matchId) {
      this.lastPlayerIndex = null;
      this.lastTurnOwnerKey = null;
      this.currentMatchState = null;
      this.lastMatchUpdate = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
      this.resetCricket();
    }
  }

  /**
   * Get the current match state (if any)
   */
  getCurrentMatchState(): MatchStateData | null {
    return this.currentMatchState;
  }

  /** Legs/sets won per player.index for the current match, counted by the hub */
  getWonCounts(): LegTallySnapshot | null {
    return this.currentMatchState ? this.legTally.snapshot(this.currentMatchState) : null;
  }

  /**
   * Get the timestamp of the last match update
   */
  getLastMatchUpdate(): Date | null {
    return this.lastMatchUpdate;
  }

  /**
   * Parse a raw WebSocket message into a typed event
   */
  parse(raw: AutodartsMessage): ParsedEvent | ParsedEvent[] | null {
    const { channel, topic, data } = raw;
    const timestamp = new Date();

    // Board State events
    if (channel === 'autodarts.boards' && topic === `${this.boardId}.state`) {
      return this.parseBoardState(raw, data as BoardStateData, timestamp);
    }

    // Board Matches events (match start/delete)
    if (channel === 'autodarts.boards' && topic === `${this.boardId}.matches`) {
      return this.parseMatchEvent(raw, data as MatchStartData | MatchDeleteData, timestamp);
    }

    // Board Events (throws, takeouts, etc.)
    if (channel === 'autodarts.boards' && topic === `${this.boardId}.events`) {
      if (this.debug) console.log(`🎯 Board Event received: ${(data as BoardEventData).event}`);
      return this.parseBoardEvent(raw, data as BoardEventData, timestamp);
    }

    // Match State
    if (channel === 'autodarts.matches' && this.currentMatchId && topic === `${this.currentMatchId}.state`) {
      return this.parseMatchState(raw, data as MatchStateData, timestamp);
    }

    // Unknown event - return as raw
    return {
      type: 'raw',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse board state events
   */
  private parseBoardState(
    raw: AutodartsMessage,
    data: BoardStateData,
    timestamp: Date
  ): ParsedEvent<BoardStateData> {
    return {
      type: 'board.state',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse match start/delete/finish events
   */
  private parseMatchEvent(
    raw: AutodartsMessage,
    data: MatchStartData | MatchDeleteData | MatchFinishData,
    timestamp: Date
  ): ParsedEvent {
    if (data.event === 'start') {
      this.currentMatchId = data.id;
      this.lastPlayerIndex = null;
      this.lastTurnOwnerKey = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
      this.resetCricket();

      return {
        type: 'match.start',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          boardId: this.boardId,
        },
      };
    }

    if (data.event === 'delete') {
      this.currentMatchId = null;
      this.lastPlayerIndex = null;
      this.lastTurnOwnerKey = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
      this.resetCricket();

      return {
        type: 'match.delete',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          boardId: this.boardId,
        },
      };
    }

    // User clicked "Finish" after match ended (dismisses results screen)
    if (data.event === 'finish') {
      this.currentMatchId = null;
      this.lastPlayerIndex = null;
      this.lastTurnOwnerKey = null;
      this.currentMatchState = null;
      this.lastMatchUpdate = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
      this.resetCricket();

      return {
        type: 'match.finish',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          boardId: this.boardId,
        },
      };
    }

    return {
      type: 'raw',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse board events (throws, takeouts, etc.)
   */
  private parseBoardEvent(
    raw: AutodartsMessage,
    data: BoardEventData,
    timestamp: Date
  ): ParsedEvent {
    const event = data.event;

    // During a match every dart also arrives with the next match state, which
    // emits throw.detected with points and turn data; a second one from the
    // board event counted each dart twice
    if (event === 'Throw detected' && this.currentMatchId) {
      return { type: 'board.event', timestamp, raw, data };
    }

    if (event === 'Throw detected') {
      const segment = data.throw.segment;
      if (this.debug) console.log(`🎯 Throw detected: segment=${segment.name}, number=${segment.number}, multiplier=${segment.multiplier}, throwNumber=${data.throwNumber ?? 0}`);
      return {
        type: 'throw.detected',
        timestamp,
        raw,
        data: {
          segment: data.throw.segment,
          coords: data.throw.coords,
          throwNumber: data.throwNumber ?? 0,
          boardId: data.boardId,
          points: calculateSegmentScore(data.throw.segment),
        },
      };
    }

    if (event === 'Takeout started') {
      return {
        type: 'takeout.started',
        timestamp,
        raw,
        data: {
          boardId: data.boardId,
        },
      };
    }

    if (event === 'Takeout finished') {
      return {
        type: 'takeout.finished',
        timestamp,
        raw,
        data: {
          boardId: data.boardId,
        },
      };
    }

    // Other board events
    return {
      type: 'board.event',
      timestamp,
      raw,
      data,
    };
  }

  /**
   * Parse match state events
   */
  private parseMatchState(
    raw: AutodartsMessage,
    data: MatchStateData,
    timestamp: Date
  ): ParsedEvent | ParsedEvent[] {
    const game = gameContextOf(data);
    const cricket = isCricketMode(game.mode);
    const events: ParsedEvent[] = [];

    // Store the current match state
    this.currentMatchState = data;
    this.legTally.sync(data);
    this.lastMatchUpdate = timestamp;

    // Check for turn finished
    // Option 1: Round increased (takeout finished - new round started)
    // Option 2: 3 darts thrown in current turn (third dart detected)
    const currentTurn = data.turns?.[data.turns.length - 1];
    const dartsInCurrentTurn = currentTurn?.throws?.length ?? 0;
    const isThirdDart = dartsInCurrentTurn === 3 && this.lastDartsInTurn !== 3;
    const isRoundChanged = this.lastRound !== null && data.round > this.lastRound;

    if (this.debug) console.log(`🔍 EventParser: round=${data.round}, lastRound=${this.lastRound}, darts=${dartsInCurrentTurn}, lastDarts=${this.lastDartsInTurn}, turnScore=${data.turnScore}`);

    // Generate throw.detected events from match state (since Autodarts no longer sends board events for throws)
    // This must happen BEFORE other events so modules can react to individual throws
    if (dartsInCurrentTurn > this.lastDartsInTurn && currentTurn?.throws?.length) {
      for (let i = this.lastDartsInTurn; i < dartsInCurrentTurn; i++) {
        const throwData = currentTurn.throws[i];
        if (throwData?.segment) {
          // Running turn total up to and including this dart, so a 180 is visible on the third dart
          const turnPoints = currentTurn.throws
            .slice(0, i + 1)
            .reduce((sum, t) => sum + (t?.segment ? calculateSegmentScore(t.segment) : 0), 0);
          const segment = throwData.segment;
          if (this.debug) console.log(`🎯 Throw detected (from match.state): segment=${segment.name}, number=${segment.number}, multiplier=${segment.multiplier}, throwNumber=${throwData.throw ?? (i + 1)}`);
          events.push({
            type: 'throw.detected',
            timestamp,
            raw,
            data: {
              segment: throwData.segment,
              coords: throwData.coords,
              throwNumber: throwData.throw ?? (i + 1),
              boardId: this.boardId,
              points: calculateSegmentScore(throwData.segment),
              turnPoints,
              // Only the newest dart can have caused the bust reported in this update
              busted: data.turnBusted === true && i === dartsInCurrentTurn - 1,
              turnId: currentTurn.id ?? null,
              ...(cricket && {
                marks: throwMarks(throwData),
                turnMarks: currentTurn.throws.slice(0, i + 1).reduce((s, t) => s + throwMarks(t), 0),
              }),
            },
          });
        }
      }
    }

    // Cricket: closed fields and state (marks/points) publishing
    if (cricket) {
      // A new leg never produces a "closed" against marks carried over from the previous one
      const legKey = `${data.id}:${data.set}:${data.leg}`;
      if (this.lastCricketLegKey !== legKey) {
        this.lastCricketLegKey = legKey;
        this.lastCricketSegments = null;
      }

      const segments = segmentsOf(data);
      const activePlayer = data.players[data.player];
      for (const field of closedFields(this.lastCricketSegments, segments, data.player)) {
        const key = `${data.id}:${data.set}:${data.leg}:${activePlayer?.index ?? data.player}:${field}`;
        if (this.cricketClosed.has(key)) continue;
        this.cricketClosed.add(key);
        events.push({
          type: 'cricket.closed',
          timestamp,
          raw,
          data: {
            matchId: data.id,
            set: data.set,
            leg: data.leg,
            field,
            playerIndex: activePlayer?.index ?? data.player,
            playerName: activePlayer?.name ?? 'Unknown',
          } satisfies CricketClosedData,
        });
      }
      this.lastCricketSegments = segments;

      const state = cricketStateOf(data);
      const stateKey = JSON.stringify(state);
      if (state && stateKey !== this.lastCricketKey) {
        this.lastCricketKey = stateKey;
        events.push({ type: 'cricket.state', timestamp, raw, data: state });
      }
    }

    // Check for bust (turnBusted changed from false to true)
    // FIXED: data.player IS the ARRAY POSITION (0-based), not the index field value!
    const justBusted = data.turnBusted && !this.lastTurnBusted;
    if (justBusted) {
      const playerArrayPosition = data.player;
      const player = data.players[playerArrayPosition];
      if (this.debug) console.log(`💥 EventParser: BUST detected for player ${player?.name} (arrayPosition=${playerArrayPosition}, index=${player?.index})`);
      events.push({
        type: 'turn.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          playerIndex: player?.index, // The player's stable index field
          playerName: player?.name ?? 'Unknown',
          turnScore: 0, // Bust means 0 points
          turnPoints: 0,
          remaining: this.lastGameScores[playerArrayPosition] ?? data.gameScores[playerArrayPosition] ?? 0, // Score before bust
          busted: true,
          round: data.round,
          throws: currentTurn?.throws ?? [], // Include throws for bull/double bull detection
          ...(cricket && { turnMarks: (currentTurn?.throws ?? []).reduce((s, t) => s + throwMarks(t), 0) }),
        },
      });
    }

    // Emit turn.finished when third dart is thrown (score announcement)
    // Skip if we just busted (already handled above)
    // FIXED: data.player IS the ARRAY POSITION (0-based), not the index field value!
    if (isThirdDart && !data.turnBusted && !justBusted) {
      const playerArrayPosition = data.player;
      const player = data.players[playerArrayPosition];
      const remainingScore = data.gameScores[playerArrayPosition] ?? 0;
      const throwsInfo = currentTurn?.throws?.map(t => `${t.segment?.name || 'unknown'}(${t.segment?.number}x${t.segment?.multiplier})`).join(', ') || 'none';
      if (this.debug) console.log(`✅ EventParser: Third dart - Emitting turn.finished - turnScore=${data.turnScore}, remaining=${remainingScore}, throws=[${throwsInfo}]`);
      events.push({
        type: 'turn.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          playerIndex: player?.index, // The player's stable index field
          playerName: player?.name ?? 'Unknown',
          turnScore: data.turnScore,
          turnPoints: data.turnScore,
          remaining: remainingScore,
          busted: false,
          round: data.round,
          throws: currentTurn?.throws ?? [], // Include throws for bull/double bull detection
          ...(cricket && { turnMarks: (currentTurn?.throws ?? []).reduce((s, t) => s + throwMarks(t), 0) }),
        },
      });
    }

    // Also emit turn.finished on round change if we didn't emit on third dart
    // This handles cases where takeout happens before 3 darts (e.g., checkout)
    // Skip if we already emitted a bust event (justBusted or lastTurnBusted - the latter handles
    // the case where bust was detected in a previous update and round changes in this update)
    // FIXED: lastPlayerIndex IS the ARRAY POSITION (0-based), not the index field value!
    if (isRoundChanged && this.lastTurnScore !== null && this.lastDartsInTurn !== 3 && !justBusted && !this.lastTurnBusted) {
      const previousPlayerArrayPosition = this.lastPlayerIndex ?? data.player;
      const previousPlayer = data.players[previousPlayerArrayPosition];
      const remainingScore = this.lastGameScores[previousPlayerArrayPosition] ?? data.gameScores[previousPlayerArrayPosition] ?? 0;
      // Get throws from the previous turn (the one that just ended)
      const previousTurn = data.turns && data.turns.length > 1 ? data.turns[data.turns.length - 2] : currentTurn;
      if (this.debug) console.log(`✅ EventParser: Round change - Emitting turn.finished - turnScore=${this.lastTurnScore}, remaining=${remainingScore}`);
      events.push({
        type: 'turn.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          playerIndex: previousPlayer?.index, // The player's stable index field
          playerName: previousPlayer?.name ?? 'Unknown',
          turnScore: this.lastTurnScore,
          turnPoints: this.lastTurnScore,
          remaining: remainingScore,
          busted: this.lastTurnBusted,
          round: this.lastRound!,
          throws: previousTurn?.throws ?? [], // Include throws for bull/double bull detection
          ...(cricket && { turnMarks: (previousTurn?.throws ?? []).reduce((s, t) => s + throwMarks(t), 0) }),
        },
      });
    }

    this.lastRound = data.round;
    this.lastTurnScore = data.turnScore;
    this.lastTurnBusted = data.turnBusted;
    this.lastGameScores = [...data.gameScores];
    this.lastDartsInTurn = dartsInCurrentTurn;

    // Check for player change: a different player (stable index) or a new
    // leg/variant. Finished states of a leg are skipped, Autodarts already
    // rotates the players in them.
    const turnOwner = data.players[data.player];
    const turnOwnerKey = `${data.variant}:${data.set}:${data.leg}:${turnOwner?.index ?? data.player}`;
    const ownerChanged = !data.gameFinished && this.lastTurnOwnerKey !== null && this.lastTurnOwnerKey !== turnOwnerKey;
    if (!data.gameFinished) this.lastTurnOwnerKey = turnOwnerKey;
    if (ownerChanged) {
      // FIXED: data.player IS the ARRAY POSITION (0-based), not the index field value!
      // After each leg, Autodarts rotates the players array, so array positions change.
      // This matches how GameDisplay handles it - using the position directly.
      const newPlayerArrayPosition = data.player;
      const newPlayer = data.players[newPlayerArrayPosition];
      const newPlayerRemaining = data.gameScores[newPlayerArrayPosition] ?? 0;
      const newPlayerName = newPlayer?.name ?? 'Unknown';
      events.push({
        type: 'player.change',
        timestamp,
        raw,
        data: {
          previousPlayer: this.lastPlayerIndex,
          currentPlayer: data.player, // This is the array position (used by frontend)
          playerIndex: newPlayer?.index, // The player's index field (stable across rotations)
          playerName: newPlayerName,
          remaining: newPlayerRemaining, // Remaining score of the player who is now up
        },
      });
    }
    this.lastPlayerIndex = data.player;

    // Check for game finished. Autodarts keeps sending finished states for the
    // same leg (also after rotating the players for the next leg), so report
    // each leg once, from its first finished state.
    // The variant is part of the key: an online match plays a Bull-off as
    // "leg 1" before the first X01 leg 1 under the same match id
    const legKey = `${data.id}:${data.variant}:${data.set}:${data.leg}`;
    // The bull-off only decides who starts, it is not a leg
    const isBullOff = data.variant?.toLowerCase() === 'bull-off';
    // Back in progress after a finish (corrected checkout): the real finish is reported again
    if (!data.gameFinished && this.lastFinishedLegKey === legKey) this.lastFinishedLegKey = null;
    if (!isBullOff && data.gameFinished && data.gameWinner !== null && this.lastFinishedLegKey !== legKey) {
      this.lastFinishedLegKey = legKey;
      // IMPORTANT: gameWinner from Autodarts is the player's INDEX field value, not array position!
      // When a leg ends, Autodarts rotates the players array for the next leg.
      // The gameWinner value stays the same (it's the player.index, not array position).
      //
      // Example scenario:
      // - Leg 1: players = [{index:0, name:'A'}, {index:1, name:'B'}]
      // - Player A (index=0) wins leg 1
      // - gameWinner = 0 (player A's index field)
      // - For leg 2, array rotates: players = [{index:1, name:'B'}, {index:0, name:'A'}]
      // - Using find(p => p.index === gameWinner) correctly finds player A
      const gameWinnerByIndex = data.players.find(p => p.index === data.gameWinner);
      const gameWinnerByArrayPos = data.players[data.gameWinner];

      if (this.debug) {
        console.log('🎯 DEBUG EventParser - GAME FINISHED:');
        console.log('  data.gameWinner:', data.gameWinner);
        console.log('  data.players:', JSON.stringify(data.players.map(p => ({ index: p.index, name: p.name })), null, 2));
        console.log('  Found by p.index:', gameWinnerByIndex?.name);
        console.log('  Found by array position:', gameWinnerByArrayPos?.name);
      }

      // The player who checked out has 0 left; gameScores follows the players
      // order of the same state. gameWinner is the fallback (non-X01 variants).
      // Only X01 counts down to 0; in Cricket gameScores are points
      const checkedOut = game.mode === 'x01'
        ? data.gameScores?.map((score, i) => (score === 0 ? i : -1)).filter((i) => i >= 0) ?? []
        : [];
      const gameWinnerPlayer = checkedOut.length === 1 ? data.players[checkedOut[0]] : gameWinnerByIndex;

      this.legTally.recordLeg(data, gameWinnerPlayer?.index ?? data.gameWinner);
      events.push({
        type: 'game.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          winner: data.gameWinner,
          winnerName: gameWinnerPlayer?.name ?? 'Unknown',
          winnerPlayerIndex: gameWinnerPlayer?.index ?? data.gameWinner,  // Stable player.index value
          leg: data.leg,
          set: data.set,
          players: data.players,
          // Include scores array so frontend can extract legs/sets won
          scores: data.scores,
          // Legs/sets won per player.index, counted by the hub
          ...this.legTally.snapshot(data),
        },
      });
    }

    // Check for match finished
    if (data.finished && data.winner !== null) {
      // The player who checked out the last leg has 0 left (players order of this
      // state); the index lookup is the fallback for non-X01 variants
      const lastCheckout = game.mode === 'x01'
        ? data.gameScores?.map((score, i) => (score === 0 ? i : -1)).filter((i) => i >= 0) ?? []
        : [];
      const matchWinnerPlayer = lastCheckout.length === 1
        ? data.players[lastCheckout[0]]
        : data.players.find(p => p.index === data.winner);

      if (this.debug) {
        console.log('🏆 DEBUG EventParser - MATCH FINISHED RAW DATA:');
        console.log('  data.winner:', data.winner, typeof data.winner);
        console.log('  data.players:', JSON.stringify(data.players, null, 2));
        console.log('  matchWinnerPlayer (found by index):', matchWinnerPlayer);
        console.log('  winnerName:', matchWinnerPlayer?.name);
      }

      events.push({
        type: 'match.finished',
        timestamp,
        raw,
        data: {
          matchId: data.id,
          winner: data.winner,
          winnerName: matchWinnerPlayer?.name ?? 'Unknown',
          winnerPlayerIndex: matchWinnerPlayer?.index ?? data.winner,  // Stable player.index value
          players: data.players,
          // Include scores array so frontend can extract legs/sets won
          scores: data.scores,
        },
      });

      // Also emit match.result with full result data (chalkboards, stats, scores)
      const matchResultData: MatchResultData = {
        matchId: data.id,
        winner: data.winner,
        winnerName: matchWinnerPlayer?.name ?? 'Unknown',
        winnerPlayerIndex: matchWinnerPlayer?.index ?? data.winner,
        variant: data.variant,
        type: data.type,
        leg: data.leg,
        set: data.set,
        round: data.round,
        players: data.players.map((p) => ({
          index: p.index,
          name: p.name,
          userId: p.userId,
        })),
        scores: (data.scores as unknown as Array<{ legs: number; sets: number }>)?.map((s) => ({
          legs: s.legs ?? 0,
          sets: s.sets ?? 0,
        })) ?? [],
        chalkboards: data.chalkboards ?? [],
        stats: data.stats?.legStats?.map((legStat, idx) => ({
          legStats: legStat,
          matchStats: data.stats.matchStats[idx] ?? legStat,
          setStats: data.stats.setStats?.[idx],
        })) ?? [],
        settings: data.settings,
      };
      events.push({
        type: 'match.result',
        timestamp,
        raw,
        data: matchResultData,
      });

      this.currentMatchId = null;
      this.lastPlayerIndex = null;
      this.lastTurnOwnerKey = null;
      this.currentMatchState = null;
      this.lastMatchUpdate = null;
      this.lastRound = null;
      this.lastTurnScore = null;
      this.lastTurnBusted = false;
      this.lastGameScores = [];
      this.lastDartsInTurn = 0;
      this.resetCricket();
    }

    // Always emit match state event
    // FIXED: data.player IS the ARRAY POSITION (0-based), not the index field value!
    const activePlayer = data.players[data.player];
    events.push({
      type: 'match.state',
      timestamp,
      raw,
      data: {
        matchId: data.id,
        player: data.player, // This is the array position (used by frontend)
        playerName: activePlayer?.name ?? 'Unknown',
        gameScores: data.gameScores,
        turnScore: data.turnScore,
        round: data.round,
        finished: data.finished,
        winner: data.winner,
        leg: data.leg,
        set: data.set,
        // Legs/sets needed to win (null = single leg/set) and legs/sets won
        // per player, for the game info and the legs won display
        legs: data.legs,
        sets: data.sets,
        scores: data.scores,
        // Legs/sets won per player.index, counted by the hub (use these)
        ...this.legTally.snapshot(data),
        gameFinished: data.gameFinished,
        players: data.players.map((p) => ({
          index: p.index,
          name: p.name,
          userId: p.userId,
        })),
        turns: data.turns,
        settings: data.settings,
        variant: data.variant,
      },
    });

    // All events created here are match events, so they all carry the game context
    for (const e of events) (e.data as Record<string, unknown>).game = game;

    return events.length === 1 ? events[0] : events;
  }
}

/**
 * Extract the last throw from a match state
 */
export function getLastThrow(matchState: MatchStateData): {
  segment: ThrowSegment;
  coords?: ThrowCoords;
  throwNumber: number;
  playerId: string;
} | null {
  if (!matchState.turns || matchState.turns.length === 0) {
    return null;
  }

  const lastTurn = matchState.turns[matchState.turns.length - 1];
  if (!lastTurn.throws || lastTurn.throws.length === 0) {
    return null;
  }

  const lastThrow = lastTurn.throws[lastTurn.throws.length - 1];
  return {
    segment: lastThrow.segment,
    coords: lastThrow.coords,
    throwNumber: lastThrow.throw,
    playerId: lastTurn.playerId,
  };
}

/**
 * Calculate score for a segment
 */
export function calculateSegmentScore(segment: ThrowSegment): number {
  if (segment.multiplier === 0) return 0;
  return segment.number * segment.multiplier;
}

/**
 * Check if a segment is a special scoring segment (T20, D20, Bull, etc.)
 */
export function isHighValueSegment(segment: ThrowSegment): boolean {
  // Triple 20, Double 20, Bull, Double Bull
  if (segment.multiplier === 3 && segment.number === 20) return true; // T20
  if (segment.multiplier === 2 && segment.number === 20) return true; // D20
  if (segment.bed === 'Bull' || segment.bed === 'DoubleBull') return true;
  return false;
}

/**
 * Check if throw is a miss
 */
export function isMiss(segment: ThrowSegment): boolean {
  return segment.multiplier === 0 || segment.bed === 'Outside';
}
