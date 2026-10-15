import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastifyMultipart from '@fastify/multipart';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import type { HubConfiguration, SessionData } from '../types/api.js';

export interface ServerOptions {
  port: number;
  host: string;
  staticDir?: string;
  cookieSecret?: string;
  logger?: boolean;
}

const DEFAULT_OPTIONS: ServerOptions = {
  port: 3000,
  host: '0.0.0.0',
  cookieSecret: 'autodarts-hub-secret-change-me',
  logger: true,
};

const LOCAL_DOMAIN_SUFFIXES = ['.local', '.lan', '.home.arpa', '.fritz.box'];

function isLocalIPv6(address: string): boolean {
  if (address === '::1') return true;
  const firstHextet = address.split(':')[0];
  // fc00::/7 unique local, fe80::/10 link local
  return /^f[cd][0-9a-f]{0,2}$/.test(firstHextet) || /^fe[89ab][0-9a-f]$/.test(firstHextet);
}

/**
 * Whether a browser Origin belongs to the local network.
 *
 * The hub only runs in the LAN. Restricting CORS to local origins keeps an
 * arbitrary internet page opened in a LAN browser from calling the API with
 * the user's session. Requests without Origin (same-origin, curl) pass.
 */
export function isLocalOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (hostname.startsWith('[')) {
    return isLocalIPv6(hostname.slice(1, -1).toLowerCase());
  }

  // Dotless names (e.g. "dartpc") only resolve inside the LAN
  if (!hostname.includes('.')) return true;

  if (LOCAL_DOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return true;
  }

  const octets = hostname.split('.');
  if (octets.length !== 4 || !octets.every((o) => /^\d{1,3}$/.test(o))) {
    return false;
  }
  const [a, b] = octets.map(Number);
  return (
    a === 127 ||
    a === 10 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * API Server - Fastify-based HTTP/WebSocket server
 */
export class APIServer extends EventEmitter {
  private fastify: FastifyInstance;
  private options: ServerOptions;
  private sessions = new Map<string, SessionData>();
  private config: HubConfiguration | null = null;

  constructor(options: Partial<ServerOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Configure logger (disable in test environment)
    const loggerConfig = this.options.logger
      ? {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        }
      : false;

    this.fastify = Fastify({
      logger: loggerConfig,
    });

    // Allow empty JSON bodies (for POST requests without body)
    this.fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      try {
        const json = body ? JSON.parse(body as string) : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    });
  }

  /**
   * Initialize the server with plugins and routes
   */
  async initialize(config: HubConfiguration | null): Promise<void> {
    this.config = config;

    // Reject cross-site requests from non-local pages before any route or
    // websocket upgrade runs. CORS alone only hides responses; simple
    // requests (e.g. a bodyless POST) would still be executed.
    this.fastify.addHook('onRequest', async (request, reply) => {
      if (!isLocalOrigin(request.headers.origin)) {
        return reply.code(403).send({ error: 'Origin not allowed' });
      }
    });

    // Register CORS
    await this.fastify.register(fastifyCors, {
      origin: (origin, callback) => callback(null, isLocalOrigin(origin)),
      credentials: true,
    });

    // Register cookies
    await this.fastify.register(fastifyCookie, {
      secret: this.options.cookieSecret,
      parseOptions: {},
    });

    // Register WebSocket support
    await this.fastify.register(fastifyWebsocket);

    // Register multipart (file upload) support
    await this.fastify.register(fastifyMultipart, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
      },
    });

    // Register static file serving (for Vue frontend)
    if (this.options.staticDir && fs.existsSync(this.options.staticDir)) {
      await this.fastify.register(fastifyStatic, {
        root: path.resolve(this.options.staticDir),
        prefix: '/',
      });
    }

    // Health check endpoint
    this.fastify.get('/health', async () => ({ status: 'ok' }));

    this.emit('initialized');
  }

  /**
   * Get the Fastify instance for route registration
   */
  getInstance(): FastifyInstance {
    return this.fastify;
  }

  /**
   * Update config reference
   */
  setConfig(config: HubConfiguration): void {
    this.config = config;
  }

  /**
   * Get current config
   */
  getConfig(): HubConfiguration | null {
    return this.config;
  }

  /**
   * Check if setup is required
   */
  isSetupRequired(): boolean {
    return !this.config || !this.config.setupCompleted;
  }

  /**
   * Check if web auth is enabled
   */
  isAuthEnabled(): boolean {
    return this.config?.webAuth?.enabled ?? false;
  }

  /**
   * Session management
   */
  createSession(username: string): string {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      authenticated: true,
      username,
      createdAt: Date.now(),
    });
    return sessionId;
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  isSessionValid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Sessions expire after 24 hours
    const maxAge = 24 * 60 * 60 * 1000;
    return Date.now() - session.createdAt < maxAge;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      const address = await this.fastify.listen({
        port: this.options.port,
        host: this.options.host,
      });
      this.emit('started', address);
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.fastify.close();
    this.emit('stopped');
  }

  /**
   * Port the server listens on
   */
  getPort(): number {
    return this.options.port;
  }

  /**
   * Get server address
   */
  getAddress(): string {
    return `http://${this.options.host}:${this.options.port}`;
  }

  /**
   * Generate a secure session ID
   */
  private generateSessionId(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
