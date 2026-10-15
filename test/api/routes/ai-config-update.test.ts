import { describe, it, expect, vi } from 'vitest';
import { AIProviderService } from '../../../src/core/ai/AIProviderService.js';
import type { IAIProvider } from '../../../src/core/ai/AIProvider.js';

describe('AIProviderService.updateProviderConfig', () => {
  it('notifies the provider so cached data from the old key is dropped', () => {
    const service = new AIProviderService();
    const onConfigUpdated = vi.fn();
    service.registerProviderFactory(
      'openai',
      (config) =>
        ({
          config,
          capabilities: ['text-generation'],
          isConfigured: () => true,
          isAvailable: () => true,
          getStatus: vi.fn(),
          onConfigUpdated,
        }) as unknown as IAIProvider
    );
    service.addProvider({ id: 'openai', type: 'openai', name: 'OpenAI', apiKey: 'old', enabled: true });

    service.updateProviderConfig('openai', { apiKey: 'new' });

    expect(onConfigUpdated).toHaveBeenCalledTimes(1);
  });
});
