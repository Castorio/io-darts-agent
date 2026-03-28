export const MOCK_BOARD_ID = '00000000-0000-4000-8000-000000000001';
export const MOCK_MATCH_ID = '00000000-0000-4000-8000-000000000002';
export const MOCK_USER_ID = '00000000-0000-4000-8000-000000000003';
// ============================================
// Board State Messages
// ============================================
export const mockBoardStateStarted = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.state`,
    data: {
        connected: true,
        event: 'Started',
        numThrows: 0,
        status: 'Throw',
    },
};
export const mockBoardStateStopped = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.state`,
    data: {
        connected: true,
        event: 'Manual reset',
        numThrows: 0,
        status: 'Stopped',
    },
};
export const mockBoardStateThrowDetected = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.state`,
    data: {
        connected: true,
        event: 'Throw detected',
        numThrows: 2,
        status: 'Throw',
    },
};
export const mockBoardStateTakeout = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.state`,
    data: {
        connected: true,
        event: 'Throw detected',
        numThrows: 3,
        status: 'Takeout',
    },
};
// ============================================
// Match Start/Delete Messages
// ============================================
export const mockMatchStart = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.matches`,
    data: {
        event: 'start',
        id: MOCK_MATCH_ID,
    },
};
export const mockMatchDelete = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.matches`,
    data: {
        event: 'delete',
        id: MOCK_MATCH_ID,
    },
};
// ============================================
// Board Events Messages (Throws)
// ============================================
export const mockThrowT20 = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.events`,
    data: {
        boardId: MOCK_BOARD_ID,
        event: 'Throw detected',
        throw: {
            coords: { x: 0.05, y: -0.02 },
            segment: {
                bed: 'Triple',
                multiplier: 3,
                name: 'T20',
                number: 20,
            },
        },
        throwNumber: 1,
    },
};
export const mockThrowS20 = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.events`,
    data: {
        boardId: MOCK_BOARD_ID,
        event: 'Throw detected',
        throw: {
            coords: { x: 0.1, y: 0.15 },
            segment: {
                bed: 'SingleInner',
                multiplier: 1,
                name: 'S20',
                number: 20,
            },
        },
        throwNumber: 2,
    },
};
export const mockThrowMiss = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.events`,
    data: {
        boardId: MOCK_BOARD_ID,
        event: 'Throw detected',
        throw: {
            segment: {
                bed: 'Outside',
                multiplier: 0,
                name: 'Miss',
                number: 0,
            },
        },
        throwNumber: 3,
    },
};
export const mockTakeoutStarted = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.events`,
    data: {
        boardId: MOCK_BOARD_ID,
        event: 'Takeout started',
        throw: {
            segment: {
                bed: '',
                multiplier: 0,
                name: '',
                number: 0,
            },
        },
    },
};
export const mockTakeoutFinished = {
    channel: 'autodarts.boards',
    topic: `${MOCK_BOARD_ID}.events`,
    data: {
        boardId: MOCK_BOARD_ID,
        event: 'Takeout finished',
        throw: {
            segment: {
                bed: '',
                multiplier: 0,
                name: '',
                number: 0,
            },
        },
    },
};
// ============================================
// Match State Messages
// ============================================
export function createMockMatchState(overrides = {}) {
    const matchState = {
        id: MOCK_MATCH_ID,
        createdAt: '2024-03-27T12:00:00Z',
        finished: false,
        gameFinished: false,
        gameWinner: null,
        hasReferee: false,
        leg: 1,
        set: 1,
        round: 1,
        type: 'Local',
        variant: 'X01',
        winner: null,
        settings: {
            baseScore: 501,
            bullMode: '25/50',
            inMode: 'Straight',
            maxRounds: 50,
            outMode: 'Double',
        },
        state: 'playing',
        scores: [501, 501],
        chalkboards: [
            { rows: [{ points: 0, round: 0, score: 501 }] },
            { rows: [{ points: 0, round: 0, score: 501 }] },
        ],
        gameScores: [501, 501],
        stats: {
            legStats: [
                {
                    average: 0,
                    averageUntil170: 0,
                    checkoutPercent: 0,
                    checkoutPoints: 0,
                    checkoutPointsAverage: 0,
                    checkouts: 0,
                    checkoutsHit: 0,
                    dartsThrown: 0,
                    dartsUntil170: 0,
                    first9Average: 0,
                    first9Score: 0,
                    less60: 0,
                    plus60: 0,
                    plus100: 0,
                    plus140: 0,
                    plus170: 0,
                    score: 0,
                    scoreUntil170: 0,
                    total180: 0,
                },
                {
                    average: 0,
                    averageUntil170: 0,
                    checkoutPercent: 0,
                    checkoutPoints: 0,
                    checkoutPointsAverage: 0,
                    checkouts: 0,
                    checkoutsHit: 0,
                    dartsThrown: 0,
                    dartsUntil170: 0,
                    first9Average: 0,
                    first9Score: 0,
                    less60: 0,
                    plus60: 0,
                    plus100: 0,
                    plus140: 0,
                    plus170: 0,
                    score: 0,
                    scoreUntil170: 0,
                    total180: 0,
                },
            ],
            matchStats: [],
        },
        turnBusted: false,
        turnScore: 0,
        turns: [],
        player: 0,
        players: [
            {
                id: 'player-1-id',
                index: 0,
                name: 'player-one',
                boardId: MOCK_BOARD_ID,
                userId: MOCK_USER_ID,
                refereeState: 'can-call-referee',
            },
            {
                id: 'player-2-id',
                index: 1,
                name: 'laura',
                boardId: MOCK_BOARD_ID,
                userId: null,
                refereeState: 'can-call-referee-when-active',
            },
        ],
        host: null,
        ...overrides,
    };
    return {
        channel: 'autodarts.matches',
        topic: `${MOCK_MATCH_ID}.state`,
        data: matchState,
    };
}
export const mockMatchStateInitial = createMockMatchState();
export const mockMatchStateAfterThrow = createMockMatchState({
    gameScores: [441, 501],
    turnScore: 60,
    turns: [
        {
            busted: false,
            createdAt: '2024-03-27T12:01:00Z',
            finishedAt: '0001-01-01T00:00:00Z',
            id: 'turn-1',
            marks: null,
            playerId: 'player-1-id',
            points: 60,
            round: 1,
            score: 441,
            throws: [
                {
                    coords: { x: 0.05, y: -0.02 },
                    createdAt: '2024-03-27T12:01:00Z',
                    entry: 'detected',
                    id: 'throw-1',
                    marks: null,
                    segment: {
                        bed: 'Triple',
                        multiplier: 3,
                        name: 'T20',
                        number: 20,
                    },
                    throw: 1,
                },
            ],
            turn: 0,
        },
    ],
});
export const mockMatchStatePlayer2Turn = createMockMatchState({
    player: 1,
    gameScores: [321, 501],
    round: 1,
});
export const mockMatchStateGameFinished = createMockMatchState({
    finished: false,
    gameFinished: true,
    gameWinner: 0,
    gameScores: [0, 123],
});
export const mockMatchStateMatchFinished = createMockMatchState({
    finished: true,
    gameFinished: true,
    gameWinner: 0,
    winner: 0,
    gameScores: [0, 123],
});
// ============================================
// Helper: Create sequence of game events
// ============================================
export function createGameEventSequence() {
    return [
        mockMatchStart,
        createMockMatchState({ gameScores: [501, 501], player: 0 }),
        mockThrowT20,
        createMockMatchState({ gameScores: [441, 501], turnScore: 60, player: 0 }),
        mockThrowT20,
        createMockMatchState({ gameScores: [381, 501], turnScore: 120, player: 0 }),
        mockThrowT20,
        createMockMatchState({ gameScores: [321, 501], turnScore: 180, player: 0 }),
        mockTakeoutStarted,
        mockTakeoutFinished,
        createMockMatchState({ gameScores: [321, 501], player: 1, round: 1 }),
    ];
}
//# sourceMappingURL=autodarts-events.js.map