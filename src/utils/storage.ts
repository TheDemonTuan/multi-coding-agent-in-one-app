/**
 * Storage utility functions for electron-store
 */

import { STORAGE_KEYS } from '../config/constants';

/**
 * Get value from electron store
 */
export async function getStoreValue<T>(key: string): Promise<T | null> {
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    
    return null;
  }

  try {
    const value = await (window as any).electronAPI.getStoreValue(key);
    return value as T;
  } catch (err) {
    console.error('[Storage] Failed to get value:', err);
    return null;
  }
}

/**
 * Set value in electron store
 */
export async function setStoreValue<T>(key: string, value: T): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).electronAPI) {
    
    return false;
  }

  try {
    const result = await (window as any).electronAPI.setStoreValue(key, value);
    return result?.success || false;
  } catch (err) {
    console.error('[Storage] Failed to set value:', err);
    return false;
  }
}

/**
 * Get workspaces from store
 */
export async function getWorkspaces() {
  return getStoreValue<any[]>(STORAGE_KEYS.WORKSPACES);
}

/**
 * Save workspaces to store
 */
export async function saveWorkspaces(workspaces: any[]) {
  return setStoreValue(STORAGE_KEYS.WORKSPACES, workspaces);
}

/**
 * Get templates from store
 */
export async function getTemplates() {
  return getStoreValue<any[]>(STORAGE_KEYS.TEMPLATES);
}

/**
 * Save templates to store
 */
export async function saveTemplates(templates: any[]) {
  return setStoreValue(STORAGE_KEYS.TEMPLATES, templates);
}

/**
 * Get settings from store
 */
export async function getSettings() {
  return getStoreValue<any>(STORAGE_KEYS.SETTINGS);
}

/**
 * Save settings to store
 */
export async function saveSettings(settings: any) {
  return setStoreValue(STORAGE_KEYS.SETTINGS, settings);
}

/**
 * Get Vietnamese IME settings
 */
export async function getVietnameseImeSettings() {
  return getStoreValue<any>(STORAGE_KEYS.VIETNAMESE_IME);
}

/**
 * Save Vietnamese IME settings
 */
export async function saveVietnameseImeSettings(settings: any) {
  return setStoreValue(STORAGE_KEYS.VIETNAMESE_IME, settings);
}
