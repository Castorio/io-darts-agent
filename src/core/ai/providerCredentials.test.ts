import { describe, it, expect } from 'vitest';
import { resolveProviderApiKey, resolveProviderDefaultModel } from './providerCredentials.js';

function service(providers: Record<string, { apiKey: string; available: boolean; options?: Record<string, unknown> }>) {
  return {
    getProvider: (id: string) => {
      const p = providers[id];
      return p ? { config: { apiKey: p.apiKey, options: p.options }, isAvailable: () => p.available } : undefined;
    },
  };
}

describe('resolveProviderApiKey', () => {
  it('uses the key from the AI settings', () => {
    const s = service({ elevenlabs: { apiKey: 'from-ai-settings', available: true } });

    expect(resolveProviderApiKey(s, 'elevenlabs', { apiKey: 'legacy' })).toBe('from-ai-settings');
  });

  it('falls back to the legacy hub config when the AI settings provider is disabled', () => {
    const s = service({ elevenlabs: { apiKey: 'from-ai-settings', available: false } });

    expect(resolveProviderApiKey(s, 'elevenlabs', { apiKey: 'legacy' })).toBe('legacy');
  });

  it('falls back to the legacy hub config when the provider is unknown', () => {
    expect(resolveProviderApiKey(service({}), 'runway', { apiKey: 'legacy' })).toBe('legacy');
  });

  it('returns undefined when no key is configured anywhere', () => {
    expect(resolveProviderApiKey(service({}), 'elevenlabs', undefined)).toBeUndefined();
    expect(resolveProviderApiKey(service({}), 'elevenlabs', { apiKey: '' })).toBeUndefined();
  });
});

describe('resolveProviderDefaultModel', () => {
  it('uses the model chosen in the AI settings', () => {
    const s = service({ runway: { apiKey: 'k', available: true, options: { defaultModel: 'kling3.0_standard' } } });

    expect(resolveProviderDefaultModel(s, 'runway', { model: 'gen3a_turbo' })).toBe('kling3.0_standard');
  });

  it('keeps the AI settings model when only the legacy key is in use', () => {
    const s = service({ runway: { apiKey: '', available: false, options: { defaultModel: 'veo3.1_fast' } } });

    expect(resolveProviderDefaultModel(s, 'runway', { model: 'gen3a_turbo' })).toBe('veo3.1_fast');
  });

  it('falls back to the legacy hub config model', () => {
    const s = service({ runway: { apiKey: 'k', available: true } });

    expect(resolveProviderDefaultModel(s, 'runway', { model: 'gen3a_turbo' })).toBe('gen3a_turbo');
    expect(resolveProviderDefaultModel(service({}), 'runway', { model: 'gen3a' })).toBe('gen3a');
  });

  it('ignores empty or non-string values', () => {
    const s = service({ runway: { apiKey: 'k', available: true, options: { defaultModel: 42 } } });

    expect(resolveProviderDefaultModel(s, 'runway', undefined)).toBeUndefined();
    expect(resolveProviderDefaultModel(service({ runway: { apiKey: 'k', available: true, options: { defaultModel: ' ' } } }), 'runway', { model: '' })).toBeUndefined();
  });
});
