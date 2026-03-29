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
} from './api/routes/index.js';
import { MediaService } from './core/media/MediaService.js';
import { APIConfigService } from './core/config/ConfigService.js';
import { AuthService } from './core/auth/AuthService.js';
import { ModuleInstaller } from './core/modules/ModuleInstaller.js';
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
}
const installedModules = new Map<string, InstalledModule>();

/**
 * Convert hex color string to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Parse color from config - supports both hex strings and RGB objects
 */
function parseColor(color: unknown, fallback: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }): { r: number; g: number; b: number } {
  if (!color) return fallback;

  // If it's already an RGB object
  if (typeof color === 'object' && color !== null && 'r' in color) {
    return color as { r: number; g: number; b: number };
  }

  // If it's a hex string
  if (typeof color === 'string' && color.startsWith('#')) {
    return hexToRgb(color);
  }

  return fallback;
}

/**
 * Handle WLED module events
 * This processes Autodarts events and sends commands to WLED
 */
async function handleWledEvent(event: ParsedEvent, mod: InstalledModule): Promise<void> {
  const config = mod.configValues;
  const host = config.wledHost as string;
  const port = (config.wledPort as number) || 80;

  if (!host) {
    console.warn('WLED: No host configured');
    return;
  }

  // Get events config - support both 'events' and 'eventActions' keys
  const eventsConfig = (config.events as Record<string, unknown>) ||
                       (config.eventActions as Record<string, unknown>) || {};

  // Map Autodarts events to WLED actions - try exact match first, then variations
  let actionConfig: Record<string, unknown> | null = null;
  let eventKey: string | null = null;

  // Use string type to allow flexible event matching
  const eventType = event.type as string;

  switch (eventType) {
    case 'match.start':
    case 'match.started':
      eventKey = 'match.started';
      actionConfig = (eventsConfig['match.started'] || eventsConfig['match.start'] || eventsConfig.matchStart) as Record<string, unknown>;
      break;
    case 'match.finished':
      eventKey = 'match.finished';
      actionConfig = (eventsConfig['match.finished'] || eventsConfig.matchFinished) as Record<string, unknown>;
      break;
    case 'match.delete':
    case 'match.deleted':
      eventKey = 'match.deleted';
      actionConfig = (eventsConfig['match.deleted'] || eventsConfig['match.delete'] || eventsConfig.matchDeleted) as Record<string, unknown>;
      break;
    case 'game.finished':
      eventKey = 'game.finished';
      actionConfig = (eventsConfig['game.finished'] || eventsConfig.gameFinished) as Record<string, unknown>;
      break;
    case 'throw.detected':
      // Check for special throws
      const throwData = event.data as Record<string, unknown>;
      const segment = throwData.segment as Record<string, unknown>;
      const points = (throwData.points as number) || 0;
      const turnPoints = (throwData.turnPoints as number) || 0;

      if (turnPoints === 180) {
        eventKey = 'throw.180';
        actionConfig = (eventsConfig['throw.180'] || eventsConfig.throw180) as Record<string, unknown>;
      } else if (throwData.busted) {
        eventKey = 'throw.bust';
        actionConfig = (eventsConfig['throw.bust'] || eventsConfig.throwBust) as Record<string, unknown>;
      } else if (segment) {
        const multiplier = segment.multiplier as number;
        const number = segment.number as number;

        if (multiplier === 3) {
          eventKey = 'throw.triple';
          actionConfig = (eventsConfig['throw.triple'] || eventsConfig.throwTriple || eventsConfig.throwHighlight) as Record<string, unknown>;
        } else if (multiplier === 2 && number === 25) {
          eventKey = 'throw.bullseye';
          actionConfig = (eventsConfig['throw.bullseye'] || eventsConfig.throwBullseye) as Record<string, unknown>;
        } else if (number === 25) {
          eventKey = 'throw.bull';
          actionConfig = (eventsConfig['throw.bull'] || eventsConfig.throwBull) as Record<string, unknown>;
        } else if (multiplier === 2) {
          eventKey = 'throw.double';
          actionConfig = (eventsConfig['throw.double'] || eventsConfig.throwDouble) as Record<string, unknown>;
        }
      }

      // Fallback to throw.detected or throw.hit
      if (!actionConfig) {
        if (points === 0) {
          eventKey = 'throw.miss';
          actionConfig = (eventsConfig['throw.miss'] || eventsConfig.throwMiss) as Record<string, unknown>;
        } else {
          eventKey = 'throw.detected';
          actionConfig = (eventsConfig['throw.detected'] || eventsConfig.throwHit) as Record<string, unknown>;
        }
      }
      break;
    case 'player.change':
    case 'player.changed':
      eventKey = 'player.changed';
      actionConfig = (eventsConfig['player.changed'] || eventsConfig['player.change'] || eventsConfig.playerChange) as Record<string, unknown>;
      break;
    case 'takeout.started':
      eventKey = 'takeout.started';
      actionConfig = (eventsConfig['takeout.started'] || eventsConfig.takeoutStarted) as Record<string, unknown>;
      break;
    case 'takeout.finished':
      eventKey = 'takeout.finished';
      actionConfig = (eventsConfig['takeout.finished'] || eventsConfig.takeoutFinished) as Record<string, unknown>;
      break;
    case 'turn.started':
      eventKey = 'turn.started';
      actionConfig = (eventsConfig['turn.started'] || eventsConfig.turnStarted) as Record<string, unknown>;
      break;
    case 'turn.finished':
      eventKey = 'turn.finished';
      actionConfig = (eventsConfig['turn.finished'] || eventsConfig.turnFinished) as Record<string, unknown>;
      break;
  }

  if (!actionConfig) {
    addLog('module', 'wled', `No config for event: ${event.type} (key: ${eventKey})`);
    return;
  }

  const actionType = actionConfig.actionType as string;
  if (!actionType || actionType === 'none') {
    addLog('module', 'wled', `Action type is none for ${eventKey}`);
    return;
  }

  try {
    const wledUrl = `http://${host}:${port}/json/state`;
    let wledPayload: Record<string, unknown> = { on: true };

    // Check duration for state restore
    const duration = (actionConfig.duration as number) || 0;
    let previousState: Record<string, unknown> | null = null;

    // If duration is set, save current WLED state BEFORE making changes
    if (duration > 0 && actionType !== 'off') {
      try {
        const stateResponse = await fetch(`http://${host}:${port}/json/state`);
        if (stateResponse.ok) {
          previousState = await stateResponse.json() as Record<string, unknown>;
          addLog('module', 'wled', `Saved previous state for restore after ${duration}ms`, {
            on: previousState.on,
            bri: previousState.bri,
            ps: previousState.ps,
          });
        }
      } catch (e) {
        addLog('module', 'wled', 'Could not save previous state');
      }
    }

    // Check if usePlayerColor is enabled - if so, determine player color
    const usePlayerColor = actionConfig.usePlayerColor as boolean;
    let playerColor: { r: number; g: number; b: number } | null = null;
    let playerColorSource = '';

    if (usePlayerColor) {
      const eventData = event.data as Record<string, unknown>;
      const playerIdx = (eventData?.playerIndex as number) || 0;
      const currentPlayerName = eventData?.playerName as string;

      // First, try to match the player by name and use their configured color
      if (playerService && currentPlayerName) {
        try {
          const matchedPlayer = await playerService.matchPlayer(currentPlayerName);
          if (matchedPlayer && matchedPlayer.color) {
            // Use the player's configured color (higher priority)
            playerColor = parseColor(matchedPlayer.color);
            playerColorSource = `player "${matchedPlayer.name}"`;
            addLog('module', 'wled', `Matched known player: ${matchedPlayer.name} with color ${matchedPlayer.color}`);
          }
        } catch (e) {
          addLog('module', 'wled', `Could not match player: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // If no known player found, use generic player colors
      if (!playerColor) {
        const playerColorsConfig = (config.playerColors as Array<string | { r: number; g: number; b: number }>) || [
          '#3b82f6', // Blue
          '#ef4444', // Red
          '#22c55e', // Green
          '#f59e0b', // Amber
          '#8b5cf6', // Purple
          '#ec4899', // Pink
        ];
        const playerColorsRgb = playerColorsConfig.map(c => parseColor(c));
        playerColor = playerColorsRgb[playerIdx % playerColorsRgb.length];
        playerColorSource = `generic player ${playerIdx + 1}`;
      }
      addLog('module', 'wled', `Using ${playerColorSource} color: RGB(${playerColor.r},${playerColor.g},${playerColor.b})`);
    }

    // Parse colors from config (support both hex strings and RGB objects)
    // If usePlayerColor is enabled, use player color for color1
    const color1 = usePlayerColor && playerColor
      ? playerColor
      : parseColor(actionConfig.color1 || actionConfig.color);
    const color2 = parseColor(actionConfig.color2, { r: 0, g: 0, b: 0 });
    const color3 = parseColor(actionConfig.color3, { r: 0, g: 0, b: 0 });

    // Check if a color is configured
    const hasColor = actionConfig.color1 || actionConfig.color || usePlayerColor;

    // If a color is selected but no preset or effect, default to solid
    const effectiveActionType = (actionType === 'none' || !actionType) && hasColor
      ? 'solid'
      : actionType;

    switch (effectiveActionType) {
      case 'preset':
        wledPayload = { ps: (actionConfig.presetId as number) || 1 };
        break;
      case 'effect':
        wledPayload = {
          on: true,
          bri: (actionConfig.brightness as number) ?? 255,
          seg: [{
            fx: (actionConfig.effectId as number) ?? 0,
            sx: (actionConfig.speed as number) ?? 128,
            ix: (actionConfig.intensity as number) ?? 128,
            col: [
              [color1.r, color1.g, color1.b],
              [color2.r, color2.g, color2.b],
              [color3.r, color3.g, color3.b],
            ],
          }],
        };
        break;
      case 'solid':
        wledPayload = {
          on: true,
          bri: (actionConfig.brightness as number) ?? 255,
          seg: [{
            fx: 0,
            col: [[color1.r, color1.g, color1.b]],
          }],
        };
        break;
      case 'brightness':
        wledPayload = {
          on: true,
          bri: (actionConfig.brightness as number) ?? 255,
        };
        break;
      case 'off':
        wledPayload = { on: false };
        break;
    }

    addLog('module', 'wled', `Sending ${effectiveActionType} action for ${event.type}`, wledPayload);
    console.log(`🎨 WLED [${event.type}]: Sending ${effectiveActionType} action`);

    const response = await fetch(wledUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wledPayload),
    });

    if (!response.ok) {
      addLog('module', 'wled', `HTTP Error: ${response.status}`);
      console.error(`WLED: HTTP ${response.status}`);
    } else {
      addLog('module', 'wled', `Command sent successfully to ${host}:${port}`);
    }

    // Handle duration (revert to previous state after timeout)
    if (duration > 0 && previousState) {
      addLog('module', 'wled', `Will restore state in ${duration}ms`);
      setTimeout(async () => {
        try {
          // Restore the previous state
          // Extract relevant parts to restore
          const restorePayload: Record<string, unknown> = {
            on: previousState.on,
            bri: previousState.bri,
          };

          // Restore segments if available
          if (previousState.seg && Array.isArray(previousState.seg)) {
            const segments = previousState.seg as Array<Record<string, unknown>>;
            restorePayload.seg = segments.map(seg => ({
              fx: seg.fx,
              sx: seg.sx,
              ix: seg.ix,
              col: seg.col,
              pal: seg.pal,
            }));
          }

          // Restore preset if it was active
          if (previousState.ps !== undefined && previousState.ps !== -1) {
            restorePayload.ps = previousState.ps;
          }

          addLog('module', 'wled', `Restoring previous state now`, restorePayload);
          const restoreResponse = await fetch(wledUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restorePayload),
          });

          if (restoreResponse.ok) {
            addLog('module', 'wled', `Successfully restored previous state after ${duration}ms`);
          } else {
            addLog('module', 'wled', `Failed to restore state: HTTP ${restoreResponse.status}`);
          }
        } catch (e) {
          addLog('module', 'wled', `Error restoring state: ${e instanceof Error ? e.message : String(e)}`);
        }
      }, duration);
    }
  } catch (error) {
    addLog('module', 'wled', `Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`WLED Error:`, error instanceof Error ? error.message : error);
  }
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
        mod.id === 'game-display'; // Game display always auto-starts

      if (shouldAutoStart && mod.status === 'stopped') {
        try {
          // Setup event handler based on module type
          if (mod.id === 'wled') {
            mod.eventHandler = async (event: ParsedEvent) => {
              await handleWledEvent(event, mod);
            };
          }
          // game-display doesn't need an event handler - it uses WebSocket directly
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

      // Setup event handler based on module type
      if (id === 'wled') {
        mod.eventHandler = async (event: ParsedEvent) => {
          await handleWledEvent(event, mod);
        };
      }

      mod.status = 'running';
      console.log(`▶️  Started module: ${mod.manifest.name}`);

      // Log module config for debugging
      console.log(`   Host: ${mod.configValues.wledHost || 'not configured'}`);
    },
    stopModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Remove event handler
      mod.eventHandler = undefined;
      mod.status = 'stopped';
      console.log(`⏹️  Stopped module: ${mod.manifest.name}`);
    },
    restartModule: async (id: string): Promise<void> => {
      const mod = installedModules.get(id);
      if (!mod) throw new Error(`Module ${id} not found`);

      // Re-setup event handler
      if (id === 'wled') {
        mod.eventHandler = async (event: ParsedEvent) => {
          await handleWledEvent(event, mod);
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
