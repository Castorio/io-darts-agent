import { describe, it, expect } from 'vitest';
import { readLines } from './ndjson.js';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of readLines(body)) out.push(line);
  return out;
}

describe('readLines', () => {
  it('yields each line of a chunk and skips empty lines', async () => {
    expect(await collect(streamOf(['{"a":1}\n\n{"b":2}\n']))).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('joins a line that is split across chunks', async () => {
    expect(await collect(streamOf(['{"resp', 'onse":"hi"}\n{"x"', ':1}\n']))).toEqual([
      '{"response":"hi"}',
      '{"x":1}',
    ]);
  });

  it('yields a trailing line without newline', async () => {
    expect(await collect(streamOf(['{"done":true}']))).toEqual(['{"done":true}']);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('ä\n');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    });
    expect(await collect(body)).toEqual(['ä']);
  });
});
