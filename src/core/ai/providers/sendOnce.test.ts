/**
 * Requests that start paid work are sent exactly once: after a 5xx, timeout
 * or network error the provider may already have processed and billed them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { ReplicateProvider } from './ReplicateProvider.js';
import { StabilityAIProvider } from './StabilityAIProvider.js';
import { ElevenLabsProvider } from './ElevenLabsProvider.js';

const base = { apiKey: 'key', enabled: true, maxRetries: 3 };
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

type Failure = 'status500' | 'network';

let fetchMock: ReturnType<typeof vi.fn>;

function failPostsWith(failure: Failure) {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') !== 'POST') {
      return new Response(JSON.stringify({ data: [], voices: [] }), { status: 200 });
    }
    if (failure === 'network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500 });
  });
}

function postCalls(): string[] {
  return fetchMock.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
    .map((c) => c[0] as string);
}

const cases: Array<{ name: string; run: () => Promise<unknown> }> = [
  {
    name: 'OpenAI chat completion',
    run: () => new OpenAIProvider({ ...base, id: 'openai', type: 'openai', name: 'OpenAI' })
      .generateText({ prompt: 'hi', model: 'gpt-5.1' }),
  },
  {
    name: 'OpenAI image',
    run: () => new OpenAIProvider({ ...base, id: 'openai', type: 'openai', name: 'OpenAI' })
      .generateImage({ prompt: 'a dart', model: 'gpt-image-1' }),
  },
  {
    name: 'OpenAI speech',
    run: () => new OpenAIProvider({ ...base, id: 'openai', type: 'openai', name: 'OpenAI' })
      .generateSpeech({ text: 'one hundred and eighty', voice: 'alloy', model: 'gpt-4o-mini-tts' }),
  },
  {
    name: 'OpenAI embeddings',
    run: () => new OpenAIProvider({ ...base, id: 'openai', type: 'openai', name: 'OpenAI' })
      .generateEmbeddings({ input: 'x' }),
  },
  {
    name: 'Anthropic message',
    run: () => new AnthropicProvider({ ...base, id: 'anthropic', type: 'anthropic', name: 'Anthropic' })
      .generateText({ prompt: 'hi' }),
  },
  {
    name: 'Replicate prediction (image)',
    run: () => new ReplicateProvider({ ...base, id: 'replicate', type: 'replicate', name: 'Replicate' })
      .generateImage({ prompt: 'a dart' }),
  },
  {
    name: 'Replicate prediction (video)',
    run: () => new ReplicateProvider({ ...base, id: 'replicate', type: 'replicate', name: 'Replicate' })
      .generateVideo({ prompt: 'a dart' }),
  },
  {
    name: 'Stability engine image',
    run: () => new StabilityAIProvider({ ...base, id: 'stability', type: 'stability', name: 'Stability AI' })
      .generateImage({ prompt: 'a dart', model: 'stable-diffusion-xl-1024-v1-0' }),
  },
  {
    name: 'Stability stable-image',
    run: () => new StabilityAIProvider({ ...base, id: 'stability', type: 'stability', name: 'Stability AI' })
      .generateImage({ prompt: 'a dart', model: 'stable-image-core' }),
  },
  {
    name: 'ElevenLabs speech',
    run: () => new ElevenLabsProvider({ ...base, id: 'elevenlabs', type: 'elevenlabs', name: 'ElevenLabs' })
      .generateSpeech({ text: 'one hundred and eighty', voice: VOICE_ID }),
  },
];

describe('paid requests are sent once', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  for (const c of cases) {
    it(`${c.name}: one POST and a clear error on a 500`, async () => {
      failPostsWith('status500');

      await expect(c.run()).rejects.toThrow(/500.*not retried/);
      expect(postCalls()).toHaveLength(1);
    });

    it(`${c.name}: one POST and a clear error on a network error`, async () => {
      failPostsWith('network');

      await expect(c.run()).rejects.toThrow(/fetch failed.*not retried/);
      expect(postCalls()).toHaveLength(1);
    });
  }
});
