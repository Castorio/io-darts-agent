import 'dotenv/config';
import * as path from 'path';
import { assignPlayerColors, DEFAULT_PLAYER_COLORS } from './core/players/playerColors.js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { APIServer } from './api/Server.js';
import { StoreCatalog } from './core/store/catalog.js';
import {
  registerSetupRoutes,
  registerAuthRoutes,
  registerStatusRoutes,
  registerModuleRoutes,
  registerStoreRoutes,
  registerSettingsRoutes,
  registerWebSocketRoutes,
  registerPlayerRoutes,
  registerMediaRoutes,
  registerMatchRoutes,
  registerAnimationRoutes,
  registerTtsRoutes,
  registerCallerRoutes,
  registerDeveloperRoutes,
  registerAIRoutes,
  registerTrainerRoutes,
} from './api/routes/index.js';
import { createAuthMiddleware } from './api/middleware/auth.js';
import { ElevenLabsService, VoicePackGenerator } from './core/modules/handlers/index.js';
import { MediaService } from './core/media/MediaService.js';
import { AnimationGeneratorService } from './core/media/AnimationGeneratorService.js';
import { createRunwayProvider } from './core/media/providers/RunwayProvider.js';
import { HiggsfieldAnimationProvider } from './core/media/providers/HiggsfieldAnimationProvider.js';
import { AnimationEngineSettings } from './core/media/AnimationEngineSettings.js';
import { HiggsfieldProvider } from './core/ai/providers/HiggsfieldProvider.js';
import { APIConfigService } from './core/config/ConfigService.js';
import { AuthService } from './core/auth/AuthService.js';
import { ModuleInstaller } from './core/modules/ModuleInstaller.js';
import { computeModuleStats } from './core/modules/moduleStats.js';
import { ModuleBridge } from './core/modules/ModuleBridge.js';
import { moduleSocketPath } from './core/modules/socketPath.js';
import { refreshSdkLinkBeforeSpawn } from './core/modules/sdkLink.js';
import { resolveBuiltinModulesDir } from './core/modules/BuiltinModuleInstaller.js';
import { resolveSdkPath } from './core/modules/sdkPath.js';
import { runtimePath } from './core/runtimePaths.js';
import { guardBrokenPipes, isBrokenPipe } from './core/brokenPipe.js';
import { restartProcess } from './core/system/restart.js';
import { createStartOnce } from './core/modules/startOnce.js';
import { autostartModules, connectThenAutostart } from './core/modules/autostart.js';
import { isValidModuleId, resolveModuleUiFile } from './core/modules/moduleUiPath.js';
import { getModuleRouteRegistry, type ModuleRouteRequest, type ModuleRouteResponse } from './core/modules/ModuleRouteRegistry.js';
import {
  stopExternalModule,
  stopAllExternalModules as stopAllExternalModulesImpl,
  restartExternalModule,
  handleExternalModuleExit,
} from './core/modules/externalModuleLifecycle.js';
import { stopForMaintenance, restartAfterMaintenance } from './core/modules/moduleMaintenance.js';
import type { RoutesRegisterPayload } from './types/modules.js';
import { spawn, ChildProcess } from 'child_process';
import {
  WledHandler,
  GameDisplayHandler,
  DartsCallerHandler,
  createWledHandler,
  createGameDisplayHandler,
  createDartsCallerHandler,
  normalizeDartsCallerConfig,
  normalizeWledConfig,
  mergeWledConfigUpdate,
  type WledConfig,
  type GameDisplayConfig,
} from './core/modules/handlers/index.js';
// Note: BuiltinModuleInstaller is available but we use local implementations
// that integrate with the local state (installedModules map, config loading, etc.)
// import { installBuiltinModules, scanInstalledModules } from './core/modules/BuiltinModuleInstaller.js';
import { initializeAIProviders, saveAIProviderConfigs } from './core/ai/AIProviderInitializer.js';
import { getEventSystem, type LogEntry, type CallRequest } from './core/events/EventSystem.js';
import { PlayerService } from './core/players/PlayerService.js';
import { PlayerRepository } from './core/players/PlayerRepository.js';
import { AutodartsHub } from './index.js';
import { getIntentBus, createEmitterFromManifest, IntentEmitter } from './core/intents/index.js';
import { getMatchStatusService } from './core/match/index.js';
import { getAIProviderService } from './core/ai/AIProviderService.js';
import { resolveProviderApiKey, resolveProviderDefaultModel } from './core/ai/providerCredentials.js';
import type { HubConfiguration } from './types/api.js';
import type { ModuleListItem, ModuleDetailResponse } from './types/api.js';
import type { ParsedEvent, ModuleStatus, ModuleManifest } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global state
let hub: AutodartsHub | null = null;
const startTime = Date.now();

// Intent Bus for inter-module communication
const intentBus = getIntentBus({ debug: process.env.NODE_ENV !== 'production' });

// Match Status Service for centralized match state
const matchStatusService = getMatchStatusService();

// Event System for centralized event/log management
const eventSystem = getEventSystem({ debug: false });

// Player service for matching known players
let playerService: PlayerService | null = null;

// Voice pack progress type
import type { GenerationProgress } from './core/modules/handlers/index.js';

// Subscribe IntentBus to forward intents to EventSystem
intentBus.subscribeGlobal((intent) => {
  eventSystem.emitIntent(intent);
  eventSystem.addLog('module', `intent:${intent.source}`, `${intent.id}`, intent.payload);
});

// Helper function for logging (shortcut to eventSystem.addLog)
function addLog(type: 'event' | 'module' | 'system', source: string, message: string, data?: unknown): void {
  eventSystem.addLog(type, source, message, data);
}

// Module tracking
interface InstalledModule {
  id: string;
  manifest: ModuleManifest;
  path: string;
  status: ModuleStatus;
  configValues: Record<string, unknown>;
  eventHandler?: (event: ParsedEvent) => Promise<void>;
  // Handler instances for specific module types (internal/builtin modules)
  wledHandler?: WledHandler;
  gameDisplayHandler?: GameDisplayHandler;
  dartsCallerHandler?: DartsCallerHandler;
  // Intent emitter for modules that emit intents
  intentEmitter?: IntentEmitter;
  // External process module fields (SDK-based modules)
  process?: ChildProcess;
  bridge?: ModuleBridge;
  isExternalProcess?: boolean;
}
const installedModules = new Map<string, InstalledModule>();

/**
 * Run async work from a callback that ignores promises (EventEmitter listener,
 * timer). A rejection would otherwise be unhandled and end the process.
 */
function runDetached(label: string, task: () => Promise<void>): void {
  task().catch((err) => {
    console.error(`❌ ${label} failed:`, err);
  });
}

/**
 * Create a logger interface for module handlers
 */
function createModuleLogger(moduleId: string): { log: (source: string, message: string, data?: unknown) => void } {
  return {
    log: (source: string, message: string, data?: unknown): void => {
      addLog('module', source || moduleId, message, data);
    },
  };
}

/**
 * Create an intent emitter for a module
 * Used by modules to emit semantic intents that other modules can react to
 */
/**
 * Register module intents when starting
 */
function registerModuleIntents(mod: InstalledModule): void {
  // Register intents this module can emit and create an emitter
  if (mod.manifest.intents?.emits) {
    intentBus.registerIntents(mod.id, mod.manifest.intents.emits);

    // Create IntentEmitter for this module
    const emitter = createEmitterFromManifest(mod.id, mod.manifest, intentBus);
    if (emitter) {
      mod.intentEmitter = emitter;
      console.log(`📡 Registered ${mod.manifest.intents.emits.length} emittable intents for ${mod.id} (emitter created)`);
    }
  } else {
    mod.intentEmitter = undefined;
  }

  // Register intent subscriptions from module config
  const intentsConfig = mod.manifest.intents as {
    actions?: Array<{ type: string; label: string; description?: string; configSchema?: Record<string, unknown> }>;
    defaultSubscriptions?: Array<{
      intentId: string;
      enabled: boolean;
      action: { type: string; config?: Record<string, unknown> };
    }>;
  } | undefined;

  if (intentsConfig?.defaultSubscriptions) {
    // Get user-configured subscriptions from module config (if any)
    const userSubscriptions = (mod.configValues.intentSubscriptions as typeof intentsConfig.defaultSubscriptions) || [];

    // Merge default and user subscriptions (user takes priority)
    const subscriptionMap = new Map<string, typeof userSubscriptions[0]>();

    // Add defaults first
    for (const sub of intentsConfig.defaultSubscriptions) {
      subscriptionMap.set(sub.intentId, sub);
    }

    // Override with user settings
    for (const sub of userSubscriptions) {
      subscriptionMap.set(sub.intentId, sub);
    }

    // Register enabled subscriptions with the intent bus
    let subscribedCount = 0;
    for (const sub of subscriptionMap.values()) {
      if (sub.enabled) {
        intentBus.subscribe(mod.id, sub.intentId, async (intent) => {
          // Find the module handler and execute the action
          await executeModuleIntentAction(mod, intent, sub.action);
        });
        subscribedCount++;
      }
    }

    if (subscribedCount > 0) {
      console.log(`🎯 Registered ${subscribedCount} intent subscriptions for ${mod.id}`);
    }
  }
}

/**
 * Execute an intent action for a module
 */
async function executeModuleIntentAction(
  mod: InstalledModule,
  intent: import('./types/intents.js').Intent,
  action: { type: string; config?: Record<string, unknown> }
): Promise<void> {
  // Route the action to the appropriate module handler
  try {
    if (mod.id === 'wled' && mod.wledHandler) {
      await mod.wledHandler.executeIntentAction(intent, action);
    } else if (mod.id === 'darts-caller' && mod.dartsCallerHandler) {
      await mod.dartsCallerHandler.executeIntentAction(intent, action);
    } else if (mod.id === 'game-display' && mod.gameDisplayHandler) {
      // Game display could handle intents too
      // await mod.gameDisplayHandler.executeIntentAction(intent, action);
    }
    // Add more modules as needed
  } catch (error) {
    console.error(`Error executing intent action for ${mod.id}:`, error);
    addLog('module', mod.id, `Intent action error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Unregister module intents when stopping
 */
function unregisterModuleIntents(mod: InstalledModule): void {
  intentBus.unregisterIntents(mod.id);
  intentBus.unsubscribeAll(mod.id);
  mod.intentEmitter = undefined;
}

// ============================================================================
// External Module Process Management (SDK-based modules)
// ============================================================================

/**
 * Start an external SDK-based module as a separate Node.js process
 */
async function spawnExternalModule(mod: InstalledModule): Promise<void> {
  // A Linux AppImage re-mounts the whole app under a fresh
  // /tmp/.mount_XXXXXXX path on every launch, so a module's SDK symlink
  // created on a previous run can dangle (point at a mountpoint that no
  // longer exists) by the time it's spawned again. Re-check/re-point it
  // against this run's resolveSdkPath before every spawn, not just at
  // install time.
  await refreshSdkLinkBeforeSpawn(mod.path, __dirname);

  const linkedEntry = path.join(mod.path, mod.manifest.entry);

  // Check if entry point exists
  if (!fs.existsSync(linkedEntry)) {
    throw new Error(`Module entry point not found: ${linkedEntry}`);
  }
  // Real path: modules_installed is often a symlink, and SDK modules start
  // only when import.meta.url (resolved) matches process.argv[1]
  const entryPoint = fs.realpathSync(linkedEntry);

  // Create IPC bridge for communication
  const socketPath = moduleSocketPath(mod.id);
  const bridge = new ModuleBridge(mod.id, { socketPath });

  // Setup bridge event handlers
  setupExternalModuleBridgeHandlers(mod, bridge);

  // Start the bridge (creates socket server)
  await bridge.start();
  console.log(`🔌 Started IPC bridge for ${mod.id} at ${socketPath}`);

  // Spawn the module process
  // The hub's own runtime: also works inside the desktop app, which has no system Node
  const proc = spawn(process.execPath, [entryPoint], {
    cwd: mod.path,
    env: {
      ...process.env,
      AUTODARTS_MODULE_ID: mod.id,
      AUTODARTS_SOCKET_PATH: socketPath,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  mod.process = proc;
  mod.bridge = bridge;
  mod.isExternalProcess = true;

  // Handle stdout/stderr
  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.log(`[${mod.id}] ${line}`);
      addLog('module', mod.id, line);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      console.error(`[${mod.id}] ERROR: ${line}`);
      addLog('module', mod.id, `ERROR: ${line}`);
    }
  });

  // Handle process exit
  proc.on('exit', (code, signal) => {
    // A graceful shutdown that timed out (SIGKILL -> start() spawns a new
    // process) can still deliver this OLD process's 'exit' afterwards; by
    // then mod.process/mod.bridge already point at the new process, and this
    // exit must not wipe them out or mark the new module 'crashed'.
    const wasCrash = mod.status === 'running';
    const handled = handleExternalModuleExit(mod, proc);
    if (!handled) {
      console.log(`[${mod.id}] Ignoring exit of a stale process (code ${code}, signal ${signal})`);
      return;
    }
    console.log(`[${mod.id}] Process exited with code ${code}, signal ${signal}`);
    if (wasCrash) {
      addLog('module', mod.id, `Process crashed: code=${code}, signal=${signal}`);
    }
  });

  // Wait for module to send ready signal
  await waitForModuleReady(bridge, mod.id);

  // Send init message with config
  bridge.sendInit(mod.configValues, mod.manifest.events);
  console.log(`▶️  Started external module: ${mod.manifest.name} (PID: ${proc.pid})`);

  // Setup event forwarding to the external module
  // Promise executor: a throw from sendEvent still surfaces as a rejection
  mod.eventHandler = (event: ParsedEvent): Promise<void> =>
    new Promise<void>((resolve) => {
      if (bridge.isConnected()) {
        bridge.sendEvent(event);
      }
      resolve();
    });
}

// Autostart and the start button can fire for the same module; start it once
const startExternalModule = createStartOnce<InstalledModule>(
  (mod) => !!mod.process && mod.process.exitCode === null,
  spawnExternalModule,
  (mod) => mod.id
);

/**
 * Stop all running external modules, so no orphaned module process
 * attaches to the next hub instance (restart, shutdown)
 */
async function stopAllExternalModules(): Promise<void> {
  await stopAllExternalModulesImpl(installedModules.values());
}

/**
 * Wait for external module to send ready signal
 */
function waitForModuleReady(bridge: ModuleBridge, moduleId: string, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Module ${moduleId} startup timeout`));
    }, timeout);

    bridge.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });

    bridge.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Setup event handlers for external module bridge
 */
function setupExternalModuleBridgeHandlers(mod: InstalledModule, bridge: ModuleBridge): void {
  bridge.on('log', (data: { level: string; message: string; context?: unknown }) => {
    const prefix = data.level === 'error' ? '❌' : data.level === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${mod.id}] ${data.message}`);
    addLog('module', mod.id, data.message);
  });

  bridge.on('moduleError', (data: { code: string; message: string; fatal: boolean }) => {
    console.error(`❌ [${mod.id}] Error: ${data.message} (${data.code})`);
    addLog('module', mod.id, `Error: ${data.message}`);
    if (data.fatal) {
      mod.status = 'error';
    }
  });

  bridge.on('status', (data: { status: ModuleStatus; message?: string }) => {
    console.log(`📊 [${mod.id}] Status: ${data.status}${data.message ? ` - ${data.message}` : ''}`);
  });

  bridge.on('disconnected', () => {
    console.log(`🔌 [${mod.id}] Disconnected from IPC bridge`);
    if (mod.status === 'running') {
      mod.status = 'error';
    }
  });

  // Handle routes registration from external module
  const onRoutesRegister = async (payload: RoutesRegisterPayload): Promise<void> => {
    console.log(`🛣️  [${mod.id}] Registering ${payload.routes.length} API routes`);

    const registry = getModuleRouteRegistry();

    // Set up route handler that forwards requests to the module via bridge
    registry.setRouteHandler(mod.id, async (request: ModuleRouteRequest): Promise<ModuleRouteResponse> => {
      if (!mod.bridge || !mod.bridge.isConnected()) {
        return { statusCode: 503, body: { error: 'Module not connected' } };
      }

      try {
        const response = await mod.bridge.sendRouteRequest({
          handlerId: request.handlerId,
          method: request.method,
          path: request.path,
          params: request.params,
          query: request.query,
          body: request.body,
          headers: request.headers,
        });

        return {
          statusCode: response.statusCode,
          headers: response.headers,
          body: response.body,
        };
      } catch (err) {
        console.error(`[${mod.id}] Route request failed:`, err);
        return { statusCode: 500, body: { error: 'Route request failed' } };
      }
    });

    // Register the routes with Fastify
    try {
      await registry.registerRoutes({
        moduleId: mod.id,
        routes: payload.routes,
      });
      console.log(`✅ [${mod.id}] API routes registered successfully`);
    } catch (err) {
      console.error(`❌ [${mod.id}] Failed to register routes:`, err);
    }
  };
  bridge.on('routesRegister', (payload: RoutesRegisterPayload) =>
    runDetached(`[${mod.id}] routesRegister`, () => onRoutesRegister(payload))
  );

  // Handle intent emission from external module
  const onIntentEmit = async (data: { moduleId: string; intentId: string; payload: Record<string, unknown> }): Promise<void> => {
    console.log(`📡 [${mod.id}] Emitting intent: ${data.intentId}`);
    addLog('module', `intent:${mod.id}`, data.intentId, data.payload);

    // Emit intent through the IntentBus
    try {
      await intentBus.emit(data.moduleId, data.intentId, data.payload);
    } catch (err) {
      console.error(`❌ [${mod.id}] Failed to emit intent ${data.intentId}:`, err);
      addLog('module', mod.id, `Intent emit error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  bridge.on('intentEmit', (data: Parameters<typeof onIntentEmit>[0]) =>
    runDetached(`[${mod.id}] intentEmit`, () => onIntentEmit(data))
  );

  // Handle data requests from external module (e.g., getPlayers, getPlayer)
  const onRequest = async (payload: { action: string; data?: Record<string, unknown>; requestId: string }): Promise<void> => {
    console.log(`📥 [${mod.id}] Request: ${payload.action}`);

    try {
      let responseData: unknown;

      switch (payload.action) {
        case 'getPlayers': {
          // Return all registered core players
          if (!playerService) {
            throw new Error('PlayerService not initialized');
          }
          const players = await playerService.getAllPlayers();
          responseData = { players };
          break;
        }

        case 'getPlayer': {
          // Return a specific player by ID
          if (!playerService) {
            throw new Error('PlayerService not initialized');
          }
          const playerId = payload.data?.playerId as string;
          if (!playerId) {
            throw new Error('playerId is required');
          }
          const player = await playerService.getPlayer(playerId);
          responseData = { player };
          break;
        }

        case 'getPlayerByName': {
          // Return a player by name
          if (!playerService) {
            throw new Error('PlayerService not initialized');
          }
          const playerName = payload.data?.playerName as string;
          if (!playerName) {
            throw new Error('playerName is required');
          }
          const player = await playerService.getPlayerByName(playerName);
          responseData = { player };
          break;
        }

        case 'isPlayerRegistered': {
          // Check if a player is registered (by name or ID)
          if (!playerService) {
            throw new Error('PlayerService not initialized');
          }
          const identifier = payload.data?.identifier as string;
          if (!identifier) {
            throw new Error('identifier is required');
          }
          // Try by ID first, then by name
          let player = await playerService.getPlayer(identifier);
          if (!player) {
            player = await playerService.getPlayerByName(identifier);
          }
          responseData = { exists: !!player };
          break;
        }

        case 'generateText': {
          // Generate text using the AI service
          const aiService = getAIProviderService();
          const prompt = payload.data?.prompt as string;
          if (!prompt) {
            throw new Error('prompt is required');
          }
          const providerId = payload.data?.providerId as string | undefined;
          const temperature = payload.data?.temperature as number | undefined;
          const maxTokens = payload.data?.maxTokens as number | undefined;
          const model = payload.data?.model as string | undefined;

          // Get the configured provider from module config if available
          const configProviderId = mod.configValues?.aiProvider as string | undefined;
          const effectiveProviderId = providerId || configProviderId;

          console.log(`🤖 [${mod.id}] AI generateText request, provider: ${effectiveProviderId || '(default)'}`);

          const result = await aiService.generateText({
            prompt,
            temperature,
            maxTokens,
            model
          }, effectiveProviderId);

          responseData = {
            text: result.text,
            provider: effectiveProviderId || 'default',
            model: result.model,
            usage: result.usage
          };
          break;
        }

        default:
          throw new Error(`Unknown action: ${payload.action}`);
      }

      bridge.sendRequestResponse(payload.requestId, true, responseData);
    } catch (err) {
      console.error(`❌ [${mod.id}] Request failed:`, err);
      bridge.sendRequestResponse(payload.requestId, false, undefined, (err as Error).message);
    }
  };
  bridge.on('request', (payload: Parameters<typeof onRequest>[0]) =>
    runDetached(`[${mod.id}] request ${payload.action}`, () => onRequest(payload))
  );
}

// Module config storage directory
const getConfigDir = (): string => runtimePath('config', 'modules');

/** JSON object check for config files edited on disk */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
      const data: unknown = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (isJsonObject(data)) return data;
      console.warn(`⚠️  Config for module ${moduleId} is not a JSON object, using defaults`);
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

// ============================================================================
// Module Autostart Settings
// ============================================================================

interface ModuleAutostartSettings {
  [moduleId: string]: boolean;
}

/**
 * Get autostart settings file path
 */
function getAutostartSettingsPath(): string {
  return path.join(getConfigDir(), '_autostart.json');
}

/**
 * Load autostart settings from disk
 */
function loadAutostartSettings(): ModuleAutostartSettings {
  try {
    const settingsPath = getAutostartSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (isJsonObject(data)) return data as ModuleAutostartSettings;
      console.warn('⚠️  Autostart settings are not a JSON object, ignoring them');
    }
  } catch (e) {
    console.warn('⚠️  Failed to load autostart settings:', e);
  }
  return {};
}

/**
 * Save autostart settings to disk
 */
function saveAutostartSettings(settings: ModuleAutostartSettings): void {
  try {
    const configDir = getConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const settingsPath = getAutostartSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('❌ Failed to save autostart settings:', e);
    throw e;
  }
}

/**
 * Get autostart setting for a module
 * Returns true if module should autostart, false if not, or undefined if not set
 */
function getModuleAutostart(moduleId: string): boolean | undefined {
  const settings = loadAutostartSettings();
  return settings[moduleId];
}

/**
 * Set autostart setting for a module
 */
function setModuleAutostart(moduleId: string, autostart: boolean): void {
  const settings = loadAutostartSettings();
  settings[moduleId] = autostart;
  saveAutostartSettings(settings);
}

/**
 * Determine if a module should autostart based on settings and defaults
 */
function shouldModuleAutostart(mod: InstalledModule): boolean {
  // First check explicit autostart setting
  const explicitSetting = getModuleAutostart(mod.id);
  if (explicitSetting !== undefined) {
    return explicitSetting;
  }

  // Legacy check: autoStart in config values
  if (mod.configValues.autoStart === true) {
    return true;
  }
  if (mod.configValues.autoStart === false) {
    return false;
  }

  // Default behavior based on module type
  switch (mod.id) {
    case 'wled':
      // WLED auto-starts if host is configured
      return !!mod.configValues.wledHost;
    case 'game-display':
      // Game display always auto-starts by default
      return true;
    case 'darts-caller':
      // Darts caller auto-starts if enabled
      return mod.configValues.enabled !== false;
    default:
      // External modules: check if entry exists (SDK modules), default to false
      if (mod.manifest.entry && mod.manifest.entry !== 'internal') {
        return false; // External modules don't autostart by default
      }
      return false;
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
  try {
    const authService = new AuthService({
      email,
      password,
      clientId: process.env.AUTODARTS_CLIENT_ID || undefined,
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
  const defaultPlayerColors = DEFAULT_PLAYER_COLORS;

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

    // Profile colors for known players; others get a stable default color
    // by player.index that no known player in this match uses
    const colors = await assignPlayerColors(
      players as Array<{ name?: string; index?: number; color?: string }>,
      (name) => playerService!.matchPlayer(name),
      defaultPlayerColors,
    );
    const enrichedPlayers = players.map((player, position) => ({ ...player, color: colors[position] }));

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

    // Update centralized match status service
    matchStatusService.handleEvent(event);

    // Enrich event with player colors
    const enrichedEvent = await enrichEventWithPlayerColors(event);

    // Forward to WebSocket subscribers via EventSystem
    eventSystem.emitEvent(enrichedEvent);

    // Forward to running modules
    for (const mod of installedModules.values()) {
      if (mod.status === 'running' && mod.eventHandler) {
        // Debug: Log event forwarding for WLED
        if (mod.id === 'wled' && event.type === 'throw.detected') {
          console.log(`🎨 WLED: Forwarding ${event.type} to handler`);
        }
        addLog('module', mod.id, `Processing event: ${event.type}`);
        mod.eventHandler(enrichedEvent).catch((err) => {
          addLog('module', mod.id, `Error: ${err instanceof Error ? err.message : String(err)}`);
          console.error(`Module ${mod.id} event handler error:`, err);
        });
      } else if (mod.id === 'wled' && event.type === 'throw.detected') {
        // Debug: Why WLED is not receiving events
        console.log(`🎨 WLED: NOT forwarding event. status=${mod.status}, hasHandler=${!!mod.eventHandler}`);
      }
    }
  });

  // Autostart modules even if the Autodarts login fails: they work without
  // game events (e.g. board status, lights) and get events once connected.
  const currentHub = hub;
  await connectThenAutostart(
    async () => {
      try {
        await currentHub.start();
      } catch (error) {
        addLog('system', 'hub', `Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Failed to start hub:', error);
        if (hub === currentHub) hub = null;
        throw error;
      }
      addLog('system', 'hub', 'IO-Darts-Agent connected successfully');
      console.log('🎯 IO-Darts-Agent started successfully');
    },
    () => autostartInstalledModules(config)
  );
}

/**
 * Auto-start installed modules based on their autostart settings.
 * Only stopped modules are started, so repeated calls never double-start.
 */
function autostartInstalledModules(config: HubConfiguration): Promise<void> {
  return autostartModules(installedModules.values(), {
    shouldAutostart: shouldModuleAutostart,
    start: (mod) => startModuleForAutostart(mod, config),
    onStarted: (mod) => {
      addLog('module', mod.id, `Auto-started module: ${mod.manifest.name}`);
      console.log(`▶️  Auto-started module: ${mod.manifest.name}`);
    },
    onFailed: (mod, err) => {
      addLog('module', mod.id, `Failed to auto-start: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`Failed to auto-start ${mod.id}:`, err);
    },
  });
}

/**
 * Set up the handler of one module and start it (status is set by the caller)
 */
async function startModuleForAutostart(mod: InstalledModule, config: HubConfiguration): Promise<void> {
    // Setup handler based on module type
    if (mod.id === 'wled') {
      // Create WLED handler with full configuration
      mod.wledHandler = createWledHandler(mod.configValues);
      mod.wledHandler.setPlayerService(playerService);
      mod.wledHandler.setLogger(createModuleLogger('wled'));

      mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
        if (mod.wledHandler) {
          // Debug: Log before calling handler
          if (event.type === 'throw.detected') {
            console.log(`🎨 WLED [main.ts]: Calling handleEvent for ${event.type}`);
          }
          await mod.wledHandler.handleEvent(event);
          // Debug: Log after calling handler
          if (event.type === 'throw.detected') {
            console.log(`🎨 WLED [main.ts]: handleEvent completed for ${event.type}`);
          }
        }
      };
    } else if (mod.id === 'game-display') {
      // Create Game Display handler for statistics and animation tracking
      mod.gameDisplayHandler = createGameDisplayHandler(mod.configValues);
      mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
        if (mod.gameDisplayHandler) {
          await mod.gameDisplayHandler.handleEvent(event);
        }
      };
    } else if (mod.id === 'darts-caller') {
      // Create Darts Caller handler with voice packs directory
      const callerVoicePacksDir = runtimePath('data', 'voicepacks');
      mod.dartsCallerHandler = createDartsCallerHandler({
        ...mod.configValues,
        voicePacksDir: callerVoicePacksDir,
      });
      // Register callback to forward call requests to WebSocket
      mod.dartsCallerHandler.onCallRequest((request) => {
        console.log(`🎙️  Caller request: ${request.type} - "${request.text}"`);
        eventSystem.emitCallerRequest(request);
      });
      // Initialize ElevenLabs service and VoicePackGenerator if API key is configured
      const elevenLabsApiKey = resolveProviderApiKey(
        getAIProviderService(),
        'elevenlabs',
        (config as unknown as { aiProviders?: { elevenlabs?: { apiKey?: string } } })?.aiProviders?.elevenlabs
      );
      if (elevenLabsApiKey) {
        const service = new ElevenLabsService({
          apiKey: elevenLabsApiKey,
          cacheDir: runtimePath('data', 'tts-cache'),
          enableCache: true,
        });
        service.init().catch((err) => {
          console.error('Failed to initialize ElevenLabs service:', err);
        });
        const generator = new VoicePackGenerator(service, callerVoicePacksDir);
        mod.dartsCallerHandler.setElevenLabsService(service);
        mod.dartsCallerHandler.setVoicePackGenerator(generator);
        console.log('🎙️  Darts Caller configured with ElevenLabs for player name generation');
      }
      mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
        if (mod.dartsCallerHandler) {
          await mod.dartsCallerHandler.handleEvent(event);
        }
      };
    } else if (mod.manifest.entry && mod.manifest.entry !== 'internal') {
      // External SDK-based module - spawn as separate process
      await startExternalModule(mod);
    }

  // Register module intents
  registerModuleIntents(mod);
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

  // AI providers first: modules (darts caller, animations) read their keys from them
  const aiConfigDir = runtimePath('config');
  initializeAIProviders({ configDir: aiConfigDir });
  console.log('🤖 AI providers initialized');

  // Paths
  const configPath = runtimePath('config', 'hub.config.json');
  const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');

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

  // Initialize ModuleRouteRegistry for external module API routes
  const moduleRouteRegistry = getModuleRouteRegistry();
  moduleRouteRegistry.initialize(fastify, {
    isAuthEnabled: () => server.isAuthEnabled(),
  });
  console.log('🛣️  Module route registry initialized');

  // Register authentication middleware (must be before routes)
  const authMiddleware = createAuthMiddleware(server);
  fastify.addHook('onRequest', authMiddleware);

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
  registerAuthRoutes(fastify, server, {
    saveConfig: async (newConfig: HubConfiguration) => {
      await configService.saveConfig(newConfig);
      config = newConfig;
      server.setConfig(newConfig);
    },
  });

  // Register Status Routes
  registerStatusRoutes(fastify, server, {
    getUptime: () => Math.floor((Date.now() - startTime) / 1000),
    getAutodartsStatus: () => ({
      connected: hub?.isActive() ?? false,
      userId: undefined,
      boardId: config?.autodarts?.boardId,
    }),
    getModuleStats: () => computeModuleStats(installedModules.values()),
  });

  // Module Installer
  const modulesDir = runtimePath('modules_installed');
  const builtinModulesDir = resolveBuiltinModulesDir(path.join(__dirname, '..'));
  // The hub's own module SDK at the repo root, for modules that point to an
  // SDK path of their author's machine. Resolved relative to this file's own
  // directory, which differs between a compiled build (dist/src) and running
  // from source via tsx (src) - see resolveSdkPath.
  const moduleInstaller = new ModuleInstaller({
    modulesDir,
    sdkPath: resolveSdkPath(__dirname),
    // A git repo clones into a directory named after the repo, not its
    // manifest id, so the installer can't tell from the directory alone
    // whether the manifest id collides with an already-registered module
    // (including built-ins). Give it the registry to check against.
    isModuleIdInstalled: (id: string): boolean => installedModules.has(id),
  });

  // Built-in modules that should be auto-installed on first run
  const BUILTIN_MODULES = ['wled', 'darts-caller', 'game-display'];

  /**
   * Install built-in modules on first run (when modules_installed is empty)
   * Creates symlinks to the /modules/ directory for built-in modules
   */
  function installBuiltinModules(): void {
    try {
      // Create modules_installed directory if it doesn't exist
      if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
      }

      // Check if any modules are already installed
      const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
      const existingModules = entries.filter(e => e.isDirectory() || e.isSymbolicLink());

      if (existingModules.length > 0) {
        console.log(`📦 Found ${existingModules.length} existing module(s), skipping built-in installation`);
        return;
      }

      console.log('🚀 First run detected - installing built-in modules...');

      for (const moduleId of BUILTIN_MODULES) {
        const sourcePath = path.join(builtinModulesDir, moduleId);
        const targetPath = path.join(modulesDir, moduleId);

        // Check if source module exists
        if (!fs.existsSync(sourcePath)) {
          console.warn(`⚠️  Built-in module not found: ${moduleId}`);
          continue;
        }

        // Check if module.json exists in source
        const manifestPath = path.join(sourcePath, 'module.json');
        if (!fs.existsSync(manifestPath)) {
          console.warn(`⚠️  No module.json found for built-in module: ${moduleId}`);
          continue;
        }

        try {
          // Create symlink to built-in module (allows updates without reinstall)
          // A junction needs no admin rights on Windows, so updates reach the module there too
          fs.symlinkSync(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir');
          console.log(`✅ Installed built-in module: ${moduleId} (symlink)`);
        } catch (symlinkError) {
          // Fallback: copy the module if symlink fails (e.g., on Windows without admin)
          console.log(`📋 Symlink failed, copying module: ${moduleId}`);
          copyDirectoryRecursive(sourcePath, targetPath);
          console.log(`✅ Installed built-in module: ${moduleId} (copy)`);
        }
      }

      console.log('✨ Built-in modules installation complete');
    } catch (e) {
      console.error('❌ Failed to install built-in modules:', e);
    }
  }

  /**
   * Recursively copy a directory
   */
  function copyDirectoryRecursive(source: string, target: string): void {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        copyDirectoryRecursive(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  // Install built-in modules on first run
  installBuiltinModules();

  // Scan for already installed modules on startup
  function scanInstalledModules(): void {
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
                // Darts caller: migrate older stored shapes into the current one
                configValues: manifest.id === 'darts-caller'
                  ? normalizeDartsCallerConfig({ ...defaultConfig, ...savedConfig })
                  // WLED: fade times to ms everywhere, unit marker set
                  : manifest.id === 'wled'
                    ? normalizeWledConfig({ ...defaultConfig, ...savedConfig })
                    : { ...defaultConfig, ...savedConfig },
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
  scanInstalledModules();

  // Start a module: shared by the start route and by maintenance operations
  // (update) that must bring a module back up after touching its files.
  const startModuleImpl = async (id: string): Promise<void> => {
    const mod = installedModules.get(id);
    if (!mod) throw new Error(`Module ${id} not found`);

    // Setup handler based on module type
    if (id === 'wled') {
      mod.wledHandler = createWledHandler(mod.configValues);
      mod.wledHandler.setPlayerService(playerService);
      mod.wledHandler.setLogger(createModuleLogger('wled'));

      mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
        if (mod.wledHandler) {
          await mod.wledHandler.handleEvent(event);
        }
      };

      console.log(`▶️  Started module: ${mod.manifest.name}`);
      console.log(`   Host: ${mod.wledHandler.getHost() || 'not configured'}`);
    } else if (id === 'game-display') {
      mod.gameDisplayHandler = createGameDisplayHandler(mod.configValues);
      mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
        if (mod.gameDisplayHandler) {
          await mod.gameDisplayHandler.handleEvent(event);
        }
      };
      console.log(`▶️  Started module: ${mod.manifest.name}`);
    } else if (id === 'darts-caller') {
      const callerVoicePacksDir = runtimePath('data', 'voicepacks');
      mod.dartsCallerHandler = createDartsCallerHandler({
        ...mod.configValues,
        voicePacksDir: callerVoicePacksDir,
      });
      // Register callback to forward call requests to WebSocket
      mod.dartsCallerHandler.onCallRequest((request) => {
        console.log(`🎙️  Caller request: ${request.type} - "${request.text}"`);
        eventSystem.emitCallerRequest(request);
      });
      // Initialize ElevenLabs service and VoicePackGenerator if API key is configured
      const config = server.getConfig();
      const elevenLabsApiKey = resolveProviderApiKey(getAIProviderService(), 'elevenlabs', config?.aiProviders?.elevenlabs);
      if (elevenLabsApiKey) {
        const service = new ElevenLabsService({
          apiKey: elevenLabsApiKey,
          cacheDir: runtimePath('data', 'tts-cache'),
          enableCache: true,
        });
        service.init().catch((err) => {
          console.error('Failed to initialize ElevenLabs service:', err);
        });
        const generator = new VoicePackGenerator(service, callerVoicePacksDir);
        mod.dartsCallerHandler.setElevenLabsService(service);
        mod.dartsCallerHandler.setVoicePackGenerator(generator);
        console.log('🎙️  Darts Caller configured with ElevenLabs for player name generation');
      }
      mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
        if (mod.dartsCallerHandler) {
          await mod.dartsCallerHandler.handleEvent(event);
        }
      };
      console.log(`▶️  Started module: ${mod.manifest.name}`);
    } else if (mod.manifest.entry && mod.manifest.entry !== 'internal') {
      // External SDK-based module - spawn as separate process
      await startExternalModule(mod);
    } else {
      console.log(`▶️  Started module: ${mod.manifest.name}`);
    }

    // Register module intents
    registerModuleIntents(mod);

    mod.status = 'running';
  };

  // Stop a module: shared by the stop route and by maintenance operations
  // (uninstall, update) that must not leave a running external process (or
  // registered intents) behind when the module's files are removed/replaced.
  const stopModuleImpl = async (id: string): Promise<void> => {
    const mod = installedModules.get(id);
    if (!mod) throw new Error(`Module ${id} not found`);

    // Unregister intents
    unregisterModuleIntents(mod);

    // Stop external process if running
    if (mod.isExternalProcess) {
      await stopExternalModule(mod);
    }

    // Remove event handler and handlers
    mod.eventHandler = undefined;
    mod.wledHandler = undefined;
    mod.gameDisplayHandler = undefined;
    mod.dartsCallerHandler = undefined;
    mod.status = 'stopped';
    console.log(`⏹️  Stopped module: ${mod.manifest.name}`);
  };

  // Shared install implementation: used by the module management routes
  // (git or local install) and the store routes (always git, url/branch
  // supplied by the validated catalog entry).
  const installModuleImpl = async (
    source: 'git' | 'local',
    url?: string,
    modulePath?: string,
    branch?: string
  ): Promise<string> => {
    console.log(`📥 Installing module from ${source}: ${url || modulePath}`);

    const result = await moduleInstaller.install({
      type: source,
      url: source === 'git' ? url : undefined,
      path: source === 'local' ? modulePath : undefined,
      branch: branch,
    });

    if (!result.success || !result.manifest) {
      const error = new Error(result.error || 'Installation failed') as Error & { code?: string };
      if (result.errorCode) {
        error.code = result.errorCode;
      }
      throw error;
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
  };

  // Shared uninstall implementation: used by the module management routes
  // and the store routes (to roll back a mismatched install).
  const uninstallModuleImpl = async (id: string): Promise<void> => {
    const mod = installedModules.get(id);
    if (!mod) throw new Error(`Module ${id} not found`);

    // Stop module first if running - otherwise its external process (or
    // registered intents) would be left running while its install
    // directory is removed out from under it.
    await stopForMaintenance(mod, (m) => stopModuleImpl(m.id));

    // Use the stored path directly instead of relying on moduleId matching directory name
    // This fixes the issue where git-installed modules have directory names different from their module ID
    // e.g., directory "autodarts-mqtt-module" but module ID "mqtt"
    console.log(`🗑️  Uninstalling module ${id} from path: ${mod.path}`);
    await fs.promises.rm(mod.path, { recursive: true, force: true });

    // Also remove the module config file
    const configPath = path.join(getConfigDir(), `${id}.json`);
    try {
      await fs.promises.rm(configPath, { force: true });
    } catch {
      // Config file may not exist, that's fine
    }

    installedModules.delete(id);
    console.log(`🗑️  Uninstalled module: ${id}`);
  };

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
        const convertField = (field: import('./types/modules.js').ModuleConfigField): import('./types/api.js').ModuleConfigFieldSchema => {
          const result: import('./types/api.js').ModuleConfigFieldSchema = {
            type: field.type as 'string' | 'number' | 'boolean' | 'select' | 'color' | 'group' | 'provider-select',
            label: field.label,
            description: field.description,
            default: field.default,
            required: field.required,
            min: field.min,
            max: field.max,
            options: field.options,
            showIf: field.showIf,
            placeholder: field.placeholder,
            providerCapability: field.providerCapability,
          };
          // Recursively convert nested fields for group type
          if (field.type === 'group' && field.fields) {
            result.fields = {};
            for (const [nestedKey, nestedField] of Object.entries(field.fields)) {
              result.fields[nestedKey] = convertField(nestedField);
            }
          }
          return result;
        };
        for (const [key, field] of Object.entries(mod.manifest.config)) {
          schema[key] = convertField(field);
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
        // Extended fields from module.json (for dynamic UI generation)
        eventMeta: mod.manifest.eventMeta,
        eventGroups: mod.manifest.eventGroups,
        effects: mod.manifest.effects,
        intents: mod.manifest.intents,
        i18n: mod.manifest.i18n,
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
    // Promise executor: a throw (unknown module, failed save) becomes a rejection
    updateModuleConfig: (id: string, newConfig: Record<string, unknown>): Promise<void> => new Promise<void>((resolve) => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Merge with existing config (WLED: migrate the stored fade times first, update is in ms)
      mod.configValues = id === 'wled'
        ? mergeWledConfigUpdate(mod.configValues, newConfig)
        : { ...mod.configValues, ...newConfig };
      if (id === 'darts-caller') {
        // One shape for page, generic form and handler; drops legacy keys
        mod.configValues = normalizeDartsCallerConfig(mod.configValues);
      }

      // Save to disk
      saveModuleConfig(id, mod.configValues);
      console.log(`💾 Saved config for module: ${mod.manifest.name}`);

      // Darts caller: apply the new settings to the running handler right away
      if (id === 'darts-caller' && mod.dartsCallerHandler) {
        mod.dartsCallerHandler.updateConfig(mod.configValues);
      }
      resolve();
    }),
    startModule: startModuleImpl,
    stopModule: stopModuleImpl,
    // A thrown error (unknown module, handler setup) rejects the returned promise.
    restartModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Re-setup handler based on module type
      if (id === 'wled') {
        // Update or create handler with latest config
        if (mod.wledHandler) {
          mod.wledHandler.updateConfig(mod.configValues as WledConfig);
        } else {
          mod.wledHandler = createWledHandler(mod.configValues);
          mod.wledHandler.setPlayerService(playerService);
          mod.wledHandler.setLogger(createModuleLogger('wled'));
        }

        mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
          if (mod.wledHandler) {
            await mod.wledHandler.handleEvent(event);
          }
        };
      } else if (id === 'game-display') {
        if (mod.gameDisplayHandler) {
          mod.gameDisplayHandler.updateConfig(mod.configValues as GameDisplayConfig);
        } else {
          mod.gameDisplayHandler = createGameDisplayHandler(mod.configValues);
        }

        mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
          if (mod.gameDisplayHandler) {
            await mod.gameDisplayHandler.handleEvent(event);
          }
        };
      } else if (id === 'darts-caller') {
        const callerConfig = {
          ...mod.configValues,
          voicePacksDir: runtimePath('data', 'voicepacks'),
        };
        if (mod.dartsCallerHandler) {
          mod.dartsCallerHandler.updateConfig(callerConfig);
        } else {
          mod.dartsCallerHandler = createDartsCallerHandler(callerConfig);
          // Register callback to forward call requests to WebSocket
          mod.dartsCallerHandler.onCallRequest((request) => {
            console.log(`🎙️  Caller request: ${request.type} - "${request.text}"`);
            eventSystem.emitCallerRequest(request);
          });
        }

        mod.eventHandler = async (event: ParsedEvent): Promise<void> => {
          if (mod.dartsCallerHandler) {
            await mod.dartsCallerHandler.handleEvent(event);
          }
        };
      } else if (mod.manifest.entry && mod.manifest.entry !== 'internal') {
        // External SDK-based module: it runs as its own process, so restart can't
        // just swap a handler in place like the built-ins above - stop the old
        // process (waiting for it to actually exit) and spawn a fresh one.
        await restartExternalModule(mod, startExternalModule);
      }

      mod.status = 'running';
      console.log(`🔄 Restarted module: ${mod.manifest.name}`);
    },
    installModule: installModuleImpl,
    uninstallModule: uninstallModuleImpl,
    updateModule: async (id: string): Promise<{ success: boolean; previousVersion?: string; newVersion?: string; error?: string }> => {
      const mod = installedModules.get(id);
      if (!mod) {
        return { success: false, error: `Module ${id} not found` };
      }

      // Check if it's a git repo
      const gitPath = path.join(mod.path, '.git');
      if (!fs.existsSync(gitPath)) {
        return { success: false, error: 'Module is not a git repository, cannot update' };
      }

      const previousVersion = mod.manifest.version;

      // Stop module if running - otherwise its external process (or
      // registered intents) would keep running the OLD code underneath
      // while refreshAt() pulls and rebuilds the new version on disk.
      const wasRunning = await stopForMaintenance(mod, (m) => stopModuleImpl(m.id));
      if (wasRunning) {
        console.log(`⏸️  Stopped module ${id} for update`);
      }

      try {
        // Pull, install with dev dependencies and rebuild (without a shell)
        console.log(`🔄 Updating module ${id} from git...`);
        await moduleInstaller.refreshAt(mod.path);

        // Reload manifest
        const manifestPath = path.join(mod.path, 'module.json');
        const newManifestData = fs.readFileSync(manifestPath, 'utf-8');
        const newManifest = JSON.parse(newManifestData) as ModuleManifest;

        // Update the stored module info
        mod.manifest = newManifest;

        console.log(`✅ Updated module ${id}: ${previousVersion} → ${newManifest.version}`);

        // Restart if it was running before - matches the user-visible
        // behavior of an update: a module that was running keeps running
        // afterwards, now with the new version.
        await restartAfterMaintenance(
          wasRunning,
          mod,
          (m) => startModuleImpl(m.id),
          (startError) => {
            console.error(`⚠️  Module ${id} updated but failed to restart:`, startError);
          }
        );
        if (wasRunning && mod.status === 'running') {
          console.log(`▶️  Module ${id} restarted after update`);
        }

        return {
          success: true,
          previousVersion,
          newVersion: newManifest.version,
        };
      } catch (error) {
        console.error(`❌ Failed to update module ${id}:`, error);
        return {
          success: false,
          previousVersion,
          error: error instanceof Error ? error.message : 'Update failed',
        };
      }
    },
    isModuleInstalled: (id: string): boolean => installedModules.has(id),
    getAllModuleIntents: () => {
      const result: Record<string, Record<string, {
        description: string;
        category?: string;
        payload?: Record<string, { type: string; description?: string; optional?: boolean }>;
      }>> = {};

      for (const mod of installedModules.values()) {
        const intentsConfig = mod.manifest.intents as {
          emits?: Array<{
            id: string;
            description: string;
            category?: string;
            payload?: Record<string, { type: string; description?: string; optional?: boolean }>;
          }>;
        } | undefined;

        if (intentsConfig?.emits && intentsConfig.emits.length > 0) {
          result[mod.id] = {};
          for (const intent of intentsConfig.emits) {
            result[mod.id][intent.id] = {
              description: intent.description,
              category: intent.category,
              payload: intent.payload,
            };
          }
        }
      }

      return result;
    },
    // Autostart management
    getModuleAutostart: (id: string): boolean | undefined => {
      return getModuleAutostart(id);
    },
    setModuleAutostart: (id: string, autostart: boolean): void => {
      setModuleAutostart(id, autostart);
      console.log(`⚙️  Set autostart for ${id}: ${autostart}`);
    },
    getAllAutostartSettings: (): Record<string, boolean> => {
      const settings = loadAutostartSettings();
      // Add computed autostart values for modules without explicit settings
      for (const mod of installedModules.values()) {
        if (settings[mod.id] === undefined) {
          settings[mod.id] = shouldModuleAutostart(mod);
        }
      }
      return settings;
    },
  });

  // Register Store Routes
  const defaultStoreCatalogUrl = 'https://raw.githubusercontent.com/Castorio/io-darts-agent/main/store/modules.json';
  let storeCatalogUrl = defaultStoreCatalogUrl;
  if (process.env.IO_DARTS_STORE_URL) {
    try {
      if (new URL(process.env.IO_DARTS_STORE_URL).protocol === 'https:') {
        storeCatalogUrl = process.env.IO_DARTS_STORE_URL;
      } else {
        console.warn('⚠️  IO_DARTS_STORE_URL must use https:, ignoring and using the default catalog URL');
      }
    } catch {
      console.warn('⚠️  IO_DARTS_STORE_URL is not a valid URL, ignoring and using the default catalog URL');
    }
  }
  const storeCatalog = new StoreCatalog({ url: storeCatalogUrl });
  registerStoreRoutes(fastify, server, {
    catalog: storeCatalog,
    installedVersion: (id: string): string | null => {
      const mod = installedModules.get(id);
      return mod ? mod.manifest.version : null;
    },
    installModule: (url: string, branch: string): Promise<string> =>
      installModuleImpl('git', url, undefined, branch),
    uninstallModule: uninstallModuleImpl,
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
  const playersFilePath = runtimePath('config', 'players.json');
  const playerRepository = new PlayerRepository({ filePath: playersFilePath });
  // Use the global playerService variable so handleWledEvent can access it
  playerService = new PlayerService({ repository: playerRepository });

  registerPlayerRoutes(fastify, server, {
    playerService,
  });
  console.log('👥 Player management initialized');

  // Connect player color resolver to match status service
  matchStatusService.setPlayerColorResolver((playerName: string) => {
    if (!playerService) return undefined;
    return playerService.getPlayerColor(playerName);
  });

  // Register Media Routes (core media library for all modules)
  const mediaDir = runtimePath('media');
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

  const animationEngineSettings = new AnimationEngineSettings(
    runtimePath('config', 'animation-settings.json')
  );

  // Runway key from the AI settings, legacy hub config as fallback
  // Model from the AI settings; the provider replaces retired or unknown ids with its default
  function runwayAnimationConfig(): { apiKey: string | undefined; model: string | undefined } {
    const legacy = server.getConfig()?.aiProviders?.runway;
    const aiService = getAIProviderService();
    return {
      apiKey: resolveProviderApiKey(aiService, 'runway', legacy),
      model: resolveProviderDefaultModel(aiService, 'runway', legacy),
    };
  }

  // Higgsfield uses the access configured in the AI settings
  function getHiggsfieldProvider(): HiggsfieldProvider | undefined {
    const provider = getAIProviderService().getProvider('higgsfield');
    return provider instanceof HiggsfieldProvider ? provider : undefined;
  }

  // Function to configure/reconfigure the animation engine
  function configureAnimationProvider(): void {
    if (animationEngineSettings.get() === 'higgsfield') {
      const higgsfield = getHiggsfieldProvider();
      if (higgsfield) {
        animationService.setProvider(new HiggsfieldAnimationProvider(higgsfield));
        console.log(`🎬 Animation generator: Higgsfield ${higgsfield.isAvailable() ? 'configured' : 'selected, not configured'}`);
      } else {
        animationService.setProvider(null);
        console.log('🎬 Animation generator: Higgsfield selected, provider not loaded yet');
      }
      return;
    }

    const runwayProvider = createRunwayProvider(runwayAnimationConfig());

    if (runwayProvider) {
      animationService.setProvider(runwayProvider);
      console.log('🎬 Animation generator: Runway ML configured');
    } else {
      animationService.setProvider(null); // Clear provider
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
    engine: {
      get: () => ({
        engine: animationEngineSettings.get(),
        engines: [
          {
            id: 'runway',
            name: 'Runway ML',
            available: !!createRunwayProvider(runwayAnimationConfig()),
          },
          { id: 'higgsfield', name: 'Higgsfield', available: !!getHiggsfieldProvider()?.isAvailable() },
        ],
      }),
      set: (engine) => {
        animationEngineSettings.set(engine);
        configureAnimationProvider();
      },
    },
  });

  // ElevenLabs TTS Service
  let elevenLabsService: ElevenLabsService | null = null;
  let voicePackGenerator: VoicePackGenerator | null = null;
  const voicePacksDir = runtimePath('data', 'voicepacks');

  function getOrCreateElevenLabsService(): ElevenLabsService | null {
    const config = server.getConfig();
    const apiKey = resolveProviderApiKey(getAIProviderService(), 'elevenlabs', config?.aiProviders?.elevenlabs);

    if (!apiKey) {
      // Key removed or provider disabled: the darts caller must stop using the old one
      if (elevenLabsService) {
        installedModules.get('darts-caller')?.dartsCallerHandler?.setElevenLabsService(null);
        console.log('🎙️  ElevenLabs no longer configured, Darts Caller detached');
      }
      elevenLabsService = null;
      voicePackGenerator = null;
      return null;
    }

    if (!elevenLabsService || elevenLabsService.getApiKey() !== apiKey) {
      elevenLabsService = new ElevenLabsService({
        apiKey,
        cacheDir: runtimePath('data', 'tts-cache'),
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
        eventSystem.emitVoicePackProgress(progress);
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

  // Initialize ElevenLabs service and VoicePackGenerator for darts-caller if already running
  // This ensures player names can be generated when a match starts
  const dartsCallerModInit = installedModules.get('darts-caller');
  if (dartsCallerModInit?.dartsCallerHandler && dartsCallerModInit.status === 'running') {
    const service = getOrCreateElevenLabsService();
    if (service && voicePackGenerator) {
      dartsCallerModInit.dartsCallerHandler.setElevenLabsService(service);
      dartsCallerModInit.dartsCallerHandler.setVoicePackGenerator(voicePackGenerator);
      console.log('🎙️  Darts Caller initialized with ElevenLabs service and Voice Pack Generator');
    }
  }

  // Helper function to get the darts caller handler
  function getDartsCallerHandler(): DartsCallerHandler | null {
    const mod = installedModules.get('darts-caller');
    return mod?.dartsCallerHandler ?? null;
  }

  // Register Caller Routes
  registerCallerRoutes(fastify, server, {
    getCallerHandler: getDartsCallerHandler,
    subscribeToCallRequests: (callback: (request: CallRequest) => void) => {
      return eventSystem.subscribeToCallerRequests(callback);
    },
  });
  console.log('🗣️  Caller routes initialized');

  // Register Developer Routes (for simulation/testing)
  registerDeveloperRoutes(fastify, server, {
    emitEvent: (event: ParsedEvent) => {
      // Emit to WebSocket subscribers via EventSystem
      eventSystem.emitEvent(event);
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

  const aiService = getAIProviderService();
  // Keys changed in the AI settings reach the darts caller and animation engine
  aiService.on('provider:status', () => {
    getOrCreateElevenLabsService();
    configureAnimationProvider();
  });

  // Register AI Routes
  registerAIRoutes(fastify, server, {
    getService: () => aiService,
    saveConfig: () => saveAIProviderConfigs({ configDir: aiConfigDir }),
  });
  console.log('🤖 AI routes initialized');

  // Register Trainer Routes
  registerTrainerRoutes(fastify, server, {
    emitEvent: (event: unknown) => {
      // Emit training events to subscribers via EventSystem
      eventSystem.emitEvent(event as ParsedEvent);
    },
  });
  console.log('🏋️ Trainer routes initialized');

  // Register Match Routes (for current match state)
  registerMatchRoutes(fastify, server, {
    getCurrentMatch: () => hub?.getCurrentMatchState() ?? null,
    getLastMatchUpdate: () => hub?.getLastMatchUpdate() ?? null,
    getWonCounts: () => hub?.getWonCounts() ?? null,
  });

  // Register WebSocket Routes - using EventSystem for subscriptions
  const wsManager = registerWebSocketRoutes(fastify, server, {
    getAutodartsStatus: () => ({
      connected: hub?.isActive() ?? false,
      matchId: hub?.getCurrentMatchId() ?? undefined,
    }),
    subscribeToEvents: (handler: (event: ParsedEvent) => void) => {
      return eventSystem.subscribeToEvents(handler);
    },
    subscribeToModuleStatus: (handler: (moduleId: string, status: ModuleStatus) => void) => {
      return eventSystem.subscribeToModuleStatus(handler);
    },
    subscribeToLogs: (handler: (entry: LogEntry) => void) => {
      return eventSystem.subscribeToLogs(handler);
    },
    getLogHistory: () => eventSystem.getLogHistory(),
    subscribeToVoicePackProgress: (handler: (progress: GenerationProgress) => void) => {
      return eventSystem.subscribeToVoicePackProgress(handler);
    },
    subscribeToCallerRequests: (handler: (request: CallRequest) => void) => {
      return eventSystem.subscribeToCallerRequests(handler);
    },
  });

  // Start WebSocket manager
  wsManager.start();

  // Serve module UIs from their own folders
  // Each module can have a /web/dist folder with its built frontend
  // Check both /modules/ (builtin) and /modules_installed/ (external)
  const modulesSourceDir = resolveBuiltinModulesDir(path.join(__dirname, '..'));
  const modulesInstalledDir = runtimePath('modules_installed');
  // Registration is queued and loaded by fastify on listen; nothing to await here
  void fastify.register((instance, _opts, done) => {
    instance.get('/module-ui/:moduleId/*', async (request, reply) => {
      const { moduleId } = request.params as { moduleId: string };
      const splat = (request.params as Record<string, string>)['*'] || 'index.html';
      if (!isValidModuleId(moduleId)) {
        return reply.status(404).send({ error: 'Module UI not found' });
      }

      // Helper to find module UI path - check multiple locations
      const findModuleUiPath = (): string | null => {
        // First check modules_installed using the stored module path (handles directory name != module id)
        const installedModule = installedModules.get(moduleId);
        if (installedModule) {
          const installedDistPath = path.join(installedModule.path, 'web', 'dist');
          if (fs.existsSync(installedDistPath)) {
            return installedDistPath;
          }
        }

        // Check in modules_installed by moduleId
        const installedByIdPath = path.join(modulesInstalledDir, moduleId, 'web', 'dist');
        if (fs.existsSync(installedByIdPath)) {
          return installedByIdPath;
        }

        // Check in builtin modules directory
        const builtinPath = path.join(modulesSourceDir, moduleId, 'web', 'dist');
        if (fs.existsSync(builtinPath)) {
          return builtinPath;
        }

        return null;
      };

      const moduleDistPath = findModuleUiPath();
      if (!moduleDistPath) {
        return reply.status(404).send({ error: 'Module UI not found' });
      }

      // The router decodes the wildcard (..%2f), so keep the file inside the UI folder
      const filePath = resolveModuleUiFile(moduleDistPath, splat);

      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
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

        void reply.header('Content-Type', contentType);
        return reply.send(fs.readFileSync(filePath));
      }

      // SPA fallback - serve index.html for any non-asset routes
      const indexPath = path.join(moduleDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        void reply.header('Content-Type', 'text/html');
        return reply.send(fs.readFileSync(indexPath));
      }

      return reply.status(404).send({ error: 'Module UI not found' });
    });
    done();
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
  let isShuttingDown = false;
  const shutdown = (signal?: string): void => {
    if (isShuttingDown) return; // Prevent multiple shutdown calls
    isShuttingDown = true;

    console.log(`\n🛑 Shutting down${signal ? ` (${signal})` : ''}...`);

    try {
      wsManager.stop();
      stopHub();
      // Don't await - just trigger shutdown
      server.stop().catch(() => {});
      console.log('✅ Server stopped cleanly');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }

    // Give external modules up to 7 s to stop, then exit
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 7000));
    void Promise.race([stopAllExternalModules(), timeout]).finally(() => {
      process.exit(0);
    });
  };

  // Output pipe closed (the desktop app that supervises the hub is gone):
  // nobody reads the logs any more, so shut down instead of looping on EPIPE
  guardBrokenPipes([process.stdout, process.stderr], () => {
    if (process.env.IO_DARTS_SUPERVISED === '1') shutdown('EPIPE');
  });

  // Restart from the settings page: answer the request first, free the port, then restart
  server.on('restartRequested', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n🔄 Restarting hub...');
    const stopForRestart = async (): Promise<void> => {
      try {
        wsManager.stop();
        stopHub();
        await stopAllExternalModules();
        await server.stop();
      } catch (error) {
        console.error('Error while stopping for restart:', error);
      }
    };
    setTimeout(() => {
      // stopForRestart never rejects. If restartProcess throws, the rejection stays
      // unhandled on purpose: the process exits instead of idling with a stopped server.
      void stopForRestart().then(() => restartProcess());
    }, 300);
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  // Handle uncaught errors to ensure cleanup
  process.on('uncaughtException', (error) => {
    if (isBrokenPipe(error)) return; // logging it would fail the same way
    console.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
  });
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
