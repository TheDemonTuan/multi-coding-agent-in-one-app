/**
 * Terminal History IPC Handlers
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '../../config/constants';
import { logger } from '../../lib/logger';

const log = logger.child('[IPC:TerminalHistory]');

export function initializeTerminalHistoryHandlers(store: Store) {
  // Get terminal history
  ipcMain.handle(IPC_CHANNELS.GET_TERMINAL_HISTORY, (event, { terminalId }: { terminalId: string }) => {
    try {
      const history = store.get(`terminal-history:${terminalId}`, []) as any[];
      return history;
    } catch (err: any) {
      log.error('Failed to get terminal history', { terminalId, error: err.message });
      return [];
    }
  });

  // Save terminal history
  ipcMain.handle(IPC_CHANNELS.SAVE_TERMINAL_HISTORY, (event, { terminalId, history }: { terminalId: string; history: any[] }) => {
    try {
      store.set(`terminal-history:${terminalId}`, history);
      log.debug('Saved terminal history', { terminalId });
      return { success: true };
    } catch (err: any) {
      log.error('Failed to save terminal history', { terminalId, error: err.message });
      return { success: false, error: err.message };
    }
  });

  // Clear terminal history
  ipcMain.handle(IPC_CHANNELS.CLEAR_TERMINAL_HISTORY, (event, { terminalId }: { terminalId: string }) => {
    try {
      store.delete(`terminal-history:${terminalId}`);
      log.debug('Cleared terminal history', { terminalId });
      return { success: true };
    } catch (err: any) {
      log.error('Failed to clear terminal history', { terminalId, error: err.message });
      return { success: false, error: err.message };
    }
  });
}
