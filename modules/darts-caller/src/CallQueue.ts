/**
 * Call Queue
 *
 * Manages the queue of calls to be announced
 */

import type { CallRequest, CallType } from './types.js';

/**
 * Call queue item with priority
 */
interface QueueItem {
  request: CallRequest;
  addedAt: number;
}

/**
 * Callback for when a call should be played
 */
export type CallPlaybackCallback = (request: CallRequest) => void;

export class CallQueue {
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private playbackCallback: CallPlaybackCallback | null = null;
  private idCounter = 0;
  private defaultDelay: number;

  constructor(defaultDelay: number = 200) {
    this.defaultDelay = defaultDelay;
  }

  /**
   * Set the playback callback
   */
  onPlayback(callback: CallPlaybackCallback): void {
    this.playbackCallback = callback;
  }

  /**
   * Set default delay
   */
  setDefaultDelay(delay: number): void {
    this.defaultDelay = delay;
  }

  /**
   * Add a call to the queue
   */
  enqueue(
    type: CallType,
    text: string,
    audioFile?: string,
    priority: number = 5,
    delay?: number
  ): CallRequest {
    const request: CallRequest = {
      id: `call_${++this.idCounter}_${Date.now()}`,
      type,
      text,
      audioFile,
      priority,
      timestamp: Date.now(),
    };

    const item: QueueItem = {
      request,
      addedAt: Date.now(),
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex((q) => q.request.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    // Process queue after delay
    const actualDelay = delay ?? this.defaultDelay;
    if (actualDelay > 0) {
      setTimeout(() => this.processQueue(), actualDelay);
    } else {
      this.processQueue();
    }

    return request;
  }

  /**
   * Process the next item in queue
   */
  private processQueue(): void {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.isPlaying = true;

    if (this.playbackCallback) {
      this.playbackCallback(item.request);
    }

    // Reset playing state after estimated duration
    // This is a rough estimate - actual playback timing handled by frontend
    const estimatedDuration = this.estimateDuration(item.request.text);
    setTimeout(() => {
      this.isPlaying = false;
      this.processQueue();
    }, estimatedDuration);
  }

  /**
   * Estimate speech duration based on text length
   */
  private estimateDuration(text: string): number {
    // Rough estimate: ~150ms per word
    const words = text.split(/\s+/).length;
    return Math.max(500, words * 150);
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Mark playback as complete (called by frontend)
   */
  markPlaybackComplete(): void {
    this.isPlaying = false;
    this.processQueue();
  }

  /**
   * Force process next (skip current)
   */
  skipCurrent(): void {
    this.isPlaying = false;
    this.processQueue();
  }
}
