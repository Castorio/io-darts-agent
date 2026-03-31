import type { FastifyInstance, FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { EventEmitter } from 'events';

/**
 * HTTP method types supported for module routes
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Module route definition
 */
export interface ModuleRouteDefinition {
  /** HTTP method */
  method: HttpMethod;
  /** Route path (relative to /api/modules/:moduleId/) */
  path: string;
  /** Route handler identifier (used by module to handle the request) */
  handlerId: string;
  /** Optional route schema for validation */
  schema?: {
    body?: Record<string, unknown>;
    querystring?: Record<string, unknown>;
    params?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
  /** Optional route description for documentation */
  description?: string;
  /** Whether authentication is required (default: true) */
  requireAuth?: boolean;
}

/**
 * Module route registration request (sent by module via IPC)
 */
export interface ModuleRouteRegistration {
  moduleId: string;
  routes: ModuleRouteDefinition[];
}

/**
 * Module route request (forwarded to module via IPC)
 */
export interface ModuleRouteRequest {
  handlerId: string;
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * Module route response (returned by module via IPC)
 */
export interface ModuleRouteResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body: unknown;
}

/**
 * Route handler function type
 */
export type ModuleRouteHandler = (
  request: ModuleRouteRequest
) => Promise<ModuleRouteResponse>;

/**
 * Registered route info
 */
interface RegisteredRoute {
  moduleId: string;
  definition: ModuleRouteDefinition;
  fullPath: string;
}

/**
 * ModuleRouteRegistry - Manages dynamic route registration for modules
 *
 * Allows modules to register custom API endpoints that are mounted under
 * /api/modules/:moduleId/routes/*
 */
export class ModuleRouteRegistry extends EventEmitter {
  private fastify: FastifyInstance | null = null;
  private routes = new Map<string, RegisteredRoute[]>(); // moduleId -> routes
  private routeHandlers = new Map<string, ModuleRouteHandler>(); // moduleId -> handler
  private isAuthEnabled: () => boolean = () => false;
  private getSession: (sessionId: string) => { authenticated?: boolean } | undefined = () => undefined;

  /**
   * Initialize with Fastify instance
   */
  initialize(
    fastify: FastifyInstance,
    authConfig: {
      isAuthEnabled: () => boolean;
      getSession: (sessionId: string) => { authenticated?: boolean } | undefined;
    }
  ): void {
    this.fastify = fastify;
    this.isAuthEnabled = authConfig.isAuthEnabled;
    this.getSession = authConfig.getSession;
  }

  /**
   * Register a route handler for a module
   * The handler is called when any of the module's routes are hit
   */
  setRouteHandler(moduleId: string, handler: ModuleRouteHandler): void {
    this.routeHandlers.set(moduleId, handler);
  }

  /**
   * Remove route handler for a module
   */
  removeRouteHandler(moduleId: string): void {
    this.routeHandlers.delete(moduleId);
  }

  /**
   * Register routes for a module
   */
  async registerRoutes(registration: ModuleRouteRegistration): Promise<void> {
    if (!this.fastify) {
      throw new Error('ModuleRouteRegistry not initialized');
    }

    const { moduleId, routes } = registration;

    // Unregister existing routes for this module first
    await this.unregisterRoutes(moduleId);

    const registeredRoutes: RegisteredRoute[] = [];

    for (const route of routes) {
      const fullPath = this.buildFullPath(moduleId, route.path);

      try {
        await this.registerRoute(moduleId, route, fullPath);
        registeredRoutes.push({
          moduleId,
          definition: route,
          fullPath,
        });
      } catch (error) {
        console.error(`Failed to register route ${route.method} ${fullPath}:`, error);
        throw error;
      }
    }

    this.routes.set(moduleId, registeredRoutes);
    this.emit('routesRegistered', { moduleId, routes: registeredRoutes });
  }

  /**
   * Unregister all routes for a module
   */
  async unregisterRoutes(moduleId: string): Promise<void> {
    const existingRoutes = this.routes.get(moduleId);
    if (!existingRoutes || existingRoutes.length === 0) {
      return;
    }

    // Note: Fastify doesn't support dynamic route removal
    // We mark routes as inactive and they will return 404
    // The routes will be properly removed on server restart
    this.routes.delete(moduleId);
    this.routeHandlers.delete(moduleId);
    this.emit('routesUnregistered', { moduleId });
  }

  /**
   * Get all registered routes for a module
   */
  getModuleRoutes(moduleId: string): RegisteredRoute[] {
    return this.routes.get(moduleId) || [];
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): Map<string, RegisteredRoute[]> {
    return new Map(this.routes);
  }

  /**
   * Check if a module has registered routes
   */
  hasRoutes(moduleId: string): boolean {
    const routes = this.routes.get(moduleId);
    return routes !== undefined && routes.length > 0;
  }

  /**
   * Build full path for a module route
   */
  private buildFullPath(moduleId: string, routePath: string): string {
    // Normalize path - ensure it starts with /
    const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return `/api/modules/${moduleId}/routes${normalizedPath}`;
  }

  /**
   * Register a single route with Fastify
   */
  private async registerRoute(
    moduleId: string,
    route: ModuleRouteDefinition,
    fullPath: string
  ): Promise<void> {
    if (!this.fastify) return;

    const fastify = this.fastify;
    const self = this;

    const routeOptions: RouteShorthandOptions = {
      schema: route.schema,
    };

    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      // Check if module still has routes registered
      if (!self.routes.has(moduleId)) {
        reply.code(404);
        return { error: 'Module routes not available' };
      }

      // Check authentication if required
      if (route.requireAuth !== false) {
        const isAuthed = self.checkAuth(request);
        if (!isAuthed) {
          reply.code(401);
          return { error: 'Unauthorized' };
        }
      }

      // Get the route handler for this module
      const routeHandler = self.routeHandlers.get(moduleId);
      if (!routeHandler) {
        reply.code(503);
        return { error: 'Module not ready to handle requests' };
      }

      // Build the request object for the module
      const moduleRequest: ModuleRouteRequest = {
        handlerId: route.handlerId,
        method: route.method,
        path: route.path,
        params: request.params as Record<string, string>,
        query: request.query as Record<string, unknown>,
        body: request.body,
        headers: Object.fromEntries(
          Object.entries(request.headers)
            .filter(([_, v]) => typeof v === 'string')
            .map(([k, v]) => [k, v as string])
        ),
      };

      try {
        // Forward request to module
        const response = await routeHandler(moduleRequest);

        // Set response headers
        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            reply.header(key, value);
          }
        }

        // Set status code
        if (response.statusCode) {
          reply.code(response.statusCode);
        }

        return response.body;
      } catch (error) {
        console.error(`Module ${moduleId} route handler error:`, error);
        reply.code(500);
        return { error: 'Internal module error' };
      }
    };

    // Register the route based on method
    switch (route.method) {
      case 'GET':
        fastify.get(fullPath, routeOptions, handler);
        break;
      case 'POST':
        fastify.post(fullPath, routeOptions, handler);
        break;
      case 'PUT':
        fastify.put(fullPath, routeOptions, handler);
        break;
      case 'PATCH':
        fastify.patch(fullPath, routeOptions, handler);
        break;
      case 'DELETE':
        fastify.delete(fullPath, routeOptions, handler);
        break;
    }
  }

  /**
   * Check if request is authenticated
   */
  private checkAuth(request: FastifyRequest): boolean {
    // If auth is disabled, always allow
    if (!this.isAuthEnabled()) {
      return true;
    }

    // Get session from cookie
    const sessionId = (request.cookies as Record<string, string>)?.['session'];
    if (!sessionId) {
      return false;
    }

    const session = this.getSession(sessionId);
    return session?.authenticated === true;
  }
}

// Singleton instance
let registryInstance: ModuleRouteRegistry | null = null;

/**
 * Get the singleton ModuleRouteRegistry instance
 */
export function getModuleRouteRegistry(): ModuleRouteRegistry {
  if (!registryInstance) {
    registryInstance = new ModuleRouteRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetModuleRouteRegistry(): void {
  registryInstance = null;
}
