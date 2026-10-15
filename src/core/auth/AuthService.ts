import type { AuthConfig, TokenResponse, DecodedToken } from '../../types/index.js';

const AUTH_BASE_URL = 'https://api.autodarts.com/auth/v1';

/** Client id of the Autodarts web app; the v1 auth service accepts password logins for it */
export const DEFAULT_CLIENT_ID = 'autodarts-play';

/** Client of the retired Keycloak login, still present in older .env and config files */
export const RETIRED_CLIENT_IDS: ReadonlySet<string> = new Set(['developer-darts-caller']);

const DEFAULT_EXPIRES_IN_SECONDS = 900;

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
    const response = await this.post('/login', {
      username: this.config.email,
      password: this.config.password,
      client_id: this.clientId(),
    });

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
    const response = await this.post('/refresh', {
      refresh_token: refreshToken,
      client_id: this.clientId(),
    });

    if (!response.ok) {
      return this.login();
    }

    this.setTokens((await response.json()) as TokenResponse);
    return this.accessToken!;
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
    });
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
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

    if (!this.expiresAt) return;

    const refreshTime = this.expiresAt.getTime() - this.tokenRefreshBuffer * 1000 - Date.now();

    if (refreshTime <= 0) {
      // Token already expired or about to, refresh immediately
      void this.refresh()
        .then((token) => {
          onRefresh?.(token);
          this.startAutoRefresh(onRefresh);
        })
        .catch((err) => {
          console.error('Auto-refresh failed:', err instanceof Error ? err.message : err);
        });
      return;
    }

    this.refreshTimeout = setTimeout(() => {
      void this.refresh()
        .then((token) => {
          onRefresh?.(token);
          this.startAutoRefresh(onRefresh);
        })
        .catch((err) => {
          console.error('Auto-refresh failed:', err instanceof Error ? err.message : err);
        });
    }, refreshTime);
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Logout - clear all tokens
   */
  logout(): void {
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
