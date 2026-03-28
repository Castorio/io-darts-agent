#!/usr/bin/env node

/**
 * Packaging script for IO-Darts-Agent
 * Creates distributable packages for all platforms
 *
 * Note: This creates Node.js-based packages that require Node.js to be installed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const RELEASES_DIR = path.join(ROOT_DIR, 'releases');

const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8')).version;

console.log(`\n🎯 IO-Darts-Agent Packager v${VERSION}\n`);

// Platforms to build
const platforms = [
  { name: 'linux', archive: 'tar.gz' },
  { name: 'macos', archive: 'tar.gz' },
  { name: 'windows', archive: 'zip' },
];

function run(cmd, options = {}) {
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR, ...options });
    return true;
  } catch (error) {
    console.error(`  ❌ Command failed: ${cmd}`);
    return false;
  }
}

function runSilent(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: ROOT_DIR, ...options }).trim();
  } catch (error) {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function createPackage(platform) {
  console.log(`📦 Creating package for ${platform.name}...`);

  const outputName = `autodarts-hub-${VERSION}-${platform.name}`;
  const packageDir = path.join(RELEASES_DIR, outputName);

  // Clean and create package directory
  if (fs.existsSync(packageDir)) {
    fs.rmSync(packageDir, { recursive: true });
  }
  ensureDir(packageDir);

  // Copy compiled backend
  console.log('  Copying backend...');
  copyDir(path.join(ROOT_DIR, 'dist'), path.join(packageDir, 'dist'));

  // Copy node_modules (production only)
  console.log('  Copying dependencies...');
  ensureDir(path.join(packageDir, 'node_modules'));

  // Get production dependencies
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  const prodDeps = Object.keys(pkgJson.dependencies || {});

  for (const dep of prodDeps) {
    const depSrc = path.join(ROOT_DIR, 'node_modules', dep);
    const depDest = path.join(packageDir, 'node_modules', dep);
    if (fs.existsSync(depSrc)) {
      copyDir(depSrc, depDest);
    }
  }

  // Also copy nested dependencies (common ones)
  const nestedDeps = [
    '@fastify', '@lukeed', 'fast-json-stringify', 'ajv', 'pino', 'sonic-boom',
    'atomic-sleep', 'fast-redact', 'on-exit-leak-free', 'pino-std-serializers', 'process-warning',
    'quick-format-unescaped', 'real-require', 'safe-stable-stringify', 'thread-stream',
    'send', 'ms', 'encodeurl', 'escape-html', 'etag', 'fresh', 'http-errors', 'mime',
    'on-finished', 'range-parser', 'statuses', 'destroy', 'depd', 'setprototypeof', 'toidentifier',
    'inherits', 'ee-first', 'form-data', 'follow-redirects', 'proxy-from-env', 'asynckit',
    'combined-stream', 'delayed-stream', 'mime-types', 'mime-db', 'rfdc', 'toad-cache',
    'fast-uri', 'fast-deep-equal', 'json-schema-traverse', 'require-from-string',
    'uri-js', 'punycode', 'abstract-logging', 'avvio', 'fastq', 'reusify',
    'light-my-request', 'set-cookie-parser', 'cookie', 'fast-content-type-parse',
    'find-my-way', 'fast-decode-uri-component', 'safe-regex2', 'ret',
    'secure-json-parse', 'semver', 'tiny-lru'
  ];

  for (const dep of nestedDeps) {
    const depSrc = path.join(ROOT_DIR, 'node_modules', dep);
    const depDest = path.join(packageDir, 'node_modules', dep);
    if (fs.existsSync(depSrc) && !fs.existsSync(depDest)) {
      copyDir(depSrc, depDest);
    }
  }

  // Copy web assets
  console.log('  Copying web assets...');
  const webDistSrc = path.join(ROOT_DIR, 'web', 'dist');
  const webDistDest = path.join(packageDir, 'web', 'dist');
  if (fs.existsSync(webDistSrc)) {
    copyDir(webDistSrc, webDistDest);
  }

  // Copy modules
  console.log('  Copying modules...');
  const modulesDir = path.join(ROOT_DIR, 'modules');
  const modulesDest = path.join(packageDir, 'modules');
  ensureDir(modulesDest);

  const modules = fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const mod of modules) {
    const modSrc = path.join(modulesDir, mod.name);
    const modDest = path.join(modulesDest, mod.name);
    ensureDir(modDest);

    // Copy module.json
    const manifestSrc = path.join(modSrc, 'module.json');
    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, path.join(modDest, 'module.json'));
    }

    // Copy README.md
    const readmeSrc = path.join(modSrc, 'README.md');
    if (fs.existsSync(readmeSrc)) {
      fs.copyFileSync(readmeSrc, path.join(modDest, 'README.md'));
    }

    // Copy web/dist if exists
    const webDistModSrc = path.join(modSrc, 'web', 'dist');
    if (fs.existsSync(webDistModSrc)) {
      const webDistModDest = path.join(modDest, 'web', 'dist');
      copyDir(webDistModSrc, webDistModDest);
    }
  }

  // Create modules_installed directory with copies
  const modulesInstalledDest = path.join(packageDir, 'modules_installed');
  ensureDir(modulesInstalledDest);

  for (const mod of modules) {
    const modInstallDest = path.join(modulesInstalledDest, mod.name);
    ensureDir(modInstallDest);

    const manifestSrc = path.join(modulesDir, mod.name, 'module.json');
    if (fs.existsSync(manifestSrc)) {
      fs.copyFileSync(manifestSrc, path.join(modInstallDest, 'module.json'));
    }
  }

  // Create config directory
  ensureDir(path.join(packageDir, 'config'));

  // Copy package.json (minimal version)
  const minPkg = {
    name: pkgJson.name,
    version: pkgJson.version,
    type: 'module',
    main: 'dist/main.js',
    scripts: {
      start: 'node dist/main.js'
    }
  };
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(minPkg, null, 2)
  );

  // Copy documentation
  console.log('  Copying documentation...');
  const readmeSrc = path.join(ROOT_DIR, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(packageDir, 'README.md'));
  }

  // Copy installation guide
  const installGuideSrc = path.join(ROOT_DIR, 'docs', 'installation.md');
  if (fs.existsSync(installGuideSrc)) {
    fs.copyFileSync(installGuideSrc, path.join(packageDir, 'INSTALL.md'));
  }

  // Create start scripts
  console.log('  Creating start scripts...');
  if (platform.name === 'windows') {
    fs.writeFileSync(
      path.join(packageDir, 'start.bat'),
      `@echo off\r\n` +
      `echo ================================\r\n` +
      `echo   IO-Darts-Agent v${VERSION}\r\n` +
      `echo ================================\r\n` +
      `echo.\r\n` +
      `echo Starting server...\r\n` +
      `echo Open http://localhost:3000 in your browser\r\n` +
      `echo.\r\n` +
      `cd /d "%~dp0"\r\n` +
      `node dist/main.js\r\n` +
      `if errorlevel 1 pause\r\n`
    );

    // Install script for Windows
    fs.writeFileSync(
      path.join(packageDir, 'install.bat'),
      `@echo off\r\n` +
      `echo Checking Node.js...\r\n` +
      `node -v >nul 2>&1\r\n` +
      `if errorlevel 1 (\r\n` +
      `  echo Node.js is not installed!\r\n` +
      `  echo Please download and install Node.js from https://nodejs.org/\r\n` +
      `  echo Choose the LTS version.\r\n` +
      `  pause\r\n` +
      `  exit /b 1\r\n` +
      `)\r\n` +
      `echo Node.js is installed.\r\n` +
      `echo.\r\n` +
      `echo You can now run start.bat to start IO-Darts-Agent.\r\n` +
      `pause\r\n`
    );
  } else {
    fs.writeFileSync(
      path.join(packageDir, 'start.sh'),
      `#!/bin/bash\n` +
      `echo "================================"\n` +
      `echo "  IO-Darts-Agent v${VERSION}"\n` +
      `echo "================================"\n` +
      `echo ""\n` +
      `echo "Starting server..."\n` +
      `echo "Open http://localhost:3000 in your browser"\n` +
      `echo ""\n` +
      `cd "$(dirname "$0")"\n` +
      `node dist/main.js\n`
    );
    fs.chmodSync(path.join(packageDir, 'start.sh'), '755');

    // Install script for Unix
    fs.writeFileSync(
      path.join(packageDir, 'install.sh'),
      `#!/bin/bash\n` +
      `echo "Checking Node.js..."\n` +
      `if ! command -v node &> /dev/null; then\n` +
      `  echo "Node.js is not installed!"\n` +
      `  echo ""\n` +
      `  echo "Please install Node.js:"\n` +
      `  echo ""\n` +
      `  echo "  macOS (with Homebrew): brew install node"\n` +
      `  echo "  Ubuntu/Debian: sudo apt install nodejs npm"\n` +
      `  echo "  Or download from: https://nodejs.org/"\n` +
      `  echo ""\n` +
      `  exit 1\n` +
      `fi\n` +
      `echo "Node.js $(node -v) is installed."\n` +
      `echo ""\n` +
      `echo "You can now run ./start.sh to start IO-Darts-Agent."\n`
    );
    fs.chmodSync(path.join(packageDir, 'install.sh'), '755');
  }

  // Create archive
  console.log(`  Creating ${platform.archive} archive...`);
  const archiveName = `${outputName}.${platform.archive}`;

  if (platform.archive === 'zip') {
    runSilent(`cd "${RELEASES_DIR}" && rm -f "${archiveName}"`);
    run(`cd "${RELEASES_DIR}" && zip -r "${archiveName}" "${outputName}"`);
  } else {
    runSilent(`cd "${RELEASES_DIR}" && rm -f "${archiveName}"`);
    run(`cd "${RELEASES_DIR}" && tar -czvf "${archiveName}" "${outputName}"`);
  }

  console.log(`  ✅ Created ${archiveName}\n`);
  return archiveName;
}

async function main() {
  const args = process.argv.slice(2);
  const selectedPlatform = args[0];

  ensureDir(RELEASES_DIR);

  // Filter platforms if specified
  let platformsToBuild = platforms;
  if (selectedPlatform && selectedPlatform !== 'all') {
    platformsToBuild = platforms.filter(p => p.name === selectedPlatform);
    if (platformsToBuild.length === 0) {
      console.error(`Unknown platform: ${selectedPlatform}`);
      console.log(`Available platforms: ${platforms.map(p => p.name).join(', ')}, all`);
      process.exit(1);
    }
  }

  // Create packages
  const created = [];
  for (const platform of platformsToBuild) {
    const archive = await createPackage(platform);
    created.push(archive);
  }

  console.log('🎉 Packaging complete!\n');
  console.log('Created packages:');
  for (const archive of created) {
    const archivePath = path.join(RELEASES_DIR, archive);
    const stats = fs.statSync(archivePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  - ${archive} (${sizeMB} MB)`);
  }
  console.log(`\nPackages are in: ${RELEASES_DIR}`);
  console.log(`\n⚠️  Note: Users need Node.js 18+ installed to run the hub.`);
}

main().catch(console.error);
