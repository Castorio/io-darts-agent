/**
 * Intent Bus - Central routing system for module intents
 *
 * The IntentBus enables loose coupling between modules by allowing them to
 * emit semantic intents that other modules can handle based on their configuration.
 */

import type {
  Intent,
  IntentHandler,
  RegisteredIntentHandler,
  IntentEmitDefinition,
  IntentHandleDefinition,
  IntentSubscriptionOptions,
  RegisteredIntent,
} from '../../types/intents.js';

/**
 * Logger interface for IntentBus
 */
export interface IntentBusLogger {
  log(source: string, message: string, data?: unknown): void;
}

/**
 * IntentBus configuration
 */
export interface IntentBusConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum handlers per intent */
  maxHandlersPerIntent?: number;
}

/**
 * IntentBus - Routes intents between modules
 */
export class IntentBus {
  private config: IntentBusConfig;
  private logger: IntentBusLogger | null = null;

  // Registry of available intents (from module definitions)
  private intentRegistry = new Map<string, RegisteredIntent>();

  // Registered handlers by intent pattern
  private handlers = new Map<string, RegisteredIntentHandler[]>();

  // Wildcard handlers (e.g., "player.achievement.*")
  private wildcardHandlers: RegisteredIntentHandler[] = [];

  // Global handlers that receive all intents
  private globalHandlers: IntentHandler[] = [];

  // Statistics
  private stats = {
    intentsEmitted: 0,
    intentsHandled: 0,
    handlerErrors: 0,
  };

  constructor(config: IntentBusConfig = {}) {
    this.config = {
      debug: false,
      maxHandlersPerIntent: 50,
      ...config,
    };
  }

  /**
   * Set logger
   */
  setLogger(logger: IntentBusLogger | null): void {
    this.logger = logger;
  }

  /**
   * Log a message
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      if (this.logger) {
        this.logger.log('intent-bus', message, data);
      } else {
        console.log(`[IntentBus] ${message}`, data || '');
      }
    }
  }

  // ============================================================================
  // Intent Registration
  // ============================================================================

  /**
   * Register intent definitions from a module
   */
  registerIntents(moduleId: string, definitions: IntentEmitDefinition[]): void {
    for (const def of definitions) {
      this.intentRegistry.set(def.id, {
        definition: def,
        sourceModule: moduleId,
      });
      this.log(`Registered intent: ${def.id} from ${moduleId}`);
    }
  }

  /**
   * Unregister all intents from a module
   */
  unregisterIntents(moduleId: string): void {
    for (const [intentId, registered] of this.intentRegistry.entries()) {
      if (registered.sourceModule === moduleId) {
        this.intentRegistry.delete(intentId);
        this.log(`Unregistered intent: ${intentId}`);
      }
    }
  }

  /**
   * Get all registered intents
   */
  getRegisteredIntents(): Map<string, RegisteredIntent> {
    return new Map(this.intentRegistry);
  }

  /**
   * Get intents by category
   */
  getIntentsByCategory(category: string): RegisteredIntent[] {
    const results: RegisteredIntent[] = [];
    for (const registered of this.intentRegistry.values()) {
      if (registered.definition.category === category ||
          registered.definition.id.startsWith(category + '.')) {
        results.push(registered);
      }
    }
    return results;
  }

  // ============================================================================
  // Handler Registration
  // ============================================================================

  /**
   * Register a handler for an intent pattern
   */
  subscribe(
    moduleId: string,
    intentPattern: string,
    handler: IntentHandler,
    options: IntentSubscriptionOptions = {}
  ): () => void {
    const registration: RegisteredIntentHandler = {
      moduleId,
      intentPattern,
      handler,
      config: options.config,
      priority: options.priority ?? 0,
    };

    // Check if this is a wildcard pattern
    if (intentPattern.includes('*')) {
      this.wildcardHandlers.push(registration);
      this.wildcardHandlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.log(`Registered wildcard handler: ${intentPattern} for ${moduleId}`);
    } else {
      // Exact match handler
      const handlers = this.handlers.get(intentPattern) ?? [];
      handlers.push(registration);
      handlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      this.handlers.set(intentPattern, handlers);
      this.log(`Registered handler: ${intentPattern} for ${moduleId}`);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(moduleId, intentPattern);
    };
  }

  /**
   * Register handlers from module definition
   */
  registerHandlers(
    moduleId: string,
    definitions: IntentHandleDefinition[],
    createHandler: (def: IntentHandleDefinition) => IntentHandler
  ): void {
    for (const def of definitions) {
      const handler = createHandler(def);
      this.subscribe(moduleId, def.id, handler, {
        config: def.defaultConfig,
      });
    }
  }

  /**
   * Unsubscribe a handler
   */
  unsubscribe(moduleId: string, intentPattern: string): void {
    if (intentPattern.includes('*')) {
      this.wildcardHandlers = this.wildcardHandlers.filter(
        (h) => !(h.moduleId === moduleId && h.intentPattern === intentPattern)
      );
    } else {
      const handlers = this.handlers.get(intentPattern);
      if (handlers) {
        const filtered = handlers.filter(
          (h) => !(h.moduleId === moduleId && h.intentPattern === intentPattern)
        );
        if (filtered.length > 0) {
          this.handlers.set(intentPattern, filtered);
        } else {
          this.handlers.delete(intentPattern);
        }
      }
    }
    this.log(`Unsubscribed: ${intentPattern} for ${moduleId}`);
  }

  /**
   * Unsubscribe all handlers for a module
   */
  unsubscribeAll(moduleId: string): void {
    // Remove from exact handlers
    for (const [pattern, handlers] of this.handlers.entries()) {
      const filtered = handlers.filter((h) => h.moduleId !== moduleId);
      if (filtered.length > 0) {
        this.handlers.set(pattern, filtered);
      } else {
        this.handlers.delete(pattern);
      }
    }

    // Remove from wildcard handlers
    this.wildcardHandlers = this.wildcardHandlers.filter(
      (h) => h.moduleId !== moduleId
    );

    this.log(`Unsubscribed all handlers for: ${moduleId}`);
  }

  /**
   * Subscribe to all intents (for debugging/logging)
   */
  subscribeGlobal(handler: IntentHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== handler);
    };
  }

  // ============================================================================
  // Intent Emission
  // ============================================================================

  /**
   * Emit an intent
   */
  async emit(
    sourceModule: string,
    intentId: string,
    payload: Record<string, unknown> = {},
    correlationId?: string
  ): Promise<void> {
    const intent: Intent = {
      id: intentId,
      source: sourceModule,
      payload,
      timestamp: Date.now(),
      correlationId,
    };

    this.stats.intentsEmitted++;
    this.log(`Emitting intent: ${intentId}`, { source: sourceModule, payload });

    // Collect all matching handlers
    const matchingHandlers: RegisteredIntentHandler[] = [];

    // 1. Exact match handlers
    const exactHandlers = this.handlers.get(intentId) ?? [];
    matchingHandlers.push(...exactHandlers);

    // 2. Wildcard handlers
    for (const handler of this.wildcardHandlers) {
      if (this.matchesPattern(intentId, handler.intentPattern)) {
        matchingHandlers.push(handler);
      }
    }

    // Sort by priority
    matchingHandlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Execute handlers
    for (const handler of matchingHandlers) {
      try {
        await handler.handler(intent);
        this.stats.intentsHandled++;
      } catch (error) {
        this.stats.handlerErrors++;
        console.error(`Intent handler error [${handler.moduleId}]:`, error);
        this.log(`Handler error: ${handler.moduleId}`, { error, intentId });
      }
    }

    // Execute global handlers
    for (const handler of this.globalHandlers) {
      try {
        await handler(intent);
      } catch (error) {
        console.error('Global intent handler error:', error);
      }
    }
  }

  /**
   * Check if an intent ID matches a pattern (supports wildcards)
   */
  private matchesPattern(intentId: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return intentId.startsWith(prefix + '.');
    }

    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return intentId.startsWith(prefix);
    }

    return intentId === pattern;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Get statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get all handlers for an intent
   */
  getHandlersForIntent(intentId: string): RegisteredIntentHandler[] {
    const handlers: RegisteredIntentHandler[] = [];

    // Exact handlers
    const exact = this.handlers.get(intentId);
    if (exact) {
      handlers.push(...exact);
    }

    // Wildcard handlers
    for (const handler of this.wildcardHandlers) {
      if (this.matchesPattern(intentId, handler.intentPattern)) {
        handlers.push(handler);
      }
    }

    return handlers;
  }

  /**
   * Check if any handlers exist for an intent
   */
  hasHandlers(intentId: string): boolean {
    return this.getHandlersForIntent(intentId).length > 0;
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.intentRegistry.clear();
    this.handlers.clear();
    this.wildcardHandlers = [];
    this.globalHandlers = [];
    this.stats = {
      intentsEmitted: 0,
      intentsHandled: 0,
      handlerErrors: 0,
    };
  }
}

// Singleton instance
let intentBusInstance: IntentBus | null = null;

/**
 * Get or create the IntentBus singleton
 */
export function getIntentBus(config?: IntentBusConfig): IntentBus {
  if (!intentBusInstance) {
    intentBusInstance = new IntentBus(config);
  }
  return intentBusInstance;
}

/**
 * Create a new IntentBus instance (for testing)
 */
export function createIntentBus(config?: IntentBusConfig): IntentBus {
  return new IntentBus(config);
}
