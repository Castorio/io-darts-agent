import { describe, it, expect } from 'vitest';
import { rawDataToString } from './rawData.js';

describe('rawDataToString', () => {
  const text = '{"type":"ping","ä":1}';

  it('decodes a Buffer', () => {
    expect(rawDataToString(Buffer.from(text))).toBe(text);
  });

  it('decodes fragmented Buffer[] payloads', () => {
    const bytes = Buffer.from(text);
    expect(rawDataToString([bytes.subarray(0, 5), bytes.subarray(5)])).toBe(text);
  });

  it('decodes an ArrayBuffer', () => {
    const bytes = new TextEncoder().encode(text);
    expect(rawDataToString(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).toBe(text);
  });
});
