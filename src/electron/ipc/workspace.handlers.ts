/**
 * Workspace IPC Handlers
 * Handles workspace CRUD operations
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS, STORAGE_KEYS } from '../../config/constants';
import { logger } from '../../lib/logger';
import { getTerminalProcesses, getTerminalWorkspaceMap } from './terminal.handlers';

const log = logger.child('[IPC:Workspace]');

export function initializeWorkspaceHandlers(store: Store) {
  // Get workspaces
  ipcMain.handle(IPC_CHANNELS.GET_WORKSPACES, () => {
    try {
      const workspaces = store.get(STORAGE_KEYS.WORKSPACES, []) as any[];
      log.debug('Getting workspaces', { count: workspaces.length });
      return workspaces;
    } catch (err: any) {
      log.error('Failed to get workspaces', { error: err.message });
      return [];
    }
  });

  // Create workspace
  ipcMain.handle(IPC_CHANNELS.CREATE_WORKSPACE, (event, config) => {
    try {
      const workspaces = store.get(STORAGE_KEYS.WORKSPACES, []) as any[];
      const newWorkspace = {
        ...config,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      workspaces.push(newWorkspace);
      store.set(STORAGE_KEYS.WORKSPACES, workspaces);
      log.info('Created workspace', { name: newWorkspace.name, id: newWorkspace.id });
      return newWorkspace;
    } catch (err: any) {
      log.error('Failed to create workspace', { error: err.message });
      return null;
    }
  });

  // Delete workspace
  ipcMain.handle(IPC_CHANNELS.DELETE_WORKSPACE, (event, { id }) => {
    try {
      const workspaces = store.get(STORAGE_KEYS.WORKSPACES, []) as any[];
      const filtered = workspaces.filter((ws: any) => ws.id !== id);
      store.set(STORAGE_KEYS.WORKSPACES, filtered);
      log.info('Deleted workspace', { id });

      // Also kill terminals associated with this workspace
      const terminalProcesses = getTerminalProcesses();
      const terminalWorkspaceMap = getTerminalWorkspaceMap();
      
      terminalProcesses.forEach((term, terminalId) => {
        if (terminalWorkspaceMap.get(terminalId) === id) {
          try {
            term.ptyProcess.kill();
            terminalProcesses.delete(terminalId);
            terminalWorkspaceMap.delete(terminalId);
            log.info('Killed terminal during workspace delete', { terminalId });
          } catch (err) {
            log.error('Failed to kill terminal during workspace delete', { terminalId, error: err });
          }
        }
      });

      return { success: true };
    } catch (err: any) {
      log.error('Failed to delete workspace', { error: err.message });
      return { success: false, error: err.message };
    }
  });

  // Switch workspace
  ipcMain.handle(IPC_CHANNELS.SWITCH_WORKSPACE, (event, { id }) => {
    try {
      const workspaces = store.get(STORAGE_KEYS.WORKSPACES, []) as any[];
      const workspace = workspaces.find((ws: any) => ws.id === id);
      if (workspace) {
        workspace.lastUsed = Date.now();
        store.set(STORAGE_KEYS.WORKSPACES, workspaces);
        log.info('Switched to workspace', { name: workspace.name, id });
        return workspace;
      }
      return null;
    } catch (err: any) {
      log.error('Failed to switch workspace', { error: err.message });
      return null;
    }
  });
}
