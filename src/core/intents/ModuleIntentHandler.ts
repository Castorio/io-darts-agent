/**
 * Module Intent Handler
 *
 * Base class for handling intents in modules. Provides a standard way
 * for modules to react to intents with configurable actions.
 */

import type {
  Intent,
  IntentSubscriptionConfig,
  IntentActionConfig,
  ModuleIntentAction,
} from '../../types/intents.js';
import { getIntentBus, type IntentBus } from './IntentBus.js';

/**
 * Logger interface for intent handler
 */
export interface IntentHandlerLogger {
  log(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

/**
 * Action executor function type
 */
export type ActionExecutor = (
  intent: Intent,
  actionConfig: IntentActionConfig
) => Promise<void> | void;

/**
 * Module Intent Handler configuration
 */
export interface ModuleIntentHandlerConfig {
  /** Module ID */
  moduleId: string;
  /** Available actions from module.json */
  availableActions: ModuleIntentAction[];
  /** Default subscriptions from module.json */
  defaultSubscriptions: IntentSubscriptionConfig[];
  /** User-configured subscriptions (overrides defaults) */
  userSubscriptions?: IntentSubscriptionConfig[];
  /** Logger */
  logger?: IntentHandlerLogger;
}

/**
 * ModuleIntentHandler - handles intents for a module
 */
export class ModuleIntentHandler {
  private moduleId: string;
  private intentBus: IntentBus;
  private availableActions: Map<string, ModuleIntentAction>;
  private subscriptions: Map<string, IntentSubscriptionConfig>;
  private actionExecutors: Map<string, ActionExecutor>;
  private unsubscribeFunctions: Array<() => void> = [];
  private logger: IntentHandlerLogger | null;

  constructor(config: ModuleIntentHandlerConfig) {
    this.moduleId = config.moduleId;
    this.intentBus = getIntentBus();
    this.availableActions = new Map();
    this.subscriptions = new Map();
    this.actionExecutors = new Map();
    this.logger = config.logger ?? null;

    // Index available actions
    for (const action of config.availableActions) {
      this.availableActions.set(action.type, action);
    }

    // Merge default and user subscriptions
    this.mergeSubscriptions(config.defaultSubscriptions, config.userSubscriptions);
  }

  /**
   * Merge default and user subscriptions
   * User subscriptions override defaults
   */
  private mergeSubscriptions(
    defaults: IntentSubscriptionConfig[],
    userOverrides?: IntentSubscriptionConfig[]
  ): void {
    // Add defaults
    for (const sub of defaults) {
      this.subscriptions.set(sub.intentId, sub);
    }

    // Override with user settings
    if (userOverrides) {
      for (const sub of userOverrides) {
        this.subscriptions.set(sub.intentId, sub);
      }
    }
  }

  /**
   * Register an action executor
   */
  registerActionExecutor(actionType: string, executor: ActionExecutor): void {
    this.actionExecutors.set(actionType, executor);
    this.log(`Registered action executor: ${actionType}`);
  }

  /**
   * Start handling intents
   */
  start(): void {
    this.stop(); // Clear any existing subscriptions

    for (const [intentId, subscription] of this.subscriptions) {
      if (!subscription.enabled) {
        this.log(`Subscription disabled: ${intentId}`);
        continue;
      }

      const unsubscribe = this.intentBus.subscribe(
        this.moduleId,
        intentId,
        async (intent) => {
          await this.handleIntent(intent, subscription);
        }
      );

      this.unsubscribeFunctions.push(unsubscribe);
      this.log(`Subscribed to intent: ${intentId}`);
    }

    this.log(`Started with ${this.unsubscribeFunctions.length} active subscriptions`);
  }

  /**
   * Stop handling intents
   */
  stop(): void {
    for (const unsubscribe of this.unsubscribeFunctions) {
      unsubscribe();
    }
    this.unsubscribeFunctions = [];
    this.log('Stopped intent handling');
  }

  /**
   * Handle a single intent
   */
  private async handleIntent(
    intent: Intent,
    subscription: IntentSubscriptionConfig
  ): Promise<void> {
    const { action } = subscription;

    // Find the executor for this action type
    const executor = this.actionExecutors.get(action.type);
    if (!executor) {
      this.log(`No executor for action type: ${action.type}`);
      return;
    }

    try {
      this.log(`Executing action ${action.type} for intent ${intent.id}`);
      await executor(intent, action);
    } catch (error) {
      this.logger?.error(`Error executing action ${action.type}`, error);
    }
  }

  /**
   * Update subscriptions at runtime
   */
  updateSubscriptions(newSubscriptions: IntentSubscriptionConfig[]): void {
    // Stop current handling
    this.stop();

    // Clear and rebuild subscriptions
    this.subscriptions.clear();
    for (const sub of newSubscriptions) {
      this.subscriptions.set(sub.intentId, sub);
    }

    // Restart
    this.start();
  }

  /**
   * Get current subscriptions
   */
  getSubscriptions(): IntentSubscriptionConfig[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get available actions
   */
  getAvailableActions(): ModuleIntentAction[] {
    return Array.from(this.availableActions.values());
  }

  /**
   * Check if an action type is valid
   */
  isValidAction(actionType: string): boolean {
    return this.availableActions.has(actionType);
  }

  /**
   * Add or update a single subscription
   */
  setSubscription(subscription: IntentSubscriptionConfig): void {
    this.subscriptions.set(subscription.intentId, subscription);

    // Restart to apply changes
    if (this.unsubscribeFunctions.length > 0) {
      this.start();
    }
  }

  /**
   * Remove a subscription
   */
  removeSubscription(intentId: string): void {
    this.subscriptions.delete(intentId);

    // Restart to apply changes
    if (this.unsubscribeFunctions.length > 0) {
      this.start();
    }
  }

  /**
   * Enable or disable a subscription
   */
  setSubscriptionEnabled(intentId: string, enabled: boolean): void {
    const sub = this.subscriptions.get(intentId);
    if (sub) {
      sub.enabled = enabled;

      // Restart to apply changes
      if (this.unsubscribeFunctions.length > 0) {
        this.start();
      }
    }
  }

  /**
   * Log helper
   */
  private log(message: string, data?: unknown): void {
    this.logger?.log(`[IntentHandler:${this.moduleId}] ${message}`, data);
  }
}

/**
 * Create a module intent handler from module.json intents config
 */
export function createModuleIntentHandler(
  moduleId: string,
  intentsConfig: {
    actions?: ModuleIntentAction[];
    defaultSubscriptions?: IntentSubscriptionConfig[];
  },
  userSubscriptions?: IntentSubscriptionConfig[],
  logger?: IntentHandlerLogger
): ModuleIntentHandler {
  return new ModuleIntentHandler({
    moduleId,
    availableActions: intentsConfig.actions ?? [],
    defaultSubscriptions: intentsConfig.defaultSubscriptions ?? [],
    userSubscriptions,
    logger,
  });
}
