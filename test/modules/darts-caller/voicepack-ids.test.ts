import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { VoicePackGenerator, isValidPackId, intentAudioPath } from '../../../modules/darts-caller/src/VoicePackGenerator.js';

describe('voice pack ids', () => {
  let root: string;
  let packsDir: string;
  let generator: VoicePackGenerator;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'voicepacks-'));
    packsDir = path.join(root, 'data', 'voicepacks');
    mkdirSync(packsDir, { recursive: true });
    // A folder next to the packs that must never be touched
    writeFileSync(path.join(root, 'data', 'keep.txt'), 'x');
    generator = new VoicePackGenerator({} as never, packsDir);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each(['de-adam', 'en_rachel.v2', 'Pack1'])('accepts %s', (id) => {
    expect(isValidPackId(id)).toBe(true);
  });

  it.each(['..', '../data', 'a/b', 'a\\b', '', '.hidden', 'x'.repeat(101)])('rejects %j', (id) => {
    expect(isValidPackId(id)).toBe(false);
  });

  it('does not delete anything outside the voice pack folder', () => {
    expect(generator.deletePack('..')).toBe(false);
    expect(existsSync(packsDir)).toBe(true);
    expect(existsSync(path.join(root, 'data', 'keep.txt'))).toBe(true);
  });

  it('reports no pack info or audio for invalid ids', () => {
    expect(generator.getPackInfo('../..')).toBeNull();
    expect(generator.getExistingPlayerNames('..')).toEqual([]);
    expect(generator.getPlayerNameAudioPath('..', 'Max')).toBeNull();
    expect(generator.hasPlayerName('..', 'Max')).toBe(false);
  });
});

describe('intent audio files', () => {
  it('builds the path inside the selected voice pack', () => {
    expect(intentAudioPath('/data/voicepacks', 'de-adam', 'score_180')).toBe(
      path.join('/data/voicepacks', 'de-adam', 'score_180.mp3')
    );
  });

  it.each(['../../secret', 'a/b', '..', '', 'x\\y'])('refuses the file name %j', (name) => {
    expect(intentAudioPath('/data/voicepacks', 'de-adam', name)).toBeNull();
  });

  it('refuses an invalid pack id', () => {
    expect(intentAudioPath('/data/voicepacks', '..', 'score_180')).toBeNull();
  });
});
