import { describe, it, expect } from 'vitest';
import { resolveProviderApiKey } from './providerCredentials.js';

function service(providers: Record<string, { apiKey: string; available: boolean }>) {
  return {
    getProvider: (id: string) => {
      const p = providers[id];
      return p ? { config: { apiKey: p.apiKey }, isAvailable: () => p.available } : undefined;
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
