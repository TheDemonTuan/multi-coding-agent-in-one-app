/**
 * Unified Type Exports for TDT Space
 * 
 * Import từ file này thay vì import từ các file riêng lẻ
 * Giúp tránh circular imports và consolidate types
 */

// Core types (ưu tiên sử dụng các types này)
export type { AgentType, AgentConfig, AgentSpawnOptions, AgentState } from './agent';

export type {
  TerminalStatus,
  TerminalPane,
  TerminalProcess,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalResizeOptions,
  TerminalSpawnOptions,
} from './terminal';

export type {
  AgentType as WorkspaceAgentType,
  AgentConfig as WorkspaceAgentConfig,
  AgentAllocation,
  LayoutType,
  Template,
  TerminalPane as WorkspaceTerminalPane,
  WorkspaceLayout,
  WorkspaceCreationConfig,
  WorkspaceState,
} from './workspace';

// Backend API types
export type {
  VietnameseImePatchResult,
  VietnameseImeStatus,
  VietnameseImeSettings,
  PatchValidation,
  PatchLog,
  OpenDialogOptions,
  OpenDialogReturnValue,
} from './backend';

// Legacy exports (deprecated - use specific imports instead)
export type { ElectronAPI } from './electron';
