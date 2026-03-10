/**
 * Shared backend API types.
 * This file has NO dependency on wails-bridge.ts or electron.d.ts
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
  claudeCodeInstalled: boolean;
  isPatched: boolean;
  version?: string;
  claudePath?: string;
  hasBackup?: boolean;
  installedVia?: 'bun' | 'npm' | 'binary' | 'unknown';
  error?: string;
}

export interface PatchValidation {
  isValid: boolean;
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
