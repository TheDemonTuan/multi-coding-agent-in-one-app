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
export const DEFAULT_SHELL_MACOS = '/bin/zsh';
export const DEFAULT_SHELL_LINUX = '/bin/bash';

// Grid layout limits
export const MAX_COLUMNS = 4;
export const MAX_ROWS = 4;
export const MIN_COLUMNS = 1;
export const MIN_ROWS = 1;

// Agent types
export const SUPPORTED_AGENTS = ['claude-code', 'opencode', 'droid', 'gemini-cli', 'cursor', 'codex', 'aider', 'goose', 'amp', 'kiro'] as const;
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

// Wails event names (must match Go backend)
export const WAILS_EVENTS = {
  TERMINAL_DATA: 'terminal-data',
  TERMINAL_EXIT: 'terminal-exit',
  TERMINAL_STARTED: 'terminal-started',
  TERMINAL_ERROR: 'terminal-error',
  OPEN_WORKSPACE_SWITCHER: 'open-workspace-switcher',
} as const;
