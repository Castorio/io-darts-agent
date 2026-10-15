import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from './AnthropicProvider.js';

function messageResponse(overrides: Record<string, unknown> = {}): Response {
  const body = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Triple 20!' }],
    model: DEFAULT_ANTHROPIC_MODEL,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  };
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  return (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
}

describe('AnthropicProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(messageResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to Claude Opus 5', async () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-opus-5');

    await createAnthropicProvider('key').generateText({ prompt: 'Tip?' });

    expect(sentBody(fetchMock).model).toBe('claude-opus-5');
  });

  it('replaces a retired configured model with the default', async () => {
    const provider = createAnthropicProvider('key', {
      options: { defaultModel: 'claude-3-5-sonnet-20241022' },
    });

    await provider.generateText({ prompt: 'Tip?' });

    expect(sentBody(fetchMock).model).toBe('claude-opus-5');
  });

  it('keeps a current configured model', async () => {
    const provider = createAnthropicProvider('key', { options: { defaultModel: 'claude-sonnet-5' } });

    await provider.generateText({ prompt: 'Tip?' });

    expect(sentBody(fetchMock).model).toBe('claude-sonnet-5');
  });

  it('drops sampling parameters that current models reject', async () => {
    await createAnthropicProvider('key').generateText({ prompt: 'Tip?', temperature: 0.7, topP: 0.9 });

    const body = sentBody(fetchMock);
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
  });

  it('keeps sampling parameters for models that still accept them', async () => {
    await createAnthropicProvider('key').generateText({
      prompt: 'Tip?',
      model: 'claude-haiku-4-5',
      temperature: 0.7,
    });

    expect(sentBody(fetchMock).temperature).toBe(0.7);
  });

  it('uses low effort on current models so short answers are not used up by thinking', async () => {
    await createAnthropicProvider('key').generateText({ prompt: 'Tip?', maxTokens: 100 });

    expect(sentBody(fetchMock).output_config).toEqual({ effort: 'low' });
  });

  it('does not send effort to models without effort support', async () => {
    await createAnthropicProvider('key').generateText({ prompt: 'Tip?', model: 'claude-haiku-4-5' });

    expect(sentBody(fetchMock)).not.toHaveProperty('output_config');
  });

  it('gives current models enough room so thinking does not use up a short budget', async () => {
    await createAnthropicProvider('key').generateText({ prompt: 'Tip?', maxTokens: 100 });

    expect(sentBody(fetchMock).max_tokens).toBe(1024);
  });

  it('fails instead of returning an empty answer cut off by the token limit', async () => {
    fetchMock.mockResolvedValue(
      messageResponse({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens' })
    );

    await expect(createAnthropicProvider('key').generateText({ prompt: 'Tip?' })).rejects.toThrow(
      'token limit'
    );
  });

  it('opts into fallbacks for dated Claude Opus 5 ids too', async () => {
    await createAnthropicProvider('key').generateText({ prompt: 'Tip?', model: 'claude-opus-5-20260901' });

    expect(sentBody(fetchMock).fallbacks).toBe('default');
  });

  it('does not send the fallback beta through a custom base URL', async () => {
    const provider = createAnthropicProvider('key', { baseUrl: 'https://proxy.example.com' });

    await provider.generateText({ prompt: 'Tip?' });

    expect(sentBody(fetchMock)).not.toHaveProperty('fallbacks');
    expect(sentHeaders(fetchMock)['anthropic-beta']).toBeUndefined();
  });

  it('opts into server-side refusal fallbacks on Claude Opus 5', async () => {
    await createAnthropicProvider('key').generateText({ prompt: 'Tip?' });

    expect(sentBody(fetchMock).fallbacks).toBe('default');
    expect(sentHeaders(fetchMock)['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
  });

  it('maps a refusal with partial text to content_filter', async () => {
    fetchMock.mockResolvedValue(
      messageResponse({ content: [{ type: 'text', text: 'Aim' }], stop_reason: 'refusal' })
    );

    const result = await createAnthropicProvider('key').generateText({ prompt: 'Tip?' });

    expect(result.finishReason).toBe('content_filter');
  });

  it('fails instead of returning an empty answer when the model declined', async () => {
    fetchMock.mockResolvedValue(messageResponse({ content: [], stop_reason: 'refusal' }));

    await expect(createAnthropicProvider('key').generateText({ prompt: 'Tip?' })).rejects.toThrow(
      'declined'
    );
  });

  it('ignores thinking blocks in the returned text', async () => {
    fetchMock.mockResolvedValue(
      messageResponse({
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: 'Aim for double 16.' },
        ],
      })
    );

    const result = await createAnthropicProvider('key').generateText({ prompt: 'Tip?' });

    expect(result.text).toBe('Aim for double 16.');
  });

  it('lists current text models from the API, without retired ones', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            { id: 'claude-opus-5', display_name: 'Claude Opus 5' },
            { id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' },
            { id: 'claude-3-haiku-20240307', display_name: 'Claude Haiku 3' },
          ],
        }),
    } as unknown as Response);

    const models = await createAnthropicProvider('key').listTextModels();

    expect(models).toEqual([
      { id: 'claude-opus-5', name: 'Claude Opus 5' },
      { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/models?limit=100');
  });

  it('checks the API key by listing models instead of sending a message', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 } as Response);

    const status = await createAnthropicProvider('key').getStatus();

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/models');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('GET');
    expect(status.available).toBe(true);
  });
});
