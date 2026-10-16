/**
 * Modules whose settings live on their own page instead of the generic
 * module form (the WLED form has no preset or effect selection)
 */
const DEDICATED_CONFIG_ROUTES: Record<string, string> = {
  wled: 'wled-config',
}

export function dedicatedConfigRoute(moduleId: string): string | null {
  return DEDICATED_CONFIG_ROUTES[moduleId] ?? null
}
