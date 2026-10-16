import type WebSocket from 'ws';

/**
 * Decode a ws message payload as UTF-8 text.
 *
 * ws hands out a Buffer by default, but the RawData type also covers
 * ArrayBuffer and fragmented Buffer[] payloads, whose toString() would
 * not yield the message text.
 */
export function rawDataToString(data: WebSocket.RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}
