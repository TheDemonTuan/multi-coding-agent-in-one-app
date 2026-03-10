export type AgentType =
  | 'claude-code'
  | 'opencode'
  | 'droid'
  | 'gemini-cli'
  | 'cursor'
  | 'codex'
  | 'oh-my-pi'
  | 'aider'
  | 'goose'
  | 'warp'
  | 'amp'
  | 'kiro'
  | 'none';

export interface AgentConfig {
  type: AgentType;
  command?: string;
  args?: string[];
  apiKey?: string;
  enabled: boolean;
}

export interface AgentAllocation {
  claudeCode: number;
  opencode: number;
  droid: number;
  geminiCli: number;
  cursor: number;
  codex: number;
  ohMyPi: number;
  aider: number;
  goose: number;
  warp: number;
  amp: number;
  kiro: number;
}

export type LayoutType = 'single' | 'dual' | 'quad' | 'six' | 'eight' | 'ten' | 'twelve' | 'fourteen' | 'sixteen' | 'grid' | 'custom';

export interface Template {
  id: string;
  name: string;
  description: string;
  layout: LayoutType;
  columns: number;
  rows: number;
  icon: string;
  isBuiltIn: boolean;
  createdAt: number;
  agentAllocation?: AgentAllocation;
}

export interface TerminalPane {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  status: 'running' | 'stopped' | 'error';
  agent?: AgentConfig;
  processId?: number;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  columns: number;
  rows: number;
  terminals: TerminalPane[];
  icon?: string;
  createdAt: number;
  lastUsed: number;
}

export interface WorkspaceCreationConfig {
  name: string;
  columns: number;
  rows: number;
  cwd: string;
  icon?: string;
  agentAssignments: Record<string, AgentConfig>;
  templateId?: string;
}

export interface WorkspaceState {
  currentWorkspace: WorkspaceLayout | null;
  workspaces: WorkspaceLayout[];
  activeTerminalId: string | null;
  theme: 'dark' | 'light';
  isWorkspaceModalOpen: boolean;
  editingWorkspace: WorkspaceLayout | null;
  restartingTerminals: Set<string>;

  isTerminalRestarting: (terminalId: string) => boolean;
  setCurrentWorkspace: (workspace: WorkspaceLayout | null) => void;
  addWorkspace: (config: WorkspaceCreationConfig) => WorkspaceLayout;
  removeWorkspace: (id: string) => Promise<void>;
  updateWorkspace: (id: string, updates: Partial<WorkspaceLayout>) => void;
  setActiveTerminal: (id: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setWorkspaceModalOpen: (isOpen: boolean) => void;
  setWorkspaceModalOpenWithEdit: (workspace: WorkspaceLayout) => void;
  updateTerminalAgent: (terminalId: string, agentConfig: AgentConfig) => void;
  updateTerminalStatus: (terminalId: string, status: TerminalPane['status']) => void;
  setTerminalProcessId: (terminalId: string, pid: number) => void;
  removeTerminal: (terminalId: string) => Promise<void>;
  splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => void;
  restartTerminal: (terminalId: string) => Promise<void>;
  switchTerminalAgent: (terminalId: string, newAgentType: string) => Promise<void>;

  loadWorkspaces: () => void;
  saveWorkspaces: () => void;

  getNextWorkspace: () => WorkspaceLayout | null;
  getPreviousWorkspace: () => WorkspaceLayout | null;
  getNextTerminal: () => TerminalPane | null;
  getPreviousTerminal: () => TerminalPane | null;
  getWorkspaceByIndex: (index: number) => WorkspaceLayout | null;
  getTerminalByIndex: (terminalIndex: number) => TerminalPane | null;
}
