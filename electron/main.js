const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === 'development';

// Global references to prevent garbage collection
let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

/**
 * Get the path to resources based on packaging state
 */
function getResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', ...segments);
  }
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
  const iconPath = process.platform === 'darwin'
    ? path.join(__dirname, '..', 'build', 'tray-icon.png')
    : getIconPath();

  if (app.isPackaged) {
    const trayIconPath = process.platform === 'darwin'
      ? path.join(process.resourcesPath, 'icons', 'tray-icon.png')
      : path.join(process.resourcesPath, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
    return nativeImage.createFromPath(trayIconPath);
  }

  return nativeImage.createFromPath(iconPath);
}

/**
 * Start the backend server as a child process
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting backend server...');

    const backendPath = getResourcePath('dist', 'main.js');
    console.log(`[Electron] Backend path: ${backendPath}`);

    // Determine Node.js executable path
    let nodePath;
    if (app.isPackaged) {
      // In packaged app, use bundled Node.js or system Node
      // electron-builder can bundle Node.js runtime
      nodePath = process.execPath.includes('electron') ? 'node' : process.execPath;
    } else {
      nodePath = 'node';
    }

    // Environment variables for the backend
    const env = {
      ...process.env,
      PORT: PORT.toString(),
      NODE_ENV: isDev ? 'development' : 'production',
      ELECTRON_RUN_AS_NODE: '1'
    };

    // Spawn the backend process
    backendProcess = spawn(nodePath, [backendPath], {
      cwd: getResourcePath(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Backend] ${output}`);

      // Check if server is ready
      if (output.includes('Server running at') || output.includes('listening')) {
        resolve();
      }
    });

    // Handle stderr
    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString()}`);
    });

    // Handle process exit
    backendProcess.on('error', (error) => {
      console.error('[Electron] Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`[Electron] Backend exited with code ${code}, signal ${signal}`);
      if (!isQuitting) {
        // Backend crashed, show error and restart
        dialog.showErrorBox(
          'IO-Darts-Agent Error',
          'The backend server has stopped unexpectedly. The application will now close.'
        );
        app.quit();
      }
    });

    // Fallback: resolve after timeout even if no ready message
    setTimeout(() => {
      resolve();
    }, 5000);
  });
}

/**
 * Stop the backend server
 */
function stopBackend() {
  if (backendProcess) {
    console.log('[Electron] Stopping backend server...');
    isQuitting = true;

    // Try graceful shutdown first
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGKILL');
        }
      }, 3000);
    }

    backendProcess = null;
  }
}

/**
 * Wait for server to be available
 */
function waitForServer(maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;

      const req = http.get(`http://localhost:${PORT}/api/status`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 401) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          reject(new Error('Server did not become available'));
        }
      });

      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, interval);
        } else {
          reject(new Error('Server did not become available'));
        }
      });

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
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close (minimize to tray instead)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      // Show notification on first minimize
      if (tray && process.platform !== 'darwin') {
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

/**
 * Create the system tray icon and menu
 */
function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open IO-Darts-Agent',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Open in Browser',
      click: () => {
        shell.openExternal(`http://localhost:${PORT}`);
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
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  // Single click on macOS
  if (process.platform === 'darwin') {
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    });
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  console.log('[Electron] Initializing IO-Darts-Agent...');
  console.log(`[Electron] Platform: ${process.platform}`);
  console.log(`[Electron] Packaged: ${app.isPackaged}`);
  console.log(`[Electron] Resource path: ${app.isPackaged ? process.resourcesPath : 'N/A'}`);

  try {
    // Start backend server
    await startBackend();
    console.log('[Electron] Backend started, waiting for server...');

    // Wait for server to be available
    await waitForServer();
    console.log('[Electron] Server is available');

    // Create tray icon
    createTray();

    // Create main window
    createWindow();

    console.log('[Electron] Application initialized successfully');
  } catch (error) {
    console.error('[Electron] Failed to initialize:', error);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start IO-Darts-Agent:\n\n${error.message}`
    );
    app.quit();
  }
}

// App event handlers
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray
  if (process.platform !== 'darwin') {
    // Don't quit, just hide to tray
  }
});

app.on('activate', () => {
  // On macOS, recreate window when dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('quit', () => {
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred:\n\n${error.message}`);
});
