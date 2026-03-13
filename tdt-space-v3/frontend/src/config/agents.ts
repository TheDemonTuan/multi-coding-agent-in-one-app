/**
 * Agent command configurations
 */

export interface AgentConfig {
  type: string;
  command: string;
  displayName: string;
  description?: string;
  defaultArgs?: string[];
}

/**
 * Built-in agent configurations
 */
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  'claude-code': {
    type: 'claude-code',
    command: 'claude',
    displayName: 'Claude Code',
    description: 'Anthropic\'s AI coding assistant',
    defaultArgs: [],
  },
  'opencode': {
    type: 'opencode',
    command: 'opencode',
    displayName: 'OpenCode',
    description: 'Open source AI coding assistant',
    defaultArgs: [],
  },
  'droid': {
    type: 'droid',
    command: 'droid',
    displayName: 'Droid',
    description: 'AI software engineering agent',
    defaultArgs: [],
  },
  'gemini-cli': {
    type: 'gemini-cli',
    command: 'gemini',
    displayName: 'Gemini CLI',
    description: 'Google\'s AI coding assistant',
    defaultArgs: [],
  },
  'aider': {
    type: 'aider',
    command: 'aider',
    displayName: 'Aider',
    description: 'AI pair programming tool',
    defaultArgs: [],
  },
  'cursor': {
    type: 'cursor',
    command: 'cursor',
    displayName: 'Cursor',
    description: 'AI-powered code editor',
    defaultArgs: [],
  },
  'codex': {
    type: 'codex',
    command: 'codex',
    displayName: 'Codex CLI',
    description: 'OpenAI\'s coding assistant',
    defaultArgs: [],
  },
  'goose': {
    type: 'goose',
    command: 'goose',
    displayName: 'Goose',
    description: 'Open source AI agent',
    defaultArgs: [],
  },
  'amp': {
    type: 'amp',
    command: 'amp',
    displayName: 'Amp',
    description: 'AI coding tool',
    defaultArgs: [],
  },
  'kiro': {
    type: 'kiro',
    command: 'kiro',
    displayName: 'Kiro',
    description: 'AWS AI coding assistant',
    defaultArgs: [],
  },
  'oh-my-pi': {
    type: 'oh-my-pi',
    command: 'omp',
    displayName: 'Oh My Pi',
    description: 'Minimalist AI coding agent',
    defaultArgs: [],
  },
  'none': {
    type: 'none',
    command: '',
    displayName: 'None',
    description: 'Plain terminal without agent',
    defaultArgs: [],
  },
} as const;

/**
 * Get agent command by type
 */
export function getAgentCommand(type: string): string {
  const config = AGENT_CONFIGS[type];
  return config?.command || '';
}

/**
 * Check if agent type is supported
 */
export function isSupportedAgent(type: string): boolean {
  return type in AGENT_CONFIGS && type !== 'none';
}

/**
 * Get all supported agent types (excluding 'none')
 */
export function getSupportedAgentTypes(): string[] {
  return Object.keys(AGENT_CONFIGS).filter(key => key !== 'none');
}

/**
 * Get agent display name
 */
export function getAgentDisplayName(type: string): string {
  const config = AGENT_CONFIGS[type];
  return config?.displayName || type;
}
