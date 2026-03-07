/**
 * Terminal IPC Handlers
 * Handles spawn, write, kill, resize operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import * as pty from 'node-pty';
import { IPC_CHANNELS, DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS, STORAGE_KEYS } from '../../config/constants';
import { logger } from '../../lib/logger';
import { applyVietnameseImePatch, isVietnameseImePatched, extractClaudeVersion } from '../../utils/vietnameseImePatch';

const log = logger.child('[IPC:Terminal]');

// Store terminal processes
const terminalProcesses = new Map<string, {
  ptyProcess: pty.IPty;
  cwd: string;
  agentType?: string;
  workspaceId?: string;
}>();

// Track workspace -> terminals mapping
const terminalWorkspaceMap = new Map<string, string>();

export function getTerminalProcesses() {
  return terminalProcesses;
}

export function getTerminalWorkspaceMap() {
  return terminalWorkspaceMap;
}

export function initializeTerminalHandlers(mainWindow: BrowserWindow | null, store: Store) {
  // Spawn terminal
  ipcMain.handle(IPC_CHANNELS.SPAWN_TERMINAL, (event, { id, cwd, workspaceId }) => {
    log.info('Spawning terminal', { id, cwd, workspaceId });

    const actualCwd = cwd || process.cwd();
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const args = process.platform === 'win32' ? ['-NoLogo', '-NoExit'] : [];

    try {
      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cwd: actualCwd,
        cols: DEFAULT_TERMINAL_COLS,
        rows: DEFAULT_TERMINAL_ROWS,
        env: {
          ...process.env,
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'TDTSpace',
        },
      });

      log.info('Spawned PTY process', { id, pid: ptyProcess.pid });

      terminalProcesses.set(id, { ptyProcess, cwd, workspaceId });
      if (workspaceId) {
        terminalWorkspaceMap.set(id, workspaceId);
      }

      // Send confirmation that terminal has started
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_STARTED, { id });
        }
      }, 300);

      ptyProcess.onData((data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data });
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        log.info('Terminal exited', { id, exitCode, signal });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { id, code: exitCode, signal });
        }
        terminalProcesses.delete(id);
        terminalWorkspaceMap.delete(id);
      });

      return { success: true, pid: ptyProcess.pid };
    } catch (err: any) {
      log.error('Failed to spawn terminal', { id, error: err.message });
      return { success: false, error: err.message };
    }
  });

  // Write to terminal
  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, (event, { id, data }) => {
    const term = terminalProcesses.get(id);
    if (term) {
      term.ptyProcess.write(data);
      return { success: true };
    }
    return { success: false, error: 'Terminal not found' };
  });

  // Kill terminal
  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, (event, { id }) => {
    log.info('Kill terminal requested', { id });
    const term = terminalProcesses.get(id);
    if (term) {
      try {
        term.ptyProcess.kill();
        terminalProcesses.delete(id);
        terminalWorkspaceMap.delete(id);
        log.info('Terminal killed', { id });
        return { success: true };
      } catch (err) {
        log.error('Failed to kill terminal', { id, error: err });
        return { success: false, error: String(err) };
      }
    }
    return { success: false, error: 'Terminal not found' };
  });

  // Resize terminal
  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, (event, { id, cols, rows }) => {
    const term = terminalProcesses.get(id);
    if (term) {
      try {
        term.ptyProcess.resize(cols, rows);
        log.debug('Terminal resized', { id, cols, rows });
      } catch (err) {
        log.error('Failed to resize terminal', { id, error: err });
      }
    }
    return { success: true };
  });

  // Cleanup workspace terminals
  ipcMain.handle(IPC_CHANNELS.CLEANUP_WORKSPACE_TERMINALS, (event, { workspaceId }) => {
    log.info('Cleaning up workspace terminals', { workspaceId });
    let cleaned = 0;

    terminalProcesses.forEach((term, id) => {
      const termWorkspaceId = terminalWorkspaceMap.get(id);
      if (termWorkspaceId === workspaceId) {
        try {
          term.ptyProcess.kill();
          terminalProcesses.delete(id);
          terminalWorkspaceMap.delete(id);
          cleaned++;
          log.info('Cleaned up terminal', { id, workspaceId });
        } catch (err) {
          log.error('Failed to cleanup terminal', { id, error: err });
        }
      }
    });

    log.info('Cleanup complete', { workspaceId, cleaned });
    return { success: true, cleaned };
  });

  // Spawn terminal with agent
  ipcMain.handle(IPC_CHANNELS.SPAWN_TERMINAL_WITH_AGENT, async (event, { id, cwd, agentConfig, workspaceId }) => {
    log.info('Spawning terminal with agent', { id, cwd, agentConfig: agentConfig?.type, workspaceId });

    // Auto-patch Claude Code if enabled and not already patched
    if (agentConfig?.type === 'claude-code' && agentConfig?.enabled !== false) {
      const vnSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, { enabled: false, autoPatch: true }) as any;
      
      if (vnSettings.enabled && vnSettings.autoPatch) {
        const isPatched = isVietnameseImePatched();
        
        if (!isPatched) {
          log.info('Auto-patching Claude Code before spawning terminal...');
          try {
            const result = await applyVietnameseImePatch();
            if (result.success) {
              log.info('Auto-patch successful!');
              // Store the patched version in electron-store
              if (result.version) {
                const updatedSettings = { 
                  ...vnSettings, 
                  patchedVersion: result.version,
                  lastPatchStatus: 'success' as const,
                  lastPatchPath: result.patchedPath 
                };
                store.set(STORAGE_KEYS.VIETNAMESE_IME, updatedSettings);
                log.info('Stored patched version in electron-store:', result.version);
              }
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(IPC_CHANNELS.VIETNAMESE_IME_PATCH_APPLIED, result);
              }
            } else {
              log.warn('Auto-patch failed:', result.message);
            }
          } catch (err: any) {
            log.error('Auto-patch error:', err.message);
          }
        } else {
          log.info('Claude Code already patched, skipping auto-patch');
        }
      }
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    let args: string[] = [];

    // Build agent command if specified
    if (agentConfig && agentConfig.type !== 'none' && agentConfig.enabled) {
      const agentCommands: Record<string, string> = {
        'claude-code': 'claude',
        'opencode': 'opencode',
        'droid': 'droid',
      };

      const agentCmd = agentConfig.command || agentCommands[agentConfig.type];
      if (agentCmd) {
        if (process.platform === 'win32') {
          const fullCmd = `${agentCmd} ${agentConfig.args?.join(' ') || ''}`.trim();
          args = ['-NoLogo', '-NoExit', '-Command', fullCmd];
        } else {
          args = ['-c', `${agentConfig.args?.join(' ') || ''}; exec $SHELL`];
        }
      } else {
        args = process.platform === 'win32' ? ['-NoLogo', '-NoExit'] : [];
      }
    } else {
      args = process.platform === 'win32' ? ['-NoLogo', '-NoExit'] : [];
    }

    try {
      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cwd: cwd || process.cwd(),
        cols: DEFAULT_TERMINAL_COLS,
        rows: DEFAULT_TERMINAL_ROWS,
        env: {
          ...process.env,
          COLORTERM: 'truecolor',
          TERM_PROGRAM: 'TDTSpace',
        },
      });

      log.info('Spawned PTY process with agent', { id, pid: ptyProcess.pid });

      terminalProcesses.set(id, {
        ptyProcess,
        cwd,
        agentType: agentConfig?.type || 'none',
        workspaceId
      });

      if (workspaceId) {
        terminalWorkspaceMap.set(id, workspaceId);
      }

      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_STARTED, { id });
        }
      }, 100);

      ptyProcess.onData((data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data });
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        log.info('Terminal with agent exited', { id, exitCode, signal });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { id, code: exitCode, signal });
        }
        terminalProcesses.delete(id);
        terminalWorkspaceMap.delete(id);
      });

      return { success: true, pid: ptyProcess.pid };
    } catch (err: any) {
      log.error('Failed to spawn terminal with agent', { id, error: err.message });
      return { success: false, error: err.message };
    }
  });
}

// Export cleanup function for app quit
export function cleanupAllTerminals(isDev: boolean) {
  log.info('Cleaning up all terminals', { isDev });
  
  const currentPid = process.pid;
  let killCount = 0;

  if (isDev) {
    // In dev mode, skip killing dev terminal
    terminalProcesses.forEach((term, id) => {
      if (term.ptyProcess.pid === currentPid) {
        log.info('Skipping dev terminal', { id, pid: currentPid });
        return;
      }
      term.ptyProcess.kill();
      killCount++;
    });
  } else {
    // In production, kill all terminals
    terminalProcesses.forEach((term, id) => {
      term.ptyProcess.kill();
      killCount++;
    });
  }

  terminalProcesses.clear();
  terminalWorkspaceMap.clear();

  log.info('Cleanup complete', { killCount });
  return killCount;
}
