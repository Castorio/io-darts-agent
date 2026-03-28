export { APIServer, type ServerOptions } from './Server.js';
export { createAuthMiddleware, requireAuth, setSessionCookie, clearSessionCookie } from './middleware/auth.js';
export {
  registerSetupRoutes,
  registerAuthRoutes,
  registerStatusRoutes,
  registerModuleRoutes,
  registerSettingsRoutes,
  registerWebSocketRoutes,
  WebSocketManager,
  type StatusDependencies,
  type ModuleDependencies,
  type SettingsDependencies,
  type WebSocketDependencies,
} from './routes/index.js';
