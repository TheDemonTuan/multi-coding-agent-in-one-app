/**
 * IPC-related types
 */

// Request/Response types for IPC communication
export interface IPCRequest<T = any> {
  channel: string;
  data?: T;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Terminal IPC
export interface SpawnTerminalRequest {
  id: string;
  cwd: string;
  workspaceId?: string;
}

export interface SpawnTerminalResponse {
  success: boolean;
  pid?: number;
  error?: string;
}

export interface WriteTerminalRequest {
  id: string;
  data: string;
}

export interface ResizeTerminalRequest {
  id: string;
  cols: number;
  rows: number;
}

export interface CleanupWorkspaceTerminalsRequest {
  workspaceId: string;
}

export interface CleanupWorkspaceTerminalsResponse {
  success: boolean;
  cleaned: number;
}

// Workspace IPC
export interface CreateWorkspaceRequest {
  name: string;
  columns: number;
  rows: number;
  cwd?: string;
  icon?: string;
  agentAssignments?: Record<string, any>;
}

export interface DeleteWorkspaceRequest {
  id: string;
}

export interface SwitchWorkspaceRequest {
  id: string;
}

// Store IPC
export interface GetStoreValueRequest {
  key: string;
}

export interface SetStoreValueRequest {
  key: string;
  value: any;
}

// Template IPC
export interface SaveTemplateRequest {
  id: string;
  name: string;
  columns: number;
  rows: number;
  terminals?: any[];
}

export interface DeleteTemplateRequest {
  id: string;
}

// Window IPC
export interface WindowControlRequest {
  action: 'minimize' | 'maximize' | 'close';
}

// Vietnamese IME IPC
export interface VietnameseImePatchResponse {
  success: boolean;
  message?: string;
  patchedPath?: string;
  backupPath?: string;
}

export interface VietnameseImeStatusResponse {
  isPatched: boolean;
  claudePath: string | null;
  claudeCodeInstalled: boolean;
  hasBackup: boolean;
  installedVia: string;
  version: string | null;
}

export interface VietnameseImeSettings {
  enabled: boolean;
  autoPatch: boolean;
}

// Terminal History IPC
export interface GetTerminalHistoryRequest {
  terminalId: string;
}

export interface SaveTerminalHistoryRequest {
  terminalId: string;
  history: any[];
}

export interface ClearTerminalHistoryRequest {
  terminalId: string;
}

// Dialog IPC
export interface ShowOpenDialogOptions {
  properties?: string[];
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface ShowOpenDialogResponse {
  canceled: boolean;
  filePaths: string[];
  error?: string;
}
