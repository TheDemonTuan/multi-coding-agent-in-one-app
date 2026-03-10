/**
 * Type definitions for backend API (formerly ElectronAPI).
 * Types are defined in backend.ts to avoid circular imports.
 * window.electronAPI is kept as an alias for backward compatibility.
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

/** @deprecated - use backendAPI from wails-bridge instead */
export type ElectronAPI = BackendAPI;

declare global {
  interface Window {
    /** @deprecated - use backendAPI from wails-bridge instead */
    electronAPI?: BackendAPI;
  }
}

export {};
