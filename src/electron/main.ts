import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { logger } from '../lib/logger';
import { initializeAllHandlers, cleanupAllTerminals, validatePatchOnStartup } from './ipc';
import { applyVietnameseImePatch, isVietnameseImePatched } from '../utils/vietnameseImePatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.child('[Main]');

// Initialize electron-store
const store = new Store();

// Enable GPU acceleration for WebGL rendering in xterm.js (~900% faster than Canvas).
// Use ANGLE on Windows for best compatibility with most GPU drivers.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('use-gl', 'angle');
  app.commandLine.appendSwitch('use-angle', 'd3d11'); // D3D11 is the most compatible on Windows
}
app.commandLine.appendSwitch('disable-features', 'TranslateUI,MediaRouter,OptimizationHints');

let mainWindow: BrowserWindow | null = null;

function createMenu() {
  const template: any = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Terminal',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            log.debug('New Terminal clicked');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About TDT Space',
          click: () => {
            log.debug('About clicked');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    // macOS: use native titlebar with traffic lights; Windows/Linux: frameless with custom titlebar
    frame: process.platform === 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 12, y: 14 } : undefined,
    backgroundColor: '#1e1e2e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.cjs'),
      webgl: true,        // enabled: allows xterm.js WebGL addon (GPU-accelerated rendering)
      experimentalFeatures: false,
      devTools: true,
    },
  });

  const isDev = !app.isPackaged;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || `http://localhost:${process.env.VITE_DEV_SERVER_PORT || '5173'}`;

  log.info('Starting in', isDev ? 'DEV mode' : 'PROD mode');
  log.info('Preload path:', path.join(__dirname, '../preload/preload.cjs'));

  if (isDev) {
    log.info('Loading from', devServerUrl);
    mainWindow.loadURL(devServerUrl);
  } else {
    log.info('Loading from file:', path.join(__dirname, '../../dist/index.html'));
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    log.info('Window ready-to-show');
    mainWindow?.show();
    mainWindow?.maximize();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Page loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    log.error('Page load failed:', code, desc);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log.error('Render process gone:', details);
  });

  mainWindow.on('closed', () => {
    log.info('Window closed');
    mainWindow = null;
  });

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception:', err);
  });
}

app.whenReady().then(() => {
  log.info('App ready, creating window...');
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.setName('TDT Space');
  log.info('App name set to TDT Space');

  // Initialize all IPC handlers
  initializeAllHandlers(mainWindow, store);
  log.info('All IPC handlers initialized');

  // Validate Vietnamese IME patch on startup (check for version mismatch after Claude Code auto-update)
  // Works with Claude Code installed via npm, bun, pnpm, or binary
  validatePatchOnStartup(store, mainWindow).catch(err => {
    log.error('Startup patch validation failed', { error: err.message });
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed, quitting app');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up terminals before app quits
app.on('before-quit', () => {
  const isDev = !app.isPackaged;
  log.info('App quitting, cleaning up terminals...');

  const killCount = cleanupAllTerminals(isDev, mainWindow);
  log.info(`Cleaned up ${killCount} terminal(s)`);

  // Force quit after cleanup completes
  setTimeout(() => {
    log.info('Cleanup complete, forcing app exit');
    app.exit(0);
  }, 500);
});
