import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Store from 'electron-store';
import * as pty from 'node-pty';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize electron-store
const store = new Store();

// Disable ALL GPU features BEFORE app ready
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gl-drawing-for-tests');
app.commandLine.appendSwitch('use-gl', 'disabled');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('disable-features', 'TranslateUI,MediaRouter,OptimizationHints');

// Store terminal processes
const terminalProcesses = new Map<string, {
  ptyProcess: pty.IPty;
  cwd: string;
  agentType?: string;
  workspaceId?: string; // Track which workspace owns this terminal
}>();

// Track workspace -> terminals mapping for cleanup
const terminalWorkspaceMap = new Map<string, string>(); // terminalId -> workspaceId

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
            console.log('New Terminal clicked');
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        {
          label: 'Layout',
          submenu: [
            {
              label: '2x2 Grid',
              click: () => console.log('2x2 layout')
            },
            {
              label: '4x4 Grid',
              click: () => console.log('4x4 layout')
            }
          ]
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About TDT Space',
          click: () => {
            console.log('About clicked');
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
    frame: false,
    backgroundColor: '#1e1e2e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.cjs'),
      webgl: false,
      experimentalFeatures: false,
      devTools: true,
    },
  });

  // Load Vite dev server or built files
  const isDev = process.env.ELECTRON_IS_DEV !== '0';
  console.log('[Main] Starting in', isDev ? 'DEV mode' : 'PROD mode');
  console.log('[Main] Preload path:', path.join(__dirname, '../preload/preload.cjs'));

  if (isDev) {
    console.log('[Main] Loading from http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    console.log('[Main] Loading from file:', path.join(__dirname, '../../dist/index.html'));
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Show window when ready and maximize
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready-to-show');
    mainWindow?.show();
    // Maximize window after showing
    mainWindow?.maximize();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
    console.error('[Main] Page load failed:', code, desc);
  });

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Render process gone:', details);
  });

  mainWindow.on('closed', () => {
    console.log('[Main] Window closed');
    mainWindow = null;
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('[Main] Uncaught exception:', err);
  });
}

app.whenReady().then(() => {
  console.log('[Main] App ready, creating window...');
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Set app name
  app.setName('TDT Space');
  console.log('[Main] App name set to TDT Space');
});

app.on('window-all-closed', () => {
  console.log('[Main] All windows closed, quitting app');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up terminals before app quits
app.on('before-quit', () => {
  console.log('[Main] App quitting, cleaning up terminals...');
  terminalProcesses.forEach((term) => {
    try {
      term.ptyProcess.kill();
    } catch (err) {
      // Process may have already exited, ignore errors
    }
  });
  terminalProcesses.clear();
  terminalWorkspaceMap.clear();
});

// IPC handlers for terminal management
ipcMain.handle('spawn-terminal', (event, { id, cwd, workspaceId }: { id: string; cwd: string; workspaceId?: string }) => {
  console.log('[Main] Spawning terminal', id, 'in', cwd, 'workspace:', workspaceId);

  // Validate cwd exists
  const actualCwd = cwd || process.cwd();
  try {
    if (!fs.existsSync(actualCwd)) {
      console.error(`[Main] CWD does not exist: ${actualCwd}, using process.cwd()`);
    }
  } catch (err) {
    console.error('[Main] Error checking cwd:', err);
  }

  // Use cmd.exe with /k to keep shell open (just opens cmd prompt)
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  const args = process.platform === 'win32' ? ['/k'] : [];

  console.log('[Main] Using shell:', shell, 'args:', args.join(' '), 'cwd:', actualCwd);

  try {
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cwd: actualCwd,
      cols: 80,
      rows: 24,
      useConpty: false, // Disable ConPTY to avoid STATUS_INVALID_IMAGE_FORMAT error on Windows
    });

    console.log('[Main] Spawned PTY process with PID:', ptyProcess.pid);

    terminalProcesses.set(id, { ptyProcess, cwd, workspaceId });
    if (workspaceId) {
      terminalWorkspaceMap.set(id, workspaceId);
    }

    // Send confirmation that terminal has started
    setTimeout(() => {
      mainWindow?.webContents.send('terminal-started', { id });
    }, 300);

    ptyProcess.onData((data: string) => {
      // Check for error messages in terminal output
      if (data.toLowerCase().includes('error') || data.toLowerCase().includes('not recognized')) {
        console.log(`[Terminal ${id}] Output contains error:`, data.substring(0, 100));
      }
      mainWindow?.webContents.send('terminal-data', { id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[Terminal ${id}] exited with code ${exitCode}, signal: ${signal}`);
      if (exitCode !== 0 && exitCode !== undefined) {
        console.error(`[Terminal ${id}] Abnormal exit with code ${exitCode}`);
      }
      mainWindow?.webContents.send('terminal-exit', { id, code: exitCode, signal });
      terminalProcesses.delete(id);
      terminalWorkspaceMap.delete(id);
    });

    return { success: true, pid: ptyProcess.pid };
  } catch (err: any) {
    console.error('[Main] Failed to spawn terminal:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('terminal-write', (event, { id, data }: { id: string; data: string }) => {
  const term = terminalProcesses.get(id);
  if (term) {
    term.ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal-kill', (event, { id }: { id: string }) => {
  const term = terminalProcesses.get(id);
  console.log(`[Main] terminal-kill called for ${id}, found:`, !!term);
  if (term) {
    try {
      term.ptyProcess.kill();
      terminalProcesses.delete(id);
      terminalWorkspaceMap.delete(id);
      console.log(`[Main] Terminal ${id} killed successfully`);
      return { success: true };
    } catch (err) {
      console.error(`[Main] Failed to kill terminal ${id}:`, err);
      return { success: false, error: String(err) };
    }
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal-resize', (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
  const term = terminalProcesses.get(id);
  if (term) {
    try {
      term.ptyProcess.resize(cols, rows);
      console.log(`[Main] Terminal resized: ${id} ${cols}x${rows}`);
    } catch (err) {
      console.error('[Main] Failed to resize terminal:', err);
    }
  }
  return { success: true };
});

// Cleanup terminals for a specific workspace (called when switching workspaces)
ipcMain.handle('cleanup-workspace-terminals', (event, { workspaceId }: { workspaceId: string }) => {
  console.log(`[Main] Cleaning up terminals for workspace: ${workspaceId}`);
  let cleaned = 0;

  terminalProcesses.forEach((term, id) => {
    const termWorkspaceId = terminalWorkspaceMap.get(id);
    if (termWorkspaceId === workspaceId) {
      try {
        term.ptyProcess.kill();
        terminalProcesses.delete(id);
        terminalWorkspaceMap.delete(id);
        cleaned++;
        console.log(`[Main] Cleaned up terminal ${id} from workspace ${workspaceId}`);
      } catch (err) {
        console.error(`[Main] Failed to cleanup terminal ${id}:`, err);
      }
    }
  });

  console.log(`[Main] Cleaned up ${cleaned} terminals for workspace ${workspaceId}`);
  return { success: true, cleaned };
});

// IPC handlers for electron-store
ipcMain.handle('get-store-value', (event, { key }: { key: string }) => {
  try {
    const value = store.get(key);
    console.log('[Store] Getting key:', key, 'value:', JSON.stringify(value, null, 2));
    return value;
  } catch (err: any) {
    console.error('[Store] Failed to get value:', err.message);
    return null;
  }
});

ipcMain.handle('set-store-value', (event, { key, value }: { key: string; value: any }) => {
  try {
    console.log('[Store] Setting key:', key, 'value:', JSON.stringify(value, null, 2));
    store.set(key, value);
    console.log('[Store] Successfully set key:', key);
    return { success: true };
  } catch (err: any) {
    console.error('[Store] Failed to set value:', err.message);
    return { success: false, error: err.message };
  }
});

// Workspace management handlers
ipcMain.handle('get-workspaces', () => {
  try {
    const workspaces = store.get('workspaces', []) as any[];
    console.log('[Workspace] Getting workspaces, count:', workspaces.length);
    return workspaces;
  } catch (err: any) {
    console.error('[Workspace] Failed to get workspaces:', err.message);
    return [];
  }
});

ipcMain.handle('create-workspace', (event, config) => {
  try {
    const workspaces = store.get('workspaces', []) as any[];
    const newWorkspace = {
      ...config,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
    workspaces.push(newWorkspace);
    store.set('workspaces', workspaces);
    console.log('[Workspace] Created workspace:', newWorkspace.name);
    return newWorkspace;
  } catch (err: any) {
    console.error('[Workspace] Failed to create workspace:', err.message);
    return null;
  }
});

ipcMain.handle('delete-workspace', (event, { id }) => {
  try {
    const workspaces = store.get('workspaces', []) as any[];
    const filtered = workspaces.filter((ws: any) => ws.id !== id);
    store.set('workspaces', filtered);
    console.log('[Workspace] Deleted workspace:', id);

    // Also kill terminals associated with this workspace
    terminalProcesses.forEach((term, terminalId) => {
      if (terminalWorkspaceMap.get(terminalId) === id) {
        try {
          term.ptyProcess.kill();
          terminalProcesses.delete(terminalId);
          terminalWorkspaceMap.delete(terminalId);
        } catch (err) {
          console.error(`[Main] Failed to kill terminal ${terminalId} during workspace delete:`, err);
        }
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error('[Workspace] Failed to delete workspace:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('switch-workspace', (event, { id }) => {
  try {
    const workspaces = store.get('workspaces', []) as any[];
    const workspace = workspaces.find((ws: any) => ws.id === id);
    if (workspace) {
      workspace.lastUsed = Date.now();
      store.set('workspaces', workspaces);
      console.log('[Workspace] Switched to workspace:', workspace.name);
      return workspace;
    }
    return null;
  } catch (err: any) {
    console.error('[Workspace] Failed to switch workspace:', err.message);
    return null;
  }
});

// File dialog handler
ipcMain.handle('show-open-dialog', (event, options: any) => {
  try {
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }
    const result = dialog.showOpenDialogSync(mainWindow, {
      properties: options.properties || ['openFile'],
      title: options.title || 'Select',
      defaultPath: options.defaultPath,
      filters: options.filters,
    });

    if (result && result.length > 0) {
      return { canceled: false, filePaths: result };
    }
    return { canceled: true, filePaths: [] };
  } catch (err: any) {
    console.error('[Dialog] Failed to show open dialog:', err.message);
    return { canceled: true, filePaths: [], error: err.message };
  }
});

// Spawn terminal with agent CLI
ipcMain.handle('spawn-terminal-with-agent', (event, { id, cwd, agentConfig, workspaceId }: { id: string; cwd: string; agentConfig: any; workspaceId?: string }) => {

  // Use cmd.exe as the shell for better compatibility on Windows
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';

  // Build agent command if specified
  let args: string[] = [];

  if (agentConfig && agentConfig.type !== 'none' && agentConfig.enabled) {
    const agentCommands: Record<string, string> = {
      'claude-code': 'claude',
      'opencode': 'opencode',
      'droid': 'droid',
    };

    const agentCmd = agentConfig.command || agentCommands[agentConfig.type];
    if (agentCmd) {
      if (process.platform === 'win32') {
        // Use /k to keep shell open after running agent
        args = ['/k', `${agentCmd} ${agentConfig.args?.join(' ') || ''}`];
      } else {
        args = ['-c', `${agentConfig.args?.join(' ') || ''}; exec $SHELL`];
      }
    } else {
      args = process.platform === 'win32' ? ['/k'] : [];
    }
  } else {
    args = process.platform === 'win32' ? ['/k'] : [];
  }

  console.log('[Main] Using shell:', shell, 'args:', args.join(' '));

  try {
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cwd: cwd || process.cwd(),
      cols: 80,
      rows: 24,
      useConpty: false, // Disable ConPTY to avoid STATUS_INVALID_IMAGE_FORMAT error
    });

    console.log('[Main] Spawned PTY process with PID:', ptyProcess.pid);

    terminalProcesses.set(id, {
      ptyProcess,
      cwd,
      agentType: agentConfig?.type || 'none',
      workspaceId
    });

    if (workspaceId) {
      terminalWorkspaceMap.set(id, workspaceId);
    }

    setTimeout(() => {
      mainWindow?.webContents.send('terminal-started', { id });
    }, 100);

    ptyProcess.onData((data: string) => {
      mainWindow?.webContents.send('terminal-data', { id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[Terminal ${id}] exited with code ${exitCode}, signal: ${signal}`);
      mainWindow?.webContents.send('terminal-exit', { id, code: exitCode, signal });
      terminalProcesses.delete(id);
      terminalWorkspaceMap.delete(id);
    });

    return { success: true, pid: ptyProcess.pid };
  } catch (err: any) {
    console.error('[Main] Failed to spawn terminal with agent:', err.message);
    return { success: false, error: err.message };
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-cwd', () => process.cwd());

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Template management handlers
ipcMain.handle('get-templates', () => {
  try {
    const templates = store.get('templates', []) as any[];
    console.log('[Template] Getting templates, count:', templates.length);
    return templates;
  } catch (err: any) {
    console.error('[Template] Failed to get templates:', err.message);
    return [];
  }
});

ipcMain.handle('save-template', (event, template) => {
  try {
    const templates = store.get('templates', []) as any[];
    const existingIndex = templates.findIndex((t: any) => t.id === template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = template;
      console.log('[Template] Updated template:', template.id);
    } else {
      templates.push(template);
      console.log('[Template] Created new template:', template.id);
    }

    store.set('templates', templates);
    return { success: true };
  } catch (err: any) {
    console.error('[Template] Failed to save template:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-template', (event, { id }) => {
  try {
    const templates = store.get('templates', []) as any[];
    const filtered = templates.filter((t: any) => t.id !== id);
    store.set('templates', filtered);
    console.log('[Template] Deleted template:', id);
    return { success: true };
  } catch (err: any) {
    console.error('[Template] Failed to delete template:', err.message);
    return { success: false, error: err.message };
  }
});

// Terminal command history handlers
ipcMain.handle('get-terminal-history', (event, { terminalId }: { terminalId: string }) => {
  try {
    const history = store.get(`terminal-history:${terminalId}`, []) as any[];
    return history;
  } catch (err: any) {
    console.error('[TerminalHistory] Failed to get history:', err.message);
    return [];
  }
});

ipcMain.handle('save-terminal-history', (event, { terminalId, history }: { terminalId: string; history: any[] }) => {
  try {
    store.set(`terminal-history:${terminalId}`, history);
    console.log('[TerminalHistory] Saved history for terminal:', terminalId);
    return { success: true };
  } catch (err: any) {
    console.error('[TerminalHistory] Failed to save history:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('clear-terminal-history', (event, { terminalId }: { terminalId: string }) => {
  try {
    store.delete(`terminal-history:${terminalId}`);
    console.log('[TerminalHistory] Cleared history for terminal:', terminalId);
    return { success: true };
  } catch (err: any) {
    console.error('[TerminalHistory] Failed to clear history:', err.message);
    return { success: false, error: err.message };
  }
});
