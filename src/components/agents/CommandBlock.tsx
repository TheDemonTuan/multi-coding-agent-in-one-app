import React, { useState } from 'react';

export interface CommandBlockData {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  timestamp: Date;
  isCollapsed: boolean;
  status: 'running' | 'success' | 'error' | 'pending';
}

interface CommandBlockProps {
  commandBlock: CommandBlockData;
  onToggleCollapse: (id: string) => void;
  onRerunCommand: (command: string) => void;
  onCopyCommand: (command: string) => void;
  onCopyOutput: (output: string) => void;
}

export const CommandBlock: React.FC<CommandBlockProps> = ({
  commandBlock,
  onToggleCollapse,
  onRerunCommand,
  onCopyCommand,
  onCopyOutput,
}) => {
  const { command, output, exitCode, timestamp, isCollapsed, status } = commandBlock;

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return '#f9e2af';
      case 'success':
        return '#a6e3a1';
      case 'error':
        return '#f38ba8';
      default:
        return '#6c7086';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return '⏳';
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '○';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCopyCommand = () => {
    onCopyCommand(command);
  };

  const handleCopyOutput = () => {
    onCopyOutput(output);
  };

  const handleRerun = () => {
    onRerunCommand(command);
  };

  return (
    <div style={styles.container}>
      {/* Command Header */}
      <div
        style={{
          ...styles.commandHeader,
          backgroundColor: isCollapsed ? '#313244' : '#45475a',
        }}
      >
        <div style={styles.headerLeft}>
          <button
            onClick={() => onToggleCollapse(commandBlock.id)}
            style={styles.collapseButton}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <span
            style={{
              ...styles.statusIndicator,
              backgroundColor: getStatusColor(),
            }}
          >
            {getStatusIcon()}
          </span>
          <span style={styles.command}>{command}</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.timestamp}>{formatTimestamp(timestamp)}</span>
          {exitCode !== null && (
            <span
              style={{
                ...styles.exitCode,
                backgroundColor: exitCode === 0 ? '#a6e3a1' : '#f38ba8',
                color: exitCode === 0 ? '#1e1e2e' : '#cdd6f4',
              }}
            >
              Exit: {exitCode}
            </span>
          )}
          {status === 'running' && (
            <span style={styles.runningIndicator}>Running...</span>
          )}
        </div>
      </div>

      {/* Command Actions */}
      {!isCollapsed && (
        <div style={styles.actionBar}>
          <button onClick={handleCopyCommand} style={styles.actionButton} title="Copy command">
            📋 Copy command
          </button>
          <button onClick={handleCopyOutput} style={styles.actionButton} title="Copy output">
            📄 Copy output
          </button>
          <button onClick={handleRerun} style={styles.actionButton} title="Re-run command">
            🔄 Re-run
          </button>
        </div>
      )}

      {/* Output Section */}
      {!isCollapsed && output && (
        <div style={styles.outputSection}>
          <div style={styles.outputHeader}>
            <span style={styles.outputLabel}>Output</span>
          </div>
          <pre style={styles.output}>{output}</pre>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid #45475a',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '8px',
    backgroundColor: '#1e1e2e',
  },
  commandHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  collapseButton: {
    background: 'none',
    border: 'none',
    color: '#a6adc8',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#1e1e2e',
    fontWeight: 600,
    flexShrink: 0,
  },
  command: {
    fontSize: '13px',
    color: '#cdd6f4',
    fontFamily: '"Fira Code", "Cascadia Code", monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  timestamp: {
    fontSize: '11px',
    color: '#6c7086',
  },
  exitCode: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 600,
  },
  runningIndicator: {
    fontSize: '11px',
    color: '#f9e2af',
    fontStyle: 'italic',
  },
  actionBar: {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#181825',
    borderBottom: '1px solid #45475a',
  },
  actionButton: {
    fontSize: '11px',
    padding: '4px 8px',
    backgroundColor: '#313244',
    color: '#a6adc8',
    border: '1px solid #45475a',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  outputSection: {
    padding: '0',
  },
  outputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#181825',
  },
  outputLabel: {
    fontSize: '11px',
    color: '#6c7086',
    fontWeight: 500,
  },
  output: {
    fontSize: '12px',
    color: '#bac2de',
    fontFamily: '"Fira Code", "Cascadia Code", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    padding: '12px',
    margin: 0,
    backgroundColor: '#11111b',
    maxHeight: '300px',
    overflowY: 'auto',
  },
};
