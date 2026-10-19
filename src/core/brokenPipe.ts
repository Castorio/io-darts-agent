/**
 * A closed stdout/stderr (EPIPE), e.g. once the desktop app that reads the
 * hub's output has quit, must not turn into an uncaught exception: the
 * handler would log, which fails again, and the resulting loop starves the
 * event loop at 100% CPU so the shutdown timer never fires.
 */

import type { EventEmitter } from 'events';

export function isBrokenPipe(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === 'EPIPE';
}

export function guardBrokenPipes(streams: EventEmitter[], onBrokenPipe: () => void): void {
  for (const stream of streams) {
    stream.on('error', (error: unknown) => {
      if (isBrokenPipe(error)) {
        onBrokenPipe();
        return;
      }
      throw error;
    });
  }
}
