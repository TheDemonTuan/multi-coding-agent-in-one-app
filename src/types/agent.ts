/**
 * Agent-related types
 */

export type AgentType = 'claude-code' | 'opencode' | 'droid' | 'none';

export interface AgentConfig {
  type: AgentType;
  enabled: boolean;
  command?: string;
  args?: string[];
}

export interface AgentSpawnOptions {
  type: AgentType;
  cwd: string;
  args?: string[];
}

export interface AgentState {
  isActive: boolean;
  lastCommand?: string;
  isProcessing: boolean;
}
