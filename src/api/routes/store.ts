import type { FastifyInstance } from 'fastify';
import type { APIServer } from '../Server.js';
import type { StoreCatalog, StoreModule } from '../../core/store/catalog.js';

export interface StoreDependencies {
  catalog: Pick<StoreCatalog, 'load' | 'find'>;
  /** Returns the installed version for a module id, or null if not installed. */
  installedVersion: (id: string) => string | null;
  /** Installs a module from a (catalog-provided) git repo URL and branch, returning the installed module id. */
  installModule: (url: string, branch: string) => Promise<string>;
}

export interface StoreListResponse {
  available: boolean;
  error?: string;
  modules: Array<StoreModule & { installed: boolean; installedVersion: string | null }>;
}

export interface StoreInstallResponse {
  success: boolean;
  moduleId?: string;
  error?: string;
}

/**
 * Same auth check used by the other module routes: auth disabled always
 * passes, otherwise the session must be authenticated.
 */
function isAuthorized(server: APIServer, session: { authenticated?: boolean } | undefined): boolean {
  if (!server.isAuthEnabled()) {
    return true;
  }
  return session?.authenticated === true;
}

/**
 * Registers the module store routes: listing the catalog with install
 * status, and installing a module by id. The install route only ever uses
 * the repo URL and branch from the (validated) catalog entry - any url or
 * branch supplied in the request body is ignored, so a client can never
 * point the installer at an arbitrary repo.
 */
export function registerStoreRoutes(
  fastify: FastifyInstance,
  server: APIServer,
  deps: StoreDependencies
): void {
  /**
   * GET /api/store - List the module store catalog with install status
   */
  fastify.get<{
    Reply: StoreListResponse;
  }>('/api/store', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { available: false, error: 'Authentication required', modules: [] };
    }

    const result = await deps.catalog.load();
    if (!result.available) {
      return { available: false, error: result.error, modules: [] };
    }

    const modules = result.modules.map((module) => {
      const installedVersion = deps.installedVersion(module.id);
      return { ...module, installed: installedVersion !== null, installedVersion };
    });

    return { available: true, modules };
  });

  /**
   * POST /api/store/:id/install - Install a module from the store
   * Repo and branch always come from the catalog entry, never from the request body.
   */
  fastify.post<{
    Params: { id: string };
    Reply: StoreInstallResponse;
  }>('/api/store/:id/install', async (request, reply) => {
    if (!isAuthorized(server, request.session)) {
      void reply.code(401);
      return { success: false, error: 'Authentication required' };
    }

    const { id } = request.params;

    const result = await deps.catalog.load();
    if (!result.available) {
      void reply.code(503);
      return { success: false, error: result.error };
    }

    const storeModule = result.modules.find((module) => module.id === id);
    if (!storeModule) {
      void reply.code(404);
      return { success: false, error: 'Module not found in store' };
    }

    if (deps.installedVersion(id) !== null) {
      void reply.code(409);
      return { success: false, error: 'Module already installed' };
    }

    try {
      const moduleId = await deps.installModule(storeModule.repo, storeModule.branch);
      return { success: true, moduleId };
    } catch (error) {
      void reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install module',
      };
    }
  });
}
