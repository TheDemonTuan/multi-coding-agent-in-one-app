/**
 * System IPC Handlers
 * Handles app info, platform, cwd, dialogs
 */

import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../config/constants';
import { logger } from '../../lib/logger';

const log = logger.child('[IPC:System]');

export function initializeSystemHandlers(mainWindow: BrowserWindow | null) {
  // Get app version
  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  // Get platform
  ipcMain.handle(IPC_CHANNELS.GET_PLATFORM, () => {
    return process.platform;
  });

  // Get current working directory
  ipcMain.handle(IPC_CHANNELS.GET_CWD, () => {
    return process.cwd();
  });

  // Show open dialog
  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, (event, options) => {
    try {
      if (!mainWindow) {
        return { canceled: true, filePaths: [] };
      }
      const result = dialog.showOpenDialogSync(mainWindow, {
        properties: options.properties || ['openFile'],
        title: options.title || 'Select',
        defaultPath: options.defaultPath,
        filters: options.filters,
      });

      if (result && result.length > 0) {
        return { canceled: false, filePaths: result };
      }
      return { canceled: true, filePaths: [] };
    } catch (err: any) {
      log.error('Failed to show open dialog', { error: err.message });
      return { canceled: true, filePaths: [], error: err.message };
    }
  });
}
