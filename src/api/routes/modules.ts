import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type {
  ModuleListItem,
  ModuleDetailResponse,
  UpdateModuleConfigRequest,
  InstallModuleRequest,
  InstallModuleResponse,
  ModuleActionResponse,
} from '../../types/api.js';
import type { ModuleManifest } from '../../types/modules.js';
import type { SupportedLanguage } from '../../types/i18n.js';
import type { TranslatedModuleManifest } from '../../core/modules/ModuleI18n.js';
import { getTranslatedManifest, getModuleStrings, getAvailableLanguages } from '../../core/modules/ModuleI18n.js';

// WLED Test Action Request
export interface WledTestActionRequest {
  actionType: 'preset' | 'effect' | 'solid' | 'off';
  presetId?: number;
  effectId?: number;
  color?: { r: number; g: number; b: number };
  color2?: { r: number; g: number; b: number };
  color3?: { r: number; g: number; b: number };
  brightness?: number;
  speed?: number;
  intensity?: number;
}

export interface ModuleDependencies {
  listModules: () => ModuleListItem[];
  getModule: (id: string) => ModuleDetailResponse | null;
  getModuleManifest: (id: string) => ModuleManifest | null;
  getModuleConfig: (id: string) => Record<string, unknown> | null;
  updateModuleConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  startModule: (id: string) => Promise<void>;
  stopModule: (id: string) => Promise<void>;
  restartModule: (id: string) => Promise<void>;
  installModule: (source: 'git' | 'local', url?: string, path?: string, branch?: string) => Promise<string>;
  uninstallModule: (id: string) => Promise<void>;
  isModuleInstalled: (id: string) => boolean;
  testWledAction?: (host: string, port: number, action: WledTestActionRequest) => Promise<void>;
}

/**
 * Module translation response
 */
export interface ModuleTranslationResponse {
  success: boolean;
  manifest?: TranslatedModuleManifest;
  strings?: Record<string, string>;
  availableLanguages?: string[];
  error?: string;
}

/**
 * Helper to check authentication
 * Returns true if request is authorized (auth disabled or session authenticated)
 */
function isAuthorized(server: APIServer, session: { authenticated?: boolean } | undefined): boolean {
  // If auth is disabled, always allow
  if (!server.isAuthEnabled()) {
    return true;
  }
  // Otherwise require authenticated session
  return session?.authenticated === true;
}

/**
 * Register module management routes
 */
export function registerModuleRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: ModuleDependencies
): void {
  /**
   * GET /api/modules - List all modules
   */
  fastify.get<{
    Reply: ModuleListItem[];
  }>('/api/modules', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return [];
    }

    return deps.listModules();
  });

  /**
   * GET /api/modules/:id - Get module details
   */
  fastify.get<{
    Params: { id: string };
    Reply: ModuleDetailResponse | { error: string };
  }>('/api/modules/:id', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { error: 'Authentication required' };
    }

    const module = deps.getModule(request.params.id);
    if (!module) {
      reply.code(404);
      return { error: 'Module not found' };
    }

    return module;
  });

  /**
   * GET /api/modules/:id/config - Get module configuration
   * This endpoint is public (no auth required) so module UIs can load their config
   */
  fastify.get<{
    Params: { id: string };
    Reply: Record<string, unknown> | { error: string };
  }>('/api/modules/:id/config', async (request, reply) => {
    const module = deps.getModule(request.params.id);
    if (!module) {
      reply.code(404);
      return { error: 'Module not found' };
    }

    // Return the config values directly
    return module.config?.values || {};
  });

  /**
   * PUT /api/modules/:id/config - Update module configuration
   */
  fastify.put<{
    Params: { id: string };
    Body: UpdateModuleConfigRequest;
    Reply: ModuleActionResponse;
  }>('/api/modules/:id/config', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;
    const { config } = request.body;

    if (!deps.isModuleInstalled(id)) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    try {
      await deps.updateModuleConfig(id, config);
      return { success: true, message: 'Configuration updated' };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update configuration',
      };
    }
  });

  /**
   * POST /api/modules/:id/start - Start a module
   */
  fastify.post<{
    Params: { id: string };
    Reply: ModuleActionResponse;
  }>('/api/modules/:id/start', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    if (!deps.isModuleInstalled(id)) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    try {
      await deps.startModule(id);
      return { success: true, message: 'Module started' };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start module',
      };
    }
  });

  /**
   * POST /api/modules/:id/stop - Stop a module
   */
  fastify.post<{
    Params: { id: string };
    Reply: ModuleActionResponse;
  }>('/api/modules/:id/stop', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    if (!deps.isModuleInstalled(id)) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    try {
      await deps.stopModule(id);
      return { success: true, message: 'Module stopped' };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop module',
      };
    }
  });

  /**
   * POST /api/modules/:id/restart - Restart a module
   */
  fastify.post<{
    Params: { id: string };
    Reply: ModuleActionResponse;
  }>('/api/modules/:id/restart', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    if (!deps.isModuleInstalled(id)) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    try {
      await deps.restartModule(id);
      return { success: true, message: 'Module restarted' };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restart module',
      };
    }
  });

  /**
   * POST /api/modules/install - Install a new module
   */
  fastify.post<{
    Body: InstallModuleRequest;
    Reply: InstallModuleResponse;
  }>('/api/modules/install', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { source, url, path, branch } = request.body;

    if (!source) {
      reply.code(400);
      return { success: false, error: 'Source is required (git or local)' };
    }

    if (source === 'git' && !url) {
      reply.code(400);
      return { success: false, error: 'URL is required for git installation' };
    }

    if (source === 'local' && !path) {
      reply.code(400);
      return { success: false, error: 'Path is required for local installation' };
    }

    try {
      const moduleId = await deps.installModule(source, url, path, branch);
      return { success: true, moduleId };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install module',
      };
    }
  });

  /**
   * DELETE /api/modules/:id - Uninstall a module
   */
  fastify.delete<{
    Params: { id: string };
    Reply: ModuleActionResponse;
  }>('/api/modules/:id', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    if (!deps.isModuleInstalled(id)) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    try {
      await deps.uninstallModule(id);
      return { success: true, message: 'Module uninstalled' };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to uninstall module',
      };
    }
  });

  /**
   * POST /api/modules/wled/test-action - Test a WLED action
   * Sends a test command directly to a WLED device
   */
  fastify.post<{
    Body: WledTestActionRequest & { host: string; port?: number };
    Reply: ModuleActionResponse;
  }>('/api/modules/wled/test-action', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { host, port = 80, actionType, presetId, effectId, color, color2, color3, brightness, speed, intensity } = request.body;

    if (!host) {
      reply.code(400);
      return { success: false, error: 'WLED host is required' };
    }

    if (!actionType) {
      reply.code(400);
      return { success: false, error: 'Action type is required' };
    }

    try {
      // Build WLED API request
      const wledUrl = `http://${host}:${port}/json/state`;
      let wledPayload: Record<string, unknown> = { on: true };

      switch (actionType) {
        case 'preset':
          wledPayload = { ps: presetId || 1 };
          break;
        case 'effect':
          wledPayload = {
            on: true,
            bri: brightness ?? 255,
            seg: [{
              fx: effectId ?? 0,
              sx: speed ?? 128,
              ix: intensity ?? 128,
              col: [
                color ? [color.r, color.g, color.b] : [255, 255, 255],
                color2 ? [color2.r, color2.g, color2.b] : [0, 0, 0],
                color3 ? [color3.r, color3.g, color3.b] : [0, 0, 0],
              ],
            }],
          };
          break;
        case 'solid':
          wledPayload = {
            on: true,
            bri: brightness ?? 255,
            seg: [{
              fx: 0, // Solid
              col: [
                color ? [color.r, color.g, color.b] : [255, 255, 255],
              ],
            }],
          };
          break;
        case 'off':
          wledPayload = { on: false };
          break;
      }

      // Send request to WLED
      const response = await fetch(wledUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wledPayload),
      });

      if (!response.ok) {
        throw new Error(`WLED responded with status ${response.status}`);
      }

      return { success: true, message: 'Test action sent successfully' };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test action',
      };
    }
  });

  /**
   * POST /api/modules/wled/test-connection - Test WLED connection
   */
  fastify.post<{
    Body: { host: string; port?: number };
    Reply: { success: boolean; info?: Record<string, unknown>; error?: string };
  }>('/api/modules/wled/test-connection', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { host, port = 80 } = request.body;

    if (!host) {
      reply.code(400);
      return { success: false, error: 'WLED host is required' };
    }

    try {
      const response = await fetch(`http://${host}:${port}/json/info`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`WLED responded with status ${response.status}`);
      }

      const info = await response.json() as Record<string, unknown>;
      return { success: true, info };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to WLED',
      };
    }
  });

  /**
   * POST /api/modules/wled/presets - Get available presets from WLED
   */
  fastify.post<{
    Body: { host: string; port?: number };
    Reply: {
      success: boolean;
      presets?: Array<{ id: number; name: string }>;
      error?: string
    };
  }>('/api/modules/wled/presets', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { host, port = 80 } = request.body;

    if (!host) {
      reply.code(400);
      return { success: false, error: 'WLED host is required' };
    }

    try {
      // Fetch presets from WLED
      const response = await fetch(`http://${host}:${port}/presets.json`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`WLED responded with status ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;

      // Parse WLED presets format
      // WLED returns presets as an object with numeric keys
      // Each preset has: n (name), on (state), bri (brightness), etc.
      const presets: Array<{ id: number; name: string }> = [];

      for (const [key, value] of Object.entries(data)) {
        const id = parseInt(key, 10);
        // Skip non-numeric keys and special entries (0 is usually empty)
        if (isNaN(id) || id === 0) continue;

        const preset = value as Record<string, unknown>;
        // WLED preset name is in 'n' field
        const name = typeof preset.n === 'string' ? preset.n : `Preset ${id}`;

        // Only include presets that have actual data (not just placeholders)
        if (preset.n || preset.on !== undefined || preset.bri !== undefined) {
          presets.push({ id, name });
        }
      }

      // Sort by ID
      presets.sort((a, b) => a.id - b.id);

      return { success: true, presets };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch presets from WLED',
      };
    }
  });

  /**
   * POST /api/modules/wled/effects - Get available effects from WLED
   */
  fastify.post<{
    Body: { host: string; port?: number };
    Reply: {
      success: boolean;
      effects?: Array<{ id: number; name: string }>;
      error?: string
    };
  }>('/api/modules/wled/effects', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { host, port = 80 } = request.body;

    if (!host) {
      reply.code(400);
      return { success: false, error: 'WLED host is required' };
    }

    try {
      // Fetch effects from WLED JSON API
      const response = await fetch(`http://${host}:${port}/json/effects`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`WLED responded with status ${response.status}`);
      }

      // WLED returns effects as an array of strings
      const effectNames = await response.json() as string[];

      const effects: Array<{ id: number; name: string }> = effectNames.map((name, id) => ({
        id,
        name,
      }));

      return { success: true, effects };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch effects from WLED',
      };
    }
  });

  /**
   * POST /api/modules/wled/palettes - Get available color palettes from WLED
   */
  fastify.post<{
    Body: { host: string; port?: number };
    Reply: {
      success: boolean;
      palettes?: Array<{ id: number; name: string }>;
      error?: string
    };
  }>('/api/modules/wled/palettes', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { host, port = 80 } = request.body;

    if (!host) {
      reply.code(400);
      return { success: false, error: 'WLED host is required' };
    }

    try {
      // Fetch palettes from WLED JSON API
      const response = await fetch(`http://${host}:${port}/json/palettes`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`WLED responded with status ${response.status}`);
      }

      // WLED returns palettes as an array of strings
      const paletteNames = await response.json() as string[];

      const palettes: Array<{ id: number; name: string }> = paletteNames.map((name, id) => ({
        id,
        name,
      }));

      return { success: true, palettes };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch palettes from WLED',
      };
    }
  });

  /**
   * GET /api/modules/:id/translations/:language - Get translated module manifest
   * Returns the module manifest with all fields translated to the requested language
   */
  fastify.get<{
    Params: { id: string; language: string };
    Reply: ModuleTranslationResponse;
  }>('/api/modules/:id/translations/:language', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id, language } = request.params;

    // Validate language
    const validLanguages: SupportedLanguage[] = ['en', 'de', 'es'];
    if (!validLanguages.includes(language as SupportedLanguage)) {
      reply.code(400);
      return { success: false, error: `Invalid language. Supported: ${validLanguages.join(', ')}` };
    }

    const manifest = deps.getModuleManifest(id);
    if (!manifest) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    const translatedManifest = getTranslatedManifest(manifest, language as SupportedLanguage);
    const strings = getModuleStrings(manifest, language as SupportedLanguage);
    const availableLanguages = getAvailableLanguages(manifest);

    return {
      success: true,
      manifest: translatedManifest,
      strings,
      availableLanguages,
    };
  });

  /**
   * GET /api/modules/:id/languages - Get available languages for a module
   */
  fastify.get<{
    Params: { id: string };
    Reply: { success: boolean; languages?: string[]; error?: string };
  }>('/api/modules/:id/languages', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    const manifest = deps.getModuleManifest(id);
    if (!manifest) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    const languages = getAvailableLanguages(manifest);

    return {
      success: true,
      languages,
    };
  });

  /**
   * GET /api/modules/:id/intents - Get module intent configuration
   * Returns available actions and default subscriptions for intent handling
   */
  fastify.get<{
    Params: { id: string };
    Reply: {
      success: boolean;
      actions?: Array<{
        type: string;
        label: string;
        description?: string;
        configSchema?: Record<string, unknown>;
      }>;
      defaultSubscriptions?: Array<{
        intentId: string;
        enabled: boolean;
        action: { type: string; config?: Record<string, unknown> };
      }>;
      error?: string;
    };
  }>('/api/modules/:id/intents', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    const manifest = deps.getModuleManifest(id);
    if (!manifest) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    // Get intent configuration from manifest
    const intents = manifest.intents;
    if (!intents) {
      return {
        success: true,
        actions: [],
        defaultSubscriptions: [],
      };
    }

    return {
      success: true,
      actions: intents.actions || [],
      defaultSubscriptions: intents.defaultSubscriptions || [],
    };
  });

  /**
   * GET /api/intents - Get all available intents from the system
   * Returns intents that modules have registered as emitting
   */
  fastify.get<{
    Reply: {
      success: boolean;
      intents?: Array<{
        id: string;
        description: string;
        category?: string;
        sourceModule?: string;
      }>;
      error?: string;
    };
  }>('/api/intents', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    // Collect all intents from all modules
    const allIntents: Array<{
      id: string;
      description: string;
      category?: string;
      sourceModule?: string;
    }> = [];

    // Get intents from all module manifests
    for (const module of deps.listModules()) {
      const manifest = deps.getModuleManifest(module.id);
      if (manifest?.intents?.emits) {
        for (const emit of manifest.intents.emits) {
          allIntents.push({
            id: emit.id,
            description: emit.description,
            category: emit.category,
            sourceModule: module.id,
          });
        }
      }
    }

    // Sort by category and then by id
    // NOTE: Only module-defined intents are returned. System events (180s, checkouts, etc.)
    // come from the Autodarts event stream and are NOT intents.
    allIntents.sort((a, b) => {
      const catA = a.category || 'Other';
      const catB = b.category || 'Other';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.id.localeCompare(b.id);
    });

    return {
      success: true,
      intents: allIntents,
    };
  });

  /**
   * GET /api/intents/available - Get all available intents with full schema
   * Returns complete intent definitions including payload schema
   */
  fastify.get<{
    Reply: {
      success: boolean;
      intents?: Array<{
        id: string;
        description: string;
        category?: string;
        sourceModule: string;
        sourceModuleName: string;
        payload?: Record<string, { type: string; description?: string }>;
      }>;
      error?: string;
    };
  }>('/api/intents/available', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    // Collect all intents from all modules with full schema
    const allIntents: Array<{
      id: string;
      description: string;
      category?: string;
      sourceModule: string;
      sourceModuleName: string;
      payload?: Record<string, { type: string; description?: string }>;
    }> = [];

    // Get intents from all module manifests
    for (const module of deps.listModules()) {
      const manifest = deps.getModuleManifest(module.id);
      if (manifest?.intents?.emits) {
        for (const emit of manifest.intents.emits) {
          allIntents.push({
            id: emit.id,
            description: emit.description,
            category: emit.category,
            sourceModule: module.id,
            sourceModuleName: manifest.name || module.id,
            payload: emit.payload,
          });
        }
      }
    }

    // Sort by category and then by id
    allIntents.sort((a, b) => {
      const catA = a.category || 'Other';
      const catB = b.category || 'Other';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.id.localeCompare(b.id);
    });

    return {
      success: true,
      intents: allIntents,
    };
  });

  /**
   * PUT /api/modules/:id/intents - Update module intent subscriptions
   * Stores the intent subscriptions in the module config
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      subscriptions: Array<{
        intentId: string;
        enabled: boolean;
        action: { type: string; config?: Record<string, unknown> };
      }>;
    };
    Reply: { success: boolean; error?: string };
  }>('/api/modules/:id/intents', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;
    const { subscriptions } = request.body;

    if (!deps.isModuleInstalled(id)) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    try {
      // Get current config and merge with intent subscriptions
      const currentConfig = deps.getModuleConfig(id) || {};
      const updatedConfig = {
        ...currentConfig,
        intentSubscriptions: subscriptions,
      };

      await deps.updateModuleConfig(id, updatedConfig);
      return { success: true };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update intent subscriptions',
      };
    }
  });

  /**
   * GET /api/modules/:id/intent-subscriptions - Get current intent subscriptions for a module
   * Returns the configured intent subscriptions from the module config
   */
  fastify.get<{
    Params: { id: string };
    Reply: {
      success: boolean;
      subscriptions?: Array<{
        intentId: string;
        enabled: boolean;
        action: { type: string; config?: Record<string, unknown> };
      }>;
      error?: string;
    };
  }>('/api/modules/:id/intent-subscriptions', async (request, reply) => {
    // Require authentication (if enabled)
    if (!isAuthorized(server, request.session)) {
      reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    const config = deps.getModuleConfig(id);
    if (config === null) {
      reply.code(404);
      return { success: false, error: 'Module not found' };
    }

    // Get subscriptions from config or use defaults from manifest
    let subscriptions = config.intentSubscriptions as Array<{
      intentId: string;
      enabled: boolean;
      action: { type: string; config?: Record<string, unknown> };
    }> | undefined;

    // If no subscriptions in config, use defaults from manifest
    if (!subscriptions) {
      const manifest = deps.getModuleManifest(id);
      subscriptions = manifest?.intents?.defaultSubscriptions || [];
    }

    return {
      success: true,
      subscriptions,
    };
  });
}
