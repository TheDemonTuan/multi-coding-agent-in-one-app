// Preload script - CommonJS format for Electron
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getCwd: () => ipcRenderer.invoke('get-cwd'),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // Electron store management
  getStoreValue: (key) => ipcRenderer.invoke('get-store-value', { key }),
  setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', { key, value }),

  // File dialogs
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Workspace management
  createWorkspace: (config) => ipcRenderer.invoke('create-workspace', config),
  deleteWorkspace: (id) => ipcRenderer.invoke('delete-workspace', { id }),
  switchWorkspace: (id) => ipcRenderer.invoke('switch-workspace', { id }),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),

  // Terminal management
  spawnTerminal: (id, cwd, workspaceId) => ipcRenderer.invoke('spawn-terminal', { id, cwd, workspaceId }),
  spawnTerminalWithAgent: (id, cwd, agentConfig, workspaceId) => ipcRenderer.invoke('spawn-terminal-with-agent', { id, cwd, agentConfig, workspaceId }),
  terminalWrite: (id, data) => ipcRenderer.invoke('terminal-write', { id, data }),
  terminalKill: (id) => ipcRenderer.invoke('terminal-kill', { id }),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', { id, cols, rows }),
  cleanupWorkspaceTerminals: (workspaceId) => ipcRenderer.invoke('cleanup-workspace-terminals', { workspaceId }),

  // Template management
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  saveTemplate: (template) => ipcRenderer.invoke('save-template', template),
  deleteTemplate: (id) => ipcRenderer.invoke('delete-template', { id }),

  // Terminal command history
  getTerminalHistory: (terminalId) => ipcRenderer.invoke('get-terminal-history', { terminalId }),
  saveTerminalHistory: (terminalId, history) => ipcRenderer.invoke('save-terminal-history', { terminalId, history }),
  clearTerminalHistory: (terminalId) => ipcRenderer.invoke('clear-terminal-history', { terminalId }),

  // Vietnamese IME patch
  applyVietnameseImePatch: () => ipcRenderer.invoke('apply-vietnamese-ime-patch'),
  checkVietnameseImePatchStatus: () => ipcRenderer.invoke('check-vietnamese-ime-patch-status'),
  getVietnameseImeSettings: () => ipcRenderer.invoke('get-vietnamese-ime-settings'),
  setVietnameseImeSettings: (settings) => ipcRenderer.invoke('set-vietnamese-ime-settings', settings),
  restartClaudeTerminals: (workspaceId, terminals) => ipcRenderer.invoke('restart-claude-terminals', workspaceId, terminals),
  restoreVietnameseImePatch: () => ipcRenderer.invoke('restore-vietnamese-ime-patch'),
  validateVietnameseImePatch: () => ipcRenderer.invoke('validate-vietnamese-ime-patch'),
  onVietnameseImePatchApplied: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('vietnamese-ime-patch-applied', listener);
    return () => ipcRenderer.removeListener('vietnamese-ime-patch-applied', listener);
  },

  // Terminal events
  onTerminalData: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('terminal-data', listener);
    return () => ipcRenderer.removeListener('terminal-data', listener);
  },
  onTerminalStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('terminal-started', listener);
    return () => ipcRenderer.removeListener('terminal-started', listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('terminal-exit', listener);
    return () => ipcRenderer.removeListener('terminal-exit', listener);
  },
  onTerminalError: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('terminal-error', listener);
    return () => ipcRenderer.removeListener('terminal-error', listener);
  },
});
