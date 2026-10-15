import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { ModuleBridge } from './ModuleBridge.js';
import { EventBus } from '../events/EventBus.js';
import { getModuleRouteRegistry } from './ModuleRouteRegistry.js';
import type {
  ModuleManifest,
  ModuleState,
  ModuleInfo,
  ModuleStatus,
  ModuleManagerOptions,
  SpawnOptions,
  ParsedEvent,
  AutodartsEventType,
  RoutesRegisterPayload,
} from '../../types/index.js';

const DEFAULT_OPTIONS: ModuleManagerOptions = {
  modulesDir: './modules',
  socketDir: process.env.TMPDIR || '/tmp',
  maxRestarts: 3,
  restartDelay: 5000,
  shutdownTimeout: 5000,
};

interface ManagedModule {
  manifest: ModuleManifest;
  state: ModuleState;
  config: Record<string, unknown>;
  bridge: ModuleBridge;
  process: ChildProcess | null;
  path: string;
}

/**
 * ModuleManager - Manages module lifecycle (spawn, kill, restart)
 *
 * Responsibilities:
 * - Load module manifests
 * - Spawn module processes
 * - Manage IPC bridges
 * - Handle module crashes/restarts
 * - Route events to subscribed modules
 */
export class ModuleManager extends EventEmitter {
  private options: ModuleManagerOptions;
  private modules = new Map<string, ManagedModule>();
  private eventBus: EventBus;
  private eventSubscriptions = new Map<string, ReturnType<EventBus['on']>>();

  constructor(eventBus: EventBus, options: Partial<ModuleManagerOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.eventBus = eventBus;
  }

  /**
   * Discover and load all modules from the modules directory
   */
  async discoverModules(): Promise<ModuleManifest[]> {
    const manifests: ModuleManifest[] = [];

    try {
      await fs.access(this.options.modulesDir);
    } catch {
      // Modules directory doesn't exist, create it
      await fs.mkdir(this.options.modulesDir, { recursive: true });
      return manifests;
    }

    const entries = await fs.readdir(this.options.modulesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const modulePath = path.join(this.options.modulesDir, entry.name);
      const manifestPath = path.join(modulePath, 'module.json');

      try {
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestData) as ModuleManifest;

        if (this.validateManifest(manifest)) {
          manifests.push(manifest);

          // Register module if not already registered
          if (!this.modules.has(manifest.id)) {
            await this.registerModule(manifest, modulePath);
          }
        }
      } catch (err) {
        console.error(`Failed to load module at ${modulePath}:`, err);
      }
    }

    return manifests;
  }

  /**
   * Register a module (without starting it)
   */
  async registerModule(
    manifest: ModuleManifest,
    modulePath: string,
    config: Record<string, unknown> = {}
  ): Promise<void> {
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module ${manifest.id} is already registered`);
    }

    const socketPath = path.join(this.options.socketDir, `autodarts-hub-${manifest.id}.sock`);
    const bridge = new ModuleBridge(manifest.id, { socketPath });

    // Setup bridge event handlers
    this.setupBridgeHandlers(manifest.id, bridge);

    const managed: ManagedModule = {
      manifest,
      state: {
        id: manifest.id,
        status: 'stopped',
        restartCount: 0,
      },
      config: this.mergeWithDefaults(manifest.config, config),
      bridge,
      process: null,
      path: modulePath,
    };

    this.modules.set(manifest.id, managed);
    this.emit('moduleRegistered', manifest.id);
  }

  /**
   * Unregister a module
   */
  async unregisterModule(moduleId: string): Promise<void> {
    const managed = this.modules.get(moduleId);
    if (!managed) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // Stop if running
    if (managed.state.status === 'running') {
      await this.stopModule(moduleId);
    }

    // Remove event subscription
    this.eventSubscriptions.get(moduleId)?.unsubscribe();
    this.eventSubscriptions.delete(moduleId);

    // Unregister module routes
    const routeRegistry = getModuleRouteRegistry();
    await routeRegistry.unregisterRoutes(moduleId);

    this.modules.delete(moduleId);
    this.emit('moduleUnregistered', moduleId);
  }

  /**
   * Start a module
   */
  async startModule(moduleId: string, options: SpawnOptions = {}): Promise<void> {
    const managed = this.modules.get(moduleId);
    if (!managed) {
      throw new Error(`Module ${moduleId} not found`);
    }

    if (managed.state.status === 'running') {
      throw new Error(`Module ${moduleId} is already running`);
    }

    this.setModuleStatus(moduleId, 'starting');

    try {
      // Start the bridge first
      await managed.bridge.start();

      // Spawn the process
      const proc = await this.spawnProcess(managed, options);
      managed.process = proc;

      // Wait for ready signal
      await this.waitForReady(managed);

      // Send init message
      managed.bridge.sendInit(managed.config, managed.manifest.events);

      // Subscribe to events
      this.subscribeToEvents(managed);

      this.setModuleStatus(moduleId, 'running');
      managed.state.startedAt = new Date();

      this.emit('moduleStarted', moduleId);
    } catch (err) {
      this.setModuleStatus(moduleId, 'error', (err as Error).message);
      await this.cleanup(managed);
      throw err;
    }
  }

  /**
   * Stop a module gracefully
   */
  async stopModule(moduleId: string): Promise<void> {
    const managed = this.modules.get(moduleId);
    if (!managed) {
      throw new Error(`Module ${moduleId} not found`);
    }

    if (managed.state.status !== 'running') {
      return;
    }

    this.setModuleStatus(moduleId, 'stopping');

    try {
      // Unsubscribe from events
      this.eventSubscriptions.get(moduleId)?.unsubscribe();
      this.eventSubscriptions.delete(moduleId);

      // Send shutdown signal
      managed.bridge.sendShutdown('user', this.options.shutdownTimeout);

      // Wait for process to exit
      await this.waitForExit(managed, this.options.shutdownTimeout);
    } catch {
      // Force kill if graceful shutdown fails
      this.killProcess(managed);
    }

    await this.cleanup(managed);
    this.setModuleStatus(moduleId, 'stopped');
    managed.state.stoppedAt = new Date();

    this.emit('moduleStopped', moduleId);
  }

  /**
   * Restart a module
   */
  async restartModule(moduleId: string): Promise<void> {
    await this.stopModule(moduleId);
    await this.startModule(moduleId);
  }

  /**
   * Get module info
   */
  getModule(moduleId: string): ModuleInfo | undefined {
    const managed = this.modules.get(moduleId);
    if (!managed) return undefined;

    return {
      manifest: managed.manifest,
      state: { ...managed.state },
      config: { ...managed.config },
      path: managed.path,
      installed: true,
    };
  }

  /**
   * Get all modules
   */
  getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values()).map((managed) => ({
      manifest: managed.manifest,
      state: { ...managed.state },
      config: { ...managed.config },
      path: managed.path,
      installed: true,
    }));
  }

  /**
   * Get running modules
   */
  getRunningModules(): ModuleInfo[] {
    return this.getAllModules().filter((m) => m.state.status === 'running');
  }

  /**
   * Update module config
   */
  async updateModuleConfig(moduleId: string, config: Partial<Record<string, unknown>>): Promise<void> {
    const managed = this.modules.get(moduleId);
    if (!managed) {
      throw new Error(`Module ${moduleId} not found`);
    }

    const changedKeys = Object.keys(config);
    managed.config = { ...managed.config, ...config };

    // If running, send config update
    if (managed.state.status === 'running') {
      managed.bridge.sendConfigUpdate(managed.config, changedKeys);
    }

    this.emit('moduleConfigUpdated', moduleId, changedKeys);
  }

  /**
   * Stop all modules
   */
  async stopAll(): Promise<void> {
    const running = this.getRunningModules();
    await Promise.all(running.map((m) => this.stopModule(m.manifest.id)));
  }

  /**
   * Spawn the module process
   */
  private async spawnProcess(managed: ManagedModule, options: SpawnOptions = {}): Promise<ChildProcess> {
    const entryPath = path.join(managed.path, managed.manifest.entry);

    const env = {
      ...process.env,
      ...options.env,
      AUTODARTS_MODULE_ID: managed.manifest.id,
      AUTODARTS_SOCKET_PATH: managed.bridge.getSocketPath(),
    };

    const proc = spawn(process.execPath, [entryPath], {
      cwd: options.cwd || managed.path,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Handle stdout/stderr
    proc.stdout?.on('data', (data: Buffer) => {
      this.emit('moduleStdout', managed.manifest.id, data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      this.emit('moduleStderr', managed.manifest.id, data.toString());
    });

    // Handle process exit
    proc.on('exit', (code, signal) => {
      this.handleProcessExit(managed, code, signal);
    });

    proc.on('error', (err) => {
      this.emit('moduleError', managed.manifest.id, err);
    });

    return proc;
  }

  /**
   * Wait for module to send ready signal
   */
  private waitForReady(managed: ManagedModule, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Module startup timeout'));
      }, timeout);

      managed.bridge.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });

      managed.bridge.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Wait for process to exit
   */
  private waitForExit(managed: ManagedModule, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!managed.process) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('Shutdown timeout'));
      }, timeout);

      managed.process.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Kill process forcefully
   */
  private killProcess(managed: ManagedModule): void {
    if (managed.process && !managed.process.killed) {
      managed.process.kill('SIGKILL');
    }
  }

  /**
   * Cleanup after module stop
   */
  private async cleanup(managed: ManagedModule): Promise<void> {
    await managed.bridge.stop();
    managed.process = null;
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(managed: ManagedModule, code: number | null, signal: NodeJS.Signals | null): void {
    const wasRunning = managed.state.status === 'running';

    if (wasRunning) {
      // Unexpected exit - handle crash
      this.setModuleStatus(managed.manifest.id, 'crashed', `Exit code: ${code}, signal: ${signal}`);
      this.emit('moduleCrashed', managed.manifest.id, { code, signal });

      // Attempt restart if under limit
      if (managed.state.restartCount < this.options.maxRestarts) {
        managed.state.restartCount++;
        this.emit('moduleRestarting', managed.manifest.id, managed.state.restartCount);

        setTimeout(async () => {
          try {
            await this.cleanup(managed);
            await this.startModule(managed.manifest.id);
          } catch (err) {
            console.error(`Failed to restart module ${managed.manifest.id}:`, err);
          }
        }, this.options.restartDelay);
      } else {
        this.emit('moduleMaxRestartsReached', managed.manifest.id);
      }
    }
  }

  /**
   * Subscribe to events for a module
   */
  private subscribeToEvents(managed: ManagedModule): void {
    // Unsubscribe first if already subscribed
    this.eventSubscriptions.get(managed.manifest.id)?.unsubscribe();

    const subscription = this.eventBus.on('*', (event: ParsedEvent) => {
      // DEBUG: Log all events for module routing
      console.log(`[ModuleManager] Event received for routing: ${event.type}`);

      // Check if module is interested in this event
      if (
        managed.manifest.events.includes(event.type) ||
        managed.manifest.events.includes('*' as AutodartsEventType)
      ) {
        console.log(`[ModuleManager] ✅ Sending event "${event.type}" to module "${managed.manifest.id}"`);
        const sent = managed.bridge.sendEvent(event);
        console.log(`[ModuleManager] Event sent result: ${sent}`);
      } else {
        console.log(`[ModuleManager] ⏭️ Module "${managed.manifest.id}" not subscribed to "${event.type}"`);
      }
    });

    this.eventSubscriptions.set(managed.manifest.id, subscription);
  }

  /**
   * Setup bridge event handlers
   */
  private setupBridgeHandlers(moduleId: string, bridge: ModuleBridge): void {
    bridge.on('log', (data) => {
      this.emit('moduleLog', moduleId, data);
    });

    bridge.on('moduleError', (data) => {
      this.emit('moduleError', moduleId, data);
    });

    bridge.on('fatalError', (data) => {
      this.emit('moduleFatalError', moduleId, data);
    });

    bridge.on('status', (data) => {
      this.emit('moduleStatus', moduleId, data);
    });

    bridge.on('disconnected', () => {
      // Module disconnected unexpectedly
      const managed = this.modules.get(moduleId);
      if (managed && managed.state.status === 'running') {
        this.handleProcessExit(managed, null, null);
      }
    });

    // Handle module route registration
    bridge.on('routesRegister', async (payload: RoutesRegisterPayload) => {
      try {
        const routeRegistry = getModuleRouteRegistry();

        // Set up the route handler to forward requests to the module
        routeRegistry.setRouteHandler(moduleId, async (request) => {
          return bridge.sendRouteRequest(request);
        });

        // Register the routes
        await routeRegistry.registerRoutes({
          moduleId,
          routes: payload.routes,
        });

        this.emit('moduleRoutesRegistered', moduleId, payload.routes);
      } catch (error) {
        console.error(`Failed to register routes for module ${moduleId}:`, error);
        this.emit('moduleError', moduleId, {
          code: 'ROUTE_REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          fatal: false,
        });
      }
    });
  }

  /**
   * Set module status
   */
  private setModuleStatus(moduleId: string, status: ModuleStatus, error?: string): void {
    const managed = this.modules.get(moduleId);
    if (!managed) return;

    managed.state.status = status;
    managed.state.lastError = error;

    this.emit('moduleStatusChange', moduleId, status, error);
  }

  /**
   * Validate module manifest
   */
  private validateManifest(manifest: unknown): manifest is ModuleManifest {
    if (typeof manifest !== 'object' || manifest === null) return false;

    const m = manifest as Record<string, unknown>;
    return (
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      typeof m.version === 'string' &&
      typeof m.entry === 'string' &&
      Array.isArray(m.events)
    );
  }

  /**
   * Merge config with defaults from manifest
   * Supports nested 'group' type fields with their own 'fields' definitions
   */
  private mergeWithDefaults(
    schema: ModuleManifest['config'],
    config: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (schema) {
      for (const [key, field] of Object.entries(schema)) {
        // Handle group type with nested fields
        if (field.type === 'group' && field.fields) {
          const groupConfig = (config[key] as Record<string, unknown>) || {};
          const groupResult: Record<string, unknown> = {};

          // Merge each field in the group with its default
          for (const [fieldKey, fieldDef] of Object.entries(field.fields as Record<string, { default?: unknown }>)) {
            groupResult[fieldKey] = groupConfig[fieldKey] ?? fieldDef.default;
          }

          result[key] = groupResult;
        } else {
          result[key] = config[key] ?? field.default;
        }
      }
    }

    // Add any extra config values
    for (const [key, value] of Object.entries(config)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }

    return result;
  }
}
