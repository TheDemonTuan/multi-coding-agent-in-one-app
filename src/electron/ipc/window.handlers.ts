/**
 * Window Control IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../config/constants';
import { logger } from '../../lib/logger';

const log = logger.child('[IPC:Window]');

export function initializeWindowHandlers(mainWindow: BrowserWindow | null) {
  // Minimize window
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    if (mainWindow) {
      mainWindow.minimize();
      log.debug('Window minimized');
    }
  });

  // Maximize/restore window
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        log.debug('Window restored');
      } else {
        mainWindow.maximize();
        log.debug('Window maximized');
      }
    }
  });

  // Close window
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    if (mainWindow) {
      mainWindow.close();
      log.debug('Window close requested');
    }
  });
}
