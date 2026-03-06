/**
 * Terminal-related types
 */

import type { AgentConfig } from './agent';

export type TerminalStatus = 'stopped' | 'running' | 'error' | 'killed';

export interface TerminalPane {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  status: TerminalStatus;
  agent?: AgentConfig;
  processId?: number;
}

export interface TerminalProcess {
  ptyProcess: any;
  cwd: string;
  agentType?: string;
  workspaceId?: string;
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  code?: number;
  signal?: string;
}

export interface TerminalResizeOptions {
  id: string;
  cols: number;
  rows: number;
}

export interface TerminalSpawnOptions {
  id: string;
  cwd: string;
  workspaceId?: string;
  agentConfig?: AgentConfig;
}
