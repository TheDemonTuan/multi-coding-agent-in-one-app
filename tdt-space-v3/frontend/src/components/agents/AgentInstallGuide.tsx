import React, { useState } from 'react';

interface AgentInfo {
  type: string;
  name: string;
  icon: string;
  description: string;
  installCommand: string;
  setupInstructions: string[];
  website: string;
  color: string;
}

const agentInstallInfo: AgentInfo[] = [
  {
    type: 'claude-code',
    name: 'Claude Code',
    icon: '🤖',
    description: "Anthropic's CLI agent for autonomous coding",
    installCommand: 'bun install -g @anthropic-ai/claude-code',
    setupInstructions: [
      'Install Claude Code globally',
      'Run `claude login` to authenticate',
      'Requires Anthropic API key or Claude subscription',
    ],
    website: 'https://claude.ai/code',
    color: '#a6adc8',
  },
  {
    type: 'gemini-cli',
    name: 'Gemini CLI',
    icon: '✨',
    description: "Google's AI agent with 1M token context",
    installCommand: 'npm install -g @anthropic-ai/gemini-cli',
    setupInstructions: [
      'Install via npm or Homebrew',
      'Authenticate with Google account',
      'Free tier: 60 requests/min, 1000 requests/day',
    ],
    website: 'https://github.com/google-gemini/gemini-cli',
    color: '#89b4fa',
  },
  {
    type: 'cursor',
    name: 'Cursor CLI',
    icon: '🎯',
    description: 'AI-powered coding from Cursor IDE',
    installCommand: 'curl -LsSf https://cursor.com/install.sh | sh',
    setupInstructions: [
      'Install Cursor CLI',
      'Login with Cursor account',
      'Supports Gemini, Claude, GPT models',
    ],
    website: 'https://cursor.com/cli',
    color: '#f38ba8',
  },
  {
    type: 'codex',
    name: 'Codex CLI',
    icon: '🧠',
    description: "OpenAI's lightweight coding agent",
    installCommand: 'npm install -g @openai/codex',
    setupInstructions: [
      'Install via npm or Homebrew',
      'Sign in with ChatGPT Plus/Pro account',
      'Written in Rust for speed',
    ],
    website: 'https://github.com/openai/codex',
    color: '#a6e3a1',
  },
  {
    type: 'oh-my-pi',
    name: 'Oh My Pi',
    icon: '🥧',
    description: 'Minimalist, extensible AI agent',
    installCommand: 'curl -fsSL https://get.pi-cli.dev | sh',
    setupInstructions: [
      'Install via install script',
      'Configure API keys for providers',
      'Supports 15+ LLM providers',
    ],
    website: 'https://github.com/badlogic/pi-mono',
    color: '#fab387',
  },
  {
    type: 'aider',
    name: 'Aider',
    icon: '🚀',
    description: 'Git-native AI pair programming',
    installCommand: 'pip install aider-chat',
    setupInstructions: [
      'Install via pip',
      'Set up API key (OpenAI, Anthropic, etc.)',
      'Auto-commits changes to git',
    ],
    website: 'https://aider.chat',
    color: '#cba6f7',
  },
  {
    type: 'opencode',
    name: 'OpenCode',
    icon: '🔓',
    description: 'Open source coding agent',
    installCommand: 'npm install -g @opencode/cli',
    setupInstructions: [
      'Install via npm',
      'Configure API keys',
      'Supports 75+ LLM providers',
    ],
    website: 'https://opencode.ai',
    color: '#a6adc8',
  },
  {
    type: 'goose',
    name: 'Goose',
    icon: '🪿',
    description: 'Extensible AI agent by Block',
    installCommand: 'cargo install goose-ai',
    setupInstructions: [
      'Install via cargo or pip',
      'Configure extensions',
      'Enterprise-ready features',
    ],
    website: 'https://github.com/block/goose',
    color: '#94e2d5',
  },
  {
    type: 'warp',
    name: 'Warp AI',
    icon: '⚡',
    description: 'Modern terminal with built-in AI',
    installCommand: 'Download from warp.dev',
    setupInstructions: [
      'Download from official website',
      'Enable Warp AI in settings',
      'AI commands built into terminal',
    ],
    website: 'https://warp.dev',
    color: '#f9e2af',
  },
  {
    type: 'droid',
    name: 'Droid',
    icon: '🤖',
    description: 'Custom AI coding agent',
    installCommand: 'npm install -g droid-cli',
    setupInstructions: [
      'Install via npm',
      'Configure API keys',
      'Multi-agent support',
    ],
    website: 'https://github.com/droid',
    color: '#a6adc8',
  },
  {
    type: 'amp',
    name: 'Amp',
    icon: '🔥',
    description: 'Code quality focused agent',
    installCommand: 'npm install -g @amp/cli',
    setupInstructions: [
      'Install via npm',
      'Configure code quality rules',
      'Automated review and fixes',
    ],
    website: 'https://amp.dev',
    color: '#eba0ac',
  },
  {
    type: 'kiro',
    name: 'Kiro',
    icon: '☁️',
    description: "AWS's AI coding agent",
    installCommand: 'npm install -g @aws/kiro',
    setupInstructions: [
      'Install via npm',
      'Configure AWS credentials',
      'Deep AWS integration',
    ],
    website: 'https://aws.amazon.com/kiro',
    color: '#89dceb',
  },
];

interface AgentInstallGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentInstallGuide: React.FC<AgentInstallGuideProps> = ({ isOpen, onClose }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>📦 AI Coding Agents Installation Guide</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {selectedAgent ? (
            /* Agent Detail View */
            <div style={styles.detailView}>
              <button onClick={() => setSelectedAgent(null)} style={styles.backButton}>
                ← Back to List
              </button>
              
              <div style={{...styles.agentCard, border: `2px solid ${selectedAgent.color}`}}>
                <div style={styles.agentHeader}>
                  <span style={styles.agentIcon}>{selectedAgent.icon}</span>
                  <div>
                    <h3 style={styles.agentName}>{selectedAgent.name}</h3>
                    <p style={styles.agentDescription}>{selectedAgent.description}</p>
                  </div>
                </div>

                <div style={styles.installSection}>
                  <h4 style={styles.sectionTitle}>Installation Command</h4>
                  <div style={styles.commandBox}>
                    <code style={styles.command}>{selectedAgent.installCommand}</code>
                    <button 
                      onClick={() => copyToClipboard(selectedAgent.installCommand)}
                      style={styles.copyButton}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                <div style={styles.setupSection}>
                  <h4 style={styles.sectionTitle}>Setup Instructions</h4>
                  <ol style={styles.instructions}>
                    {selectedAgent.setupInstructions.map((instruction, index) => (
                      <li key={index} style={styles.instruction}>{instruction}</li>
                    ))}
                  </ol>
                </div>

                <div style={styles.links}>
                  <a 
                    href={selectedAgent.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.websiteLink}
                  >
                    🌐 Official Website →
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Agent List View */
            <div style={styles.agentGrid}>
              {agentInstallInfo.map((agent) => (
                <button
                  key={agent.type}
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    ...styles.agentCard,
                    border: `2px solid ${agent.color}`,
                  }}
                >
                  <div style={styles.agentHeader}>
                    <span style={styles.agentIcon}>{agent.icon}</span>
                    <div style={styles.agentInfo}>
                      <h3 style={styles.agentName}>{agent.name}</h3>
                      <p style={styles.agentDescription}>{agent.description}</p>
                    </div>
                  </div>
                  <div style={styles.installHint}>
                    <code style={styles.hintCommand}>{agent.installCommand}</code>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerNote}>
            💡 Tip: Install agents you plan to use regularly. Each agent requires its own API keys and setup.
          </p>
          <button onClick={onClose} style={styles.closeGuideButton}>Close Guide</button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e1e2e',
    borderRadius: '12px',
    border: '1px solid #45475a',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #45475a',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#cdd6f4',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#a6adc8',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  agentCard: {
    backgroundColor: '#181825',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  agentHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  agentIcon: {
    fontSize: '32px',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#cdd6f4',
    margin: '0 0 4px 0',
  },
  agentDescription: {
    fontSize: '12px',
    color: '#a6adc8',
    margin: 0,
  },
  installHint: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#313244',
    borderRadius: '4px',
  },
  hintCommand: {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#bac2de',
  },
  detailView: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  backButton: {
    background: 'none',
    border: '1px solid #45475a',
    color: '#a6adc8',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    alignSelf: 'flex-start',
  },
  installSection: {
    marginTop: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#cdd6f4',
    marginBottom: '8px',
  },
  commandBox: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    backgroundColor: '#11111b',
    padding: '12px',
    borderRadius: '6px',
    fontFamily: 'monospace',
  },
  command: {
    flex: 1,
    fontSize: '13px',
    color: '#a6e3a1',
  },
  copyButton: {
    backgroundColor: '#45475a',
    color: '#cdd6f4',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  setupSection: {
    marginTop: '20px',
  },
  instructions: {
    paddingLeft: '20px',
    color: '#bac2de',
    fontSize: '13px',
    lineHeight: '1.8',
  },
  instruction: {
    marginBottom: '4px',
  },
  links: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #45475a',
  },
  websiteLink: {
    color: '#89b4fa',
    textDecoration: 'none',
    fontSize: '14px',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #45475a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: '12px',
    color: '#a6adc8',
    margin: 0,
  },
  closeGuideButton: {
    backgroundColor: '#45475a',
    color: '#cdd6f4',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};
