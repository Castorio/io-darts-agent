/**
 * ModuleHandlerFactory - Creates and manages module handlers
 *
 * Extracts the repetitive handler creation logic from main.ts
 * for internal/builtin modules (WLED, Game Display, Darts Caller)
 */

import { runtimePath } from '../runtimePaths.js';
import type { ParsedEvent } from '../../types/index.js';
import type { PlayerService } from '../players/PlayerService.js';
import {
  createWledHandler,
  createGameDisplayHandler,
  createDartsCallerHandler,
  ElevenLabsService,
  VoicePackGenerator,
  type WledHandler,
  type GameDisplayHandler,
  type DartsCallerHandler,
  type CallRequestCallback,
} from './handlers/index.js';

export interface ModuleHandlerContext {
  playerService: PlayerService | null;
  elevenLabsApiKey?: string;
  onCallerRequest?: CallRequestCallback;
  log?: (source: string, message: string, data?: unknown) => void;
}

export interface CreatedHandler {
  handler: WledHandler | GameDisplayHandler | DartsCallerHandler;
  eventHandler: (event: ParsedEvent) => Promise<void>;
  type: 'wled' | 'game-display' | 'darts-caller';
}

/**
 * Create a logger interface for module handlers
 */
function createModuleLogger(
  moduleId: string,
  logFn?: (source: string, message: string, data?: unknown) => void
): { log: (source: string, message: string, data?: unknown) => void } {
  return {
    log: (source: string, message: string, data?: unknown): void => {
      if (logFn) {
        logFn(source || moduleId, message, data);
      }
    },
  };
}

/**
 * Create WLED handler with full configuration
 */
export function createWledModuleHandler(
  configValues: Record<string, unknown>,
  context: ModuleHandlerContext
): CreatedHandler {
  const handler = createWledHandler(configValues);
  handler.setPlayerService(context.playerService);
  handler.setLogger(createModuleLogger('wled', context.log));

  const eventHandler = async (event: ParsedEvent): Promise<void> => {
    await handler.handleEvent(event);
  };

  return { handler, eventHandler, type: 'wled' };
}

/**
 * Create Game Display handler
 */
export function createGameDisplayModuleHandler(
  configValues: Record<string, unknown>
): CreatedHandler {
  const handler = createGameDisplayHandler(configValues);

  const eventHandler = async (event: ParsedEvent): Promise<void> => {
    await handler.handleEvent(event);
  };

  return { handler, eventHandler, type: 'game-display' };
}

/**
 * Create Darts Caller handler with voice packs
 */
export function createDartsCallerModuleHandler(
  configValues: Record<string, unknown>,
  context: ModuleHandlerContext
): CreatedHandler & { service?: ElevenLabsService; generator?: VoicePackGenerator } {
  const voicePacksDir = runtimePath('data', 'voicepacks');

  const handler = createDartsCallerHandler({
    ...configValues,
    voicePacksDir,
  });

  // Register callback to forward call requests
  if (context.onCallerRequest) {
    handler.onCallRequest(context.onCallerRequest);
  }

  let service: ElevenLabsService | undefined;
  let generator: VoicePackGenerator | undefined;

  // Initialize ElevenLabs service if API key is configured
  if (context.elevenLabsApiKey) {
    service = new ElevenLabsService({
      apiKey: context.elevenLabsApiKey,
      cacheDir: runtimePath('data', 'tts-cache'),
      enableCache: true,
    });
    service.init().catch((err) => {
      console.error('Failed to initialize ElevenLabs service:', err);
    });

    generator = new VoicePackGenerator(service, voicePacksDir);
    handler.setElevenLabsService(service);
    handler.setVoicePackGenerator(generator);
    console.log('🎙️  Darts Caller configured with ElevenLabs for player name generation');
  }

  const eventHandler = async (event: ParsedEvent): Promise<void> => {
    await handler.handleEvent(event);
  };

  return { handler, eventHandler, type: 'darts-caller', service, generator };
}

/**
 * Create handler based on module ID
 */
export function createModuleHandler(
  moduleId: string,
  configValues: Record<string, unknown>,
  context: ModuleHandlerContext
): CreatedHandler | null {
  switch (moduleId) {
    case 'wled':
      return createWledModuleHandler(configValues, context);
    case 'game-display':
      return createGameDisplayModuleHandler(configValues);
    case 'darts-caller':
      return createDartsCallerModuleHandler(configValues, context);
    default:
      return null;
  }
}

/**
 * Check if a module is an internal/builtin module
 */
export function isInternalModule(moduleId: string): boolean {
  return ['wled', 'game-display', 'darts-caller'].includes(moduleId);
}
