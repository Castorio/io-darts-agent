/**
 * Optional recording of raw Autodarts messages
 *
 * Set IO_DARTS_RECORD_FILE to a file path to append every message from the
 * Autodarts websocket as one JSON line. Meant for diagnosing data formats
 * (e.g. a new game variant); the file can contain player names and ids.
 */
import { appendFileSync } from 'fs';

export type MessageRecorder = (raw: string) => void;

export function createMessageRecorder(file: string | undefined): MessageRecorder | null {
  if (!file) return null;
  return (raw: string): void => {
    let message: unknown = raw;
    try {
      message = JSON.parse(raw) as unknown;
    } catch {
      // keep the raw text
    }
    try {
      appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), message }) + '\n');
    } catch (error) {
      console.error('Recording Autodarts message failed:', error instanceof Error ? error.message : error);
    }
  };
}
