import { AgentConfig } from './workspace';

export interface VietnameseImePatchResult {
  success: boolean;
  alreadyPatched?: boolean;
  message?: string;
  patchedPath?: string;
  processesKilled?: number;
  version?: string;
}

export interface VietnameseImeStatus {
  isPatched: boolean;
  claudePath: string | null;
  claudeCodeInstalled: boolean;
  hasBackup?: boolean;
  installedVia?: 'bun' | 'npm' | 'pnpm' | 'binary' | 'unknown';
  version?: string | null;
}

export interface VietnameseImeSettings {
  enabled: boolean;
  autoPatch: boolean;
  patchedVersion?: string;
  lastPatchStatus?: 'success' | 'failed' | 'pending';
  lastPatchPath?: string;
}

export interface PatchValidation {
  isValid: boolean;
  isPatched: boolean;
  issues: string[];
  suggestions: string[];
}

export interface PatchLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface OpenDialogOptions {
  properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory')[];
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
  error?: string;
}

export interface ElectronAPI {
  // App info
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getCwd: () => Promise<string>;
  
  // Window controls
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  
  // Electron store management
  getStoreValue: (key: string) => Promise<any>;
  setStoreValue: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
  
  // File dialogs
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>;
  
  // Workspace management
  createWorkspace: (config: any) => Promise<any>;
  deleteWorkspace: (id: string) => Promise<{ success: boolean; error?: string }>;
  switchWorkspace: (id: string) => Promise<any>;
  getWorkspaces: () => Promise<any[]>;
  
  // Terminal management
  spawnTerminal: (id: string, cwd: string, workspaceId?: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  spawnTerminalWithAgent: (id: string, cwd: string, agentConfig: AgentConfig, workspaceId?: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
  terminalWrite: (id: string, data: string) => Promise<{ success: boolean; error?: string }>;
  terminalKill: (id: string) => Promise<{ success: boolean; error?: string }>;
  terminalResize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  cleanupWorkspaceTerminals: (workspaceId: string) => Promise<{ success: boolean; cleaned?: number }>;
  
  // Terminal events
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => () => void;
  onTerminalStarted: (callback: (data: { id: string }) => void) => () => void;
  onTerminalExit: (callback: (data: { id: string; code: number | null; signal?: string }) => void) => () => void;
  onTerminalError: (callback: (data: { id: string; error: string }) => void) => () => void;
  
  // Vietnamese IME patch
  applyVietnameseImePatch: () => Promise<VietnameseImePatchResult>;
  checkVietnameseImePatchStatus: () => Promise<VietnameseImeStatus>;
  getVietnameseImeSettings: () => Promise<VietnameseImeSettings>;
  setVietnameseImeSettings: (settings: VietnameseImeSettings) => Promise<{ success: boolean; error?: string }>;
  restartClaudeTerminals: (workspaceId: string, terminals: Array<{ id: string; cwd: string; agentConfig?: any }>) => Promise<{ success: boolean; restarted?: Array<{ id: string; success: boolean; error?: string }> }>;
  restoreVietnameseImePatch: () => Promise<{ success: boolean; message?: string }>;
  validateVietnameseImePatch: () => Promise<PatchValidation>;
  onVietnameseImePatchApplied: (callback: (result: VietnameseImePatchResult) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
