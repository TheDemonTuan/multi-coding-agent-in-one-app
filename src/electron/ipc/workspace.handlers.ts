/**
 * Workspace IPC Handlers
 * Handles workspace CRUD operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS, STORAGE_KEYS } from '../../config/constants';
import { logger } from '../../lib/logger';
import { getTerminalProcesses, getTerminalWorkspaceMap } from './terminal.handlers';
import { autoPatchIfNeeded } from './terminal.handlers';

const log = logger.child('[IPC:Workspace]');

/**
 * Check if workspace has Claude Code terminals and trigger auto-patch if needed
 * This is called when switching to a workspace to ensure the patch is up-to-date
 */
export async function validatePatchForWorkspace(
  store: Store,
  mainWindow: BrowserWindow | null,
  workspace: any
): Promise<void> {
  if (!workspace || !workspace.terminals) {
    return;
  }

  // Check if any terminal has Claude Code agent enabled
  const hasClaudeCode = workspace.terminals.some((term: any) => {
    return term.agent?.type === 'claude-code' && term.agent?.enabled !== false;
  });

  if (hasClaudeCode) {
    log.debug('Workspace has Claude Code terminals, checking patch status...');
    await autoPatchIfNeeded(store, mainWindow);
  }
}

export function initializeWorkspaceHandlers(store: Store, mainWindow: BrowserWindow | null) {
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

  // Validate patch for workspace (called when switching workspaces)
  ipcMain.handle(IPC_CHANNELS.VALIDATE_PATCH_FOR_WORKSPACE, async (event, { workspace }) => {
    try {
      await validatePatchForWorkspace(store, mainWindow, workspace);
      return { success: true };
    } catch (err: any) {
      log.error('Failed to validate patch for workspace', { error: err.message });
      return { success: false, error: err.message };
    }
  });
}
