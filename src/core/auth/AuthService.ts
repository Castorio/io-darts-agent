import type { AuthConfig, TokenResponse, DecodedToken } from '../../types/index.js';

const AUTH_URL = 'https://login.autodarts.io/realms/autodarts/protocol/openid-connect/token';

export interface AuthServiceOptions {
  authUrl?: string;
  tokenRefreshBuffer?: number; // Seconds before expiry to refresh
}

export class AuthService {
  private config: AuthConfig;
  private authUrl: string;
  private tokenRefreshBuffer: number;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: Date | null = null;
  private userId: string | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: AuthConfig, options: AuthServiceOptions = {}) {
    this.config = config;
    this.authUrl = options.authUrl ?? AUTH_URL;
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
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);
    params.append('username', this.config.email);
    params.append('password', this.config.password);

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.setTokens(data);

    return this.accessToken!;
  }

  /**
   * Refresh the access token using refresh token
   */
  async refresh(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please login first.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);
    params.append('refresh_token', this.refreshToken);

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If refresh fails, clear tokens and require re-login
      this.clearTokens();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.setTokens(data);

    return this.accessToken!;
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
      void this.refresh().then((token) => onRefresh?.(token));
      return;
    }

    this.refreshTimeout = setTimeout(() => {
      void this.refresh()
        .then((token) => {
          onRefresh?.(token);
          this.startAutoRefresh(onRefresh);
        })
        .catch((err) => {
          console.error('Auto-refresh failed:', err);
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
    this.refreshToken = data.refresh_token;
    this.expiresAt = new Date(Date.now() + data.expires_in * 1000);

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
