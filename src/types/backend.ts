/**
 * Shared backend API types.
 * This file has NO dependency on wails-bridge.ts or backend-legacy.ts
 * to avoid circular imports.
 */

// --- Vietnamese IME types ---

export interface VietnameseImeSettings {
  enabled: boolean;
  autoPatch: boolean;
}

export interface VietnameseImePatchResult {
  success: boolean;
  message: string;
  version?: string;
  processesKilled?: number;
}

export interface VietnameseImeStatus {
  isPatched: boolean;
  claudePath: string;
  hasBackup: boolean;
  installedVia: 'bun' | 'npm' | 'pnpm' | 'binary' | 'unknown';
  version?: string;
}

export interface PatchValidation {
  isValid: boolean;
  isPatched?: boolean;
  issues?: string[];
  suggestions?: string[];
  reason?: string;
}

export interface PatchLog {
  timestamp: string;
  action: string;
  success: boolean;
  message?: string;
}

// --- File dialog types ---

export interface OpenDialogOptions {
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >;
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
  bookmarks?: string[];
}

// --- Dialog options for Go backend (DialogOptions) ---

export interface DialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  properties?: string[];
}

export interface DialogResult {
  Canceled: boolean;
  FilePaths: string[];
}

// --- Directory listing types ---

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface DirectoryListing {
  entries: DirectoryEntry[];
  error?: string;
}
