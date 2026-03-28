import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
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

    // Register CORS
    await this.fastify.register(fastifyCors, {
      origin: true,
      credentials: true,
    });

    // Register cookies
    await this.fastify.register(fastifyCookie, {
      secret: this.options.cookieSecret,
      parseOptions: {},
    });

    // Register WebSocket support
    await this.fastify.register(fastifyWebsocket);

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
