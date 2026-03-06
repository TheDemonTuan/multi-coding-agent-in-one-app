// Type exports - use specific imports to avoid conflicts
// Example: import type { WorkspaceLayout } from './workspace';
//          import type { TerminalPane } from './terminal';
//          import type { AgentConfig } from './agent';

// Re-export commonly used types with explicit naming to avoid conflicts
export type { WorkspaceState, WorkspaceLayout, TerminalPane as WorkspaceTerminalPane, WorkspaceCreationConfig, AgentConfig as WorkspaceAgentConfig, AgentType as WorkspaceAgentType, Template, AgentAllocation } from './workspace';
export type { TerminalPane, TerminalStatus, TerminalProcess, TerminalDataEvent, TerminalExitEvent, TerminalResizeOptions, TerminalSpawnOptions } from './terminal';
export type { AgentConfig, AgentSpawnOptions, AgentState } from './agent';
export type * from './ipc';
export type { ElectronAPI } from './electron';
