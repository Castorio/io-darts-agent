/**
 * Module stats for `/api/status`: how many modules are installed and how
 * many of them are currently running. A pure function over the module
 * registry so the status route can be exercised without booting the hub.
 */
export interface ModuleStatsEntry {
  status: string;
}

export interface ModuleStats {
  total: number;
  running: number;
}

export function computeModuleStats(modules: Iterable<ModuleStatsEntry>): ModuleStats {
  let total = 0;
  let running = 0;
  for (const mod of modules) {
    total++;
    if (mod.status === 'running') running++;
  }
  return { total, running };
}
