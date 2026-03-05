import { AgentConfig } from './workspace';

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
  spawnTerminal: (id: string, cwd: string) => Promise<{ success: boolean; pid?: number }>;
  spawnTerminalWithAgent: (id: string, cwd: string, agentConfig: AgentConfig) => Promise<{ success: boolean; pid?: number }>;
  terminalWrite: (id: string, data: string) => Promise<{ success: boolean; error?: string }>;
  terminalKill: (id: string) => Promise<{ success: boolean; error?: string }>;
  terminalResize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  
  // Terminal events
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => () => void;
  onTerminalStarted: (callback: (data: { id: string }) => void) => () => void;
  onTerminalExit: (callback: (data: { id: string; code: number | null }) => void) => () => void;
  onTerminalError: (callback: (data: { id: string; error: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
