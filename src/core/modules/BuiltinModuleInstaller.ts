/**
 * BuiltinModuleInstaller - Handles first-run installation of built-in modules
 *
 * Extracts the built-in module installation logic from main.ts
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BuiltinModuleInstallerOptions {
  modulesDir: string;
  builtinModulesDir: string;
  builtinModules?: string[];
}

const DEFAULT_BUILTIN_MODULES = ['wled', 'darts-caller', 'game-display'];

function hasManifests(dir: string): boolean {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .some((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'module.json')));
  } catch {
    return false;
  }
}

/**
 * Directory holding the built-in modules with their module.json
 *
 * tsc only compiles module sources into dist/modules, so a build from
 * source keeps the manifests (and the modules' own builds) in ../modules.
 */
export function resolveBuiltinModulesDir(distDir: string): string {
  const sourceDir = path.join(distDir, '..', 'modules');
  return hasManifests(sourceDir) ? path.resolve(sourceDir) : path.join(distDir, 'modules');
}

/**
 * Recursively copy a directory
 */
function copyDirectoryRecursive(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Install built-in modules on first run
 *
 * Creates symlinks to the /modules/ directory for built-in modules
 * Falls back to copying if symlinks fail (e.g., on Windows without admin)
 */
export function installBuiltinModules(options: BuiltinModuleInstallerOptions): Promise<void> {
  const { modulesDir, builtinModulesDir, builtinModules = DEFAULT_BUILTIN_MODULES } = options;

  try {
    // Create modules_installed directory if it doesn't exist
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir, { recursive: true });
    }

    // Check if any modules are already installed
    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    const existingModules = entries.filter((e) => e.isDirectory() || e.isSymbolicLink());

    if (existingModules.length > 0) {
      console.log(`📦 Found ${existingModules.length} existing module(s), skipping built-in installation`);
      return Promise.resolve();
    }

    console.log('🚀 First run detected - installing built-in modules...');

    for (const moduleId of builtinModules) {
      const sourcePath = path.join(builtinModulesDir, moduleId);
      const targetPath = path.join(modulesDir, moduleId);

      // Check if source module exists
      if (!fs.existsSync(sourcePath)) {
        console.warn(`⚠️ Built-in module not found: ${moduleId}`);
        continue;
      }

      // Check if module.json exists in source
      const manifestPath = path.join(sourcePath, 'module.json');
      if (!fs.existsSync(manifestPath)) {
        console.warn(`⚠️ No module.json found for built-in module: ${moduleId}`);
        continue;
      }

      try {
        // Create symlink to built-in module (allows updates without reinstall)
        // A junction needs no admin rights on Windows, so updates reach the module there too
          fs.symlinkSync(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir');
        console.log(`✅ Installed built-in module: ${moduleId} (symlink)`);
      } catch {
        // Fallback: copy the module if symlink fails (e.g., on Windows without admin)
        console.log(`📋 Symlink failed, copying module: ${moduleId}`);
        copyDirectoryRecursive(sourcePath, targetPath);
        console.log(`✅ Installed built-in module: ${moduleId} (copy)`);
      }
    }

    console.log('✨ Built-in modules installation complete');
  } catch (e) {
    console.error('❌ Failed to install built-in modules:', e);
  }
  return Promise.resolve();
}

/**
 * Scan for installed modules and return their manifests
 */
export interface ScannedModule {
  id: string;
  manifest: unknown;
  path: string;
}

export function scanInstalledModules(modulesDir: string): Promise<ScannedModule[]> {
  const modules: ScannedModule[] = [];

  try {
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir, { recursive: true });
      return Promise.resolve(modules);
    }

    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const manifestPath = path.join(modulesDir, entry.name, 'module.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifestData = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: unknown = JSON.parse(manifestData);
            const { id, name } = (manifest ?? {}) as { id?: unknown; name?: unknown };
            if (typeof id !== 'string') {
              console.warn(`⚠️ Manifest for ${entry.name} has no string id, skipping`);
              continue;
            }
            modules.push({
              id,
              manifest,
              path: path.join(modulesDir, entry.name),
            });
            console.log(`📦 Found installed module: ${String(name)} (${id})`);
          } catch (e) {
            console.warn(`⚠️ Failed to read manifest for ${entry.name}:`, e);
          }
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Failed to scan modules directory:', e);
  }

  return Promise.resolve(modules);
}
