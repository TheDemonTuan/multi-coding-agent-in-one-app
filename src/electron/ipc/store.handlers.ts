/**
 * Store IPC Handlers
 * Handles electron-store get/set operations
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '../../config/constants';
import { logger } from '../../lib/logger';

const log = logger.child('[IPC:Store]');

export function initializeStoreHandlers(store: Store) {
  // Get store value
  ipcMain.handle(IPC_CHANNELS.GET_STORE_VALUE, (event, { key }) => {
    try {
      const value = store.get(key);
      log.debug('Getting store value', { key });
      return value;
    } catch (err: any) {
      log.error('Failed to get store value', { key, error: err.message });
      return null;
    }
  });

  // Set store value
  ipcMain.handle(IPC_CHANNELS.SET_STORE_VALUE, (event, { key, value }) => {
    try {
      log.debug('Setting store value', { key });
      store.set(key, value);
      log.debug('Successfully set store value', { key });
      return { success: true };
    } catch (err: any) {
      log.error('Failed to set store value', { key, error: err.message });
      return { success: false, error: err.message };
    }
  });
}
