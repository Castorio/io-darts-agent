import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { AnimationEngineSettings } from './AnimationEngineSettings.js';

describe('AnimationEngineSettings', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'anim-engine-'));
    file = path.join(dir, 'animation-settings.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to runway', () => {
    expect(new AnimationEngineSettings(file).get()).toBe('runway');
  });

  it('persists the chosen engine', () => {
    new AnimationEngineSettings(file).set('higgsfield');

    expect(new AnimationEngineSettings(file).get()).toBe('higgsfield');
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({ engine: 'higgsfield' });
  });

  it('rejects unknown engines', () => {
    expect(() => new AnimationEngineSettings(file).set('dalle' as never)).toThrow('Unknown animation engine');
  });

  it('falls back to runway for a corrupt or unknown saved value', () => {
    writeFileSync(file, '{"engine":"something-else"}');
    expect(new AnimationEngineSettings(file).get()).toBe('runway');

    writeFileSync(file, 'not json');
    expect(new AnimationEngineSettings(file).get()).toBe('runway');
  });
});
