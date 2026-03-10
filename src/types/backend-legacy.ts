/**
 * Legacy type definitions for backward compatibility.
 * @deprecated Use types from './backend' or BackendAPI from 'services/wails-bridge' instead.
 */

import type { BackendAPI } from '../services/wails-bridge';

export type {
  VietnameseImePatchResult,
  VietnameseImeStatus,
  VietnameseImeSettings,
  PatchValidation,
  PatchLog,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from './backend';

// Additional types for Wails Go bindings
export interface PatchResult {
  success: boolean;
  alreadyPatched?: boolean;
  message?: string;
  patchedPath?: string;
  processesKilled?: number;
  version?: string;
}

export interface PatchStatus {
  isPatched: boolean;
  claudePath: string;
  hasBackup: boolean;
  installedVia: 'bun' | 'npm' | 'pnpm' | 'binary' | 'unknown';
  version?: string;
}

export interface IMESettings {
  enabled: boolean;
  autoPatch: boolean;
  patchedVersion?: string;
}

export interface RestoreResult {
  success: boolean;
  message?: string;
  backupPath?: string;
}

export interface Result {
  success: boolean;
  error?: string;
}

/** @deprecated Use BackendAPI from 'services/wails-bridge' instead */
export type ElectronAPI = BackendAPI;

declare global {
  interface Window {
    /** @deprecated Use window.go.main.App or backendAPI from 'services/wails-bridge' instead */
    electronAPI?: BackendAPI;
  }
}

export {};
