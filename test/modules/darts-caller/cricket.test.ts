import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createDartsCallerHandler,
  type CallRequest,
} from '../../../modules/darts-caller/src/index.js';
import {
  closedFile,
  closedText,
  marksFile,
  marksText,
  cricketPhrases,
} from '../../../modules/darts-caller/src/cricketPhrases.js';
import { getDefaultPhrases } from '../../../modules/darts-caller/src/VoicePackGenerator.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function collect(config: Record<string, unknown>) {
  const handler = createDartsCallerHandler({ delayMs: 0, callerType: 'tts', ...config });
  const calls: CallRequest[] = [];
  handler.onCallRequest((r) => calls.push(r));
  return { handler, calls };
}

const cricketTurnFinished = (overrides: Record<string, unknown> = {}) => ({
  type: 'turn.finished',
  timestamp: Date.now(),
  data: {
    turnScore: 40,
    turnPoints: 40,
    remaining: 40,
    busted: false,
    throws: [],
    game: { variant: 'Cricket', mode: 'cricket', cutThroat: false },
    ...overrides,
  },
}) as never;

const cricketPlayerChanged = (overrides: Record<string, unknown> = {}) => ({
  type: 'player.changed',
  timestamp: Date.now(),
  data: {
    playerName: 'Anna',
    playerIndex: 0,
    remaining: 40,
    game: { variant: 'Cricket', mode: 'cricket', cutThroat: false },
    ...overrides,
  },
}) as never;

const cricketClosed = (field: string, overrides: Record<string, unknown> = {}) => ({
  type: 'cricket.closed',
  timestamp: Date.now(),
  data: {
    matchId: 'm1',
    set: 1,
    leg: 1,
    field,
    playerIndex: 0,
    playerName: 'Anna',
    game: { variant: 'Cricket', mode: 'cricket', cutThroat: false },
    ...overrides,
  },
}) as never;

describe('DartsCallerHandler in Cricket', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('turn.finished', () => {
    it('does not announce a score for a normal turn', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 4 }));
      await flush();
      expect(calls).toHaveLength(0);
    });

    it('announces a strong turn once it reaches the threshold', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 6 }));
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].text).toBe('Six marks!');
      expect(calls[0].audioFile).toBe('marks_6');
    });

    it('does not announce a strong turn below a raised threshold', async () => {
      const { handler, calls } = collect({ callSettings: { cricketMarksThreshold: 7 } });
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 6 }));
      await flush();
      expect(calls).toHaveLength(0);
    });

    it('clamps turnMarks above 9 to marks_9', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 11 }));
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].audioFile).toBe('marks_9');
    });

    it('does not announce 180 for a 180 point Cricket turn', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ turnPoints: 180, turnMarks: 2 }));
      await flush();
      expect(calls).toHaveLength(0);
    });

    it('does not announce a bust for a busted Cricket turn', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ busted: true, turnMarks: 2 }));
      await flush();
      expect(calls).toHaveLength(0);
    });

    it('stays silent when cricketMarks is disabled', async () => {
      const { handler, calls } = collect({ callSettings: { cricketMarks: false } });
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 9 }));
      await flush();
      expect(calls).toHaveLength(0);
    });
  });

  describe('player.changed', () => {
    it('announces only the player name, never "you require"', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketPlayerChanged({ remaining: 40 }));
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].text).toBe('Anna');
    });
  });

  describe('cricket.closed', () => {
    it('announces a closed number field in English', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketClosed('20'));
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].text).toBe('Twenty closed!');
      expect(calls[0].audioFile).toBe('closed_20');
    });

    it('announces a closed Bull field', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketClosed('25'));
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].text).toBe('Bull closed!');
      expect(calls[0].audioFile).toBe('closed_bull');
    });

    it('announces in German when the language is de', async () => {
      const { handler, calls } = collect({ language: 'de' });
      await handler.handleEvent(cricketClosed('20'));
      await flush();
      expect(calls[0].text).toBe('Zwanzig geschlossen!');
    });

    it('stays silent when cricketClosed is disabled', async () => {
      const { handler, calls } = collect({ callSettings: { cricketClosed: false } });
      await handler.handleEvent(cricketClosed('20'));
      await flush();
      expect(calls).toHaveLength(0);
    });
  });

  describe('game.finished / match.finished still work in Cricket', () => {
    it('announces game shot', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 6 })); // sets gameMode = cricket
      await handler.handleEvent({
        type: 'game.finished',
        timestamp: Date.now(),
        data: { winner: { name: 'Anna' }, game: { variant: 'Cricket', mode: 'cricket', cutThroat: false } },
      } as never);
      await flush();
      expect(calls.map((c) => c.text)).toContain('Game shot! Anna!');
    });

    it('announces match shot', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 6 }));
      await handler.handleEvent({
        type: 'match.finished',
        timestamp: Date.now(),
        data: { winner: { name: 'Anna' }, game: { variant: 'Cricket', mode: 'cricket', cutThroat: false } },
      } as never);
      await flush();
      expect(calls.map((c) => c.text)).toContain('Game shot and the match! Anna!');
    });
  });

  describe('X01 is unaffected', () => {
    it('still announces scores on turn.finished', async () => {
      const { handler, calls } = collect({});
      await handler.handleEvent({
        type: 'turn.finished',
        timestamp: Date.now(),
        data: { turnScore: 60, remaining: 301, busted: false, throws: [] },
      } as never);
      await flush();
      expect(calls).toHaveLength(1);
      expect(calls[0].text).toBe('sixty');
    });

    it('resets the remembered game mode on match.start', async () => {
      const { handler, calls } = collect({});
      // Learn cricket mode
      await handler.handleEvent(cricketTurnFinished({ turnMarks: 6 }));
      await flush();
      calls.length = 0;
      // A fresh match.start should drop the remembered Cricket mode
      await handler.handleEvent({ type: 'match.start', timestamp: Date.now(), data: {} } as never);
      await flush();
      // Now an X01 turn.finished (no data.game) must be treated as X01 again
      await handler.handleEvent({
        type: 'turn.finished',
        timestamp: Date.now(),
        data: { turnScore: 60, remaining: 301, busted: false, throws: [] },
      } as never);
      await flush();
      expect(calls.some((c) => c.text === 'sixty')).toBe(true);
    });
  });
});

describe('cricketPhrases', () => {
  it('builds the closed-field filename, closed_bull for the bull field', () => {
    expect(closedFile('20')).toBe('closed_20');
    expect(closedFile('10')).toBe('closed_10');
    expect(closedFile('25')).toBe('closed_bull');
  });

  it('builds English and German closed-field text', () => {
    expect(closedText('20', 'en')).toBe('Twenty closed!');
    expect(closedText('25', 'en')).toBe('Bull closed!');
    expect(closedText('20', 'de')).toBe('Zwanzig geschlossen!');
    expect(closedText('25', 'de')).toBe('Bull geschlossen!');
  });

  it('builds the marks filename, clamped to 3..9', () => {
    expect(marksFile(6)).toBe('marks_6');
    expect(marksFile(1)).toBe('marks_3');
    expect(marksFile(11)).toBe('marks_9');
  });

  it('builds English and German marks text', () => {
    expect(marksText(6, 'en')).toBe('Six marks!');
    expect(marksText(6, 'de')).toBe('Sechs Marks!');
  });

  it('produces 12 closed-field entries and 7 marks entries, all category cricket', () => {
    const phrases = cricketPhrases('en');
    expect(phrases).toHaveLength(19);
    expect(phrases.every((p) => p.category === 'cricket')).toBe(true);
    const filenames = phrases.map((p) => p.filename);
    for (const field of ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']) {
      expect(filenames).toContain(`closed_${field}`);
    }
    expect(filenames).toContain('closed_bull');
    for (let n = 3; n <= 9; n++) {
      expect(filenames).toContain(`marks_${n}`);
    }
  });
});

describe('getDefaultPhrases includes Cricket phrases', () => {
  it('includes closed and marks phrases in English', () => {
    const phrases = getDefaultPhrases('en');
    const filenames = phrases.map((p) => p.filename);
    for (const field of ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']) {
      expect(filenames).toContain(`closed_${field}`);
    }
    expect(filenames).toContain('closed_bull');
    for (let n = 3; n <= 9; n++) {
      expect(filenames).toContain(`marks_${n}`);
    }
  });

  it('includes German texts for Cricket phrases', () => {
    const phrases = getDefaultPhrases('de');
    const closed20 = phrases.find((p) => p.filename === 'closed_20');
    const marks6 = phrases.find((p) => p.filename === 'marks_6');
    expect(closed20?.text).toBe('Zwanzig geschlossen!');
    expect(marks6?.text).toBe('Sechs Marks!');
  });
});
