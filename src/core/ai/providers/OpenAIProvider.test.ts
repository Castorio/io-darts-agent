import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOpenAIProvider,
  DEFAULT_OPENAI_TEXT_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_TTS_MODEL,
  type OpenAIProviderConfig,
} from './OpenAIProvider.js';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
  } as unknown as Response;
}

const chatResponse = {
  choices: [{ message: { content: 'Triple 20!' }, finish_reason: 'stop' }],
  model: 'gpt-6-luna',
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

// Model ids as the API returns them for an account
const ACCOUNT_MODELS = [
  'gpt-4.1',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-realtime-preview',
  'gpt-4o-search-preview',
  'gpt-4o-mini-transcribe',
  'gpt-4o-mini-tts',
  'gpt-6-luna',
  'gpt-image-1',
  'gpt-image-2.5-flare',
  'o4-mini',
  'o4-mini-deep-research',
  'dall-e-3',
  'tts-1',
  'whisper-1',
  'text-embedding-3-small',
  'omni-moderation-latest',
];

function routedFetch(modelIds: string[] | null, routes: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    if (url.endsWith('/models')) {
      return Promise.resolve(
        modelIds ? jsonResponse({ data: modelIds.map((id) => ({ id })) }) : jsonResponse({}, 500)
      );
    }
    const route = Object.keys(routes).find((path) => url.endsWith(path));
    return Promise.resolve(jsonResponse(route ? routes[route] : chatResponse));
  });
}

function provider(options: OpenAIProviderConfig['options'] = {}) {
  return createOpenAIProvider({
    id: 'openai',
    type: 'openai',
    name: 'OpenAI',
    apiKey: 'key',
    maxRetries: 1,
    options,
  });
}

function bodyFor(fetchMock: ReturnType<typeof vi.fn>, path: string): Record<string, unknown> {
  const call = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith(path));
  return JSON.parse((call![1] as RequestInit).body as string) as Record<string, unknown>;
}

describe('OpenAIProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = routedFetch(ACCOUNT_MODELS);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listTextModels()', () => {
    it('lists only current text models the key can use, newest preferred first', async () => {
      const models = await provider().listTextModels();

      expect(models.map((m) => m.id)).toEqual(['gpt-6-luna', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini']);
    });
  });

  it('drops legacy gpt-4 snapshots and Responses-only pro models from the list', async () => {
    fetchMock = routedFetch(['gpt-4', 'gpt-4-0613', 'o1', 'o1-pro', 'o1-pro-2025-03-19', 'gpt-4.1-nano']);
    vi.stubGlobal('fetch', fetchMock);

    const models = await provider().listTextModels();

    expect(models.map((m) => m.id)).toEqual(['gpt-4.1-nano', 'o1']);
  });

  describe('text', () => {
    it('uses the newest preferred model the key can access when none is configured', async () => {
      fetchMock = routedFetch(['gpt-4.1', 'gpt-4.1-mini', 'o4-mini']);
      vi.stubGlobal('fetch', fetchMock);

      await provider().generateText({ prompt: 'Tip?' });

      expect(bodyFor(fetchMock, '/chat/completions').model).toBe('gpt-4.1-mini');
    });

    it('prefers gpt-6-luna when the key has it', async () => {
      await provider().generateText({ prompt: 'Tip?' });

      expect(bodyFor(fetchMock, '/chat/completions').model).toBe('gpt-6-luna');
    });

    it('falls back to a widely available model when the model list cannot be loaded', async () => {
      fetchMock = routedFetch(null);
      vi.stubGlobal('fetch', fetchMock);

      await provider().generateText({ prompt: 'Tip?' });

      expect(bodyFor(fetchMock, '/chat/completions').model).toBe(DEFAULT_OPENAI_TEXT_MODEL);
      expect(DEFAULT_OPENAI_TEXT_MODEL).toBe('gpt-4.1-mini');
    });

    it('uses the model chosen in the settings UI (options.defaultModel)', async () => {
      await provider({ defaultModel: 'gpt-4.1' }).generateText({ prompt: 'Tip?' });

      expect(bodyFor(fetchMock, '/chat/completions').model).toBe('gpt-4.1');
    });

    it('replaces deprecated or non-text saved models', async () => {
      for (const saved of ['gpt-4o', 'dall-e-3']) {
        fetchMock.mockClear();
        await provider({ defaultModel: saved }).generateText({ prompt: 'Tip?' });

        expect(bodyFor(fetchMock, '/chat/completions').model).toBe('gpt-6-luna');
      }
    });

    it('sends max_completion_tokens instead of max_tokens', async () => {
      await provider().generateText({ prompt: 'Tip?', model: 'gpt-4.1-mini', maxTokens: 100 });

      const body = bodyFor(fetchMock, '/chat/completions');
      expect(body.max_completion_tokens).toBe(100);
      expect(body).not.toHaveProperty('max_tokens');
    });

    it('does not send sampling parameters to reasoning models', async () => {
      await provider().generateText({ prompt: 'Tip?', temperature: 0.7, topP: 0.9, stop: ['\n'] });

      const body = bodyFor(fetchMock, '/chat/completions');
      expect(body).not.toHaveProperty('temperature');
      expect(body).not.toHaveProperty('top_p');
      expect(body).not.toHaveProperty('stop');
    });

    it('gives reasoning models low effort and enough room to answer', async () => {
      await provider().generateText({ prompt: 'Tip?', model: 'o4-mini', maxTokens: 100 });

      const body = bodyFor(fetchMock, '/chat/completions');
      expect(body.reasoning_effort).toBe('low');
      expect(body.max_completion_tokens).toBe(1024);
    });

    it('does not send reasoning_effort to gpt-4.1 models', async () => {
      await provider().generateText({ prompt: 'Tip?', model: 'gpt-4.1-mini', maxTokens: 100 });

      const body = bodyFor(fetchMock, '/chat/completions');
      expect(body).not.toHaveProperty('reasoning_effort');
      expect(body.max_completion_tokens).toBe(100);
    });

    it('fails instead of returning an empty answer cut off by the token limit', async () => {
      fetchMock = routedFetch(ACCOUNT_MODELS, {
        '/chat/completions': {
          choices: [{ message: { content: '' }, finish_reason: 'length' }],
          model: 'o4-mini',
          usage: { prompt_tokens: 10, completion_tokens: 1024, total_tokens: 1034 },
        },
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(provider().generateText({ prompt: 'Tip?', model: 'o4-mini' })).rejects.toThrow(
        'token limit'
      );
    });

    it('prefers the model chosen in the UI over a legacy textModel option', async () => {
      await provider({ defaultModel: 'gpt-4.1', textModel: 'gpt-4.1-nano' }).generateText({ prompt: 'Tip?' });

      expect(bodyFor(fetchMock, '/chat/completions').model).toBe('gpt-4.1');
    });

    it('reloads the model list after the configuration changed', async () => {
      const p = provider();
      await p.listTextModels();
      fetchMock = routedFetch(['gpt-4.1-nano']);
      vi.stubGlobal('fetch', fetchMock);

      p.onConfigUpdated();

      expect((await p.listTextModels()).map((m) => m.id)).toEqual(['gpt-4.1-nano']);
    });

    it('keeps sampling parameters for gpt-4.1 models', async () => {
      await provider().generateText({ prompt: 'Tip?', model: 'gpt-4.1-mini', temperature: 0.7 });

      expect(bodyFor(fetchMock, '/chat/completions').temperature).toBe(0.7);
    });
  });

  describe('images', () => {
    const imageRoute = { '/images/generations': { data: [{ b64_json: 'aW1n' }] } };

    it('uses the newest GPT Image model the key can access, without response_format', async () => {
      fetchMock = routedFetch(['gpt-image-1'], imageRoute);
      vi.stubGlobal('fetch', fetchMock);

      const result = await provider().generateImage({ prompt: 'A dartboard' });

      const body = bodyFor(fetchMock, '/images/generations');
      expect(body.model).toBe('gpt-image-1');
      expect(body).not.toHaveProperty('response_format');
      expect(result.images[0].base64).toBe('aW1n');
    });

    it('prefers gpt-image-2.5-flare and replaces DALL-E', async () => {
      fetchMock = routedFetch(ACCOUNT_MODELS, imageRoute);
      vi.stubGlobal('fetch', fetchMock);

      await provider({ imageModel: 'dall-e-3' }).generateImage({ prompt: 'A dartboard' });

      expect(bodyFor(fetchMock, '/images/generations').model).toBe('gpt-image-2.5-flare');
      expect(DEFAULT_OPENAI_IMAGE_MODEL).toBe('gpt-image-1');
    });

    it('maps orientation to GPT Image sizes and hd to high quality', async () => {
      fetchMock = routedFetch(ACCOUNT_MODELS, imageRoute);
      vi.stubGlobal('fetch', fetchMock);

      await provider().generateImage({ prompt: 'A dartboard', width: 1600, height: 900, style: 'hd' });

      const body = bodyFor(fetchMock, '/images/generations');
      expect(body.size).toBe('1536x1024');
      expect(body.quality).toBe('high');
    });
  });

  describe('speech', () => {
    it('defaults to gpt-4o-mini-tts and replaces tts-1', async () => {
      expect(DEFAULT_OPENAI_TTS_MODEL).toBe('gpt-4o-mini-tts');

      await provider({ ttsModel: 'tts-1' }).generateSpeech({ text: '180!', voice: 'alloy' });

      const body = bodyFor(fetchMock, '/audio/speech');
      expect(body.model).toBe('gpt-4o-mini-tts');
      expect(body).not.toHaveProperty('speed');
    });
  });
});
