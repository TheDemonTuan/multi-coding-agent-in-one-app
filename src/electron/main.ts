import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Store from 'electron-store';
import * as pty from 'node-pty';
import { applyVietnameseImePatch, isVietnameseImePatched, findClaudePath, restoreFromBackup, validatePatch } from '../utils/vietnameseImePatch.js';

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
  const isDev = !app.isPackaged;

  // Use VITE_DEV_SERVER_URL if available (injected by vite-plugin-electron)
  // Otherwise, fall back to localhost with port from env or default
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || `http://localhost:${process.env.VITE_DEV_SERVER_PORT || '5173'}`;

  console.log('[Main] Starting in', isDev ? 'DEV mode' : 'PROD mode');
  console.log('[Main] Preload path:', path.join(__dirname, '../preload/preload.cjs'));

  if (isDev) {
    console.log('[Main] Loading from', devServerUrl);
    mainWindow.loadURL(devServerUrl);
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
// In dev mode, skip killing the dev terminal but still clean up user-created terminals
app.on('before-quit', () => {
  const isDev = !app.isPackaged;
  console.log('[Main] App quitting, cleaning up terminals...');

  // Get the PID of the current process to identify dev terminal
  const currentPid = process.pid;

  if (isDev) {
    // In dev mode, skip killing terminals that are running the dev server
    // but still clean up other user-created terminals
    console.log('[Main] Dev mode: Cleaning up user terminals, preserving dev process');
    terminalProcesses.forEach((term, id) => {
      try {
        // Skip killing if this terminal's PID matches current process (dev terminal)
        if (term.ptyProcess.pid === currentPid) {
          console.log(`[Main] Skipping dev terminal ${id} (pid: ${currentPid})`);
          return;
        }
        term.ptyProcess.kill();
        console.log(`[Main] Killed user terminal ${id}`);
      } catch (err) {
        console.warn(`[Main] Failed to kill terminal ${id}:`, err);
      }
    });
    terminalProcesses.clear();
    terminalWorkspaceMap.clear();
  } else {
    // In production, kill all terminal processes
    let killCount = 0;
    terminalProcesses.forEach((term, id) => {
      try {
        term.ptyProcess.kill();
        killCount++;
        console.log(`[Main] Killed terminal ${id}`);
      } catch (err) {
        console.warn(`[Main] Failed to kill terminal ${id}:`, err);
      }
    });

    console.log(`[Main] Cleaned up ${killCount} terminal(s)`);
    terminalProcesses.clear();
    terminalWorkspaceMap.clear();
  }

  // Force quit after cleanup completes
  setTimeout(() => {
    console.log('[Main] Cleanup complete, forcing app exit');
    app.exit(0);
  }, 500);
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

  // Use PowerShell for proper ANSI color support on Windows
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const args = process.platform === 'win32' ? ['-NoLogo', '-NoExit'] : [];

  console.log('[Main] Using shell:', shell, 'args:', args.join(' '), 'cwd:', actualCwd);

  try {
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cwd: actualCwd,
      cols: 80,
      rows: 24,
      env: {
        ...process.env,
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'TDTSpace',
      },
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
ipcMain.handle('spawn-terminal-with-agent', async (event, { id, cwd, agentConfig, workspaceId }: { id: string; cwd: string; agentConfig: any; workspaceId?: string }) => {

  // Auto-patch Claude Code if enabled and not already patched
  if (agentConfig?.type === 'claude-code' && agentConfig?.enabled !== false) {
    const vnSettings = store.get('vietnamese-ime-settings', { enabled: false, autoPatch: true }) as any;
    
    if (vnSettings.enabled && vnSettings.autoPatch) {
      const isPatched = isVietnameseImePatched();
      
      if (!isPatched) {
        console.log('[Main] Auto-patching Claude Code before spawning terminal...');
        try {
          const result = await applyVietnameseImePatch();
          if (result.success) {
            console.log('[Main] Auto-patch successful!');
            if (mainWindow) {
              mainWindow.webContents.send('vietnamese-ime-patch-applied', result);
            }
          } else {
            console.warn('[Main] Auto-patch failed:', result.message);
          }
        } catch (err: any) {
          console.error('[Main] Auto-patch error:', err.message);
        }
      } else {
        console.log('[Main] Claude Code already patched, skipping auto-patch');
      }
    }
  }

  // Use PowerShell for proper ANSI color support on Windows
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

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
        // Use -NoLogo -NoExit -Command to run agent in PowerShell
        const fullCmd = `${agentCmd} ${agentConfig.args?.join(' ') || ''}`.trim();
        args = ['-NoLogo', '-NoExit', '-Command', fullCmd];
      } else {
        args = ['-c', `${agentConfig.args?.join(' ') || ''}; exec $SHELL`];
      }
    } else {
      args = process.platform === 'win32' ? ['-NoLogo', '-NoExit'] : [];
    }
  } else {
    args = process.platform === 'win32' ? ['-NoLogo', '-NoExit'] : [];
  }

  console.log('[Main] Using shell:', shell, 'args:', args.join(' '));

  try {
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cwd: cwd || process.cwd(),
      cols: 80,
      rows: 24,
      env: {
        ...process.env,
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'TDTSpace',
      },
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

// Vietnamese IME patch handlers
ipcMain.handle('apply-vietnamese-ime-patch', async () => {
  console.log('[VietnameseIME] Apply patch requested');
  try {
    const result = await applyVietnameseImePatch();
    console.log('[VietnameseIME] Patch result:', result);
    
    // Update store with patch status
    if (result.success) {
      const currentSettings = store.get('vietnamese-ime-settings', {}) as any;
      store.set('vietnamese-ime-settings', {
        ...currentSettings,
        enabled: true,
        autoPatch: currentSettings.autoPatch ?? true,
        lastPatchStatus: 'success' as const,
        lastPatchPath: result.patchedPath,
      });
    } else {
      const currentSettings = store.get('vietnamese-ime-settings', {}) as any;
      store.set('vietnamese-ime-settings', {
        ...currentSettings,
        lastPatchStatus: 'failed' as const,
      });
    }
    
    return result;
  } catch (err: any) {
    console.error('[VietnameseIME] Failed to apply patch:', err.message);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('check-vietnamese-ime-patch-status', () => {
  console.log('[VietnameseIME] Check patch status requested');
  const isPatched = isVietnameseImePatched();
  const claudePath = findClaudePath();
  
  // Check for backup file
  const hasBackup = claudePath && fs.existsSync(claudePath + '.vn-backup');
  
  // Detect installation type
  let installedVia = 'unknown';
  if (claudePath) {
    if (claudePath.includes('.bun')) installedVia = 'bun';
    else if (claudePath.includes('npm')) installedVia = 'npm';
    else if (claudePath.includes('pnpm')) installedVia = 'pnpm';
    else if (claudePath.endsWith('.exe') || claudePath.endsWith('.cmd')) installedVia = 'binary';
  }
  
  // Extract version
  let version: string | null = null;
  if (claudePath && fs.existsSync(claudePath)) {
    try {
      const content = fs.readFileSync(claudePath, 'latin1');
      const versionMatch = content.match(/["']version["']\s*:\s*["']([\d.]+)["']/);
      if (versionMatch && versionMatch[1]) {
        version = versionMatch[1];
      }
    } catch {}
  }
  
  return {
    isPatched,
    claudePath,
    claudeCodeInstalled: !!claudePath,
    hasBackup,
    installedVia,
    version,
  };
});

// Restore from backup handler
ipcMain.handle('restore-vietnamese-ime-patch', async () => {
  console.log('[VietnameseIME] Restore from backup requested');
  try {
    const result = restoreFromBackup();
    console.log('[VietnameseIME] Restore result:', result);
    
    if (result.success) {
      // Update settings
      const currentSettings = store.get('vietnamese-ime-settings', {}) as any;
      store.set('vietnamese-ime-settings', {
        ...currentSettings,
        lastPatchStatus: 'failed' as const, // Cleared patch
      });
    }
    
    return result;
  } catch (err: any) {
    console.error('[VietnameseIME] Restore failed:', err.message);
    return { success: false, message: err.message };
  }
});

// Validate patch handler
ipcMain.handle('validate-vietnamese-ime-patch', () => {
  console.log('[VietnameseIME] Validate patch requested');
  try {
    const result = validatePatch();
    console.log('[VietnameseIME] Validation result:', result);
    return result;
  } catch (err: any) {
    console.error('[VietnameseIME] Validation failed:', err.message);
    return {
      isValid: false,
      isPatched: false,
      issues: [err.message],
      suggestions: ['Please try patching again'],
    };
  }
});

ipcMain.handle('get-vietnamese-ime-settings', () => {
  try {
    const settings = store.get('vietnamese-ime-settings', {
      enabled: false,
      autoPatch: true,
    }) as any;
    console.log('[VietnameseIME] Get settings:', settings);
    return settings;
  } catch (err: any) {
    console.error('[VietnameseIME] Failed to get settings:', err.message);
    return { enabled: false, autoPatch: true };
  }
});

ipcMain.handle('set-vietnamese-ime-settings', (event, settings: { enabled: boolean; autoPatch: boolean }) => {
  try {
    console.log('[VietnameseIME] Set settings:', settings);
    store.set('vietnamese-ime-settings', settings);
    
    // If enabling and autoPatch, check if already patched first
    if (settings.enabled && settings.autoPatch) {
      const isPatched = isVietnameseImePatched();
      
      if (isPatched) {
        console.log('[VietnameseIME] Auto-patch skipped: Already patched');
      } else {
        // Only apply patch if not already patched
        applyVietnameseImePatch().then(result => {
          console.log('[VietnameseIME] Auto-patch result:', result);
          if (mainWindow && result.success) {
            mainWindow.webContents.send('vietnamese-ime-patch-applied', result);
          }
        }).catch(err => {
          console.error('[VietnameseIME] Auto-patch failed:', err);
        });
      }
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('[VietnameseIME] Failed to set settings:', err.message);
    return { success: false, error: err.message };
  }
});

// Restart Claude Code terminals in current workspace
ipcMain.handle('restart-claude-terminals', async (event, { workspaceId, terminals }: { workspaceId: string; terminals: Array<{ id: string; cwd: string; agentConfig?: any }> }) => {
  console.log('[VietnameseIME] Restarting Claude terminals for workspace:', workspaceId);
  
  try {
    // First, clean up existing terminals
    await (ipcMain.handle as any)('cleanup-workspace-terminals', { workspaceId });
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Restart each terminal
    const restarted: Array<{ id: string; success: boolean; error?: string }> = [];
    
    for (const term of terminals) {
      try {
        const result = await (ipcMain.handle as any)('spawn-terminal-with-agent', {
          id: term.id,
          cwd: term.cwd,
          agentConfig: term.agentConfig,
          workspaceId,
        });
        
        restarted.push({
          id: term.id,
          success: result?.success,
          error: result?.error,
        });
      } catch (err: any) {
        restarted.push({
          id: term.id,
          success: false,
          error: err.message,
        });
      }
    }
    
    console.log('[VietnameseIME] Restarted', restarted.filter(r => r.success).length, 'terminals');
    
    return { success: true, restarted };
  } catch (err: any) {
    console.error('[VietnameseIME] Failed to restart terminals:', err.message);
    return { success: false, error: err.message };
  }
});
