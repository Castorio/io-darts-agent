import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
 * Uses a wildcard catch-all route registered BEFORE server.listen() to handle
 * all module API requests. This allows modules to register routes dynamically
 * after the server has started, since Fastify doesn't support adding routes
 * after listen().
 *
 * Routes are mounted under /api/modules/:moduleId/routes/*
 */
export class ModuleRouteRegistry extends EventEmitter {
  private fastify: FastifyInstance | null = null;
  private routes = new Map<string, RegisteredRoute[]>(); // moduleId -> routes
  private routeHandlers = new Map<string, ModuleRouteHandler>(); // moduleId -> handler
  private isAuthEnabled: () => boolean = () => false;
  private getSession: (sessionId: string) => { authenticated?: boolean } | undefined = () => undefined;
  private wildcardRegistered = false;

  /**
   * Initialize with Fastify instance and register wildcard catch-all route
   * MUST be called BEFORE fastify.listen()
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

    // Register wildcard catch-all route for all module API requests
    // This MUST happen before fastify.listen()
    this.registerWildcardRoute();
  }

  /**
   * Register the wildcard catch-all route that handles all module API requests
   * This is registered once at startup and dispatches to the correct module handler
   */
  private registerWildcardRoute(): void {
    if (!this.fastify || this.wildcardRegistered) return;

    // Create handler that dispatches to module handlers
    const wildcardHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
      const params = request.params as { moduleId: string; '*': string };
      const moduleId = params.moduleId;
      const routePath = '/' + (params['*'] || '');
      const method = request.method as HttpMethod;

      // Find matching route for this module
      const moduleRoutes = this.routes.get(moduleId);
      if (!moduleRoutes || moduleRoutes.length === 0) {
        void reply.code(404);
        return { error: `No routes registered for module: ${moduleId}` };
      }

      // Find the specific route that matches
      const matchedRoute = this.findMatchingRoute(moduleRoutes, method, routePath);
      if (!matchedRoute) {
        void reply.code(404);
        return { error: `Route not found: ${method} ${routePath}` };
      }

      // Check authentication if required
      if (matchedRoute.definition.requireAuth !== false) {
        const isAuthed = this.checkAuth(request);
        if (!isAuthed) {
          void reply.code(401);
          return { error: 'Unauthorized' };
        }
      }

      // Get the route handler for this module
      const routeHandler = this.routeHandlers.get(moduleId);
      if (!routeHandler) {
        void reply.code(503);
        return { error: 'Module not ready to handle requests' };
      }

      // Extract path params from the route pattern
      const extractedParams = this.extractPathParams(matchedRoute.definition.path, routePath);

      // Build the request object for the module
      const moduleRequest: ModuleRouteRequest = {
        handlerId: matchedRoute.definition.handlerId,
        method: method,
        path: matchedRoute.definition.path,
        params: { ...extractedParams },
        query: request.query as Record<string, unknown>,
        body: request.body,
        headers: Object.fromEntries(
          Object.entries(request.headers)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, v as string])
        ),
      };

      try {
        // Forward request to module
        const response = await routeHandler(moduleRequest);

        // Set response headers
        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            void reply.header(key, value);
          }
        }

        // Set status code
        if (response.statusCode) {
          void reply.code(response.statusCode);
        }

        return response.body;
      } catch (error) {
        console.error(`Module ${moduleId} route handler error:`, error);
        void reply.code(500);
        return { error: 'Internal module error' };
      }
    };

    // Register wildcard routes for all HTTP methods
    // Pattern: /api/modules/:moduleId/routes/*
    const basePath = '/api/modules/:moduleId/routes/*';

    this.fastify.get(basePath, wildcardHandler);
    this.fastify.post(basePath, wildcardHandler);
    this.fastify.put(basePath, wildcardHandler);
    this.fastify.patch(basePath, wildcardHandler);
    this.fastify.delete(basePath, wildcardHandler);

    // Also handle the base path without trailing wildcard (for routes like /api/players without subpath)
    const basePathNoWildcard = '/api/modules/:moduleId/routes';
    this.fastify.get(basePathNoWildcard, wildcardHandler);
    this.fastify.post(basePathNoWildcard, wildcardHandler);
    this.fastify.put(basePathNoWildcard, wildcardHandler);
    this.fastify.patch(basePathNoWildcard, wildcardHandler);
    this.fastify.delete(basePathNoWildcard, wildcardHandler);

    this.wildcardRegistered = true;
    console.log('🛣️  Module wildcard routes registered: /api/modules/:moduleId/routes/*');
  }

  /**
   * Find a matching route from the registered routes
   */
  private findMatchingRoute(
    routes: RegisteredRoute[],
    method: HttpMethod,
    requestPath: string
  ): RegisteredRoute | null {
    for (const route of routes) {
      if (route.definition.method !== method) continue;

      // Normalize the route path for comparison
      const routePath = route.definition.path.startsWith('/')
        ? route.definition.path
        : '/' + route.definition.path;

      // Check if the paths match (accounting for path parameters)
      if (this.pathsMatch(routePath, requestPath)) {
        return route;
      }
    }
    return null;
  }

  /**
   * Check if a route pattern matches a request path
   * Handles path parameters like :id, :playerId, etc.
   */
  private pathsMatch(routePattern: string, requestPath: string): boolean {
    // Normalize paths - remove /api prefix if present in route pattern
    const normalizedPattern = routePattern.replace(/^\/api/, '');
    const normalizedRequest = requestPath;

    const patternParts = normalizedPattern.split('/').filter(Boolean);
    const requestParts = normalizedRequest.split('/').filter(Boolean);

    if (patternParts.length !== requestParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const requestPart = requestParts[i];

      // If pattern part is a parameter (starts with :), it matches anything
      if (patternPart.startsWith(':')) {
        continue;
      }

      // Otherwise, parts must match exactly
      if (patternPart !== requestPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract path parameters from a request path based on route pattern
   */
  private extractPathParams(routePattern: string, requestPath: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Normalize paths
    const normalizedPattern = routePattern.replace(/^\/api/, '');
    const normalizedRequest = requestPath;

    const patternParts = normalizedPattern.split('/').filter(Boolean);
    const requestParts = normalizedRequest.split('/').filter(Boolean);

    for (let i = 0; i < patternParts.length && i < requestParts.length; i++) {
      const patternPart = patternParts[i];
      const requestPart = requestParts[i];

      if (patternPart.startsWith(':')) {
        const paramName = patternPart.slice(1);
        params[paramName] = requestPart;
      }
    }

    return params;
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
   * Register routes for a module (dynamic - can be called after server start)
   * Routes are stored in memory and matched by the wildcard handler
   */
  registerRoutes(registration: ModuleRouteRegistration): Promise<void> {
    if (!this.fastify) {
      return Promise.reject(new Error('ModuleRouteRegistry not initialized'));
    }

    const { moduleId, routes } = registration;

    // Replace existing routes for this module first. The route handler is kept:
    // callers set it right before registering, and unregisterRoutes() would drop it.
    this.removeRoutes(moduleId);

    const registeredRoutes: RegisteredRoute[] = [];

    for (const route of routes) {
      const fullPath = this.buildFullPath(moduleId, route.path);

      registeredRoutes.push({
        moduleId,
        definition: route,
        fullPath,
      });

      console.log(`📡 [${moduleId}] Route registered: ${route.method} ${fullPath}`);
    }

    this.routes.set(moduleId, registeredRoutes);
    this.emit('routesRegistered', { moduleId, routes: registeredRoutes });
    return Promise.resolve();
  }

  /**
   * Unregister all routes for a module, including its route handler
   */
  unregisterRoutes(moduleId: string): Promise<void> {
    if (this.removeRoutes(moduleId)) {
      this.routeHandlers.delete(moduleId);
    }
    return Promise.resolve();
  }

  /**
   * Remove a module's routes from the map; the wildcard handler then returns 404.
   * Returns false when the module had no routes.
   */
  private removeRoutes(moduleId: string): boolean {
    const existingRoutes = this.routes.get(moduleId);
    if (!existingRoutes || existingRoutes.length === 0) {
      return false;
    }

    this.routes.delete(moduleId);
    this.emit('routesUnregistered', { moduleId });
    return true;
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
    // Remove /api prefix if present (since our wildcard is already under /api/modules)
    const cleanPath = normalizedPath.replace(/^\/api/, '');
    return `/api/modules/${moduleId}/routes${cleanPath}`;
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
