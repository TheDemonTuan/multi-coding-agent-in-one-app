/**
 * Wails v3 Bridge
 *
 * Adapter layer that maps frontend calls to Go backend via Wails v3 runtime bindings.
 * Uses @wailsio/runtime for events and auto-generated bindings for Go methods.
 *
 * Event system uses: Events.On / Events.Emit from @wailsio/runtime
 * Bindings: Auto-generated in ../bindings/ directory
 */

import { Application, Events, WML, Window } from '@wailsio/runtime';
// Auto-generated JS bindings from Wails v3 (no TypeScript declarations)
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as App from '../../bindings/tdt-space/app';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as TerminalService from '../../bindings/tdt-space/internal/services/terminalservice';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as WorkspaceService from '../../bindings/tdt-space/internal/services/workspaceservice';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as TemplateService from '../../bindings/tdt-space/internal/services/templateservice';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as SystemService from '../../bindings/tdt-space/internal/services/systemservice';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as VietnameseIMEService from '../../bindings/tdt-space/internal/services/vietnameseimeservice';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import * as StoreService from '../../bindings/tdt-space/internal/services/storeservice';
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
// @ts-ignore - Wails v3 generates JS only, no .d.ts files
import { DialogOptions, SpawnTerminalOptions, SpawnAgentOptions, IMESettings } from '../../bindings/tdt-space/internal/services/models';

import type { AgentConfig } from '../types/workspace';

// --- Type Declarations for Wails v3 ---

// Event name constants (must match Go backend)
export const WAILS_EVENTS = {
  TERMINAL_DATA:    'terminal-data',
  TERMINAL_STARTED: 'terminal-started',
  TERMINAL_EXIT:    'terminal-exit',
  TERMINAL_ERROR:   'terminal-error',
  IME_PATCH_APPLIED: 'ime-patch-applied',
  MENU_NEW_WORKSPACE: 'menu:new-workspace',
  MENU_OPEN_SETTINGS: 'menu:open-settings',
  MENU_TOGGLE_FULLSCREEN: 'menu:toggle-fullscreen',
  MENU_ABOUT: 'menu:about',
} as const;

// --- Wails availability check ---

export function isWailsAvailable(): boolean {
  // Wails v3 uses @wailsio/runtime package with HTTP transport.
  // The runtime sets window._wails when loaded.
  // In dev mode, frontend runs on a Vite dev server and communicates
  // with the Wails backend via HTTP - no injected globals needed.
  if (typeof window === 'undefined') return false;
  // Check for Wails v3 runtime marker
  if (typeof (window as any)._wails !== 'undefined') return true;
  // In Wails v3 dev mode, the app runs inside a webview that proxies
  // to the Vite dev server. The runtime is loaded as an npm package.
  // We can detect this by checking if we're NOT in a regular browser.
  if (typeof (window as any).__wails__ !== 'undefined') return true;
  if (typeof (window as any).__wails_invoke__ !== 'undefined') return true;
  // Default: assume Wails is available when the app is bundled with @wailsio/runtime
  // The stub bridge will gracefully handle errors if the backend is not reachable
  return true;
}

// --- BackendAPI interface (same surface as old ElectronAPI) ---

export interface BackendAPI {
  // App info
  getAppVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  getCwd(): Promise<string>;

  // Window controls
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;

  // Persistent storage
  getStoreValue(key: string): Promise<any>;
  setStoreValue(key: string, value: any): Promise<{ success: boolean; error?: string }>;
  deleteStoreValue(key: string): Promise<{ success: boolean; error?: string }>;

  // File dialogs
  showOpenDialog(options: { title?: string; defaultPath?: string; buttonLabel?: string; properties?: string[] }): Promise<{ canceled: boolean; filePaths: string[] }>;
  listDirectory(path: string): Promise<{ entries: any[]; error?: string }>;
  resolvePath(path: string): Promise<string>;

  // Workspace management
  getWorkspaces(): Promise<any[]>;
  createWorkspace(config: any): Promise<any>;
  updateWorkspace(workspace: any): Promise<any>;
  deleteWorkspace(id: string): Promise<{ success: boolean; error?: string }>;
  switchWorkspace(id: string): Promise<any>;
  cleanupWorkspaceTerminals(workspaceId: string): Promise<{ success: boolean; cleaned?: number }>;
  setWorkspaceActive(workspaceId: string, active: boolean): Promise<{ success: boolean }>;
  getTerminalBacklog(terminalId: string): Promise<{ success: boolean; backlog: string }>;
  clearTerminalBacklog(terminalId: string): Promise<{ success: boolean }>;

  // Template management
  getTemplates(): Promise<any[]>;
  saveTemplate(template: any): Promise<{ success: boolean; error?: string }>;
  deleteTemplate(id: string): Promise<{ success: boolean; error?: string }>;

  // Terminal management
  spawnTerminal(id: string, cwd: string, workspaceId: string, cols: number, rows: number): Promise<{ success: boolean; pid?: number; error?: string }>;
  spawnTerminalWithAgent(id: string, cwd: string, agentConfig: AgentConfig, workspaceId: string, cols: number, rows: number): Promise<{ success: boolean; pid?: number; error?: string }>;
  terminalWrite(id: string, data: string): Promise<{ success: boolean; error?: string }>;
  terminalKill(id: string): Promise<{ success: boolean; error?: string }>;
  terminalResize(id: string, cols: number, rows: number): Promise<{ success: boolean }>;

  // Terminal status
  getTerminalStatus(id: string): Promise<{ exists: boolean; status: string; pid?: number }>;

  // Terminal events
  onTerminalData(callback: (event: { terminalId: string; data: string }) => void): () => void;
  onTerminalStarted(callback: (event: { terminalId: string; pid?: number }) => void): () => void;
  onTerminalExit(callback: (event: { terminalId: string; code: number | null; signal?: string }) => void): () => void;
  onTerminalError(callback: (event: { terminalId: string; error: string }) => void): () => void;

  // Menu events
  onMenuNewWorkspace(callback: () => void): () => void;
  onMenuOpenSettings(callback: () => void): () => void;
  onMenuToggleFullscreen(callback: () => void): () => void;
  onMenuAbout(callback: () => void): () => void;

  // Vietnamese IME patch
  applyVietnameseImePatch(): Promise<{ success: boolean; message?: string; version?: string; processesKilled?: number }>;
  checkVietnameseImePatchStatus(): Promise<{ isPatched: boolean; claudePath: string; hasBackup: boolean; installedVia: string }>;
  getVietnameseImeSettings(): Promise<{ enabled: boolean; autoPatch: boolean }>;
  setVietnameseImeSettings(settings: { enabled: boolean; autoPatch: boolean }): Promise<{ success: boolean; error?: string }>;
  restartClaudeTerminals(workspaceId: string, terminals: Array<{ id: string; cwd: string; agentConfig?: any }>): Promise<{ success: boolean; restarted?: Array<{ id: string; success: boolean; error?: string }> }>;
  restoreVietnameseImePatch(): Promise<{ success: boolean; message?: string }>;
  validateVietnameseImePatch(): Promise<{ isValid: boolean; isPatched: boolean; issues: string[]; suggestions: string[] }>;
  onVietnameseImePatchApplied(callback: (result: { success: boolean; message?: string }) => void): () => void;

  // Workspace-level IME patch validation
  validatePatchForWorkspace(workspace: any): Promise<void>;
}

// --- Wails v3 implementation ---

function createWailsBridge(): BackendAPI {
  const onEvent = (eventName: string, callback: (...args: any[]) => void): (() => void) => {
    const unsub = Events.On(eventName, (event: any) => {
      // Wails v3 event format: {name: "event-name", data: payload}
      // Unwrap .data để callback nhận raw payload
      const payload = event?.data !== undefined ? event.data : event;
      callback(payload);
    });
    return () => unsub();
  };

  const safeCall = <T>(fn: () => Promise<T>, stubValue: T): Promise<T> => {
    try {
      const result = fn();
      if (result === undefined) {
        return Promise.resolve(stubValue);
      }
      return result;
    } catch (err) {
      console.warn('[WailsBridge] Call failed:', err);
      return Promise.resolve(stubValue);
    }
  };

  return {
    getAppVersion: () => safeCall(() => App.GetAppVersion(), 'unknown'),
    getPlatform:   () => safeCall(() => SystemService.GetPlatform(), 'unknown'),
    getCwd:        () => safeCall(() => SystemService.GetCwd(), './'),

    windowMinimize: async () => { await App.WindowMinimize(); },
    windowMaximize: async () => { await App.WindowMaximize(); },
    windowClose:    async () => {
      try {
        await Window.Close();
      } catch (err) {
        console.warn('[WailsBridge] Window.Close failed, falling back to Application.Quit', err);
        await Application.Quit();
      }
    },

    getStoreValue:    (key) => {
      return safeCall(() => App.GetValue(key), null);
    },
    setStoreValue:    (key, value) => {
      return safeCall(async () => {
        await App.SetValue(key, value);
        return { success: true as boolean, error: undefined as string | undefined };
      }, { success: false, error: 'StoreService unavailable' });
    },
    deleteStoreValue: (key) => {
      return safeCall(async () => {
        await App.DeleteValue(key);
        return { success: true as boolean, error: undefined as string | undefined };
      }, { success: false, error: 'StoreService unavailable' });
    },

    showOpenDialog: (options) => safeCall(async () => {
      const opts = new DialogOptions({
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        properties: options.properties,
      });
      const result = await SystemService.ShowOpenDialog(opts);
      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
      };
    }, { canceled: true, filePaths: [] }),

    listDirectory: (path) => safeCall(async () => {
      const result = await SystemService.ListDirectory(path);
      return {
        entries: result.entries || [],
        error: result.error,
      };
    }, { entries: [], error: 'Failed to list directory' }),

    resolvePath: (path) => safeCall(async () => {
      // ResolvePath is a new method - bindings will be regenerated on next wails build
      const result = await (SystemService as any).ResolvePath?.(path);
      return result || '';
    }, ''),

    getWorkspaces: () => {
      return safeCall(() => WorkspaceService.GetWorkspaces(), []);
    },
    createWorkspace: (cfg) => {
      return safeCall(() => WorkspaceService.CreateWorkspace(cfg), null);
    },
    updateWorkspace: (ws) => {
      return safeCall(() => WorkspaceService.UpdateWorkspace(ws), null);
    },
    deleteWorkspace: (id) => safeCall(async () => {
      await WorkspaceService.DeleteWorkspace(id);
      return { success: true as boolean, error: undefined as string | undefined };
    }, { success: false, error: 'Failed to delete workspace' }),
    switchWorkspace: (id) => safeCall(() => {
      console.warn('[WailsBridge] switchWorkspace not implemented');
      return Promise.resolve(null);
    }, null),
    cleanupWorkspaceTerminals: (id) => safeCall(async () => {
      const result = await TerminalService.CleanupWorkspaceTerminals(id);
      return { success: result.success, cleaned: result.cleaned?.length };
    }, { success: false, cleaned: 0 }),
    setWorkspaceActive: (workspaceId, active) => safeCall(async () => {
      await TerminalService.SetWorkspaceActive(workspaceId, active);
      return { success: true as boolean };
    }, { success: false } as { success: boolean }),
    getTerminalBacklog: (terminalId) => safeCall(async () => {
      const backlog = await TerminalService.GetTerminalBacklog(terminalId);
      return { success: true as boolean, backlog: backlog || '' };
    }, { success: false, backlog: '' } as { success: boolean; backlog: string }),
    clearTerminalBacklog: (terminalId) => safeCall(async () => {
      await TerminalService.ClearTerminalBacklog(terminalId);
      return { success: true as boolean };
    }, { success: false } as { success: boolean }),

    getTemplates:   ()     => safeCall(() => TemplateService.GetTemplates(), []),
    saveTemplate:   (t)    => safeCall(async () => {
      await TemplateService.SaveTemplate(t);
      return { success: true as boolean, error: undefined as string | undefined };
    }, { success: false, error: 'TemplateService unavailable' }),
    deleteTemplate: (id)   => safeCall(async () => {
      await TemplateService.DeleteTemplate(id);
      return { success: true as boolean, error: undefined as string | undefined };
    }, { success: false, error: 'TemplateService unavailable' }),

    spawnTerminal: (id, cwd, workspaceId, cols, rows) =>
      safeCall(async () => {
        const opts = new SpawnTerminalOptions({ id, cwd, workspaceId, cols, rows });
        const result = await TerminalService.SpawnTerminal(opts);
        return { success: result.success as boolean, pid: result.pid as number | undefined, error: result.error as string | undefined };
      }, { success: false, pid: undefined, error: 'TerminalService unavailable' }),

    spawnTerminalWithAgent: (id, cwd, agentConfig, workspaceId, cols, rows) =>
      safeCall(async () => {
        const opts = new SpawnAgentOptions({
          id,
          cwd,
          agentType: agentConfig.type,
          workspaceId,
          cols,
          rows,
        });
        const result = await TerminalService.SpawnTerminalWithAgent(opts);
        return { success: result.success as boolean, pid: result.pid as number | undefined, error: result.error as string | undefined };
      }, { success: false, pid: undefined, error: 'TerminalService unavailable' }),

    terminalWrite:  (id, data)           => safeCall(async () => {
      await TerminalService.WriteToTerminal(id, data);
      return { success: true as boolean, error: undefined as string | undefined };
    }, { success: false, error: 'TerminalService unavailable' }),

    terminalKill:   (id)                 => safeCall(async () => {
      await TerminalService.KillTerminal(id);
      return { success: true as boolean, error: undefined as string | undefined };
    }, { success: false, error: 'TerminalService unavailable' }),

    terminalResize: (id, cols, rows)     => safeCall(async () => {
      await TerminalService.ResizeTerminal(id, cols, rows);
      return { success: true as boolean };
    }, { success: false } as { success: boolean }),

    getTerminalStatus: (id)              => safeCall(async () => {
      const status = await TerminalService.GetTerminalStatus(id);
      return { exists: status.exists ?? false, status: status.status ?? 'stopped', pid: status.pid as number | undefined };
    }, { exists: false, status: 'stopped', pid: undefined as number | undefined }),

    onTerminalData:    (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_DATA, cb); return cleanup || (() => {}); },
    onTerminalStarted: (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_STARTED, cb); return cleanup || (() => {}); },
    onTerminalExit:    (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_EXIT, cb); return cleanup || (() => {}); },
    onTerminalError:   (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_ERROR, cb); return cleanup || (() => {}); },

    onMenuNewWorkspace:    (cb) => { const cleanup = onEvent(WAILS_EVENTS.MENU_NEW_WORKSPACE, cb); return cleanup || (() => {}); },
    onMenuOpenSettings:    (cb) => { const cleanup = onEvent(WAILS_EVENTS.MENU_OPEN_SETTINGS, cb); return cleanup || (() => {}); },
    onMenuToggleFullscreen: (cb) => { const cleanup = onEvent(WAILS_EVENTS.MENU_TOGGLE_FULLSCREEN, cb); return cleanup || (() => {}); },
    onMenuAbout:           (cb) => { const cleanup = onEvent(WAILS_EVENTS.MENU_ABOUT, cb); return cleanup || (() => {}); },

    applyVietnameseImePatch:       ()          => safeCall(async () => {
      const r = await App.ApplyVietnameseImePatch();
      return { success: true as boolean, message: r?.message as string | undefined, version: r?.version as string | undefined, processesKilled: r?.processesKilled as number | undefined };
    }, { success: false, message: 'Failed to apply patch', version: undefined, processesKilled: undefined }),
    checkVietnameseImePatchStatus: ()          => safeCall(async () => {
      const r = await App.CheckVietnameseImePatchStatus();
      const claudeInstalled = r.claude_code_installed ?? false;
      return {
        isPatched: r.isPatched ?? false,
        claudePath: r.claudePath ?? '',
        hasBackup: r.hasBackup ?? false,
        installedVia: r.installedVia ?? 'unknown',
        version: r.version,
        claude_code_installed: claudeInstalled,
        claudeCodeInstalled: claudeInstalled,
      };
    }, { isPatched: false, claudePath: '', hasBackup: false, installedVia: 'unknown', version: undefined, claude_code_installed: false, claudeCodeInstalled: false }),
    getVietnameseImeSettings:      ()          => safeCall(async () => {
      const r = await App.GetVietnameseImeSettings();
      return {
        enabled: r.enabled ?? false,
        autoPatch: r.autoPatch ?? false,
        patchedVersion: r.patchedVersion ?? undefined,
      };
    }, { enabled: false, autoPatch: false, patchedVersion: undefined }),
    setVietnameseImeSettings:      (settings: IMESettings)  => safeCall(async () => {
      await App.SetVietnameseImeSettings(settings);
      return { success: true as boolean, error: undefined as string | undefined };
    }, { success: false, error: 'Failed to save settings' }),
    restartClaudeTerminals:        (wsId, ts)  => safeCall(() => {
      console.warn('[WailsBridge] restartClaudeTerminals not implemented');
      return Promise.resolve({ success: false as boolean, restarted: undefined as any });
    }, { success: false } as { success: boolean; restarted?: any }),
    restoreVietnameseImePatch:     ()          => safeCall(async () => {
      const r = await App.RestoreVietnameseImePatch();
      return { success: true as boolean, message: r?.message as string | undefined };
    }, { success: false, message: 'Failed to restore' }),
    validateVietnameseImePatch:    ()          => safeCall(async () => {
      const r = await App.ValidateVietnameseImePatch();
      return {
        isValid: r.isValid ?? false,
        isPatched: r.isPatched ?? false,
        issues: r.issues ?? [],
        suggestions: r.suggestions ?? [],
      };
    }, { isValid: false, isPatched: false, issues: [], suggestions: [] }),
    onVietnameseImePatchApplied:   (cb)        => onEvent(WAILS_EVENTS.IME_PATCH_APPLIED, cb),

    validatePatchForWorkspace: async (workspace) => {
      // No-op for now
    },
  };
}

// --- No-op stub (used when Wails runtime is not available, e.g. during tests) ---

function createStubBridge(): BackendAPI {
  const noop = async () => ({ success: false, error: 'Wails not available' });
  const noopVoid = async () => {};
  const noopArr = async () => [];
  const noopUnsubscribe = () => () => {};

  return {
    getAppVersion: () => Promise.resolve('dev'),
    getPlatform:   () => Promise.resolve('unknown'),
    getCwd:        () => Promise.resolve('./'),
    windowMinimize: noopVoid,
    windowMaximize: noopVoid,
    windowClose:    noopVoid,
    getStoreValue:    () => Promise.resolve(null),
    setStoreValue:    noop as any,
    deleteStoreValue: noop as any,
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    listDirectory: () => Promise.resolve({ entries: [], error: 'Wails not available' }),
    resolvePath: () => Promise.resolve(''),
    getWorkspaces:              noopArr,
    createWorkspace:            () => Promise.resolve(null),
    updateWorkspace:            () => Promise.resolve(null),
    deleteWorkspace:            noop as any,
    switchWorkspace:            () => Promise.resolve(null),
    cleanupWorkspaceTerminals:  noop as any,
    getTemplates:   noopArr,
    saveTemplate:   noop as any,
    deleteTemplate: noop as any,
    spawnTerminal:           noop as any,
    spawnTerminalWithAgent:  noop as any,
    terminalWrite:           noop as any,
    terminalKill:            noop as any,
    terminalResize:          noop as any,
    getTerminalStatus:       () => Promise.resolve({ exists: false, status: 'stopped' } as any),
    onTerminalData:    noopUnsubscribe,
    onTerminalStarted: noopUnsubscribe,
    onTerminalExit:    noopUnsubscribe,
    onTerminalError:   noopUnsubscribe,
    onMenuNewWorkspace:    noopUnsubscribe,
    onMenuOpenSettings:    noopUnsubscribe,
    onMenuToggleFullscreen: noopUnsubscribe,
    onMenuAbout:           noopUnsubscribe,
    setWorkspaceActive:            () => Promise.resolve({ success: false }),
    getTerminalBacklog:            () => Promise.resolve({ success: false, backlog: '' }),
    clearTerminalBacklog:          () => Promise.resolve({ success: false }),
    applyVietnameseImePatch:       noop as any,
    checkVietnameseImePatchStatus: () => Promise.resolve({ isPatched: false, claudePath: '', hasBackup: false, installedVia: 'unknown' }),
    getVietnameseImeSettings:      () => Promise.resolve({ enabled: false, autoPatch: false }),
    setVietnameseImeSettings:      noop as any,
    restartClaudeTerminals:        noop as any,
    restoreVietnameseImePatch:     noop as any,
    validateVietnameseImePatch:    () => Promise.resolve({ isValid: false, isPatched: false, issues: [], suggestions: [] }),
    onVietnameseImePatchApplied:   noopUnsubscribe,
    validatePatchForWorkspace:     noopVoid,
  };
}

// --- Singleton export ---

export const backendAPI: BackendAPI = isWailsAvailable()
  ? createWailsBridge()
  : createStubBridge();

// Backward compatibility: expose backendAPI as window.electronAPI
// This allows legacy code that uses window.electronAPI to continue working.
// Use Object.defineProperty in case the property was declared read-only.
if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'electronAPI', {
      value: backendAPI,
      writable: true,
      configurable: true,
    });
  } catch {
    // Already sealed – not a problem since all call-sites now use backendAPI directly
  }
}

// Initialize WML (Wails Markup Language) on startup
if (typeof window !== 'undefined' && isWailsAvailable()) {
  WML.Reload();
}
