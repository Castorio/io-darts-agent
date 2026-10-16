/**
 * Higgsfield API client
 *
 * Shared by the AI provider and the animation engine. Generation is
 * asynchronous: submit to a model path, then poll the request status.
 * See docs.higgsfield.ai (Authentication, Requests, Polling, Errors).
 */

import { randomUUID } from 'crypto';

const BASE_URL = 'https://api.higgsfield.ai';
const REQUEST_TIMEOUT_MS = 30_000;

// Model paths such as kling-video/v3.0/std/text-to-video; every segment starts with a
// letter or digit, so "." and ".." cannot redirect the request to another API path
const MODEL_PATH_PATTERN = /^[a-z0-9][a-z0-9.-]*(\/[a-z0-9][a-z0-9.-]*)+$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Polling per docs: start at 2s, grow gradually, cap at 10s
const POLL_START_MS = 2000;
const POLL_FACTOR = 1.5;
const POLL_MAX_MS = 10_000;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'nsfw', 'canceled']);

export type HiggsfieldRequestStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'nsfw'
  | 'canceled';

export interface HiggsfieldStatus {
  status: HiggsfieldRequestStatus;
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: string;
}

export interface HiggsfieldClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /** Delay before retrying a failed submit (tests pass a fake) */
  sleep?: (ms: number) => Promise<void>;
}

const SUBMIT_RETRY_DELAY_MS = 1000;

export interface WaitOptions {
  timeoutMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * Split the stored API key, entered as KEY_ID:KEY_SECRET.
 */
export function parseHiggsfieldCredentials(apiKey: string): { keyId: string; secret: string } {
  const parts = apiKey.trim().split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Higgsfield API key must be entered as KEY_ID:KEY_SECRET');
  }
  return { keyId: parts[0], secret: parts[1] };
}

export function isHiggsfieldTerminal(status: HiggsfieldRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** HTTP error from the Higgsfield API, with a message safe to show */
export class HiggsfieldApiError extends Error {
  constructor(readonly status: number) {
    super(describeError(status));
    this.name = 'HiggsfieldApiError';
  }
}

/**
 * Timeouts, network failures and server-side errors are worth retrying;
 * credential, credit and validation errors are not.
 */
export function isTransientHiggsfieldError(error: unknown): boolean {
  if (error instanceof HiggsfieldApiError) {
    return error.status >= 500 || error.status === 423;
  }
  return (
    error instanceof TypeError ||
    (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
  );
}

function assertRequestId(requestId: unknown): asserts requestId is string {
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error('Higgsfield returned an invalid request id');
  }
}

/**
 * Map an HTTP error to a message without echoing the response body, which
 * may repeat request details.
 */
function describeError(status: number): string {
  switch (status) {
    case 400:
      return 'Higgsfield rejected the request (invalid parameters or too many concurrent requests)';
    case 401:
      return 'Higgsfield: invalid key (expected KEY_ID:KEY_SECRET from the Higgsfield Console)';
    case 403:
      return 'Higgsfield: not enough credits';
    case 404:
      return 'Higgsfield: request or model not available for this account';
    case 422:
      return 'Higgsfield rejected the parameters';
    case 423:
    case 503:
      return 'Higgsfield: model is temporarily unavailable';
    default:
      return `Higgsfield API error ${status}`;
  }
}

export class HiggsfieldClient {
  private readonly authorization: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(apiKey: string, options: HiggsfieldClientOptions = {}) {
    const { keyId, secret } = parseHiggsfieldCredentials(apiKey);
    this.authorization = `Key ${keyId}:${secret}`;
    this.baseUrl = (options.baseUrl ?? BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.sleep = options.sleep ?? ((ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms)));
  }

  /**
   * Submit a generation request; returns the request id.
   */
  async submit(modelPath: string, body: Record<string, unknown>): Promise<string> {
    if (!MODEL_PATH_PATTERN.test(modelPath) || modelPath.includes('..')) {
      throw new Error(`Invalid Higgsfield model: ${modelPath}`);
    }

    // One key per generation intent: the single retry below reuses it, so a
    // submit whose response got lost is not created or billed twice
    const send = async (): Promise<Response> => {
      const response = await this.request(`/${modelPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new HiggsfieldApiError(response.status);
      }
      return response;
    };
    const idempotencyKey = randomUUID();

    let response: Response;
    try {
      response = await send();
    } catch (error) {
      if (!isTransientHiggsfieldError(error)) throw error;
      await this.sleep(SUBMIT_RETRY_DELAY_MS);
      response = await send();
    }

    const data = (await response.json()) as { request_id?: unknown };
    assertRequestId(data.request_id);
    return data.request_id;
  }

  /**
   * Current status and output of a request. The URL is built from the
   * validated id so credentials never go to a host taken from a response.
   */
  async getStatus(requestId: string): Promise<HiggsfieldStatus> {
    assertRequestId(requestId);
    const response = await this.request(`/requests/${requestId}/status`, { method: 'GET' });
    if (!response.ok) {
      throw new HiggsfieldApiError(response.status);
    }

    const data = (await response.json()) as HiggsfieldStatus;
    return {
      status: data.status,
      images: data.images,
      video: data.video,
      error: data.error,
    };
  }

  /**
   * Poll until the request reaches a terminal status.
   */
  async waitFor(requestId: string, options: WaitOptions): Promise<HiggsfieldStatus> {
    const sleep = options.sleep ?? ((ms: number): Promise<void> => new Promise<void>((r) => setTimeout(r, ms)));
    const now = options.now ?? Date.now;
    const deadline = now() + options.timeoutMs;
    let delay = POLL_START_MS;

    for (;;) {
      let status: HiggsfieldStatus | null = null;
      try {
        status = await this.getStatus(requestId);
      } catch (error) {
        // The request keeps running at Higgsfield; only give up on permanent errors
        if (!isTransientHiggsfieldError(error)) throw error;
      }
      if (status && isHiggsfieldTerminal(status.status)) {
        return status;
      }
      if (now() + delay > deadline) {
        throw new Error('Higgsfield generation did not finish in time');
      }
      await sleep(delay);
      delay = Math.min(delay * POLL_FACTOR, POLL_MAX_MS);
    }
  }

  /**
   * Cancel a queued request; false when it already started or finished.
   */
  async cancel(requestId: string): Promise<boolean> {
    assertRequestId(requestId);
    const response = await this.request(`/requests/${requestId}/cancel`, { method: 'POST' });
    return response.ok;
  }

  /**
   * Check the credentials without spending credits: an unknown request id
   * answers 404 for valid and 401 for invalid credentials.
   */
  async verifyCredentials(): Promise<boolean> {
    const response = await this.request('/requests/00000000-0000-0000-0000-000000000000/status', {
      method: 'GET',
    });
    if (response.status === 401) return false;
    if (response.status === 404 || response.ok) return true;
    throw new HiggsfieldApiError(response.status);
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: this.authorization },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }
}
