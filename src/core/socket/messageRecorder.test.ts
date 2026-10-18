import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { createMessageRecorder } from './messageRecorder.js';

describe('createMessageRecorder', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'rec-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('does nothing without a target file', () => {
    expect(createMessageRecorder(undefined)).toBeNull();
    expect(createMessageRecorder('')).toBeNull();
  });

  it('appends each raw message as one JSON line with a timestamp', () => {
    const file = path.join(dir, 'autodarts.jsonl');
    const record = createMessageRecorder(file)!;

    record('{"channel":"autodarts.matches","data":{"variant":"Cricket"}}');
    record('{"channel":"autodarts.boards"}');

    const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { at: string; message: unknown });
    expect(lines).toHaveLength(2);
    expect(lines[0].message).toEqual({ channel: 'autodarts.matches', data: { variant: 'Cricket' } });
    expect(typeof lines[0].at).toBe('string');
  });

  it('keeps raw text that is not JSON', () => {
    const file = path.join(dir, 'a.jsonl');
    createMessageRecorder(file)!('not json');

    expect(JSON.parse(readFileSync(file, 'utf8').trim())).toMatchObject({ message: 'not json' });
    expect(existsSync(file)).toBe(true);
  });
});
