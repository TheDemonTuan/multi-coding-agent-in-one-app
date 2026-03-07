/**
 * Vietnamese IME IPC Handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import { IPC_CHANNELS, STORAGE_KEYS } from '../../config/constants';
import { logger } from '../../lib/logger';
import {
  applyVietnameseImePatch,
  isVietnameseImePatched,
  findClaudePath,
  restoreFromBackup,
  validatePatch,
  extractClaudeVersion,
  getCurrentClaudeVersion,
  isVersionMismatched,
} from '../../utils/vietnameseImePatch';

const log = logger.child('[IPC:VietnameseIME]');

// Prevent concurrent patch operations
let isPatching = false;

export function initializeVietnameseIMEHandlers(mainWindow: BrowserWindow | null, store: Store) {
  // Apply Vietnamese IME patch
  ipcMain.handle(IPC_CHANNELS.APPLY_VIETNAMESE_IME_PATCH, async () => {
    log.info('Apply Vietnamese IME patch requested');
    try {
      const result = await applyVietnameseImePatch();
      log.info('Patch result', { success: result.success });
      
      // Update store with patch status and version
      if (result.success) {
        const currentSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, {}) as any;
        const updatedSettings = {
          ...currentSettings,
          enabled: true,
          autoPatch: currentSettings.autoPatch ?? true,
          lastPatchStatus: 'success' as const,
          lastPatchPath: result.patchedPath,
          patchedVersion: result.version,
        };
        store.set(STORAGE_KEYS.VIETNAMESE_IME, updatedSettings);
        log.info('Stored patched version in electron-store:', result.version);
      } else {
        const currentSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, {}) as any;
        store.set(STORAGE_KEYS.VIETNAMESE_IME, {
          ...currentSettings,
          lastPatchStatus: 'failed' as const,
        });
      }
      
      return result;
    } catch (err: any) {
      log.error('Failed to apply Vietnamese IME patch', { error: err.message });
      return { success: false, message: err.message };
    }
  });

  // Check Vietnamese IME patch status
  ipcMain.handle(IPC_CHANNELS.CHECK_VIETNAMESE_IME_PATCH_STATUS, () => {
    log.info('Check Vietnamese IME patch status requested');
    const isPatched = isVietnameseImePatched();
    const claudePath = findClaudePath();
    
    // Get patchedVersion from store
    const currentSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, {}) as any;
    const patchedVersion = currentSettings.patchedVersion;
    
    // Check for backup file
    const hasBackup = claudePath && fs.existsSync(claudePath + BACKUP_EXTENSION);
    
    // Detect installation type
    let installedVia = 'unknown';
    if (claudePath) {
      if (claudePath.includes('.bun')) installedVia = 'bun';
      else if (claudePath.includes('npm')) installedVia = 'npm';
      else if (claudePath.includes('pnpm')) installedVia = 'pnpm';
      else if (claudePath.endsWith('.exe') || claudePath.endsWith('.cmd')) installedVia = 'binary';
    }
    
    // Extract version using utility function
    let version: string | null = null;
    if (claudePath && fs.existsSync(claudePath)) {
      try {
        const content = fs.readFileSync(claudePath, 'latin1');
        version = extractClaudeVersion(content);
      } catch {}
    }
    
    return {
      isPatched,
      claudePath,
      claudeCodeInstalled: !!claudePath,
      hasBackup,
      installedVia,
      version,
      patchedVersion, // Return patchedVersion from store for UI display
    };
  });

  // Restore from backup
  ipcMain.handle(IPC_CHANNELS.RESTORE_VIETNAMESE_IME_PATCH, async () => {
    log.info('Restore from backup requested');
    try {
      const result = restoreFromBackup();
      log.info('Restore result', { success: result.success });
      
      if (result.success) {
        const currentSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, {}) as any;
        store.set(STORAGE_KEYS.VIETNAMESE_IME, {
          ...currentSettings,
          lastPatchStatus: 'failed' as const,
          patchedVersion: undefined, // Clear patchedVersion since file is restored to original
        });
        log.info('Cleared patchedVersion after restore');
      }
      
      return result;
    } catch (err: any) {
      log.error('Restore failed', { error: err.message });
      return { success: false, message: err.message };
    }
  });

  // Validate patch
  ipcMain.handle(IPC_CHANNELS.VALIDATE_VIETNAMESE_IME_PATCH, () => {
    log.info('Validate patch requested');
    try {
      const result = validatePatch();
      log.info('Validation result', { isValid: result.isValid });
      return result;
    } catch (err: any) {
      log.error('Validation failed', { error: err.message });
      return {
        isValid: false,
        isPatched: false,
        issues: [err.message],
        suggestions: ['Please try patching again'],
      };
    }
  });

  // Get Vietnamese IME settings
  ipcMain.handle(IPC_CHANNELS.GET_VIETNAMESE_IME_SETTINGS, () => {
    try {
      const settings = store.get(STORAGE_KEYS.VIETNAMESE_IME, {
        enabled: false,
        autoPatch: true,
      }) as any;
      log.debug('Get Vietnamese IME settings', settings);
      return settings;
    } catch (err: any) {
      log.error('Failed to get Vietnamese IME settings', { error: err.message });
      return { enabled: false, autoPatch: true };
    }
  });

  // Set Vietnamese IME settings
  ipcMain.handle(IPC_CHANNELS.SET_VIETNAMESE_IME_SETTINGS, (event, settings: { enabled: boolean; autoPatch: boolean }) => {
    try {
      log.info('Set Vietnamese IME settings', settings);
      store.set(STORAGE_KEYS.VIETNAMESE_IME, settings);
      
      // If enabling and autoPatch, check if already patched first
      if (settings.enabled && settings.autoPatch) {
        const isPatched = isVietnameseImePatched();
        
        if (isPatched) {
          log.info('Auto-patch skipped: Already patched');
        } else {
          // Only apply patch if not already patched
          applyVietnameseImePatch().then(result => {
            log.info('Auto-patch result', { success: result.success });
            if (mainWindow && !mainWindow.isDestroyed() && result.success) {
              mainWindow.webContents.send(IPC_CHANNELS.VIETNAMESE_IME_PATCH_APPLIED, result);
            }
          }).catch(err => {
            log.error('Auto-patch failed', { error: err });
          });
        }
      }
      
      return { success: true };
    } catch (err: any) {
      log.error('Failed to set Vietnamese IME settings', { error: err.message });
      return { success: false, error: err.message };
    }
  });

  // Restart Claude terminals
  ipcMain.handle(IPC_CHANNELS.RESTART_CLAUDE_TERMINALS, async (event, { workspaceId, terminals }) => {
    log.info('Restarting Claude terminals for workspace', { workspaceId });

    try {
      // First, clean up existing terminals
      await (ipcMain.handle as any)(IPC_CHANNELS.CLEANUP_WORKSPACE_TERMINALS, { workspaceId });

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      // Restart each terminal
      const restarted: Array<{ id: string; success: boolean; error?: string }> = [];

      for (const term of terminals) {
        try {
          const result = await (ipcMain.handle as any)(IPC_CHANNELS.SPAWN_TERMINAL_WITH_AGENT, {
            id: term.id,
            cwd: term.cwd,
            agentConfig: term.agentConfig,
            workspaceId,
          });

          restarted.push({
            id: term.id,
            success: result?.success,
            error: result?.error,
          });
        } catch (err: any) {
          restarted.push({
            id: term.id,
            success: false,
            error: err.message,
          });
        }
      }

      log.info('Restarted terminals', { successCount: restarted.filter(r => r.success).length });

      return { success: true, restarted };
    } catch (err: any) {
      log.error('Failed to restart terminals', { error: err.message });
      return { success: false, error: err.message };
    }
  });
}

/**
 * Validate and apply Vietnamese IME patch on app startup
 * This function checks if auto-patch is enabled and if the current Claude Code version
 * differs from the patched version, then applies the patch if needed.
 *
 * Works with Claude Code installed via npm, bun, pnpm, or binary.
 *
 * @param store - Electron store for accessing Vietnamese IME settings
 * @param mainWindow - Main browser window for sending IPC events
 */
export async function validatePatchOnStartup(store: Store, mainWindow: BrowserWindow | null): Promise<void> {
  // Prevent concurrent patch operations
  if (isPatching) {
    log.debug('Patch already running, skipping startup validation');
    return;
  }

  isPatching = true;
  try {
    const vnSettings = store.get(STORAGE_KEYS.VIETNAMESE_IME, { enabled: false, autoPatch: true }) as any;

    // Skip if Vietnamese IME or auto-patch is disabled
    if (!vnSettings.enabled || !vnSettings.autoPatch) {
      log.debug('Vietnamese IME or auto-patch disabled, skipping startup validation', {
        enabled: vnSettings.enabled,
        autoPatch: vnSettings.autoPatch
      });
      return;
    }

    // Get current Claude Code version
    const currentVersion = getCurrentClaudeVersion();
    const patchedVersion = vnSettings.patchedVersion;

    log.info('Checking Vietnamese IME patch status on startup...', {
      currentVersion: currentVersion || 'unknown',
      patchedVersion: patchedVersion || 'not patched',
      enabled: vnSettings.enabled,
      autoPatch: vnSettings.autoPatch
    });

    // Check if version mismatch exists
    const hasMismatch = isVersionMismatched(currentVersion, patchedVersion);

    if (!hasMismatch) {
      log.debug('No version mismatch detected on startup', {
        currentVersion: currentVersion || 'unknown',
        patchedVersion: patchedVersion || 'not patched'
      });
      return;
    }

    // Version mismatch detected - auto-repatch
    log.info('=== Startup Auto-Repatch ===');
    log.info('Version mismatch detected: old=' + (patchedVersion || 'none') + ', new=' + (currentVersion || 'unknown'));
    log.info('Starting auto-repatch process...');

    try {
      const result = await applyVietnameseImePatch();

      if (result.success) {
        log.info('Startup auto-repatch completed successfully!');

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
        } else {
          log.warn('Startup auto-repatch succeeded but version not extracted from result');
        }

        // Notify renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.VIETNAMESE_IME_PATCH_APPLIED, result);
          log.debug('Sent vietnamese-ime-patch-applied event to renderer');
        }
      } else {
        log.warn('Startup auto-repatch result: failed', {
          reason: result.message,
          alreadyPatched: result.alreadyPatched
        });
      }
    } catch (err: any) {
      log.error('Startup auto-repatch error occurred', {
        error: err.message,
        code: err.code,
        stack: err.stack
      });

      // Handle file locked errors gracefully
      if (err.code === 'EBUSY') {
        log.warn('Claude Code file is locked (may be updating in background), skipping startup auto-patch');
      }
    }
  } finally {
    isPatching = false;
  }
}

const BACKUP_EXTENSION = '.vn-backup';
