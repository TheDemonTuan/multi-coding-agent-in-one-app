import { AgentType, AgentAllocation } from './workspace';

export type { AgentType, AgentAllocation };

export interface AgentIconConfig {
  type: AgentType;
  label: string;
  description: string;
  icon: string;
  emoji?: string;
  color: string;
}

const BASE_URL = import.meta.env.BASE_URL || './';

export const agentTypeInfo: AgentIconConfig[] = [
  { type: 'claude-code', label: 'Claude Code', description: "Anthropic's CLI agent", icon: `${BASE_URL}agent-icons/claude-code.svg`, emoji: '🤖', color: '#a6adc8' },
  { type: 'opencode', label: 'OpenCode', description: 'Open source coding agent', icon: `${BASE_URL}agent-icons/opencode.svg`, emoji: '🔓', color: '#a6adc8' },
  { type: 'droid', label: 'Droid', description: 'Custom AI agent', icon: `${BASE_URL}agent-icons/droid.svg`, emoji: '🤖', color: '#a6adc8' },
  { type: 'gemini-cli', label: 'Gemini CLI', description: "Google's AI agent", icon: `${BASE_URL}agent-icons/gemini-cli.svg`, emoji: '✨', color: '#89b4fa' },
  { type: 'cursor', label: 'Cursor CLI', description: 'AI-powered coding', icon: `${BASE_URL}agent-icons/cursor-cli.svg`, emoji: '🎯', color: '#f38ba8' },
  { type: 'codex', label: 'Codex CLI', description: "OpenAI's coding agent", icon: `${BASE_URL}agent-icons/codex-cli.svg`, emoji: '🧠', color: '#a6e3a1' },
  { type: 'oh-my-pi', label: 'Oh My Pi', description: 'Minimalist agent', icon: `${BASE_URL}agent-icons/oh-my-pi.svg`, emoji: '🥧', color: '#fab387' },
  { type: 'aider', label: 'Aider', description: 'Git-native AI pair', icon: `${BASE_URL}agent-icons/aider.svg`, emoji: '🚀', color: '#cba6f7' },
  { type: 'goose', label: 'Goose', description: 'Extensible AI agent', icon: `${BASE_URL}agent-icons/goose.svg`, emoji: '🪿', color: '#94e2d5' },
  { type: 'warp', label: 'Warp AI', description: 'Terminal with AI', icon: `${BASE_URL}agent-icons/warp.svg`, emoji: '⚡', color: '#f9e2af' },
  { type: 'amp', label: 'Amp', description: 'Code quality agent', icon: `${BASE_URL}agent-icons/amp.svg`, emoji: '🔥', color: '#eba0ac' },
  { type: 'kiro', label: 'Kiro', description: 'AWS coding agent', icon: `${BASE_URL}agent-icons/kiro.svg`, emoji: '☁️', color: '#89dceb' },
];

export const agentAllocationKeys: Record<AgentType, keyof AgentAllocation> = {
  'claude-code': 'claudeCode',
  'opencode': 'opencode',
  'droid': 'droid',
  'gemini-cli': 'geminiCli',
  'cursor': 'cursor',
  'codex': 'codex',
  'oh-my-pi': 'ohMyPi',
  'aider': 'aider',
  'goose': 'goose',
  'warp': 'warp',
  'amp': 'amp',
  'kiro': 'kiro',
  'none': 'droid',
};
