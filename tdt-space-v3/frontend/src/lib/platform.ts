/**
 * Platform detection utilities
 */

import { backendAPI, isWailsAvailable } from '../services/wails-bridge';

export type Platform = 'win32' | 'darwin' | 'linux';

let cachedPlatform: Platform | null = null;

/**
 * Get current platform
 * Falls back to checking from backend API if not available
 */
export function getPlatform(): Platform {
  if (cachedPlatform) {
    return cachedPlatform;
  }

  // Check if we're in Wails runtime
  if (isWailsAvailable()) {
    backendAPI.getPlatform().then((platform: string) => {
      cachedPlatform = platform as Platform;
    }).catch(console.warn);
  }

  // Fallback to navigator.platform
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) {
      cachedPlatform = 'win32';
    } else if (platform.includes('mac')) {
      cachedPlatform = 'darwin';
    } else if (platform.includes('linux')) {
      cachedPlatform = 'linux';
    }
  }

  return cachedPlatform || 'win32';
}

/**
 * Check if current platform is Windows
 */
export function isWindows(): boolean {
  return getPlatform() === 'win32';
}

/**
 * Check if current platform is macOS
 */
export function isMacOS(): boolean {
  return getPlatform() === 'darwin';
}

/**
 * Check if current platform is Linux
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * Get platform-specific shell
 */
export function getShell(): string {
  if (isWindows()) return 'powershell.exe';
  if (isMacOS()) return '/bin/zsh';
  return '/bin/bash';
}

/**
 * Get platform-specific modifier key name
 */
export function getModifierKeyName(): string {
  return isMacOS() ? 'Cmd' : 'Ctrl';
}
