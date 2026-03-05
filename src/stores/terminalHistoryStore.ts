import { create } from 'zustand';
import { CommandBlockData } from '../components/CommandBlock';

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
  getHistory: (terminalId: string) => CommandBlockData[];
}

export const useTerminalHistoryStore = create<TerminalHistoryState>((set, get) => ({
  commandBlocks: {},
  isLoading: false,

  loadHistory: async () => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      console.log('[TerminalHistoryStore] electronAPI not available');
      return;
    }

    set({ isLoading: true });

    try {
      // Load all terminal history
      // Note: This is a simplified approach - in production you might want to
      // store history per workspace or use a different strategy
      const stored = await (window as any).electronAPI.getStoreValue(COMMAND_HISTORY_STORAGE_KEY);

      if (stored) {
        set({ commandBlocks: stored });
        console.log('[TerminalHistoryStore] Loaded history');
      }
    } catch (err) {
      console.error('[TerminalHistoryStore] Failed to load history:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  saveHistory: async (terminalId, blocks) => {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      console.log('[TerminalHistoryStore] electronAPI not available, cannot save');
      return;
    }

    const { commandBlocks } = get();
    const updatedHistory = { ...commandBlocks, [terminalId]: blocks };

    try {
      await (window as any).electronAPI.setStoreValue(COMMAND_HISTORY_STORAGE_KEY, updatedHistory);
      set({ commandBlocks: updatedHistory });
      console.log('[TerminalHistoryStore] Saved history for terminal:', terminalId);
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
      console.log('[TerminalHistoryStore] electronAPI not available, cannot clear');
      return;
    }

    set((state) => {
      const { [terminalId]: _, ...rest } = state.commandBlocks;
      return { commandBlocks: rest };
    });

    try {
      await (window as any).electronAPI.setStoreValue(COMMAND_HISTORY_STORAGE_KEY, get().commandBlocks);
      console.log('[TerminalHistoryStore] Cleared history for terminal:', terminalId);
    } catch (err) {
      console.error('[TerminalHistoryStore] Failed to clear history:', err);
    }
  },

  getHistory: (terminalId) => {
    return get().commandBlocks[terminalId] || [];
  },
}));
