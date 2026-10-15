/**
 * Prompt shared by all animation engines
 */

import type { AnimationGenerationOptions } from '../types/animation.js';

/**
 * Add the hints every engine needs: a solid black background that the
 * generator keys out later (transparent WebM), quality and a seamless loop.
 */
export function buildAnimationPrompt(basePrompt: string, options?: AnimationGenerationOptions): string {
  const parts = [basePrompt];

  // Request solid black background for later chromakey removal
  if (options?.transparent !== false) {
    parts.push('on a solid pure black #000000 background');
    parts.push('isolated subject, centered, no background elements');
    parts.push('high contrast against black, glowing edges');
  }

  if (options?.quality === 'quality') {
    parts.push('high quality, detailed, smooth animation');
  } else if (options?.quality === 'fast') {
    parts.push('simple, clean animation');
  }

  parts.push('looping animation, seamless loop');

  return parts.join(', ');
}
