import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createDartsCallerHandler,
  type CallRequest,
} from '../../../modules/darts-caller/src/index.js';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function collect(config: Record<string, unknown>) {
  const handler = createDartsCallerHandler({ delayMs: 0, ...config });
  const calls: CallRequest[] = [];
  handler.onCallRequest((r) => calls.push(r));
  return { handler, calls };
}

const playerChange = (remaining?: number) => ({
  type: 'player.changed',
  timestamp: Date.now(),
  data: { playerName: 'Anna', playerIndex: 0, remaining },
}) as never;

const turnFinished = (turnScore: number) => ({
  type: 'turn.finished',
  timestamp: Date.now(),
  data: { turnScore, remaining: 301, busted: false, throws: [] },
}) as never;

describe('DartsCallerHandler reads the shared config shape', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honours callSettings.playerChange from the page', async () => {
    const { handler, calls } = collect({ callSettings: { playerChange: false } });
    await handler.handleEvent(playerChange());
    await flush();
    expect(calls).toHaveLength(0);
  });

  it('migrates an old page config (callPlayerNames false) on construction', async () => {
    const { handler, calls } = collect({ voiceType: 'system', callPlayerNames: false });
    await handler.handleEvent(playerChange());
    await flush();
    expect(calls).toHaveLength(0);
  });

  it('only calls "you require" up to the checkout threshold', async () => {
    const { handler, calls } = collect({ callSettings: { checkoutThreshold: 100 } });
    await handler.handleEvent(playerChange(120));
    await handler.handleEvent(playerChange(80));
    await flush();
    expect(calls.map((c) => c.text)).toEqual(['Anna', 'Anna, you require 80']);
  });

  it('attaches the browser TTS settings to TTS call requests', async () => {
    const { handler, calls } = collect({
      callerType: 'tts',
      language: 'de',
      volume: 40,
      ttsSettings: { voice: 'Anna', rate: 1.2, pitch: 0.9 },
    });
    await handler.handleEvent(turnFinished(60));
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].tts).toEqual({ voice: 'Anna', rate: 1.2, pitch: 0.9, volume: 40, lang: 'de-DE' });
  });

  it('applies updateConfig immediately and keeps the voice packs directory', async () => {
    const { handler, calls } = collect({ voicePacksDir: '/tmp/packs' });
    handler.updateConfig({ callSettings: { scores: false } } as never);
    await handler.handleEvent(turnFinished(60));
    await flush();
    expect(calls).toHaveLength(0);
    expect(handler.getConfig().voicePacksDir).toBe('/tmp/packs');
  });

  it('exposes only the normalized shape through getConfig', () => {
    const { handler } = collect({ voiceType: 'elevenlabs', selectedVoicePackId: 'p1', callScores: false });
    const config = handler.getConfig() as unknown as Record<string, unknown>;
    expect(config.callerType).toBe('voicepack');
    expect(config).not.toHaveProperty('voiceType');
    expect(config).not.toHaveProperty('selectedVoicePackId');
    expect(config).not.toHaveProperty('callScores');
  });
});
