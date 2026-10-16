/**
 * Start each module at most once at a time
 *
 * Autostart and the start button can fire for the same module within a
 * few seconds; without this each call spawned its own process.
 */
export function createStartOnce<T>(
  isRunning: (item: T) => boolean,
  start: (item: T) => Promise<void>,
  keyOf: (item: T) => string = (item): string => String(item)
): (item: T) => Promise<void> {
  const pending = new Map<string, Promise<void>>();

  return (item: T): Promise<void> => {
    if (isRunning(item)) return Promise.resolve();
    const key = keyOf(item);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const run = start(item).finally(() => pending.delete(key));
    pending.set(key, run);
    return run;
  };
}
