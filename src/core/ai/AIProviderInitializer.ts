/**
 * AIProviderInitializer - Initialize AI providers from config
 *
 * Extracts the AI provider initialization logic from main.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { getAIProviderService } from './AIProviderService.js';
import type { AIProviderConfig } from './types.js';
import {
  OpenAIProvider,
  AnthropicProvider,
  ElevenLabsProvider,
  StabilityAIProvider,
  RunwayProvider,
  ReplicateProvider,
  OllamaProvider,
  HiggsfieldProvider,
  type OpenAIProviderConfig,
  type AnthropicProviderConfig,
  type ElevenLabsProviderConfig,
  type StabilityAIProviderConfig,
  type RunwayProviderConfig,
  type ReplicateProviderConfig,
  type OllamaProviderConfig,
} from './providers/index.js';

export interface AIProviderInitializerOptions {
  configDir: string;
  configFileName?: string;
}

/**
 * Default AI provider configurations (empty API keys - users configure them in UI)
 */
export const DEFAULT_AI_PROVIDER_CONFIGS: AIProviderConfig[] = [
  {
    id: 'openai',
    type: 'openai',
    name: 'OpenAI',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'ollama',
    type: 'ollama',
    name: 'Ollama (Lokal)',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    enabled: true,
  },
  {
    id: 'elevenlabs',
    type: 'elevenlabs',
    name: 'ElevenLabs',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'stability',
    type: 'stability',
    name: 'Stability AI',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'runway',
    type: 'runway',
    name: 'Runway ML',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'replicate',
    type: 'replicate',
    name: 'Replicate',
    apiKey: '',
    enabled: false,
  },
  {
    id: 'higgsfield',
    type: 'higgsfield',
    name: 'Higgsfield',
    apiKey: '',
    enabled: false,
  },
];

/**
 * Narrow a stored provider config to the config type of one provider class.
 * The service picks the factory by config.type, so the check only fails on a
 * wiring mistake. Provider options come from the user's config file and each
 * provider reads them defensively.
 */
function configOfType<C extends AIProviderConfig>(type: C['type'], config: AIProviderConfig): C {
  if (config.type !== type) {
    throw new Error(`Provider config of type ${config.type} passed to the ${type} factory`);
  }
  return config as C;
}

/**
 * Register all AI provider factories with the service
 */
export function registerProviderFactories(): void {
  const aiService = getAIProviderService();

  // Register provider factories
  // Each factory receives an AIProviderConfig and returns the appropriate provider instance
  aiService.registerProviderFactory('openai', (config) => new OpenAIProvider(configOfType<OpenAIProviderConfig>('openai', config)));
  aiService.registerProviderFactory('anthropic', (config) => new AnthropicProvider(configOfType<AnthropicProviderConfig>('anthropic', config)));
  aiService.registerProviderFactory('elevenlabs', (config) => new ElevenLabsProvider(configOfType<ElevenLabsProviderConfig>('elevenlabs', config)));
  aiService.registerProviderFactory('stability', (config) => new StabilityAIProvider(configOfType<StabilityAIProviderConfig>('stability', config)));
  aiService.registerProviderFactory('runway', (config) => new RunwayProvider(configOfType<RunwayProviderConfig>('runway', config)));
  aiService.registerProviderFactory('replicate', (config) => new ReplicateProvider(configOfType<ReplicateProviderConfig>('replicate', config)));
  aiService.registerProviderFactory('ollama', (config) => new OllamaProvider(configOfType<OllamaProviderConfig>('ollama', config)));
  aiService.registerProviderFactory('higgsfield', (config) => new HiggsfieldProvider(config));
}

/**
 * Load AI provider configurations from file or create defaults
 */
export function loadAIProviderConfigs(options: AIProviderInitializerOptions): AIProviderConfig[] {
  const configPath = path.join(options.configDir, options.configFileName ?? 'ai-providers.json');

  // Ensure config directory exists
  if (!fs.existsSync(options.configDir)) {
    fs.mkdirSync(options.configDir, { recursive: true });
  }

  if (fs.existsSync(configPath)) {
    try {
      const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AIProviderConfig[];
      // Providers added in newer versions are missing from older config files
      const missing = DEFAULT_AI_PROVIDER_CONFIGS.filter((d) => !configs.some((c) => c.id === d.id));
      return [...configs, ...missing.map((d) => ({ ...d }))];
    } catch (err) {
      console.warn('⚠️ Failed to parse AI providers config:', err);
      return DEFAULT_AI_PROVIDER_CONFIGS;
    }
  }

  // Create default config file
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_AI_PROVIDER_CONFIGS, null, 2));
  return DEFAULT_AI_PROVIDER_CONFIGS;
}

/**
 * Save AI provider configurations to file
 */
export function saveAIProviderConfigs(options: AIProviderInitializerOptions): void {
  const configPath = path.join(options.configDir, options.configFileName ?? 'ai-providers.json');
  const aiService = getAIProviderService();

  const providers = aiService.getProviders();
  const configs: AIProviderConfig[] = providers.map((p) => ({
    id: p.config.id,
    type: p.config.type,
    name: p.config.name,
    apiKey: p.config.apiKey,
    baseUrl: p.config.baseUrl,
    enabled: p.config.enabled,
    options: p.config.options,
  }));

  fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
  console.log('💾 AI Provider config saved');
}

/**
 * Initialize AI providers
 */
export function initializeAIProviders(options: AIProviderInitializerOptions): void {
  const aiService = getAIProviderService();

  // Register factories first
  registerProviderFactories();

  // Load configs
  const configs = loadAIProviderConfigs(options);

  // Add all providers
  for (const config of configs) {
    try {
      aiService.addProvider(config);
      console.log(`🤖 AI Provider loaded: ${config.name}`);
    } catch (err) {
      console.warn(`⚠️ Failed to load AI provider ${config.id}:`, err);
    }
  }
}
