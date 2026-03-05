import { useState, useCallback, useEffect } from 'react';
import { CommandBlockData } from '../components/CommandBlock';

const COMMAND_HISTORY_STORAGE_KEY = 'terminal-command-history';

export interface UseCommandHistoryReturn {
  commandBlocks: Record<string, CommandBlockData[]>;
  addCommandBlock: (terminalId: string, command: string) => void;
  updateCommandBlock: (terminalId: string, blockId: string, updates: Partial<CommandBlockData>) => void;
  toggleCollapse: (terminalId: string, blockId: string) => void;
  clearHistory: (terminalId: string) => void;
  loadHistory: () => void;
  saveHistory: () => void;
}

// Simple prompt detection patterns
const PROMPT_PATTERNS = [
  /^\$ /,                    // Unix bash/zsh
  /^> /,                     // PowerShell
  /^PS [A-Z]:\\/,            // PowerShell with path
  /^[a-zA-Z0-9_]+@[^\s]+[~]?[>$#] /,  // Unix user@host prompt
  /^C:\\[^>]+>/,             // Windows cmd path
];

const isCommandPrompt = (line: string): boolean => {
  return PROMPT_PATTERNS.some(pattern => pattern.test(line));
};

export const useCommandHistory = (): UseCommandHistoryReturn => {
  const [commandBlocks, setCommandBlocks] = useState<Record<string, CommandBlockData[]>>({});
  const [pendingCommands, setPendingCommands] = useState<Record<string, string>>({});

  // Load history from storage
  const loadHistory = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    (window as any).electronAPI.getStoreValue(COMMAND_HISTORY_STORAGE_KEY)
      .then((stored: Record<string, CommandBlockData[]> | null) => {
        if (stored) {
          setCommandBlocks(stored);
        }
      })
      .catch(console.error);
  }, []);

  // Save history to storage
  const saveHistory = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    (window as any).electronAPI.setStoreValue(COMMAND_HISTORY_STORAGE_KEY, commandBlocks)
      .catch(console.error);
  }, [commandBlocks]);

  // Add a new command block when a command is detected
  const addCommandBlock = useCallback((terminalId: string, command: string) => {
    const newBlock: CommandBlockData = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      command,
      output: '',
      exitCode: null,
      timestamp: new Date(),
      isCollapsed: false,
      status: 'running',
    };

    setCommandBlocks(prev => ({
      ...prev,
      [terminalId]: [...(prev[terminalId] || []), newBlock],
    }));

    setPendingCommands(prev => ({
      ...prev,
      [terminalId]: command,
    }));
  }, []);

  // Update an existing command block
  const updateCommandBlock = useCallback((
    terminalId: string,
    blockId: string,
    updates: Partial<CommandBlockData>
  ) => {
    setCommandBlocks(prev => ({
      ...prev,
      [terminalId]: (prev[terminalId] || []).map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      ),
    }));
  }, []);

  // Toggle collapse state
  const toggleCollapse = useCallback((terminalId: string, blockId: string) => {
    setCommandBlocks(prev => ({
      ...prev,
      [terminalId]: (prev[terminalId] || []).map(block =>
        block.id === blockId ? { ...block, isCollapsed: !block.isCollapsed } : block
      ),
    }));
  }, []);

  // Clear history for a terminal
  const clearHistory = useCallback((terminalId: string) => {
    setCommandBlocks(prev => {
      const updated = { ...prev };
      delete updated[terminalId];
      return updated;
    });
    setPendingCommands(prev => {
      const updated = { ...prev };
      delete updated[terminalId];
      return updated;
    });
  }, []);

  // Auto-save history when it changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveHistory();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [commandBlocks, saveHistory]);

  return {
    commandBlocks,
    addCommandBlock,
    updateCommandBlock,
    toggleCollapse,
    clearHistory,
    loadHistory,
    saveHistory,
  };
};

// Helper function to detect commands from terminal data
export const parseTerminalData = (
  data: string,
  lastDataRef: React.MutableRefObject<string>,
  onCommandDetected: (command: string) => void,
  onOutputDetected: (output: string) => void
) => {
  const buffer = lastDataRef.current + data;
  const lines = buffer.split('\n');

  // Keep the last line as it might be incomplete
  lastDataRef.current = lines.pop() || '';

  let currentCommand: string | null = null;

  for (const line of lines) {
    // Check if this is a command prompt
    if (isCommandPrompt(line)) {
      // If we have a pending command, finalize it
      if (currentCommand) {
        onCommandDetected(currentCommand.trim());
      }
      // New command starts after prompt
      currentCommand = line.replace(/^[\$>]|^PS [A-Z]:\\|^C:\\[^>]+>|^[a-zA-Z0-9_]+@[^\s]+[~]?[>$#] /, '').trim();
    } else if (currentCommand !== null) {
      // This is output from the current command
      onOutputDetected(line + '\n');
    }
  }
};
