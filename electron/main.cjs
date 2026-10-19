/**
 * IO-Darts-Agent desktop shell
 *
 * Starts the hub backend (dist/src/main.js) as a child process using the
 * Electron binary in Node mode, shows the web UI in a window and keeps a tray
 * icon. Runtime data lives in the per-user app data folder, because the app
 * bundle itself is read-only once installed.
 */

const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const http = require('http');
const { resolveUserPath } = require('./userPath.cjs');
const { stopChild } = require('./stopChild.cjs');

// Configuration
const PORT = parseInt(process.env.IO_DARTS_PORT || process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV === 'development';

// Exit code the hub uses to ask for a restart (see src/core/system/restart.ts)
const RESTART_EXIT_CODE = 75;

// Global references to prevent garbage collection
let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

/**
 * App root: holds dist/, web/dist/, modules/ and node_modules/.
 * The app is packaged without asar, so this is a plain folder in both modes
 * (packaged: <Resources>/app).
 */
function getAppRoot(...segments) {
  return path.join(__dirname, '..', ...segments);
}

/**
 * Get the app icon path based on platform
 */
function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' :
                   process.platform === 'darwin' ? 'icon.icns' : 'icon.png';

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', iconName);
  }
  return path.join(__dirname, '..', 'build', iconName);
}

/**
 * Get tray icon (smaller size for tray)
 */
function getTrayIcon() {
  if (app.isPackaged) {
    const trayIconPath = process.platform === 'darwin'
      ? path.join(process.resourcesPath, 'icons', 'tray-icon.png')
      : path.join(process.resourcesPath, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
    return nativeImage.createFromPath(trayIconPath);
  }

  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, '..', 'build', 'tray-icon.png')
    : getIconPath();
  return nativeImage.createFromPath(iconPath);
}

/**
 * Start the backend server as a child process.
 *
 * The Electron binary runs the backend in plain Node mode
 * (ELECTRON_RUN_AS_NODE), so no separate Node.js installation is needed.
 */
/**
 * Folder with the hub's runtime data (config, media, modules)
 */
function hubDataDir() {
  // Own subfolder, apart from Electron's caches in userData
  return path.join(app.getPath('userData'), 'hub');
}

/**
 * Port the hub listens on: after setup the hub uses server.port from its
 * config (also when changed in the settings), before that PORT
 */
function hubPort() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(hubDataDir(), 'config', 'hub.config.json'), 'utf8'));
    const port = config && config.server && config.server.port;
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return port;
    }
  } catch {
    // No config yet (before setup) or unreadable
  }
  return PORT;
}

function hubUrl() {
  return `http://localhost:${hubPort()}`;
}

// Resolved once: asking the login shell can take seconds, and the backend is
// started again on every restart from the settings page
let cachedUserPath = null;
function userPath() {
  if (cachedUserPath === null) {
    cachedUserPath = resolveUserPath({ platform: process.platform, env: process.env, execFileSync });
  }
  return cachedUserPath;
}

function startBackend() {
  const backendPath = getAppRoot('dist', 'src', 'main.js');
  const dataDir = hubDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`[Electron] Starting backend: ${backendPath}`);
  console.log(`[Electron] Data directory: ${dataDir}`);

  const env = {
    ...process.env,
    // Finder/desktop launches get a minimal PATH; module installs need the
    // user's git, node and npm (see userPath.cjs)
    PATH: userPath(),
    ELECTRON_RUN_AS_NODE: '1',
    IO_DARTS_DATA_DIR: dataDir,
    IO_DARTS_SUPERVISED: '1',
    PORT: String(PORT),
    NODE_ENV: isDev ? 'development' : 'production',
  };

  const child = spawn(process.execPath, [backendPath], {
    cwd: dataDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess = child;

  child.stdout.on('data', (data) => {
    process.stdout.write(`[Backend] ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[Backend Error] ${data}`);
  });

  child.on('error', (error) => {
    console.error('[Electron] Failed to start backend:', error);
  });

  child.on('exit', (code, signal) => {
    console.log(`[Electron] Backend exited with code ${code}, signal ${signal}`);
    if (backendProcess === child) {
      backendProcess = null;
    }
    if (isQuitting) {
      return;
    }

    if (code === RESTART_EXIT_CODE) {
      console.log('[Electron] Backend requested a restart');
      startBackend();
      waitForServer()
        .then(() => {
          // The port may have changed in the settings
          if (mainWindow) {
            void mainWindow.loadURL(hubUrl());
          }
        })
        .catch((error) => {
          console.error('[Electron] Backend did not come back after restart:', error);
          showCrashAndQuit();
        });
      return;
    }

    showCrashAndQuit();
  });

  return child;
}

function showCrashAndQuit() {
  // Exit handler and failed restart can both end up here
  if (isQuitting) {
    return;
  }
  dialog.showErrorBox(
    'IO-Darts-Agent Error',
    'The backend server has stopped unexpectedly. The application will now close.'
  );
  isQuitting = true;
  app.quit();
}

/**
 * Stop the backend server
 */
// Resolves once the backend is gone, so the app never quits before it
function stopBackend() {
  const child = backendProcess;
  if (!child) {
    return Promise.resolve();
  }
  console.log('[Electron] Stopping backend server...');
  isQuitting = true;
  backendProcess = null;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']);
    return Promise.resolve();
  }

  // The hub needs up to 7 s to stop external modules, give it a little more
  return stopChild(child, { timeoutMs: 8000 });
}

/**
 * Wait for server to be available
 */
function waitForServer(maxAttempts = 60, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;

      const retry = () => {
        if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          reject(new Error('Server did not become available'));
        }
      };

      const req = http.get(`http://127.0.0.1:${hubPort()}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', retry);
      req.end();
    };

    check();
  });
}

/**
 * Create the main browser window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getIconPath(),
    title: 'IO-Darts-Agent',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    show: false // Don't show until ready
  });

  // Load the web UI
  mainWindow.loadURL(hubUrl());

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser (http(s) only)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle window close (minimize to tray instead)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      // Show notification on first minimize
      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          title: 'IO-Darts-Agent',
          content: 'App is still running in the system tray.',
          iconType: 'info'
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

/**
 * Create the system tray icon and menu
 */
function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open IO-Darts-Agent',
      click: showWindow
    },
    {
      label: 'Open in Browser',
      click: () => {
        shell.openExternal(hubUrl());
      }
    },
    { type: 'separator' },
    {
      label: 'Status',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('IO-Darts-Agent');
  tray.setContextMenu(contextMenu);

  // Double-click opens window (Windows/Linux)
  tray.on('double-click', showWindow);

  // Single click on macOS
  if (process.platform === 'darwin') {
    tray.on('click', showWindow);
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  console.log('[Electron] Initializing IO-Darts-Agent...');
  console.log(`[Electron] Platform: ${process.platform}`);
  console.log(`[Electron] Packaged: ${app.isPackaged}`);
  console.log(`[Electron] App root: ${getAppRoot()}`);

  try {
    startBackend();
    await waitForServer();
    console.log('[Electron] Server is available');

    createTray();
    createWindow();

    console.log('[Electron] Application initialized successfully');
  } catch (error) {
    console.error('[Electron] Failed to initialize:', error);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start IO-Darts-Agent:\n\n${error.message}`
    );
    isQuitting = true;
    app.quit();
  }
}

// Only one instance may own the port and the data folder
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(initialize);

  app.on('window-all-closed', () => {
    // Keep running in the tray on every platform
  });

  app.on('activate', () => {
    // On macOS, recreate window when dock icon is clicked
    if (backendProcess) {
      showWindow();
    }
  });

  // Keep the app (and so the backend's output pipes) alive until the backend
  // has exited, then quit for real. A second quit while waiting must not
  // slip through, or the SIGKILL fallback dies with the app.
  let backendStop = null;
  app.on('before-quit', (event) => {
    isQuitting = true;
    if (!backendProcess && !backendStop) return;
    event.preventDefault();
    if (!backendStop) {
      backendStop = stopBackend().finally(() => app.exit(0));
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[Electron] Uncaught exception:', error);
    dialog.showErrorBox('Error', `An unexpected error occurred:\n\n${error.message}`);
  });
}
