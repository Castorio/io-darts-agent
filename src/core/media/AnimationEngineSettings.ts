/**
 * Which engine the animation generator uses (Runway or Higgsfield)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export const ANIMATION_ENGINES = ['runway', 'higgsfield'] as const;
export type AnimationEngine = (typeof ANIMATION_ENGINES)[number];

const DEFAULT_ENGINE: AnimationEngine = 'runway';

export function isAnimationEngine(value: unknown): value is AnimationEngine {
  return typeof value === 'string' && (ANIMATION_ENGINES as readonly string[]).includes(value);
}

export class AnimationEngineSettings {
  constructor(private readonly filePath: string) {}

  get(): AnimationEngine {
    try {
      const data = JSON.parse(readFileSync(this.filePath, 'utf-8')) as { engine?: unknown };
      return isAnimationEngine(data.engine) ? data.engine : DEFAULT_ENGINE;
    } catch {
      return DEFAULT_ENGINE;
    }
  }

  set(engine: AnimationEngine): void {
    if (!isAnimationEngine(engine)) {
      throw new Error(`Unknown animation engine: ${String(engine)}`);
    }
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify({ engine }, null, 2));
  }
}
