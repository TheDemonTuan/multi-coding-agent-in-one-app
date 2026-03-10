/**
 * Wails Bridge
 *
 * Adapter layer that maps frontend calls to Go backend via Wails runtime bindings.
 * Replaces electron's preload.cjs / window.electronAPI.
 *
 * Wails auto-generates TypeScript bindings from Go exported methods.
 * They are available at: window.go.<PackageName>.<StructName>.<MethodName>()
 *
 * Event system uses: window.runtime.EventsOn / EventsOff / EventsEmit
 */

import type {
  VietnameseImePatchResult,
  VietnameseImeStatus,
  VietnameseImeSettings,
  PatchValidation,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from '../types/backend';

import type { AgentConfig } from '../types/workspace';

// --- Type Declarations for Wails runtime globals ---

declare global {
  interface Window {
    // Wails Go bindings (auto-generated)
    go: {
      main: {
        App: {
          // Terminal methods
          SpawnTerminal(id: string, cwd: string, workspaceId: string): Promise<{ success: boolean; pid?: number; error?: string }>;
          SpawnTerminalWithAgent(id: string, cwd: string, agentType: string, workspaceId: string): Promise<{ success: boolean; pid?: number; error?: string }>;
          WriteToTerminal(id: string, data: string): Promise<{ success: boolean; error?: string }>;
          KillTerminal(id: string): Promise<{ success: boolean; error?: string }>;
          ResizeTerminal(id: string, cols: number, rows: number): Promise<{ success: boolean; error?: string }>;
          GetTerminalStatus(id: string): Promise<{ exists: boolean; status: string; pid?: number }>;
          // Store methods
          GetValue(key: string): Promise<any>;
          SetValue(key: string, value: any): Promise<{ success: boolean; error?: string }>;
          DeleteValue(key: string): Promise<{ success: boolean; error?: string }>;
          // System methods
          GetAppVersion(): Promise<string>;
          GetPlatform(): Promise<string>;
          GetCwd(): Promise<string>;
          // Window methods
          WindowMinimize(): Promise<void>;
          WindowMaximize(): Promise<void>;
          WindowClose(): Promise<void>;
          WindowIsMaximized(): Promise<boolean>;
        };
      };
    };

    // Wails runtime event system
    runtime: {
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
    !!(window as any).go?.main?.App
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

  // Workspace management
  getWorkspaces(): Promise<any[]>;
  createWorkspace(config: any): Promise<any>;
  deleteWorkspace(id: string): Promise<{ success: boolean; error?: string }>;
  switchWorkspace(id: string): Promise<any>;
  cleanupWorkspaceTerminals(workspaceId: string): Promise<{ success: boolean; cleaned?: number }>;

  // Template management
  getTemplates(): Promise<any[]>;
  saveTemplate(template: any): Promise<{ success: boolean; error?: string }>;
  deleteTemplate(id: string): Promise<{ success: boolean; error?: string }>;

  // Terminal management
  spawnTerminal(id: string, cwd: string, workspaceId?: string): Promise<{ success: boolean; pid?: number; error?: string }>;
  spawnTerminalWithAgent(id: string, cwd: string, agentConfig: AgentConfig, workspaceId?: string): Promise<{ success: boolean; pid?: number; error?: string }>;
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
  validateVietnameseImePatch(): Promise<PatchValidation>;
  onVietnameseImePatchApplied(callback: (result: VietnameseImePatchResult) => void): () => void;

  // Workspace-level IME patch validation
  validatePatchForWorkspace(workspace: any): Promise<void>;
}

// --- Wails implementation ---

function createWailsBridge(): BackendAPI {
  const app = () => window.go?.main?.App;
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
    getAppVersion: () => safeCall(() => app()?.GetAppVersion(), 'unknown'),
    getPlatform:   () => safeCall(() => app()?.GetPlatform(), 'unknown'),
    getCwd:        () => safeCall(() => app()?.GetCwd(), './'),

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
      console.warn('[WailsBridge] showOpenDialog not implemented');
      return Promise.resolve({ canceled: true, filePaths: [] } as OpenDialogReturnValue);
    }, { canceled: true, filePaths: [] }),

    getWorkspaces:              ()     => safeCall(() => {
      console.warn('[WailsBridge] getWorkspaces not implemented');
      return Promise.resolve([]);
    }, []),
    createWorkspace:            (cfg)  => safeCall(() => {
      console.warn('[WailsBridge] createWorkspace not implemented');
      return Promise.resolve(null);
    }, null),
    deleteWorkspace:            (id)   => safeCall(() => {
      console.warn('[WailsBridge] deleteWorkspace not implemented');
      return Promise.resolve({ success: false, error: 'WorkspaceService not implemented' });
    }, { success: false, error: 'WorkspaceService not implemented' }),
    switchWorkspace:            (id)   => safeCall(() => {
      console.warn('[WailsBridge] switchWorkspace not implemented');
      return Promise.resolve(null);
    }, null),
    cleanupWorkspaceTerminals:  (id)   => safeCall(() => {
      console.warn('[WailsBridge] cleanupWorkspaceTerminals not implemented');
      return Promise.resolve({ success: false, cleaned: 0 });
    }, { success: false, cleaned: 0 }),

    getTemplates:   ()     => safeCall(() => {
      console.warn('[WailsBridge] getTemplates not implemented');
      return Promise.resolve([]);
    }, []),
    saveTemplate:   (t)    => safeCall(() => {
      console.warn('[WailsBridge] saveTemplate not implemented');
      return Promise.resolve({ success: false, error: 'TemplateService not implemented' });
    }, { success: false, error: 'TemplateService not implemented' }),
    deleteTemplate: (id)   => safeCall(() => {
      console.warn('[WailsBridge] deleteTemplate not implemented');
      return Promise.resolve({ success: false, error: 'TemplateService not implemented' });
    }, { success: false, error: 'TemplateService not implemented' }),

    spawnTerminal: (id, cwd, workspaceId = '') =>
      safeCall(() => app()!.SpawnTerminal(id, cwd, workspaceId), { success: false, error: 'TerminalService unavailable' }),
    spawnTerminalWithAgent: (id, cwd, agentConfig, workspaceId = '') =>
      safeCall(() => app()!.SpawnTerminalWithAgent(id, cwd, agentConfig.type, workspaceId), { success: false, error: 'TerminalService unavailable' }),
    terminalWrite:  (id, data)           => safeCall(() => app()!.WriteToTerminal(id, data), { success: false, error: 'TerminalService unavailable' }),
    terminalKill:   (id)                 => safeCall(() => app()!.KillTerminal(id), { success: false, error: 'TerminalService unavailable' }),
    terminalResize: (id, cols, rows)     => safeCall(() => app()!.ResizeTerminal(id, cols, rows), { success: false }),
    getTerminalStatus: (id)              => safeCall(() => app()!.GetTerminalStatus(id), { exists: false, status: 'stopped' }),

    onTerminalData:    (cb) => onEvent(WAILS_EVENTS.TERMINAL_DATA,    cb),
    onTerminalStarted: (cb) => onEvent(WAILS_EVENTS.TERMINAL_STARTED, cb),
    onTerminalExit:    (cb) => onEvent(WAILS_EVENTS.TERMINAL_EXIT,    cb),
    onTerminalError:   (cb) => onEvent(WAILS_EVENTS.TERMINAL_ERROR,   cb),

    applyVietnameseImePatch:       ()          => safeCall(() => {
      console.warn('[WailsBridge] applyVietnameseImePatch not implemented');
      return Promise.resolve({ success: false, message: 'VietnameseIMEService not implemented' });
    }, { success: false, message: 'VietnameseIMEService not implemented' }),
    checkVietnameseImePatchStatus: ()          => safeCall(() => {
      console.warn('[WailsBridge] checkVietnameseImePatchStatus not implemented');
      return Promise.resolve({ isPatched: false, claudePath: undefined, claudeCodeInstalled: false });
    }, { isPatched: false, claudePath: undefined, claudeCodeInstalled: false }),
    getVietnameseImeSettings:      ()          => safeCall(() => {
      console.warn('[WailsBridge] getVietnameseImeSettings not implemented');
      return Promise.resolve({ enabled: false, autoPatch: false });
    }, { enabled: false, autoPatch: false }),
    setVietnameseImeSettings:      (settings)  => safeCall(() => {
      console.warn('[WailsBridge] setVietnameseImeSettings not implemented');
      return Promise.resolve({ success: false, error: 'VietnameseIMEService not implemented' });
    }, { success: false, error: 'VietnameseIMEService not implemented' }),
    restartClaudeTerminals:        (wsId, ts)  => safeCall(() => {
      console.warn('[WailsBridge] restartClaudeTerminals not implemented');
      return Promise.resolve({ success: false });
    }, { success: false }),
    restoreVietnameseImePatch:     ()          => safeCall(() => {
      console.warn('[WailsBridge] restoreVietnameseImePatch not implemented');
      return Promise.resolve({ success: false, message: 'VietnameseIMEService not implemented' });
    }, { success: false, message: 'VietnameseIMEService not implemented' }),
    validateVietnameseImePatch:    ()          => safeCall(() => {
      console.warn('[WailsBridge] validateVietnameseImePatch not implemented');
      return Promise.resolve({ isValid: false });
    }, { isValid: false }),
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
    getWorkspaces:              noopArr,
    createWorkspace:            () => Promise.resolve(null),
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
    applyVietnameseImePatch:       noop as any,
    checkVietnameseImePatchStatus: () => Promise.resolve({ isPatched: false, claudePath: undefined, claudeCodeInstalled: false }),
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

// Also expose on window for legacy code that does `window.electronAPI`
// Use Object.defineProperty in case the property was declared read-only (e.g. by Wails preload)
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
