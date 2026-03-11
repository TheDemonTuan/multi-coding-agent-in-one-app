/**
 * Wails Bridge
 *
 * Adapter layer that maps frontend calls to Go backend via Wails runtime bindings.
 * Replaces the old preload.cjs / window.electronAPI pattern.
 *
 * Wails auto-generates TypeScript bindings from Go exported methods.
 * They are available at: window.go.<PackageName>.<StructName>.<MethodName>()
 * For services in 'services' package: window.go.services.<ServiceName>.<MethodName>()
 *
 * Event system uses: window.runtime.EventsOn / EventsOff / EventsEmit
 */

import type {
  VietnameseImePatchResult,
  VietnameseImeStatus,
  VietnameseImeSettings,
  PatchValidation as BackendPatchValidation,
  OpenDialogOptions,
  OpenDialogReturnValue,
  DirectoryEntry,
  DirectoryListing,
  PatchResult as BackendPatchResult,
  PatchStatus as BackendPatchStatus,
  IMESettings as BackendIMESettings,
  RestoreResult as BackendRestoreResult,
  Result as BackendResult,
} from '../types/backend-legacy';

import type { AgentConfig } from '../types/workspace';

// --- Type Declarations for Wails runtime globals ---

declare global {
  interface Window {
    // Wails Go bindings (auto-generated)
    go?: {
      // Services bound via Wails (window.go.services.<ServiceName>)
      services?: {
        WorkspaceService?: {
          GetWorkspaces(): Promise<any[]>;
          CreateWorkspace(workspace: any): Promise<any>;
          UpdateWorkspace(workspace: any): Promise<any>;
          DeleteWorkspace(id: string): Promise<BackendResult>;
          GetWorkspace(id: string): Promise<any>;
          PatchWorkspace(id: string, patch: Record<string, any>): Promise<any>;
        };
        TemplateService?: {
          GetTemplates(): Promise<any[]>;
          SaveTemplate(template: any): Promise<any>;
          DeleteTemplate(id: string): Promise<BackendResult>;
        };
      };
      main?: {
        App: {
          // Terminal methods
          SpawnTerminal(id: string, cwd: string, workspaceId: string, cols: number, rows: number): Promise<{ success: boolean; pid?: number; error?: string }>;
          SpawnTerminalWithAgent(id: string, cwd: string, agentType: string, workspaceId: string, cols: number, rows: number): Promise<{ success: boolean; pid?: number; error?: string }>;
          WriteToTerminal(id: string, data: string): Promise<{ success: boolean; error?: string }>;
          KillTerminal(id: string): Promise<{ success: boolean; error?: string }>;
          ResizeTerminal(id: string, cols: number, rows: number): Promise<{ success: boolean; error?: string }>;
          GetTerminalStatus(id: string): Promise<{ exists: boolean; status: string; pid?: number }>;
          SetWorkspaceActive(workspaceId: string, active: boolean): Promise<{ success: boolean }>;
          GetTerminalBacklog(terminalId: string): Promise<{ success: boolean; backlog: string }>;
          ClearTerminalBacklog(terminalId: string): Promise<{ success: boolean }>;
          // Store methods
          GetValue(key: string): Promise<any>;
          SetValue(key: string, value: any): Promise<{ success: boolean; error?: string }>;
          DeleteValue(key: string): Promise<{ success: boolean; error?: string }>;
          // System methods
          GetAppVersion(): Promise<string>;
          GetPlatform(): Promise<string>;
          GetCwd(): Promise<string>;
          ShowOpenDialog(options: import("../types/backend").DialogOptions): Promise<import("../types/backend").DialogResult>;
          ListDirectory(path: string): Promise<DirectoryListing>;
          // Window methods
          WindowMinimize(): Promise<void>;
          WindowMaximize(): Promise<void>;
          WindowClose(): Promise<void>;
          WindowIsMaximized(): Promise<boolean>;
          // Vietnamese IME methods
          ApplyVietnameseImePatch(): Promise<BackendPatchResult>;
          CheckVietnameseImePatchStatus(): Promise<BackendPatchStatus>;
          GetVietnameseImeSettings(): Promise<BackendIMESettings>;
          SetVietnameseImeSettings(settings: BackendIMESettings): Promise<BackendResult>;
          RestoreVietnameseImePatch(): Promise<BackendRestoreResult>;
          ValidateVietnameseImePatch(): Promise<BackendPatchValidation>;
        };
      };
    };

    // Wails runtime event system
    runtime?: {
      EventsOn(eventName: string, callback: (...data: any[]) => void): () => void;
      EventsOff(eventName: string, ...callbacks: Array<(...data: any[]) => void>): void;
      EventsEmit(eventName: string, ...data: any[]): void;
      WindowMinimise(): void;
      WindowMaximise(): void;
      WindowClose(): void;
      WindowToggleMaximise(): void;
    };
  }
}

// --- Wails availability check ---

export function isWailsAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window.go?.main?.App || window.go?.services?.WorkspaceService)
  );
}

// --- Event name constants (must match Go backend) ---
// Note: Go backend emits: terminal-data, terminal-exit (see internal/services/terminal*.go)
// terminal-started and terminal-error are not emitted by Go backend (may be added later)
export const WAILS_EVENTS = {
  TERMINAL_DATA:    'terminal-data',
  TERMINAL_STARTED: 'terminal-started',     // Not emitted yet by Go backend
  TERMINAL_EXIT:    'terminal-exit',
  TERMINAL_ERROR:   'terminal-error',       // Not emitted yet by Go backend
  IME_PATCH_APPLIED: 'ime-patch-applied',   // Not emitted yet by Go backend
} as const;

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
  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
  listDirectory(path: string): Promise<DirectoryListing>;

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

  // Vietnamese IME patch
  applyVietnameseImePatch(): Promise<VietnameseImePatchResult>;
  checkVietnameseImePatchStatus(): Promise<VietnameseImeStatus>;
  getVietnameseImeSettings(): Promise<VietnameseImeSettings>;
  setVietnameseImeSettings(settings: VietnameseImeSettings): Promise<{ success: boolean; error?: string }>;
  restartClaudeTerminals(workspaceId: string, terminals: Array<{ id: string; cwd: string; agentConfig?: any }>): Promise<{ success: boolean; restarted?: Array<{ id: string; success: boolean; error?: string }> }>;
  restoreVietnameseImePatch(): Promise<{ success: boolean; message?: string }>;
  validateVietnameseImePatch(): Promise<BackendPatchValidation>;
  onVietnameseImePatchApplied(callback: (result: VietnameseImePatchResult) => void): () => void;

  // Workspace-level IME patch validation
  validatePatchForWorkspace(workspace: any): Promise<void>;
}

// --- Wails implementation ---

function createWailsBridge(): BackendAPI {
  const app = () => window.go?.main?.App;
  const workspaceService = () => window.go?.services?.WorkspaceService;
  const templateService = () => window.go?.services?.TemplateService;
  const runtime = () => window.runtime;

  const onEvent = (eventName: string, callback: (...args: any[]) => void): (() => void) => {
    const rt = runtime();
    if (rt?.EventsOn) {
      return rt.EventsOn(eventName, callback);
    }
    return () => {};
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
    getAppVersion: () => safeCall(() => app()?.GetAppVersion() ?? Promise.resolve('unknown'), 'unknown'),
    getPlatform:   () => safeCall(() => app()?.GetPlatform() ?? Promise.resolve('unknown'), 'unknown'),
    getCwd:        () => safeCall(() => app()?.GetCwd() ?? Promise.resolve('./'), './'),

    windowMinimize: async () => { app()?.WindowMinimize(); },
    windowMaximize: async () => { app()?.WindowMaximize(); },
    windowClose:    async () => { app()?.WindowClose(); },

    getStoreValue:    (key) => {
      return safeCall(() => app()!.GetValue(key), null);
    },
    setStoreValue:    (key, value) => {
      return safeCall(() => app()!.SetValue(key, value), { success: false, error: 'StoreService unavailable' });
    },
    deleteStoreValue: (key) => {
      return safeCall(() => app()!.DeleteValue(key), { success: false, error: 'StoreService unavailable' });
    },

    showOpenDialog: (options) => safeCall(() => {
      // Convert frontend options to Go DialogOptions format
      type GoDialogOptions = import('../types/backend').DialogOptions;
      type GoDialogResult = import('../types/backend').DialogResult;
      const dialogOptions: GoDialogOptions = {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        properties: options.properties || [],
      };
      return app()!.ShowOpenDialog(dialogOptions).then((result: GoDialogResult) => ({
        canceled: result.Canceled,
        filePaths: result.FilePaths,
      } as OpenDialogReturnValue));
    }, { canceled: true, filePaths: [] }),

    listDirectory: (path) => safeCall(() => {
      return app()!.ListDirectory(path);
    }, { entries: [], error: 'Failed to list directory' }),

    getWorkspaces: () => {
      const result = workspaceService()?.GetWorkspaces();
      if (!result) return Promise.resolve([]);
      return result.then((workspaces: any[]) => {
        // Convert Go Workspace format to frontend WorkspaceLayout format
        // Filter out null/undefined workspaces and those without id
        return (workspaces || [])
          .filter((ws: any) => ws && ws.id)
          .map((ws: any) => ({
            id: ws.id,
            name: ws.name,
            columns: ws.layout?.columns || 1,
            rows: ws.layout?.rows || 1,
            terminals: (ws.terminals || []).filter((t: any) => t && t.id).map((t: any) => ({
              id: t.id,
              title: t.title || 'Terminal',
              cwd: t.cwd,
              shell: 'powershell.exe',
              status: t.status,
              agent: { type: t.agentType || 'none', enabled: t.agentType !== 'none' },
            })),
            icon: ws.icon,
            createdAt: ws.createdAt,
            lastUsed: ws.updatedAt || ws.createdAt,
          }));
      }).catch(() => [] as any[]);
    },
    createWorkspace: (cfg) => {
      // Convert frontend WorkspaceLayout format to Go Workspace format
      const goWorkspace = {
        id: cfg.id || '',
        name: cfg.name,
        cwd: cfg.cwd || cfg.terminals?.[0]?.cwd || './',
        layout: {
          rows: cfg.rows,
          columns: cfg.columns,
        },
        terminals: (cfg.terminals || []).map((t: any) => ({
          id: t.id,
          workspaceId: cfg.id,
          agentType: t.agent?.type || 'none',
          cwd: t.cwd,
          title: t.title,
          status: t.status,
          command: '',
          args: [],
        })),
        icon: cfg.icon,
        createdAt: cfg.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      const result = workspaceService()?.CreateWorkspace(goWorkspace);
      if (!result) return Promise.resolve(null as any);
      return result.then((ws: any) => {
        // Convert Go Workspace format to frontend WorkspaceLayout format
        if (!ws || !ws.id) return null as any;
        // Ensure terminals is always an array and filter out null entries
        const terminals = (ws.terminals || []).filter((t: any) => t && t.id).map((t: any) => ({
          id: t.id,
          title: t.title || 'Terminal',
          cwd: t.cwd,
          shell: 'powershell.exe',
          status: t.status,
          agent: { type: t.agentType || 'none', enabled: t.agentType !== 'none' },
        }));
        return {
          id: ws.id,
          name: ws.name,
          columns: ws.layout?.columns || cfg.columns,
          rows: ws.layout?.rows || cfg.rows,
          terminals: terminals,
          icon: cfg.icon,
          createdAt: ws.createdAt,
          lastUsed: ws.updatedAt || ws.createdAt,
        };
      }).catch(() => null as any);
    },
    updateWorkspace: (ws) => {
      // Convert frontend WorkspaceLayout format to Go Workspace format
      const goWorkspace = {
        id: ws.id,
        name: ws.name,
        cwd: ws.cwd || ws.terminals?.[0]?.cwd || './',
        layout: {
          rows: ws.rows,
          columns: ws.columns,
        },
        terminals: (ws.terminals || []).map((t: any) => ({
          id: t.id,
          workspaceId: ws.id,
          agentType: t.agent?.type || 'none',
          cwd: t.cwd,
          title: t.title,
          status: t.status,
          command: '',
          args: [],
        })),
        createdAt: ws.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      const result = workspaceService()?.UpdateWorkspace(goWorkspace);
      if (!result) return Promise.resolve(null as any);
      return result.then((result: any) => {
        // Convert Go Workspace format to frontend WorkspaceLayout format
        if (!result || !result.id) return null as any;
        return {
          id: result.id,
          name: result.name,
          columns: result.layout?.columns || ws.columns,
          rows: result.layout?.rows || ws.rows,
          terminals: (result.terminals || []).map((t: any) => ({
            id: t.id,
            title: t.title || 'Terminal',
            cwd: t.cwd,
            shell: 'powershell.exe',
            status: t.status,
            agent: { type: t.agentType || 'none', enabled: t.agentType !== 'none' },
          })),
          icon: ws.icon,
          createdAt: result.createdAt,
          lastUsed: result.updatedAt || result.createdAt,
        };
      }).catch(() => null as any);
    },
    deleteWorkspace:            (id)   => safeCall(() => workspaceService()?.DeleteWorkspace(id) ?? Promise.resolve({ success: false, error: 'WorkspaceService unavailable' }), { success: false, error: 'Failed to delete workspace' }),
    switchWorkspace:            (id)   => safeCall(() => {
      console.warn('[WailsBridge] switchWorkspace not implemented');
      return Promise.resolve(null);
    }, null),
    cleanupWorkspaceTerminals:  (id)   => safeCall(() => {
      console.warn('[WailsBridge] cleanupWorkspaceTerminals not implemented');
      return Promise.resolve({ success: false, cleaned: 0 });
    }, { success: false, cleaned: 0 }),
    setWorkspaceActive:         (workspaceId, active) => safeCall(() => app()!.SetWorkspaceActive(workspaceId, active), { success: false }),
    getTerminalBacklog:         (terminalId) => safeCall(() => app()!.GetTerminalBacklog(terminalId), { success: false, backlog: '' }),
    clearTerminalBacklog:       (terminalId) => safeCall(() => app()!.ClearTerminalBacklog(terminalId), { success: false }),

    getTemplates:   ()     => safeCall(() => templateService()?.GetTemplates() ?? Promise.resolve([]), []),
    saveTemplate:   (t)    => safeCall(() => templateService()?.SaveTemplate(t) ?? Promise.resolve({ success: false, error: 'TemplateService unavailable' }), { success: false, error: 'TemplateService failed' }),
    deleteTemplate: (id)   => safeCall(() => templateService()?.DeleteTemplate(id) ?? Promise.resolve({ success: false, error: 'TemplateService unavailable' }), { success: false, error: 'TemplateService failed' }),

    spawnTerminal: (id, cwd, workspaceId, cols, rows) =>
      safeCall(() => app()!.SpawnTerminal(id, cwd, workspaceId, cols, rows), { success: false, error: 'TerminalService unavailable' }),
    spawnTerminalWithAgent: (id, cwd, agentConfig, workspaceId, cols, rows) =>
      safeCall(() => app()!.SpawnTerminalWithAgent(id, cwd, agentConfig.type, workspaceId, cols, rows), { success: false, error: 'TerminalService unavailable' }),
    terminalWrite:  (id, data)           => safeCall(() => app()!.WriteToTerminal(id, data), { success: false, error: 'TerminalService unavailable' }),
    terminalKill:   (id)                 => safeCall(() => app()!.KillTerminal(id), { success: false, error: 'TerminalService unavailable' }),
    terminalResize: (id, cols, rows)     => safeCall(() => app()!.ResizeTerminal(id, cols, rows), { success: false }),
    getTerminalStatus: (id)              => safeCall(() => app()!.GetTerminalStatus(id), { exists: false, status: 'stopped' }),

    onTerminalData:    (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_DATA, cb); return cleanup || (() => {}); },
    onTerminalStarted: (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_STARTED, cb); return cleanup || (() => {}); },
    onTerminalExit:    (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_EXIT, cb); return cleanup || (() => {}); },
    onTerminalError:   (cb) => { const cleanup = onEvent(WAILS_EVENTS.TERMINAL_ERROR, cb); return cleanup || (() => {}); },

    applyVietnameseImePatch:       ()          => safeCall(() => app()!.ApplyVietnameseImePatch() as any, { success: false, message: 'Failed to apply patch' }),
    checkVietnameseImePatchStatus: ()          => safeCall(() => app()!.CheckVietnameseImePatchStatus(), { isPatched: false, claudePath: '', hasBackup: false, installedVia: 'unknown' }),
    getVietnameseImeSettings:      ()          => safeCall(() => app()!.GetVietnameseImeSettings(), { enabled: false, autoPatch: false }),
    setVietnameseImeSettings:      (settings)  => safeCall(() => app()!.SetVietnameseImeSettings(settings), { success: false, error: 'Failed to save settings' }),
    restartClaudeTerminals:        (wsId, ts)  => safeCall(() => {
      console.warn('[WailsBridge] restartClaudeTerminals not implemented');
      return Promise.resolve({ success: false });
    }, { success: false }),
    restoreVietnameseImePatch:     ()          => safeCall(() => app()!.RestoreVietnameseImePatch(), { success: false, message: 'Failed to restore' }),
    validateVietnameseImePatch:    ()          => safeCall(() => app()!.ValidateVietnameseImePatch(), { isValid: false, isPatched: false, issues: [], suggestions: [] }),
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
  const noopStr = async () => '';
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
    getTerminalStatus:       () => Promise.resolve({ exists: false, status: 'stopped' }),
    onTerminalData:    noopUnsubscribe,
    onTerminalStarted: noopUnsubscribe,
    onTerminalExit:    noopUnsubscribe,
    onTerminalError:   noopUnsubscribe,
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
