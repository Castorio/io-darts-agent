import type { AddressInfo } from 'net';
import type { APIServer } from '../../src/api/Server.js';

/**
 * Base URL of a started APIServer. Tests start their servers on port 0 so the
 * OS picks a free port; a fixed port can collide with another test file or
 * process on the CI runner (EADDRINUSE).
 */
export function serverUrl(server: APIServer): string {
  const address = server.getInstance().server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
