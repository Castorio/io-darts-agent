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
];

/**
 * Register all AI provider factories with the service
 */
export function registerProviderFactories(): void {
  const aiService = getAIProviderService();

  // Register provider factories
  // Each factory receives an AIProviderConfig and returns the appropriate provider instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('openai', (config) => new OpenAIProvider(config as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('anthropic', (config) => new AnthropicProvider(config as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('elevenlabs', (config) => new ElevenLabsProvider(config as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('stability', (config) => new StabilityAIProvider(config as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('runway', (config) => new RunwayProvider(config as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('replicate', (config) => new ReplicateProvider(config as any));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiService.registerProviderFactory('ollama', (config) => new OllamaProvider(config as any));
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
      return configs;
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
