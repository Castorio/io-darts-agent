import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { APIServer } from './api/Server.js';
import {
  registerSetupRoutes,
  registerAuthRoutes,
  registerStatusRoutes,
  registerModuleRoutes,
  registerSettingsRoutes,
  registerWebSocketRoutes,
  registerPlayerRoutes,
  registerMediaRoutes,
  registerMatchRoutes,
  registerAnimationRoutes,
  registerTtsRoutes,
  registerCallerRoutes,
  registerDeveloperRoutes,
} from './api/routes/index.js';
import { ElevenLabsService, VoicePackGenerator } from './core/modules/handlers/index.js';
import { MediaService } from './core/media/MediaService.js';
import { AnimationGeneratorService } from './core/media/AnimationGeneratorService.js';
import { createRunwayProvider } from './core/media/providers/RunwayProvider.js';
import { APIConfigService } from './core/config/ConfigService.js';
import { AuthService } from './core/auth/AuthService.js';
import { ModuleInstaller } from './core/modules/ModuleInstaller.js';
import {
  WledHandler,
  GameDisplayHandler,
  DartsCallerHandler,
  createWledHandler,
  createGameDisplayHandler,
  createDartsCallerHandler,
} from './core/modules/handlers/index.js';
import { PlayerService } from './core/players/PlayerService.js';
import { PlayerRepository } from './core/players/PlayerRepository.js';
import { AutodartsHub } from './index.js';
import type { HubConfiguration } from './types/api.js';
import type { ModuleListItem, ModuleDetailResponse } from './types/api.js';
import type { ParsedEvent, ModuleStatus, ModuleManifest } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global state
let hub: AutodartsHub | null = null;
const startTime = Date.now();

// Player service for matching known players
let playerService: PlayerService | null = null;

// Event subscribers for WebSocket
const eventSubscribers = new Set<(event: ParsedEvent) => void>();
const moduleStatusSubscribers = new Set<(moduleId: string, status: ModuleStatus) => void>();

// Voice pack progress subscribers
import type { GenerationProgress } from './core/modules/handlers/index.js';
const voicePackProgressSubscribers = new Set<(progress: GenerationProgress) => void>();

function emitVoicePackProgress(progress: GenerationProgress): void {
  for (const subscriber of voicePackProgressSubscribers) {
    subscriber(progress);
  }
}

// Caller request subscribers for audio playback
import type { CallRequest } from './api/routes/index.js';
const callerRequestSubscribers = new Set<(request: CallRequest) => void>();

function emitCallerRequest(request: CallRequest): void {
  for (const subscriber of callerRequestSubscribers) {
    subscriber(request);
  }
}

// Log system for real-time event tracking
// LogEntry type is also defined in websocket.ts - keeping in sync
type LogEntry = {
  id: string;
  timestamp: number;
  type: 'event' | 'module' | 'system';
  source: string;
  message: string;
  data?: unknown;
}
const logEntries: LogEntry[] = [];
const MAX_LOG_ENTRIES = 500;
const logSubscribers = new Set<(entry: LogEntry) => void>();

function addLog(type: LogEntry['type'], source: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    source,
    message,
    data,
  };
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.shift();
  }
  // Notify subscribers
  for (const subscriber of logSubscribers) {
    subscriber(entry);
  }
}

// Module tracking
interface InstalledModule {
  id: string;
  manifest: ModuleManifest;
  path: string;
  status: ModuleStatus;
  configValues: Record<string, unknown>;
  eventHandler?: (event: ParsedEvent) => Promise<void>;
  // Handler instances for specific module types
  wledHandler?: WledHandler;
  gameDisplayHandler?: GameDisplayHandler;
  dartsCallerHandler?: DartsCallerHandler;
}
const installedModules = new Map<string, InstalledModule>();

/**
 * Create a logger interface for module handlers
 */
function createModuleLogger(moduleId: string) {
  return {
    log: (source: string, message: string, data?: unknown) => {
      addLog('module', source || moduleId, message, data);
    },
  };
}

// Module config storage directory
const getConfigDir = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, '..', 'config', 'modules');
};

/**
 * Get default config values from manifest
 */
function getDefaultConfig(manifest: ModuleManifest): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  if (manifest.config) {
    for (const [key, field] of Object.entries(manifest.config)) {
      if (field.default !== undefined) {
        defaults[key] = field.default;
      }
    }
  }
  return defaults;
}

/**
 * Load module config from disk
 */
function loadModuleConfig(moduleId: string): Record<string, unknown> {
  try {
    const configPath = path.join(getConfigDir(), `${moduleId}.json`);
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn(`⚠️  Failed to load config for module ${moduleId}:`, e);
  }
  return {};
}

/**
 * Save module config to disk
 */
function saveModuleConfig(moduleId: string, config: Record<string, unknown>): void {
  try {
    const configDir = getConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, `${moduleId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error(`❌ Failed to save config for module ${moduleId}:`, e);
    throw e;
  }
}

/**
 * Test Autodarts connection (for setup wizard)
 */
async function testAutodartsConnection(
  email: string,
  password: string,
  _boardId: string
): Promise<{
  success: boolean;
  userId?: string;
  boardName?: string;
  error?: string;
}> {
  const clientId = process.env.AUTODARTS_CLIENT_ID;
  const clientSecret = process.env.AUTODARTS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Client credentials not configured. Please set AUTODARTS_CLIENT_ID and AUTODARTS_CLIENT_SECRET.',
    };
  }

  try {
    const authService = new AuthService({
      email,
      password,
      clientId,
      clientSecret,
    });

    await authService.login();
    const userId = authService.getUserId();
    authService.logout();

    return {
      success: true,
      userId: userId ?? undefined,
      boardName: 'Autodarts Board',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Start the IO-Darts-Agent
 */
async function startHub(config: HubConfiguration, configService: APIConfigService): Promise<void> {
  if (hub) {
    console.log('Hub already running, stopping first...');
    hub.stop();
  }

  const hubConfig = configService.toHubConfig(config);
  hub = new AutodartsHub(hubConfig);

  // Default player colors for fallback
  const defaultPlayerColors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#22c55e', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ];

  // Function to enrich events with player colors from the local player database
  async function enrichEventWithPlayerColors(event: ParsedEvent): Promise<ParsedEvent> {
    // Only enrich match.state and match.start events that have player data
    if (event.type !== 'match.state' && event.type !== 'match.start') {
      return event;
    }

    const data = event.data as Record<string, unknown>;
    const players = data.players as Array<Record<string, unknown>> | undefined;

    if (!players || !playerService) {
      return event;
    }

    // Enrich each player with their color from the local database
    const enrichedPlayers = await Promise.all(
      players.map(async (player, index) => {
        const playerName = player.name as string;
        if (!playerName) {
          return {
            ...player,
            color: player.color || defaultPlayerColors[index % defaultPlayerColors.length],
          };
        }

        try {
          // Try to match player by name (case-insensitive)
          const matchedPlayer = await playerService!.matchPlayer(playerName);
          if (matchedPlayer && matchedPlayer.color) {
            console.log(`🎨 Matched player "${playerName}" with color ${matchedPlayer.color}`);
            return {
              ...player,
              color: matchedPlayer.color,
            };
          }
        } catch (err) {
          console.error(`Error matching player color for ${playerName}:`, err);
        }

        // Fallback to default color
        return {
          ...player,
          color: player.color || defaultPlayerColors[index % defaultPlayerColors.length],
        };
      })
    );

    // Return enriched event
    return {
      ...event,
      data: {
        ...data,
        players: enrichedPlayers,
      },
    };
  }

  // Setup event forwarding
  const eventBus = hub.getEventBus();
  eventBus.on('*', async (event) => {
    // Log incoming event
    addLog('event', 'autodarts', `Received: ${event.type}`, event.data);
    console.log(`📥 Event: ${event.type}`);

    // Enrich event with player colors
    const enrichedEvent = await enrichEventWithPlayerColors(event);

    // Forward to WebSocket subscribers
    for (const subscriber of eventSubscribers) {
      subscriber(enrichedEvent);
    }

    // Forward to running modules
    for (const mod of installedModules.values()) {
      if (mod.status === 'running' && mod.eventHandler) {
        addLog('module', mod.id, `Processing event: ${event.type}`);
        mod.eventHandler(enrichedEvent).catch((err) => {
          addLog('module', mod.id, `Error: ${err instanceof Error ? err.message : String(err)}`);
          console.error(`Module ${mod.id} event handler error:`, err);
        });
      }
    }
  });

  try {
    await hub.start();
    addLog('system', 'hub', 'IO-Darts-Agent connected successfully');
    console.log('🎯 IO-Darts-Agent started successfully');

    // Auto-start modules that have autoStart enabled or have a host configured
    for (const mod of installedModules.values()) {
      const shouldAutoStart = mod.configValues.autoStart === true ||
        (mod.id === 'wled' && mod.configValues.wledHost) ||
        mod.id === 'game-display' || // Game display always auto-starts
        (mod.id === 'darts-caller' && mod.configValues.enabled !== false); // Darts caller auto-starts if enabled

      if (shouldAutoStart && mod.status === 'stopped') {
        try {
          // Setup handler based on module type
          if (mod.id === 'wled') {
            // Create WLED handler with full configuration
            mod.wledHandler = createWledHandler(mod.configValues);
            mod.wledHandler.setPlayerService(playerService);
            mod.wledHandler.setLogger(createModuleLogger('wled'));

            mod.eventHandler = async (event: ParsedEvent) => {
              if (mod.wledHandler) {
                await mod.wledHandler.handleEvent(event);
              }
            };
          } else if (mod.id === 'game-display') {
            // Create Game Display handler for statistics and animation tracking
            mod.gameDisplayHandler = createGameDisplayHandler(mod.configValues);
            mod.eventHandler = async (event: ParsedEvent) => {
              if (mod.gameDisplayHandler) {
                await mod.gameDisplayHandler.handleEvent(event);
              }
            };
          } else if (mod.id === 'darts-caller') {
            // Create Darts Caller handler with voice packs directory
            mod.dartsCallerHandler = createDartsCallerHandler({
              ...mod.configValues,
              voicePacksDir: path.join(__dirname, '..', 'data', 'voicepacks'),
            });
            // Register callback to forward call requests to WebSocket
            mod.dartsCallerHandler.onCallRequest((request) => {
              console.log(`🎙️  Caller request: ${request.type} - "${request.text}"`);
              emitCallerRequest(request);
            });
            mod.eventHandler = async (event: ParsedEvent) => {
              if (mod.dartsCallerHandler) {
                await mod.dartsCallerHandler.handleEvent(event);
              }
            };
          }
          mod.status = 'running';
          addLog('module', mod.id, `Auto-started module: ${mod.manifest.name}`);
          console.log(`▶️  Auto-started module: ${mod.manifest.name}`);
        } catch (err) {
          addLog('module', mod.id, `Failed to auto-start: ${err instanceof Error ? err.message : String(err)}`);
          console.error(`Failed to auto-start ${mod.id}:`, err);
        }
      }
    }
  } catch (error) {
    addLog('system', 'hub', `Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Failed to start hub:', error);
    hub = null;
    throw error;
  }
}

/**
 * Stop the IO-Darts-Agent
 */
function stopHub(): void {
  if (hub) {
    hub.stop();
    hub = null;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('🚀 Starting IO-Darts-Agent Server...\n');

  // Paths
  const configPath = path.join(__dirname, '..', 'config', 'hub.config.json');
  const webDistPath = path.join(__dirname, '..', 'web', 'dist');

  // Load config
  const configService = new APIConfigService(configPath);
  let config: HubConfiguration | null = null;

  if (await configService.configExists()) {
    try {
      config = await configService.loadConfig();
      console.log('📄 Loaded existing configuration');
    } catch (error) {
      console.warn('⚠️  Failed to load config, starting in setup mode');
    }
  } else {
    console.log('📋 No configuration found, starting in setup mode');
  }

  // Create API server
  const port = config?.server?.port ?? parseInt(process.env.PORT ?? '3000', 10);
  const server = new APIServer({
    port,
    host: '0.0.0.0',
    staticDir: fs.existsSync(webDistPath) ? webDistPath : undefined,
    logger: process.env.NODE_ENV !== 'test',
  });

  await server.initialize(config);
  const fastify = server.getInstance();

  // Register Setup Routes
  registerSetupRoutes(fastify, server, {
    saveConfig: async (newConfig: HubConfiguration) => {
      await configService.saveConfig(newConfig);
      config = newConfig;
      server.setConfig(newConfig);
      // Auto-connect after setup
      try {
        await startHub(newConfig, configService);
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    },
    testAutodartsConnection,
  });

  // Register Auth Routes
  registerAuthRoutes(fastify, server);

  // Register Status Routes
  registerStatusRoutes(fastify, server, {
    getUptime: () => Math.floor((Date.now() - startTime) / 1000),
    getAutodartsStatus: () => ({
      connected: hub?.isActive() ?? false,
      userId: undefined,
      boardId: config?.autodarts?.boardId,
    }),
    getModuleStats: () => ({
      total: 0,
      running: 0,
    }),
  });

  // Module Installer
  const modulesDir = path.join(__dirname, '..', 'modules_installed');
  const moduleInstaller = new ModuleInstaller({ modulesDir });

  // Scan for already installed modules on startup
  async function scanInstalledModules(): Promise<void> {
    try {
      if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
        return;
      }
      const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          const manifestPath = path.join(modulesDir, entry.name, 'module.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const manifestData = fs.readFileSync(manifestPath, 'utf-8');
              const manifest = JSON.parse(manifestData) as ModuleManifest;
              // Load saved config or use defaults
              const savedConfig = loadModuleConfig(manifest.id);
              const defaultConfig = getDefaultConfig(manifest);
              installedModules.set(manifest.id, {
                id: manifest.id,
                manifest,
                path: path.join(modulesDir, entry.name),
                status: 'stopped',
                configValues: { ...defaultConfig, ...savedConfig },
              });
              console.log(`📦 Found installed module: ${manifest.name} (${manifest.id})`);
            } catch (e) {
              console.warn(`⚠️  Failed to read manifest for ${entry.name}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️  Failed to scan modules directory:', e);
    }
  }
  await scanInstalledModules();

  // Register Module Routes
  registerModuleRoutes(fastify, server, {
    listModules: (): ModuleListItem[] => {
      return Array.from(installedModules.values()).map((mod) => ({
        id: mod.id,
        name: mod.manifest.name,
        version: mod.manifest.version,
        description: mod.manifest.description || '',
        status: mod.status,
        events: mod.manifest.events || [],
      }));
    },
    getModule: (id: string): ModuleDetailResponse | null => {
      const mod = installedModules.get(id);
      if (!mod) return null;

      // Convert manifest config schema to API format
      const schema: Record<string, import('./types/api.js').ModuleConfigFieldSchema> = {};
      if (mod.manifest.config) {
        for (const [key, field] of Object.entries(mod.manifest.config)) {
          schema[key] = {
            type: field.type,
            label: field.label,
            description: field.description,
            default: field.default,
            required: field.required,
            min: field.min,
            max: field.max,
            options: field.options,
          };
        }
      }

      return {
        id: mod.id,
        name: mod.manifest.name,
        version: mod.manifest.version,
        description: mod.manifest.description || '',
        author: mod.manifest.author,
        status: mod.status,
        events: mod.manifest.events || [],
        config: {
          schema,
          values: mod.configValues || {},
        },
        stats: {
          restartCount: 0,
        },
      };
    },
    getModuleManifest: (id: string) => {
      const mod = installedModules.get(id);
      if (!mod) return null;
      return mod.manifest;
    },
    getModuleConfig: (id: string): Record<string, unknown> | null => {
      const mod = installedModules.get(id);
      if (!mod) return null;
      return mod.configValues;
    },
    updateModuleConfig: async (id: string, newConfig: Record<string, unknown>): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Merge with existing config
      mod.configValues = { ...mod.configValues, ...newConfig };

      // Save to disk
      saveModuleConfig(id, mod.configValues);
      console.log(`💾 Saved config for module: ${mod.manifest.name}`);
    },
    startModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Setup handler based on module type
      if (id === 'wled') {
        mod.wledHandler = createWledHandler(mod.configValues);
        mod.wledHandler.setPlayerService(playerService);
        mod.wledHandler.setLogger(createModuleLogger('wled'));

        mod.eventHandler = async (event: ParsedEvent) => {
          if (mod.wledHandler) {
            await mod.wledHandler.handleEvent(event);
          }
        };

        console.log(`▶️  Started module: ${mod.manifest.name}`);
        console.log(`   Host: ${mod.wledHandler.getHost() || 'not configured'}`);
      } else if (id === 'game-display') {
        mod.gameDisplayHandler = createGameDisplayHandler(mod.configValues);
        mod.eventHandler = async (event: ParsedEvent) => {
          if (mod.gameDisplayHandler) {
            await mod.gameDisplayHandler.handleEvent(event);
          }
        };
        console.log(`▶️  Started module: ${mod.manifest.name}`);
      } else if (id === 'darts-caller') {
        mod.dartsCallerHandler = createDartsCallerHandler({
          ...mod.configValues,
          voicePacksDir: path.join(__dirname, '..', 'data', 'voicepacks'),
        });
        // Register callback to forward call requests to WebSocket
        mod.dartsCallerHandler.onCallRequest((request) => {
          console.log(`🎙️  Caller request: ${request.type} - "${request.text}"`);
          emitCallerRequest(request);
        });
        // Note: ElevenLabs service and VoicePackGenerator will be set later
        // when getOrCreateElevenLabsService() is called
        mod.eventHandler = async (event: ParsedEvent) => {
          if (mod.dartsCallerHandler) {
            await mod.dartsCallerHandler.handleEvent(event);
          }
        };
        console.log(`▶️  Started module: ${mod.manifest.name}`);
      } else {
        console.log(`▶️  Started module: ${mod.manifest.name}`);
      }

      mod.status = 'running';
    },
    stopModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Remove event handler and handlers
      mod.eventHandler = undefined;
      mod.wledHandler = undefined;
      mod.gameDisplayHandler = undefined;
      mod.dartsCallerHandler = undefined;
      mod.status = 'stopped';
      console.log(`⏹️  Stopped module: ${mod.manifest.name}`);
    },
    restartModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Re-setup handler based on module type
      if (id === 'wled') {
        // Update or create handler with latest config
        if (mod.wledHandler) {
          mod.wledHandler.updateConfig(mod.configValues as any);
        } else {
          mod.wledHandler = createWledHandler(mod.configValues);
          mod.wledHandler.setPlayerService(playerService);
          mod.wledHandler.setLogger(createModuleLogger('wled'));
        }

        mod.eventHandler = async (event: ParsedEvent) => {
          if (mod.wledHandler) {
            await mod.wledHandler.handleEvent(event);
          }
        };
      } else if (id === 'game-display') {
        if (mod.gameDisplayHandler) {
          mod.gameDisplayHandler.updateConfig(mod.configValues as any);
        } else {
          mod.gameDisplayHandler = createGameDisplayHandler(mod.configValues);
        }

        mod.eventHandler = async (event: ParsedEvent) => {
          if (mod.gameDisplayHandler) {
            await mod.gameDisplayHandler.handleEvent(event);
          }
        };
      } else if (id === 'darts-caller') {
        const callerConfig = {
          ...mod.configValues,
          voicePacksDir: path.join(__dirname, '..', 'data', 'voicepacks'),
        };
        if (mod.dartsCallerHandler) {
          mod.dartsCallerHandler.updateConfig(callerConfig as any);
        } else {
          mod.dartsCallerHandler = createDartsCallerHandler(callerConfig);
          // Register callback to forward call requests to WebSocket
          mod.dartsCallerHandler.onCallRequest((request) => {
            console.log(`🎙️  Caller request: ${request.type} - "${request.text}"`);
            emitCallerRequest(request);
          });
        }

        mod.eventHandler = async (event: ParsedEvent) => {
          if (mod.dartsCallerHandler) {
            await mod.dartsCallerHandler.handleEvent(event);
          }
        };
      }

      mod.status = 'running';
      console.log(`🔄 Restarted module: ${mod.manifest.name}`);
    },
    installModule: async (source: 'git' | 'local', url?: string, modulePath?: string, branch?: string): Promise<string> => {
      console.log(`📥 Installing module from ${source}: ${url || modulePath}`);

      const result = await moduleInstaller.install({
        type: source,
        url: source === 'git' ? url : undefined,
        path: source === 'local' ? modulePath : undefined,
        branch: branch,
      });

      if (!result.success || !result.manifest) {
        throw new Error(result.error || 'Installation failed');
      }

      // Track the installed module with default config values
      const defaultConfig = getDefaultConfig(result.manifest);
      installedModules.set(result.moduleId, {
        id: result.moduleId,
        manifest: result.manifest,
        path: result.path,
        status: 'stopped',
        configValues: defaultConfig,
      });

      console.log(`✅ Installed module: ${result.manifest.name} (${result.moduleId})`);
      return result.moduleId;
    },
    uninstallModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Stop module first if running
      if (mod.status === 'running') {
        mod.status = 'stopped';
      }

      await moduleInstaller.uninstall(id);
      installedModules.delete(id);
      console.log(`🗑️  Uninstalled module: ${id}`);
    },
    isModuleInstalled: (id: string): boolean => installedModules.has(id),
  });

  // Register Settings Routes
  registerSettingsRoutes(fastify, server, {
    saveConfig: async (newConfig: HubConfiguration) => {
      await configService.saveConfig(newConfig);
      config = newConfig;
      server.setConfig(newConfig);
    },
  });

  // Register Player Routes
  const playersFilePath = path.join(__dirname, '..', 'config', 'players.json');
  const playerRepository = new PlayerRepository({ filePath: playersFilePath });
  // Use the global playerService variable so handleWledEvent can access it
  playerService = new PlayerService({ repository: playerRepository });

  registerPlayerRoutes(fastify, server, {
    playerService,
  });
  console.log('👥 Player management initialized');

  // Register Media Routes (core media library for all modules)
  const mediaDir = path.join(__dirname, '..', 'media');
  const mediaService = new MediaService({ mediaPath: mediaDir });
  await mediaService.init();

  registerMediaRoutes(fastify, server, {
    mediaService,
  });
  console.log('📁 Media library initialized');

  // Initialize Animation Generator Service
  const animationDir = path.join(mediaDir, 'animation');
  const animationService = new AnimationGeneratorService({
    outputDir: animationDir,
  });
  await animationService.init();

  // Function to configure/reconfigure the AI provider
  function configureAnimationProvider() {
    const config = server.getConfig();
    const runwayConfig = config?.aiProviders?.runway;
    const runwayProvider = createRunwayProvider(runwayConfig);

    if (runwayProvider) {
      animationService.setProvider(runwayProvider);
      console.log('🎬 Animation generator: Runway ML configured');
    } else {
      animationService.setProvider(null as any); // Clear provider
      console.log('🎬 Animation generator: No provider configured');
    }
  }

  // Initial configuration
  configureAnimationProvider();

  // Reconfigure when settings change
  server.on('settingsChanged', () => {
    configureAnimationProvider();
  });

  // Register Animation Routes
  registerAnimationRoutes(fastify, server, {
    animationService,
  });

  // ElevenLabs TTS Service
  let elevenLabsService: ElevenLabsService | null = null;
  let voicePackGenerator: VoicePackGenerator | null = null;
  const voicePacksDir = path.join(__dirname, '..', 'data', 'voicepacks');

  function getOrCreateElevenLabsService(): ElevenLabsService | null {
    const config = server.getConfig();
    const apiKey = config?.aiProviders?.elevenlabs?.apiKey;

    if (!apiKey) {
      elevenLabsService = null;
      return null;
    }

    if (!elevenLabsService || elevenLabsService.getApiKey() !== apiKey) {
      elevenLabsService = new ElevenLabsService({
        apiKey,
        cacheDir: path.join(__dirname, '..', 'data', 'tts-cache'),
        enableCache: true,
      });

      // Initialize the ElevenLabs service
      elevenLabsService.init().catch((err) => {
        console.error('Failed to initialize ElevenLabs service:', err);
      });

      // Create/update VoicePackGenerator with the new service
      voicePackGenerator = new VoicePackGenerator(elevenLabsService, voicePacksDir);

      // Subscribe to progress updates for logging and WebSocket broadcast
      voicePackGenerator.onProgress((progress) => {
        console.log(`🎙️  Voice Pack Generation: ${progress.status} - ${progress.completedFiles}/${progress.totalFiles} files`);
        if (progress.status === 'completed') {
          console.log(`✅ Voice pack "${progress.packName}" completed`);
        } else if (progress.status === 'error') {
          console.error(`❌ Voice pack generation failed: ${progress.error}`);
        }
        // Emit to WebSocket subscribers
        emitVoicePackProgress(progress);
      });

      // Update darts caller handler with the new generator
      const dartsCallerMod = installedModules.get('darts-caller');
      if (dartsCallerMod?.dartsCallerHandler) {
        dartsCallerMod.dartsCallerHandler.setElevenLabsService(elevenLabsService);
        dartsCallerMod.dartsCallerHandler.setVoicePackGenerator(voicePackGenerator);
        console.log('🎙️  Updated Darts Caller with ElevenLabs service and Voice Pack Generator');
      }
    }

    return elevenLabsService;
  }

  function getVoicePackGenerator(): VoicePackGenerator | null {
    // Ensure ElevenLabs service exists first
    const service = getOrCreateElevenLabsService();
    if (!service) {
      return null;
    }
    return voicePackGenerator;
  }

  // Register TTS Routes
  registerTtsRoutes(fastify, server, {
    getElevenLabsService: getOrCreateElevenLabsService,
    getVoicePackGenerator,
  });
  console.log('🎙️  TTS services initialized');

  // Helper function to get the darts caller handler
  function getDartsCallerHandler(): DartsCallerHandler | null {
    const mod = installedModules.get('darts-caller');
    return mod?.dartsCallerHandler ?? null;
  }

  // Register Caller Routes
  registerCallerRoutes(fastify, server, {
    getCallerHandler: getDartsCallerHandler,
    subscribeToCallRequests: (callback: (request: CallRequest) => void) => {
      callerRequestSubscribers.add(callback);
      return () => callerRequestSubscribers.delete(callback);
    },
  });
  console.log('🗣️  Caller routes initialized');

  // Register Developer Routes (for simulation/testing)
  registerDeveloperRoutes(fastify, server, {
    emitEvent: (event: ParsedEvent) => {
      // Emit to WebSocket subscribers
      for (const subscriber of eventSubscribers) {
        subscriber(event);
      }
      // Also process through modules
      for (const [, mod] of installedModules) {
        if (mod.status === 'running' && mod.eventHandler) {
          mod.eventHandler(event).catch((err) => {
            console.error(`Error in module ${mod.id}:`, err);
          });
        }
      }
    },
  });
  console.log('🔧 Developer routes initialized');

  // Register Match Routes (for current match state)
  registerMatchRoutes(fastify, server, {
    getCurrentMatch: () => hub?.getCurrentMatchState() ?? null,
    getLastMatchUpdate: () => hub?.getLastMatchUpdate() ?? null,
  });

  // Register WebSocket Routes
  const wsManager = registerWebSocketRoutes(fastify, server, {
    getAutodartsStatus: () => ({
      connected: hub?.isActive() ?? false,
      matchId: hub?.getCurrentMatchId() ?? undefined,
    }),
    subscribeToEvents: (handler: (event: ParsedEvent) => void) => {
      eventSubscribers.add(handler);
      return () => eventSubscribers.delete(handler);
    },
    subscribeToModuleStatus: (handler: (moduleId: string, status: ModuleStatus) => void) => {
      moduleStatusSubscribers.add(handler);
      return () => moduleStatusSubscribers.delete(handler);
    },
    subscribeToLogs: (handler: (entry: LogEntry) => void) => {
      logSubscribers.add(handler);
      return () => logSubscribers.delete(handler);
    },
    getLogHistory: () => [...logEntries],
    subscribeToVoicePackProgress: (handler: (progress: GenerationProgress) => void) => {
      voicePackProgressSubscribers.add(handler);
      return () => voicePackProgressSubscribers.delete(handler);
    },
    subscribeToCallerRequests: (handler: (request: CallRequest) => void) => {
      callerRequestSubscribers.add(handler);
      return () => callerRequestSubscribers.delete(handler);
    },
  });

  // Start WebSocket manager
  wsManager.start();

  // Serve module UIs from their own folders
  // Each module can have a /web/dist folder with its built frontend
  const modulesSourceDir = path.join(__dirname, '..', 'modules');
  fastify.register(async (instance) => {
    instance.get('/module-ui/:moduleId/*', async (request, reply) => {
      const { moduleId } = request.params as { moduleId: string };
      const splat = (request.params as Record<string, string>)['*'] || 'index.html';

      // Check in modules source directory first
      const moduleDistPath = path.join(modulesSourceDir, moduleId, 'web', 'dist');
      const filePath = path.join(moduleDistPath, splat);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        // Determine content type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        };
        const contentType = contentTypes[ext] || 'application/octet-stream';

        reply.header('Content-Type', contentType);
        return reply.send(fs.readFileSync(filePath));
      }

      // SPA fallback - serve index.html for any non-asset routes
      const indexPath = path.join(moduleDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        reply.header('Content-Type', 'text/html');
        return reply.send(fs.readFileSync(indexPath));
      }

      return reply.status(404).send({ error: 'Module UI not found' });
    });
  });

  // SPA fallback
  if (fs.existsSync(webDistPath)) {
    fastify.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api/') && !request.url.startsWith('/module-ui/')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  // Start server
  await server.start();
  console.log(`\n✅ Server running at http://localhost:${port}`);

  if (!config?.setupCompleted) {
    console.log('\n📋 Setup required - open the URL above in your browser');
    console.log('   Or open http://localhost:5173 if running frontend in dev mode');
  } else {
    console.log('\n🎯 Configuration loaded - connecting to Autodarts...');
    try {
      await startHub(config, configService);
    } catch (error) {
      console.error('❌ Failed to connect to Autodarts:', error);
      console.log('   You can try reconnecting from the web interface');
    }
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\n🛑 Shutting down...');
    wsManager.stop();
    stopHub();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
