/**
 * EventSystem - Centralized event management for the Hub
 *
 * Manages:
 * - Event subscribers for WebSocket
 * - Log entries with circular buffer
 * - Module status subscribers
 * - Voice pack progress subscribers
 * - Caller request subscribers
 * - Intent subscribers
 */

import type { ParsedEvent, ModuleStatus, Intent } from '../../types/index.js';
import type { GenerationProgress } from '../modules/handlers/index.js';

// Log entry type (also defined in websocket.ts - keeping in sync)
export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'event' | 'module' | 'system';
  source: string;
  message: string;
  data?: unknown;
}

// Caller type options
export type CallerType = 'tts' | 'audio' | 'elevenlabs' | 'voicepack';

// Caller request type - unified to support all call types
export interface CallRequest {
  id: string;
  type: 'score' | 'checkout' | 'bust' | 'winner' | 'player_turn' | 'game_on' | 'match_on' | 'game_shot' | 'remaining' | 'player' | 'game' | 'special';
  text: string;
  score?: number;
  playerName?: string;
  remaining?: number;
  audioUrl?: string;
  audioFile?: string;
  priority: number;
  timestamp: number;
  callerType?: CallerType;
  /** Browser TTS parameters (only for callerType 'tts') */
  tts?: {
    voice: string;
    rate: number;
    pitch: number;
    volume: number;
    lang: string;
  };
}

export interface EventSystemOptions {
  maxLogEntries?: number;
  debug?: boolean;
}

export class EventSystem {
  private eventSubscribers = new Set<(event: ParsedEvent) => void>();
  private moduleStatusSubscribers = new Set<(moduleId: string, status: ModuleStatus) => void>();
  private voicePackProgressSubscribers = new Set<(progress: GenerationProgress) => void>();
  private callerRequestSubscribers = new Set<(request: CallRequest) => void>();
  private intentSubscribers = new Set<(intent: Intent) => void>();
  private logSubscribers = new Set<(entry: LogEntry) => void>();

  private logEntries: LogEntry[] = [];
  private readonly maxLogEntries: number;
  private readonly debug: boolean;

  constructor(options: EventSystemOptions = {}) {
    this.maxLogEntries = options.maxLogEntries ?? 500;
    this.debug = options.debug ?? false;
  }

  // ============================================
  // Logging
  // ============================================

  addLog(type: LogEntry['type'], source: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      type,
      source,
      message,
      data,
    };

    this.logEntries.push(entry);
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries.shift();
    }

    // Notify subscribers
    for (const subscriber of this.logSubscribers) {
      subscriber(entry);
    }

    if (this.debug) {
      console.log(`[${type}] ${source}: ${message}`);
    }
  }

  getLogHistory(): LogEntry[] {
    return [...this.logEntries];
  }

  subscribeToLogs(handler: (entry: LogEntry) => void): () => void {
    this.logSubscribers.add(handler);
    return () => this.logSubscribers.delete(handler);
  }

  // ============================================
  // Event Subscribers
  // ============================================

  subscribeToEvents(handler: (event: ParsedEvent) => void): () => void {
    this.eventSubscribers.add(handler);
    return () => this.eventSubscribers.delete(handler);
  }

  emitEvent(event: ParsedEvent): void {
    for (const subscriber of this.eventSubscribers) {
      subscriber(event);
    }
  }

  getEventSubscribers(): Set<(event: ParsedEvent) => void> {
    return this.eventSubscribers;
  }

  // ============================================
  // Module Status Subscribers
  // ============================================

  subscribeToModuleStatus(handler: (moduleId: string, status: ModuleStatus) => void): () => void {
    this.moduleStatusSubscribers.add(handler);
    return () => this.moduleStatusSubscribers.delete(handler);
  }

  emitModuleStatus(moduleId: string, status: ModuleStatus): void {
    for (const subscriber of this.moduleStatusSubscribers) {
      subscriber(moduleId, status);
    }
  }

  // ============================================
  // Voice Pack Progress Subscribers
  // ============================================

  subscribeToVoicePackProgress(handler: (progress: GenerationProgress) => void): () => void {
    this.voicePackProgressSubscribers.add(handler);
    return () => this.voicePackProgressSubscribers.delete(handler);
  }

  emitVoicePackProgress(progress: GenerationProgress): void {
    for (const subscriber of this.voicePackProgressSubscribers) {
      subscriber(progress);
    }
  }

  // ============================================
  // Caller Request Subscribers
  // ============================================

  subscribeToCallerRequests(handler: (request: CallRequest) => void): () => void {
    this.callerRequestSubscribers.add(handler);
    return () => this.callerRequestSubscribers.delete(handler);
  }

  emitCallerRequest(request: CallRequest): void {
    for (const subscriber of this.callerRequestSubscribers) {
      subscriber(request);
    }
  }

  // ============================================
  // Intent Subscribers
  // ============================================

  subscribeToIntents(handler: (intent: Intent) => void): () => void {
    this.intentSubscribers.add(handler);
    return () => this.intentSubscribers.delete(handler);
  }

  emitIntent(intent: Intent): void {
    for (const subscriber of this.intentSubscribers) {
      subscriber(intent);
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  clearAll(): void {
    this.eventSubscribers.clear();
    this.moduleStatusSubscribers.clear();
    this.voicePackProgressSubscribers.clear();
    this.callerRequestSubscribers.clear();
    this.intentSubscribers.clear();
    this.logSubscribers.clear();
    this.logEntries.length = 0;
  }
}

// Singleton instance
let eventSystem: EventSystem | null = null;

export function getEventSystem(options?: EventSystemOptions): EventSystem {
  if (!eventSystem) {
    eventSystem = new EventSystem(options);
  }
  return eventSystem;
}

export function resetEventSystem(): void {
  if (eventSystem) {
    eventSystem.clearAll();
    eventSystem = null;
  }
}
