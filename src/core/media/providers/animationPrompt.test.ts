import { describe, it, expect } from 'vitest';
import { buildAnimationPrompt } from './animationPrompt.js';

describe('buildAnimationPrompt', () => {
  it('asks for a black background for later keying and a seamless loop', () => {
    expect(buildAnimationPrompt('Golden 180 explosion')).toBe(
      'Golden 180 explosion, on a solid pure black #000000 background, isolated subject, centered, ' +
        'no background elements, high contrast against black, glowing edges, looping animation, seamless loop'
    );
  });

  it('skips the background hints without transparency and adds quality hints', () => {
    expect(buildAnimationPrompt('Bull', { transparent: false, quality: 'quality' })).toBe(
      'Bull, high quality, detailed, smooth animation, looping animation, seamless loop'
    );
  });
});
