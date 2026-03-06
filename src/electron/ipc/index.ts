/**
 * IPC Handlers Index
 * Exports all IPC handler initializers
 */

import { BrowserWindow } from 'electron';
import Store from 'electron-store';

import { initializeTerminalHandlers, cleanupAllTerminals } from './terminal.handlers';
import { initializeWorkspaceHandlers } from './workspace.handlers';
import { initializeStoreHandlers } from './store.handlers';
import { initializeTemplateHandlers } from './template.handlers';
import { initializeWindowHandlers } from './window.handlers';
import { initializeSystemHandlers } from './system.handlers';
import { initializeTerminalHistoryHandlers } from './terminal-history.handlers';
import { initializeVietnameseIMEHandlers } from './vietnamese-ime.handlers';

export { cleanupAllTerminals, getTerminalProcesses, getTerminalWorkspaceMap } from './terminal.handlers';

export function initializeAllHandlers(
  mainWindow: BrowserWindow | null,
  store: Store
) {
  initializeTerminalHandlers(mainWindow, store);
  initializeWorkspaceHandlers(store);
  initializeStoreHandlers(store);
  initializeTemplateHandlers(store);
  initializeWindowHandlers(mainWindow);
  initializeSystemHandlers(mainWindow);
  initializeTerminalHistoryHandlers(store);
  initializeVietnameseIMEHandlers(mainWindow, store);
}
