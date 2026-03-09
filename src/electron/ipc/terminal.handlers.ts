/**
 * Terminal IPC Handlers
 * Handles spawn, write, kill, resize operations
 */

import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { IPC_CHANNELS, DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS, STORAGE_KEYS } from '../../config/constants';
import { logger } from '../../lib/logger';
import {
  applyVietnameseImePatch,
  isVietnameseImePatched,
  extractClaudeVersion,
  getCurrentClaudeVersion,
  isVersionMismatched,
  findClaudePath
} from '../../utils/vietnameseImePatch';

/**
 * Validate working directory exists and is accessible
 */
function validateWorkingDirectory(cwd: string): { valid: boolean; error?: string } {
  try {
    // Handle special paths
    if (!cwd || cwd === '.' || cwd === './') {
      return { valid: true };
    }

    const resolvedPath = path.resolve(cwd);

    if (!fs.existsSync(resolvedPath)) {
      return {
        valid: false,
        error: `Thư mục không tồn tại: ${cwd}. Vui lòng chọn thư mục khác hoặc sử dụng Browse để chọn.`
      };
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: `Đường dẫn không phải thư mục: ${cwd}. Vui lòng chọn một thư mục hợp lệ.`
      };
    }

    // Try to read directory to check permissions
    fs.readdirSync(resolvedPath);
    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: `Không thể truy cập thư mục: ${cwd}. Lỗi: ${err.message || 'Permission denied'}`
    };
  }
}

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

// Data batching for terminal output (VAL-PERF-006: Reduce IPC overhead)
// Batch terminal data to reduce IPC call frequency
const dataBatchTimers = new Map<string, NodeJS.Timeout>();
const dataBuffers = new Map<string, { data: string; timestamp: number }[]>();
const BATCH_INTERVAL = 16; // ms - 1 frame @ 60fps: balances latency vs IPC call frequency (~50% fewer calls vs 8ms)

/**
 * Batch terminal data and send via IPC at intervals
 * This reduces IPC call overhead when terminal outputs大量 data
 * Note: mainWindow is passed as parameter since this function is called from within initializeTerminalHandlers
 */
function sendTerminalData(id: string, data: string, mainWindow: BrowserWindow | null) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Initialize buffer for this terminal if needed
  if (!dataBuffers.has(id)) {
    dataBuffers.set(id, []);
  }
  const buffer = dataBuffers.get(id)!;
  buffer.push({ data, timestamp: Date.now() });

  // Clear existing timer
  if (dataBatchTimers.has(id)) {
    clearTimeout(dataBatchTimers.get(id)!);
  }

  // Schedule batch send
  dataBatchTimers.set(id, setTimeout(() => {
    const batchedData = dataBuffers.get(id);
    if (batchedData && batchedData.length > 0) {
      // Concatenate all buffered data into single IPC call
      const concatenated = batchedData.map(d => d.data).join('');
      mainWindow!.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data: concatenated });
      dataBuffers.delete(id);
    }
    dataBatchTimers.delete(id);
  }, BATCH_INTERVAL));
}

// Prevent concurrent patch operations
let isPatching = false;

/**
 * Kill PTY process and all child processes (Windows process tree killing - VAL-PERF-003)
 * Uses taskkill /f /t on Windows to kill entire process tree
 * Falls back to pty.kill() on Unix systems
 */
function killPtyProcess(ptyProcess: pty.IPty): boolean {
  const pid = ptyProcess.pid;

  if (process.platform === 'win32') {
    // Windows: Use taskkill to kill entire process tree including child processes
    try {
      const result = spawnSync('taskkill', ['/pid', pid.toString(), '/f', '/t'], {
        stdio: 'pipe',
        timeout: 5000, // 5 second timeout
      });

      if (result.status === 0) {
        log.debug('Successfully killed process tree with taskkill', { pid });
        return true;
      } else {
        log.warn('taskkill failed, falling back to pty.kill()', {
          pid,
          stderr: result.stderr?.toString()
        });
        // Fall back to pty.kill() if taskkill fails
        ptyProcess.kill();
        return true;
      }
    } catch (err: any) {
      log.error('taskkill error, falling back to pty.kill()', {
        pid,
        error: err.message
      });
      // Fall back to pty.kill() on error
      try {
        ptyProcess.kill();
        return true;
      } catch {
        return false;
      }
    }
  } else {
    // Unix: Use standard pty.kill()
    try {
      ptyProcess.kill();
      return true;
    } catch (err: any) {
      log.error('Failed to kill Unix process', { pid, error: err.message });
      return false;
    }
  }
}

/**
 * Check if auto-patch is needed and apply it
 * Returns true if patch was applied, false otherwise
 */
async function autoPatchIfNeeded(store: Store, mainWindow: BrowserWindow | null): Promise<boolean> {
  // Prevent concurrent patch operations
  if (isPatching) {
    log.debug('Patch already running, skipping concurrent patch attempt');
    return false;
  }

  isPatching = true;
  try {
    const vnSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, { enabled: false, autoPatch: true }) as any;

    // Skip if Vietnamese IME or auto-patch is disabled
    if (!vnSettings.enabled || !vnSettings.autoPatch) {
      log.debug('Vietnamese IME or auto-patch disabled, skipping version check', {
        enabled: vnSettings.enabled,
        autoPatch: vnSettings.autoPatch
      });
      return false;
    }

    // Get current Claude Code version
    const currentVersion = getCurrentClaudeVersion();
    const patchedVersion = vnSettings.patchedVersion;

    // Log version check result before spawning Claude terminal
    log.debug('Version check result', {
      currentVersion: currentVersion || 'unknown',
      patchedVersion: patchedVersion || 'not patched',
      isPatched: !!patchedVersion
    });

    // Check if version mismatch exists
    const hasMismatch = isVersionMismatched(currentVersion, patchedVersion);

    if (!hasMismatch) {
      log.debug('No version mismatch detected, skipping auto-repatch', {
        currentVersion: currentVersion || 'unknown',
        patchedVersion: patchedVersion || 'not patched'
      });
      return false;
    }

    // Version mismatch detected - auto-repatch
    log.info('=== Auto-Repatch Triggered ===');
    log.info('Version mismatch detected: old=' + (patchedVersion || 'none') + ', new=' + (currentVersion || 'unknown'));
    log.info('Starting auto-repatch process...');

    try {
      const result = await applyVietnameseImePatch();

      if (result.success) {
        log.info('Auto-repatch completed successfully!');

        // Update patchedVersion in store
        if (result.version) {
          const updatedSettings = {
            ...vnSettings,
            patchedVersion: result.version,
            lastPatchStatus: 'success' as const,
            lastPatchPath: result.patchedPath
          };
          store.set(STORAGE_KEYS.VIETNAMESE_IME, updatedSettings);
          log.info('patchedVersion storage update: ' + (patchedVersion || 'none') + ' → ' + result.version);
          log.debug('Updated settings stored in electron-store', {
            newPatchedVersion: result.version,
            lastPatchStatus: 'success',
            lastPatchPath: result.patchedPath
          });
        } else {
          log.warn('Auto-repatch succeeded but version not extracted from result');
        }

        // Notify renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.VIETNAMESE_IME_PATCH_APPLIED, result);
          log.debug('Sent vietnamese-ime-patch-applied event to renderer');
        }

        return true;
      } else {
        log.warn('Auto-repatch result: failed', {
          reason: result.message,
          alreadyPatched: result.alreadyPatched
        });
        return false;
      }
    } catch (err: any) {
      log.error('Auto-repatch error occurred', {
        error: err.message,
        code: err.code,
        stack: err.stack
      });

      // Handle file locked errors gracefully
      if (err.code === 'EBUSY') {
        log.warn('Claude Code file is locked (may be updating in background), skipping auto-patch');
      }

      return false;
    }
  } finally {
    isPatching = false;
  }
}

export function getTerminalProcesses() {
  return terminalProcesses;
}

export function getTerminalWorkspaceMap() {
  return terminalWorkspaceMap;
}

export { autoPatchIfNeeded };

export function initializeTerminalHandlers(mainWindow: BrowserWindow | null, store: Store) {
  // Spawn terminal
  ipcMain.handle(IPC_CHANNELS.SPAWN_TERMINAL, (event, { id, cwd, workspaceId }) => {
    log.info('Spawning terminal', { id, cwd, workspaceId });

    // Validate working directory
    const validation = validateWorkingDirectory(cwd || process.cwd());
    if (!validation.valid) {
      log.error('Working directory validation failed', { id, cwd, error: validation.error });

      // Send error event to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_ERROR, {
          id,
          error: validation.error,
          type: 'spawn_failed'
        });
      }

      return { success: false, error: validation.error };
    }

    const actualCwd = cwd || process.cwd();
    const shell = process.platform === 'win32' ? 'powershell.exe'
      : process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
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

      // Use batching for terminal data to reduce IPC overhead (VAL-PERF-006)
      ptyProcess.onData((data: string) => {
        sendTerminalData(id, data, mainWindow);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        // Check if this PTY is still the current one for this terminal ID
        // If it's been replaced (e.g., during restart), skip cleanup and exit event
        const currentTerm = terminalProcesses.get(id);
        if (currentTerm && currentTerm.ptyProcess !== ptyProcess) {
          log.info('Terminal exit ignored (process was replaced by restart)', { id, exitCode });
          return;
        }

        log.info('Terminal exited', { id, exitCode, signal });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { id, code: exitCode, signal });
        }
        // Cleanup batch timer and buffer on exit
        if (dataBatchTimers.has(id)) {
          clearTimeout(dataBatchTimers.get(id)!);
          dataBatchTimers.delete(id);
        }
        // Flush any remaining buffered data before cleanup
        const remainingData = dataBuffers.get(id);
        if (remainingData && remainingData.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
          const concatenated = remainingData.map(d => d.data).join('');
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data: concatenated });
          dataBuffers.delete(id);
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
  // Uses ipcMain.on (fire-and-forget) instead of ipcMain.handle (round-trip) to eliminate
  // await overhead for every keystroke. The renderer uses ipcRenderer.send().
  ipcMain.on(IPC_CHANNELS.TERMINAL_WRITE, (event, { id, data }) => {
    const term = terminalProcesses.get(id);
    if (term) {
      term.ptyProcess.write(data);
    }
  });

  // Kill terminal
  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, (event, { id }) => {
    log.info('Kill terminal requested', { id });
    const term = terminalProcesses.get(id);
    if (term) {
      try {
        // Use Windows process tree killing (VAL-PERF-003)
        const killed = killPtyProcess(term.ptyProcess);
        if (killed) {
          // Cleanup batch timer and buffer
          if (dataBatchTimers.has(id)) {
            clearTimeout(dataBatchTimers.get(id)!);
            dataBatchTimers.delete(id);
          }
          // Flush any remaining buffered data
          const remainingData = dataBuffers.get(id);
          if (remainingData && remainingData.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
            const concatenated = remainingData.map(d => d.data).join('');
            mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data: concatenated });
            dataBuffers.delete(id);
          }
          terminalProcesses.delete(id);
          terminalWorkspaceMap.delete(id);
          log.info('Terminal killed', { id });
          return { success: true };
        } else {
          log.error('Failed to kill terminal process', { id });
          return { success: false, error: 'Failed to kill process' };
        }
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
          // Use Windows process tree killing (VAL-PERF-003)
          const killed = killPtyProcess(term.ptyProcess);
          if (killed) {
            terminalProcesses.delete(id);
            terminalWorkspaceMap.delete(id);
            cleaned++;
            log.info('Cleaned up terminal', { id, workspaceId });
          } else {
            log.error('Failed to cleanup terminal', { id, workspaceId });
          }
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

    // Validate working directory
    const validation = validateWorkingDirectory(cwd || process.cwd());
    if (!validation.valid) {
      log.error('Working directory validation failed', { id, cwd, error: validation.error });

      // Send error event to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_ERROR, {
          id,
          error: validation.error,
          type: 'spawn_failed'
        });
      }

      return { success: false, error: validation.error };
    }

    // Auto-patch Claude Code if enabled and version mismatch detected
    if (agentConfig?.type === 'claude-code' && agentConfig?.enabled !== false) {
      await autoPatchIfNeeded(store, mainWindow);
    }

    const shell = process.platform === 'win32' ? 'powershell.exe'
      : process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
    let args: string[] = [];

    // Build agent command if specified
    if (agentConfig && agentConfig.type !== 'none' && agentConfig.enabled) {
      const agentCommands: Record<string, string> = {
        'claude-code': 'claude',
        'opencode': 'opencode',
        'droid': 'droid',
        'gemini-cli': 'gemini',
        'cursor': 'cursor-agent',
        'codex': 'codex',
        'oh-my-pi': 'pi',
        'aider': 'aider',
        'goose': 'goose',
        'warp': 'warp',
        'amp': 'amp',
        'kiro': 'kiro',
      };

      const agentCmd = agentConfig.command || agentCommands[agentConfig.type];
      if (agentCmd) {
        if (process.platform === 'win32') {
          const fullCmd = `${agentCmd} ${agentConfig.args?.join(' ') || ''}`.trim();
          args = ['-NoLogo', '-NoExit', '-Command', fullCmd];
        } else {
          const fullCmd = `${agentCmd} ${agentConfig.args?.join(' ') || ''}`.trim();
          args = ['-c', `${fullCmd}; exec $SHELL`];
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
        sendTerminalData(id, data, mainWindow);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        // Check if this PTY is still the current one for this terminal ID
        // If it's been replaced (e.g., during restart), skip cleanup and exit event
        const currentTerm = terminalProcesses.get(id);
        if (currentTerm && currentTerm.ptyProcess !== ptyProcess) {
          log.info('Terminal with agent exit ignored (process was replaced by restart)', { id, exitCode });
          return;
        }

        log.info('Terminal with agent exited', { id, exitCode, signal });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { id, code: exitCode, signal });
        }
        // Cleanup batch timer and buffer on exit
        if (dataBatchTimers.has(id)) {
          clearTimeout(dataBatchTimers.get(id)!);
          dataBatchTimers.delete(id);
        }
        // Flush any remaining buffered data before cleanup
        const remainingData = dataBuffers.get(id);
        if (remainingData && remainingData.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
          const concatenated = remainingData.map(d => d.data).join('');
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data: concatenated });
          dataBuffers.delete(id);
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
export function cleanupAllTerminals(isDev: boolean, mainWindow: BrowserWindow | null) {
  log.info('Cleaning up all terminals', { isDev });

  const currentPid = process.pid;
  let killCount = 0;

  // Cleanup all batch timers and buffers first
  dataBatchTimers.forEach((timer, id) => {
    clearTimeout(timer);
  });
  dataBatchTimers.clear();

  // Flush all remaining buffered data
  dataBuffers.forEach((buffer, id) => {
    if (buffer.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
      const concatenated = buffer.map(d => d.data).join('');
      mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data: concatenated });
    }
  });
  dataBuffers.clear();

  if (isDev) {
    // In dev mode, skip killing dev terminal
    terminalProcesses.forEach((term, id) => {
      if (term.ptyProcess.pid === currentPid) {
        log.info('Skipping dev terminal', { id, pid: currentPid });
        return;
      }
      // Use Windows process tree killing (VAL-PERF-003)
      if (killPtyProcess(term.ptyProcess)) {
        killCount++;
      }
    });
  } else {
    // In production, kill all terminals
    terminalProcesses.forEach((term, id) => {
      // Use Windows process tree killing (VAL-PERF-003)
      if (killPtyProcess(term.ptyProcess)) {
        killCount++;
      }
    });
  }

  terminalProcesses.clear();
  terminalWorkspaceMap.clear();

  log.info('Cleanup complete', { killCount });
  return killCount;
}
