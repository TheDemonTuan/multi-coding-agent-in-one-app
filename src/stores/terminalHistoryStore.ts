import { create } from 'zustand';
import { CommandBlockData } from '../components/agents/CommandBlock';

const COMMAND_HISTORY_STORAGE_KEY = 'terminal-command-history';

interface TerminalHistoryState {
  commandBlocks: Record<string, CommandBlockData[]>;
  isLoading: boolean;

  // Actions
  loadHistory: () => Promise<void>;
  saveHistory: (terminalId: string, blocks: CommandBlockData[]) => Promise<void>;
  addCommandBlock: (terminalId: string, block: CommandBlockData) => void;
  updateCommandBlock: (terminalId: string, blockId: string, updates: Partial<CommandBlockData>) => void;
  deleteCommandBlock: (terminalId: string, blockId: string) => void;
  clearHistory: (terminalId: string) => Promise<void>;
  removeTerminalHistory: (terminalId: string) => void;
  getHistory: (terminalId: string) => CommandBlockData[];
}

export const useTerminalHistoryStore = create<TerminalHistoryState>((set, get) => ({
  commandBlocks: {},
  isLoading: false,

  loadHistory: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    set({ isLoading: true });

    try {
      const stored = await (window as any).electronAPI.getStoreValue(COMMAND_HISTORY_STORAGE_KEY);

      if (stored) {
        set({ commandBlocks: stored });
      }
    } catch (err) {
      console.error('[TerminalHistoryStore] Failed to load history:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveHistory: async (terminalId, blocks) => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    const { commandBlocks } = get();
    const updatedHistory = { ...commandBlocks, [terminalId]: blocks };

    try {
      await (window as any).electronAPI.setStoreValue(COMMAND_HISTORY_STORAGE_KEY, updatedHistory);
      set({ commandBlocks: updatedHistory });
    } catch (err) {
      console.error('[TerminalHistoryStore] Failed to save history:', err);
    }
  },

  addCommandBlock: (terminalId, block) => {
    set((state) => {
      const terminalBlocks = state.commandBlocks[terminalId] || [];
      return {
        commandBlocks: {
          ...state.commandBlocks,
          [terminalId]: [...terminalBlocks, block],
        },
      };
    });
  },

  updateCommandBlock: (terminalId, blockId, updates) => {
    set((state) => {
      const terminalBlocks = state.commandBlocks[terminalId] || [];
      return {
        commandBlocks: {
          ...state.commandBlocks,
          [terminalId]: terminalBlocks.map((block) =>
            block.id === blockId ? { ...block, ...updates } : block
          ),
        },
      };
    });
  },

  deleteCommandBlock: (terminalId, blockId) => {
    set((state) => {
      const terminalBlocks = state.commandBlocks[terminalId] || [];
      return {
        commandBlocks: {
          ...state.commandBlocks,
          [terminalId]: terminalBlocks.filter((block) => block.id !== blockId),
        },
      };
    });
  },

  clearHistory: async (terminalId) => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      return;
    }

    set((state) => {
      const { [terminalId]: _, ...rest } = state.commandBlocks;
      return { commandBlocks: rest };
    });

    try {
      await (window as any).electronAPI.setStoreValue(COMMAND_HISTORY_STORAGE_KEY, get().commandBlocks);
    } catch (err) {
      console.error('[TerminalHistoryStore] Failed to clear history:', err);
    }
  },

  removeTerminalHistory: (terminalId) => {
    set((state) => {
      const { [terminalId]: _, ...rest } = state.commandBlocks;
      return { commandBlocks: rest };
    });
  },

  getHistory: (terminalId) => {
    return get().commandBlocks[terminalId] || [];
  },
}));
