import type { AuthConfig, TokenResponse, DecodedToken } from '../../types/index.js';

const AUTH_BASE_URL = 'https://api.autodarts.com/auth/v1';

/** Client id of the Autodarts web app; the v1 auth service accepts password logins for it */
export const DEFAULT_CLIENT_ID = 'autodarts-play';

/** Client of the retired Keycloak login, still present in older .env and config files */
export const RETIRED_CLIENT_IDS: ReadonlySet<string> = new Set(['developer-darts-caller']);

const DEFAULT_EXPIRES_IN_SECONDS = 900;
const REQUEST_TIMEOUT_MS = 10000;
// Lower bound between automatic refreshes, so short-lived tokens cannot cause a hot loop
const MIN_REFRESH_DELAY_MS = 5000;
const REFRESH_RETRY_MS = 30000;

export interface AuthServiceOptions {
  authBaseUrl?: string;
  tokenRefreshBuffer?: number; // Seconds before expiry to refresh
}

/**
 * Turn an error response into a message without echoing HTML error pages
 * or token material.
 */
async function describeError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: string } | string };
    const code = typeof body.error === 'string' ? body.error : body.error?.code;
    if (code === 'invalid_credentials') return 'invalid email or password';
    if (code) return `${response.status} ${code}`;
  } catch {
    // Not JSON (e.g. a Cloudflare error page)
  }
  return `${response.status}`;
}

export class AuthService {
  private config: AuthConfig;
  private authBaseUrl: string;
  private tokenRefreshBuffer: number;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: Date | null = null;
  private userId: string | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingRefresh: Promise<string> | null = null;
  // Bumped by logout(); responses that arrive afterwards must not restore tokens
  private session = 0;
  // Bumped by stopAutoRefresh(); in-flight auto refreshes must not re-arm the timer
  private autoRefreshGeneration = 0;

  constructor(config: AuthConfig, options: AuthServiceOptions = {}) {
    this.config = config;
    this.authBaseUrl = options.authBaseUrl ?? AUTH_BASE_URL;
    this.tokenRefreshBuffer = options.tokenRefreshBuffer ?? 60; // Default: refresh 60s before expiry
  }

  /**
   * Parse JWT token to extract payload
   */
  private parseJwt(token: string): DecodedToken {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    const base64Payload = parts[1];
    const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
    return JSON.parse(payload) as DecodedToken;
  }

  /**
   * Login with username/password
   */
  async login(): Promise<string> {
    const session = this.session;
    const response = await this.post('/login', {
      username: this.config.email,
      password: this.config.password,
      client_id: this.clientId(),
    });
    this.assertSession(session);

    if (!response.ok) {
      this.clearTokens();
      throw new Error(`Login failed: ${await describeError(response)}`);
    }

    this.setTokens((await response.json()) as TokenResponse);
    return this.accessToken!;
  }

  /**
   * Refresh the access token. The service rotates refresh tokens, so the
   * new one replaces the old. If the refresh is rejected, log in again.
   */
  async refresh(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please login first.');
    }

    // A rotated refresh token is single use, so concurrent callers share one request
    this.pendingRefresh ??= this.doRefresh(this.refreshToken).finally(() => {
      this.pendingRefresh = null;
    });
    return this.pendingRefresh;
  }

  private async doRefresh(refreshToken: string): Promise<string> {
    const session = this.session;
    const response = await this.post('/refresh', {
      refresh_token: refreshToken,
      client_id: this.clientId(),
    });
    this.assertSession(session);

    // A rejected refresh token needs a new login; outages must not hammer /login
    if (response.status === 400 || response.status === 401) {
      return this.login();
    }
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${await describeError(response)}`);
    }

    this.setTokens((await response.json()) as TokenResponse);
    return this.accessToken!;
  }

  private assertSession(session: number): void {
    if (session !== this.session) {
      throw new Error('Logged out during authentication');
    }
  }

  private clientId(): string {
    const configured = this.config.clientId;
    return configured && !RETIRED_CLIENT_IDS.has(configured) ? configured : DEFAULT_CLIENT_ID;
  }

  private post(path: string, body: Record<string, string>): Promise<Response> {
    return fetch(`${this.authBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    // No token, e.g. after a failed re-login during an outage: try again
    if (!this.accessToken) {
      return this.login();
    }

    if (this.isTokenExpired()) {
      return this.refresh();
    }

    return this.accessToken;
  }

  /**
   * Check if the current token is expired (or about to expire)
   */
  isTokenExpired(): boolean {
    if (!this.expiresAt) return true;

    const bufferMs = this.tokenRefreshBuffer * 1000;
    return new Date().getTime() >= this.expiresAt.getTime() - bufferMs;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null && !this.isTokenExpired();
  }

  /**
   * Get the user ID from the decoded token
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Get token expiry time
   */
  getExpiresAt(): Date | null {
    return this.expiresAt;
  }

  /**
   * Setup automatic token refresh
   */
  startAutoRefresh(onRefresh?: (token: string) => void): void {
    this.stopAutoRefresh();
    const generation = this.autoRefreshGeneration;

    if (!this.expiresAt) return;

    const dueIn = this.expiresAt.getTime() - this.tokenRefreshBuffer * 1000 - Date.now();
    this.scheduleAutoRefresh(Math.max(dueIn, MIN_REFRESH_DELAY_MS), generation, onRefresh);
  }

  private scheduleAutoRefresh(
    delayMs: number,
    generation: number,
    onRefresh?: (token: string) => void
  ): void {
    this.refreshTimeout = setTimeout(() => {
      void this.refresh()
        .then((token) => {
          if (generation !== this.autoRefreshGeneration) return;
          onRefresh?.(token);
          this.startAutoRefresh(onRefresh);
        })
        .catch((err) => {
          console.error('Auto-refresh failed:', err instanceof Error ? err.message : err);
          // Transient failures (outage, timeout) must not end the refresh cycle
          if (generation === this.autoRefreshGeneration) {
            this.scheduleAutoRefresh(REFRESH_RETRY_MS, generation, onRefresh);
          }
        });
    }, delayMs);
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh(): void {
    this.autoRefreshGeneration++;
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Logout - clear all tokens
   */
  logout(): void {
    this.session++;
    this.stopAutoRefresh();
    this.clearTokens();
  }

  /**
   * Internal: Set tokens from response
   */
  private setTokens(data: TokenResponse): void {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    const expiresIn = data.expires_in && data.expires_in > 0 ? data.expires_in : DEFAULT_EXPIRES_IN_SECONDS;
    this.expiresAt = new Date(Date.now() + expiresIn * 1000);

    const decoded = this.parseJwt(data.access_token);
    this.userId = decoded.sub;
  }

  /**
   * Internal: Clear all tokens
   */
  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.userId = null;
  }
}
