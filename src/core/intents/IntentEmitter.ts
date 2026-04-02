/**
 * IntentEmitter - Provides a simple interface for modules to emit intents
 *
 * Each module that declares `intents.emits` in its module.json receives
 * an IntentEmitter instance that allows it to emit only the intents it
 * has declared.
 */

import type { IntentBus } from './IntentBus.js';
import type { IntentEmitDefinition } from '../../types/intents.js';

/**
 * IntentEmitter configuration
 */
export interface IntentEmitterConfig {
  /** Module ID */
  moduleId: string;
  /** Intent definitions this module can emit */
  emits: IntentEmitDefinition[];
  /** Reference to the IntentBus */
  intentBus: IntentBus;
  /** Enable validation of emitted intents */
  validatePayload?: boolean;
}

/**
 * IntentEmitter - Scoped intent emitter for a module
 */
export class IntentEmitter {
  private moduleId: string;
  private emits: Map<string, IntentEmitDefinition>;
  private intentBus: IntentBus;
  private validatePayload: boolean;

  constructor(config: IntentEmitterConfig) {
    this.moduleId = config.moduleId;
    this.intentBus = config.intentBus;
    this.validatePayload = config.validatePayload ?? true;

    // Index emittable intents by ID for quick lookup
    this.emits = new Map();
    for (const def of config.emits) {
      this.emits.set(def.id, def);
    }
  }

  /**
   * Get the module ID
   */
  getModuleId(): string {
    return this.moduleId;
  }

  /**
   * Get list of intents this emitter can emit
   */
  getEmittableIntents(): IntentEmitDefinition[] {
    return Array.from(this.emits.values());
  }

  /**
   * Check if this emitter can emit a specific intent
   */
  canEmit(intentId: string): boolean {
    return this.emits.has(intentId);
  }

  /**
   * Emit an intent
   *
   * @param intentId - The intent ID (must be in this module's `emits` list)
   * @param payload - The intent payload
   * @param correlationId - Optional correlation ID for tracking related intents
   * @throws Error if the intent is not in the module's emits list
   */
  async emit(
    intentId: string,
    payload: Record<string, unknown> = {},
    correlationId?: string
  ): Promise<void> {
    // Validate that this module can emit this intent
    const intentDef = this.emits.get(intentId);
    if (!intentDef) {
      throw new Error(
        `Module ${this.moduleId} is not allowed to emit intent '${intentId}'. ` +
          `Allowed intents: ${Array.from(this.emits.keys()).join(', ')}`
      );
    }

    // Optionally validate payload against schema
    if (this.validatePayload && intentDef.payload) {
      this.validatePayloadSchema(intentId, payload, intentDef.payload);
    }

    // Emit via IntentBus
    await this.intentBus.emit(this.moduleId, intentId, payload, correlationId);
  }

  /**
   * Emit multiple intents in sequence
   */
  async emitMany(
    intents: Array<{ intentId: string; payload?: Record<string, unknown> }>,
    correlationId?: string
  ): Promise<void> {
    for (const { intentId, payload } of intents) {
      await this.emit(intentId, payload || {}, correlationId);
    }
  }

  /**
   * Validate payload against intent schema
   * Schema is Record<string, IntentPayloadField> where key is field name
   */
  private validatePayloadSchema(
    intentId: string,
    payload: Record<string, unknown>,
    schema: IntentEmitDefinition['payload']
  ): void {
    if (!schema) return;

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const value = payload[fieldName];

      // Check required fields (optional is the inverse of required)
      const isRequired = !fieldDef.optional;
      if (isRequired && value === undefined) {
        throw new Error(
          `Intent ${intentId}: Missing required field '${fieldName}'`
        );
      }

      // Check type if value is present
      if (value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== fieldDef.type) {
          throw new Error(
            `Intent ${intentId}: Field '${fieldName}' expected type '${fieldDef.type}', got '${actualType}'`
          );
        }
      }
    }
  }
}

/**
 * Create an IntentEmitter for a module
 */
export function createIntentEmitter(config: IntentEmitterConfig): IntentEmitter {
  return new IntentEmitter(config);
}

/**
 * Factory function to create emitters from module manifests
 */
export function createEmitterFromManifest(
  moduleId: string,
  manifest: { intents?: { emits?: IntentEmitDefinition[] } },
  intentBus: IntentBus
): IntentEmitter | null {
  if (!manifest.intents?.emits || manifest.intents.emits.length === 0) {
    return null;
  }

  return createIntentEmitter({
    moduleId,
    emits: manifest.intents.emits,
    intentBus,
  });
}
