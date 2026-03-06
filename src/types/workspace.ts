export type AgentType = 'opencode' | 'claude-code' | 'droid' | 'none';

export interface AgentConfig {
  type: AgentType;
  command?: string; // Custom command override
  args?: string[]; // Additional arguments
  apiKey?: string; // Optional API key
  enabled: boolean;
}

export interface AgentAllocation {
  claudeCode: number;  // Number of terminals assigned to claude-code
  opencode: number;    // Number of terminals assigned to opencode
  droid: number;       // Number of terminals assigned to droid
}

// Template types for workspace layouts
export type LayoutType = 'single' | 'dual' | 'quad' | 'six' | 'eight' | 'ten' | 'twelve' | 'fourteen' | 'sixteen' | 'grid' | 'custom';

export interface Template {
  id: string;
  name: string;
  description: string;
  layout: LayoutType;
  columns: number;
  rows: number;
  icon: string;
  isBuiltIn: boolean;  // true for pre-built, false for custom
  createdAt: number;
  agentAllocation?: AgentAllocation;
}

export interface TerminalPane {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  status: 'running' | 'stopped' | 'error';
  agent?: AgentConfig; // Agent configuration for this terminal
  processId?: number; // PID của terminal process
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  columns: number;
  rows: number;
  terminals: TerminalPane[];
  icon?: string; // Emoji or icon for workspace
  createdAt: number;
  lastUsed: number;
}

export interface WorkspaceCreationConfig {
  name: string;
  columns: number;
  rows: number;
  cwd: string;
  icon?: string;
  agentAssignments: Record<string, AgentConfig>; // terminalId -> AgentConfig
  templateId?: string; // Optional template ID
}

export interface WorkspaceState {
  currentWorkspace: WorkspaceLayout | null;
  workspaces: WorkspaceLayout[];
  activeTerminalId: string | null;
  theme: 'dark' | 'light';
  isWorkspaceModalOpen: boolean;
  editingWorkspace: WorkspaceLayout | null;

  // Actions
  setCurrentWorkspace: (workspace: WorkspaceLayout) => void;
  addWorkspace: (config: WorkspaceCreationConfig) => WorkspaceLayout;
  removeWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<WorkspaceLayout>) => void;
  setActiveTerminal: (id: string | null) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setWorkspaceModalOpen: (isOpen: boolean) => void;
  setWorkspaceModalOpenWithEdit: (workspace: WorkspaceLayout) => void;
  updateTerminalAgent: (terminalId: string, agentConfig: AgentConfig) => void;
  updateTerminalStatus: (terminalId: string, status: TerminalPane['status']) => void;
  setTerminalProcessId: (terminalId: string, pid: number) => void;
  removeTerminal: (terminalId: string) => void;
  splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => void;
  restartTerminal: (terminalId: string) => void;

  // Persistence
  loadWorkspaces: () => void;
  saveWorkspaces: () => void;

  // Keyboard navigation helpers
  getNextWorkspace: () => WorkspaceLayout | null;
  getPreviousWorkspace: () => WorkspaceLayout | null;
  getNextTerminal: () => TerminalPane | null;
  getPreviousTerminal: () => TerminalPane | null;
  getWorkspaceByIndex: (index: number) => WorkspaceLayout | null;
  getTerminalByIndex: (terminalIndex: number) => TerminalPane | null;
}
