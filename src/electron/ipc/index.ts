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
import { initializeVietnameseIMEHandlers, validatePatchOnStartup } from './vietnamese-ime.handlers';

export { cleanupAllTerminals, getTerminalProcesses, getTerminalWorkspaceMap, autoPatchIfNeeded } from './terminal.handlers';
export { validatePatchOnStartup } from './vietnamese-ime.handlers';
export { validatePatchForWorkspace } from './workspace.handlers';

export function initializeAllHandlers(
  mainWindow: BrowserWindow | null,
  store: Store
) {
  initializeTerminalHandlers(mainWindow, store);
  initializeWorkspaceHandlers(store, mainWindow);
  initializeStoreHandlers(store);
  initializeTemplateHandlers(store);
  initializeWindowHandlers(mainWindow);
  initializeSystemHandlers(mainWindow);
  initializeTerminalHistoryHandlers(store);
  initializeVietnameseIMEHandlers(mainWindow, store);
}
