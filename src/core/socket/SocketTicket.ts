const TICKET_URL = 'https://play.ws.autodarts.com/ms/v0/tickets';
const REQUEST_TIMEOUT_MS = 10000;

export interface SocketTicketOptions {
  url?: string;
  /** Called once after a 401 to obtain a fresh access token */
  onUnauthorized?: () => Promise<string>;
}

/**
 * Request a short-lived ticket for the Autodarts message bus websocket.
 * The websocket is opened with `?code=<ticket>` instead of a bearer header.
 */
export async function fetchSocketTicket(
  getToken: () => Promise<string>,
  options: SocketTicketOptions = {}
): Promise<string> {
  const url = options.url ?? TICKET_URL;

  let response = await requestTicket(url, await getToken());
  if (response.status === 401 && options.onUnauthorized) {
    response = await requestTicket(url, await options.onUnauthorized());
  }

  if (!response.ok) {
    throw new Error(`Socket ticket request failed: ${response.status}`);
  }

  const body = (await response.json()) as { code?: unknown };
  if (typeof body.code !== 'string' || !body.code) {
    throw new Error('Socket ticket response without code');
  }
  return body.code;
}

function requestTicket(url: string, token: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}
