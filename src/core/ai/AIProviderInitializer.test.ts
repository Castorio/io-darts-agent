import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { loadAIProviderConfigs, DEFAULT_AI_PROVIDER_CONFIGS } from './AIProviderInitializer.js';

describe('loadAIProviderConfigs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'ai-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('offers Higgsfield by default', () => {
    expect(DEFAULT_AI_PROVIDER_CONFIGS.find((c) => c.id === 'higgsfield')).toMatchObject({
      type: 'higgsfield',
      enabled: false,
      apiKey: '',
    });
  });

  it('adds providers that are missing from an existing config file, keeping saved ones', () => {
    writeFileSync(
      path.join(dir, 'ai-providers.json'),
      JSON.stringify([{ id: 'openai', type: 'openai', name: 'OpenAI', apiKey: 'sk-saved', enabled: true }])
    );

    const configs = loadAIProviderConfigs({ configDir: dir });

    expect(configs.find((c) => c.id === 'openai')?.apiKey).toBe('sk-saved');
    expect(configs.find((c) => c.id === 'higgsfield')).toBeDefined();
    expect(configs).toHaveLength(DEFAULT_AI_PROVIDER_CONFIGS.length);
  });
});
