/**
 * Application-wide constants
 */

// App metadata
export const APP_NAME = 'TDT Space';
export const APP_VERSION = '1.0.0';

// Default values
export const DEFAULT_WINDOW_WIDTH = 1400;
export const DEFAULT_WINDOW_HEIGHT = 900;
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;

// Terminal defaults
export const DEFAULT_TERMINAL_COLS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;
export const DEFAULT_SHELL_WINDOWS = 'powershell.exe';
export const DEFAULT_SHELL_UNIX = 'bash';

// Grid layout limits
export const MAX_COLUMNS = 4;
export const MAX_ROWS = 4;
export const MIN_COLUMNS = 1;
export const MIN_ROWS = 1;

// Agent types
export const SUPPORTED_AGENTS = ['claude-code', 'opencode', 'droid'] as const;
export const DEFAULT_AGENT_TYPE = 'none';

// Keyboard shortcuts
export const SHORTCUTS = {
  NEW_WORKSPACE: 'Ctrl+Shift+N',
  SWITCH_WORKSPACE_NEXT: 'Ctrl+Tab',
  SWITCH_WORKSPACE_PREV: 'Ctrl+Shift+Tab',
  NEXT_TERMINAL: 'Ctrl+T',
  PREV_TERMINAL: 'Ctrl+Shift+T',
  SETTINGS: 'Ctrl+,',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  WORKSPACES: 'workspaces',
  TEMPLATES: 'templates',
  SETTINGS: 'settings',
  VIETNAMESE_IME: 'vietnamese-ime-settings',
  TERMINAL_HISTORY: 'terminal-history',
} as const;

// IPC channel names
export const IPC_CHANNELS = {
  // Terminal
  SPAWN_TERMINAL: 'spawn-terminal',
  SPAWN_TERMINAL_WITH_AGENT: 'spawn-terminal-with-agent',
  TERMINAL_WRITE: 'terminal-write',
  TERMINAL_KILL: 'terminal-kill',
  TERMINAL_RESIZE: 'terminal-resize',
  CLEANUP_WORKSPACE_TERMINALS: 'cleanup-workspace-terminals',
  TERMINAL_STARTED: 'terminal-started',
  TERMINAL_DATA: 'terminal-data',
  TERMINAL_EXIT: 'terminal-exit',
  TERMINAL_ERROR: 'terminal-error',
  
  // Workspace
  GET_WORKSPACES: 'get-workspaces',
  CREATE_WORKSPACE: 'create-workspace',
  DELETE_WORKSPACE: 'delete-workspace',
  SWITCH_WORKSPACE: 'switch-workspace',
  VALIDATE_PATCH_FOR_WORKSPACE: 'validate-patch-for-workspace',
  
  // Store
  GET_STORE_VALUE: 'get-store-value',
  SET_STORE_VALUE: 'set-store-value',
  
  // Template
  GET_TEMPLATES: 'get-templates',
  SAVE_TEMPLATE: 'save-template',
  DELETE_TEMPLATE: 'delete-template',
  
  // Window
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE: 'window-maximize',
  WINDOW_CLOSE: 'window-close',
  
  // Vietnamese IME
  APPLY_VIETNAMESE_IME_PATCH: 'apply-vietnamese-ime-patch',
  CHECK_VIETNAMESE_IME_PATCH_STATUS: 'check-vietnamese-ime-patch-status',
  RESTORE_VIETNAMESE_IME_PATCH: 'restore-vietnamese-ime-patch',
  VALIDATE_VIETNAMESE_IME_PATCH: 'validate-vietnamese-ime-patch',
  GET_VIETNAMESE_IME_SETTINGS: 'get-vietnamese-ime-settings',
  SET_VIETNAMESE_IME_SETTINGS: 'set-vietnamese-ime-settings',
  RESTART_CLAUDE_TERMINALS: 'restart-claude-terminals',
  VIETNAMESE_IME_PATCH_APPLIED: 'vietnamese-ime-patch-applied',
  
  // Terminal history
  GET_TERMINAL_HISTORY: 'get-terminal-history',
  SAVE_TERMINAL_HISTORY: 'save-terminal-history',
  CLEAR_TERMINAL_HISTORY: 'clear-terminal-history',
  
  // System
  GET_APP_VERSION: 'get-app-version',
  GET_PLATFORM: 'get-platform',
  GET_CWD: 'get-cwd',
  
  // Dialog
  SHOW_OPEN_DIALOG: 'show-open-dialog',
} as const;

// Events
export const EVENTS = {
  TERMINAL_DATA: 'terminal-data',
  TERMINAL_EXIT: 'terminal-exit',
  TERMINAL_STARTED: 'terminal-started',
  TERMINAL_ERROR: 'terminal-error',
  VIETNAMESE_IME_PATCH_APPLIED: 'vietnamese-ime-patch-applied',
  OPEN_WORKSPACE_SWITCHER: 'open-workspace-switcher',
} as const;
