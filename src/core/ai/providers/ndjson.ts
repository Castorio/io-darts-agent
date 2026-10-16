/**
 * Iterate the non-empty lines of a newline-delimited stream (NDJSON).
 *
 * Partial lines are buffered across chunks, so a JSON object split between
 * two network chunks is yielded whole instead of being dropped.
 */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line) yield line;
    }
  }

  buffer += decoder.decode();
  if (buffer) yield buffer;
}
