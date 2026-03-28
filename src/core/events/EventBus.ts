import type {
  AutodartsEventType,
  ParsedEvent,
  EventHandler,
  EventSubscription,
} from '../../types/index.js';

type ListenerMap = Map<AutodartsEventType | '*', Set<EventHandler>>;

export class EventBus {
  private listeners: ListenerMap = new Map();

  /**
   * Subscribe to a specific event type or all events ('*')
   */
  on<T = unknown>(
    eventType: AutodartsEventType | '*',
    handler: EventHandler<T>
  ): EventSubscription {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const handlers = this.listeners.get(eventType)!;
    handlers.add(handler as EventHandler);

    return {
      unsubscribe: (): void => {
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
          this.listeners.delete(eventType);
        }
      },
    };
  }

  /**
   * Subscribe to an event once, then auto-unsubscribe
   */
  once<T = unknown>(
    eventType: AutodartsEventType | '*',
    handler: EventHandler<T>
  ): EventSubscription {
    const subscription = this.on<T>(eventType, (event) => {
      subscription.unsubscribe();
      return handler(event as ParsedEvent<T>);
    });

    return subscription;
  }

  /**
   * Emit an event to all subscribed handlers
   */
  async emit<T = unknown>(event: ParsedEvent<T>): Promise<void> {
    const handlers: EventHandler[] = [];

    // Get specific event type handlers
    const specificHandlers = this.listeners.get(event.type);
    if (specificHandlers) {
      handlers.push(...specificHandlers);
    }

    // Get wildcard handlers
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      handlers.push(...wildcardHandlers);
    }

    // Execute all handlers (in parallel for async handlers)
    const promises = handlers.map((handler) => {
      try {
        const result = handler(event as ParsedEvent);
        if (result instanceof Promise) {
          return result.catch((err) => {
            console.error(`EventBus handler error for ${event.type}:`, err);
          });
        }
        return Promise.resolve();
      } catch (err) {
        console.error(`EventBus handler error for ${event.type}:`, err);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all handlers for a specific event type
   */
  off(eventType: AutodartsEventType | '*'): void {
    this.listeners.delete(eventType);
  }

  /**
   * Remove all handlers
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of handlers for a specific event type (or all if '*')
   */
  listenerCount(eventType?: AutodartsEventType | '*'): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size ?? 0;
    }

    let count = 0;
    for (const handlers of this.listeners.values()) {
      count += handlers.size;
    }
    return count;
  }

  /**
   * Get all registered event types
   */
  eventTypes(): (AutodartsEventType | '*')[] {
    return Array.from(this.listeners.keys());
  }
}

// Singleton instance for global use
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clear();
    globalEventBus = null;
  }
}
