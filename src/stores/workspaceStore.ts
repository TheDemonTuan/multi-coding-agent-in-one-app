import { create } from 'zustand';
import { WorkspaceState, WorkspaceLayout, TerminalPane, WorkspaceCreationConfig, AgentConfig } from '../types/workspace';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Default fallback values - will be updated asynchronously when electronAPI is available
let cachedPlatform = 'win32';
let cachedCwd = './';

// Initialize with default values
const getWorkingDirectory = (): string => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return cachedCwd;
  }
  return cachedCwd;
};

const getShell = (): string => {
  return cachedPlatform === 'win32' ? 'powershell.exe' : 'bash';
};

// Initialize platform and cwd from electronAPI if available
if (typeof window !== 'undefined' && (window as any).electronAPI) {
  (window as any).electronAPI.getPlatform().then((platform: string) => {
    cachedPlatform = platform;
    console.log('[WorkspaceStore] Platform initialized:', platform);
  }).catch(console.warn);

  (window as any).electronAPI.getCwd().then((cwd: string) => {
    cachedCwd = cwd;
    console.log('[WorkspaceStore] CWD initialized:', cwd);
  }).catch(console.warn);
}

const createDefaultWorkspace = (config: WorkspaceCreationConfig): WorkspaceLayout => {
  const terminals: TerminalPane[] = [];
  const totalTerminals = config.columns * config.rows;

  for (let i = 0; i < totalTerminals; i++) {
    const terminalId = generateId();
    // Use index-based key to match the format from WorkspaceCreationModal
    const agentKey = `term-${i}`;
    const fallbackKey = `terminal-${i}`;

    const agentConfig = config.agentAssignments?.[agentKey] ||
                        config.agentAssignments?.[fallbackKey] ||
                        { type: 'none', enabled: false };

    terminals.push({
      id: terminalId,
      title: `Terminal ${i + 1}`,
      cwd: config.cwd,
      shell: getShell(),
      status: 'stopped',
      agent: agentConfig,
    });
  }

  return {
    id: generateId(),
    name: config.name,
    columns: config.columns,
    rows: config.rows,
    terminals,
    icon: config.icon,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  };
};

// Storage key for electron-store
const WORKSPACES_STORAGE_KEY = 'workspaces';

// Debounce helper - prevents rapid successive storage writes
let saveDebounceTimer: NodeJS.Timeout | null = null;
const debounceSave = (fn: () => Promise<void>, delay: number) => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  saveDebounceTimer = setTimeout(fn, delay);
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  console.log('[WorkspaceStore] Initializing...');

  const initialState = {
    currentWorkspace: null,
    workspaces: [],
    activeTerminalId: null,
    theme: 'dark' as const,
    isWorkspaceModalOpen: false,
  };

  return {
    ...initialState,
    editingWorkspace: null,

    loadWorkspaces: () => {
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        console.log('[WorkspaceStore] electronAPI not available, skipping load');
        return;
      }

      (window as any).electronAPI.getStoreValue(WORKSPACES_STORAGE_KEY)
        .then((stored: WorkspaceLayout[] | null) => {
          if (stored && Array.isArray(stored) && stored.length > 0) {
            console.log('[WorkspaceStore] Loaded workspaces:', stored.length);
            set({
              workspaces: stored,
              currentWorkspace: stored[0] || null
            });
          } else {
            console.log('[WorkspaceStore] No workspaces found in storage');
            set({
              workspaces: [],
              currentWorkspace: null
            });
          }
        })
        .catch((err: any) => console.error('[WorkspaceStore] Failed to load workspaces:', err));
    },

    saveWorkspaces: () => {
      if (typeof window === 'undefined' || !(window as any).electronAPI) {
        console.log('[WorkspaceStore] electronAPI not available, skipping save');
        return;
      }

      const { workspaces } = get();
      console.log('[WorkspaceStore] Saving workspaces:', workspaces.length);
      (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, workspaces)
        .then(() => console.log('[WorkspaceStore] Saved successfully'))
        .catch((err: any) => console.error('[WorkspaceStore] Failed to save workspaces:', err));
    },

    setCurrentWorkspace: (workspace) => {
      console.log('[WorkspaceStore] Setting workspace:', workspace.name);
      set((state) => {
        const newState = { currentWorkspace: workspace };

        // Debounce save to prevent rapid writes during workspace switch
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          debounceSave(async () => {
            try {
              await (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, state.workspaces);
              console.log('[WorkspaceStore] Workspace set and saved (debounced)');
            } catch (err) {
              console.error('[WorkspaceStore] Failed to save after set:', err);
            }
          }, 300);
        }

        return newState;
      });
    },

    addWorkspace: (config) => {
      console.log('[WorkspaceStore] Adding workspace:', config.name, config.columns, config.rows);
      const newWorkspace = createDefaultWorkspace(config);
      set((state) => {
        const updatedWorkspaces = [...state.workspaces, newWorkspace];
        const newState = {
          workspaces: updatedWorkspaces,
          currentWorkspace: newWorkspace,
        };

        // Debounce save to prevent rapid writes
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          debounceSave(async () => {
            try {
              await (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, updatedWorkspaces);
              console.log('[WorkspaceStore] Workspace added and saved (debounced)');
            } catch (err) {
              console.error('[WorkspaceStore] Failed to save after add:', err);
            }
          }, 300);
        }

        return newState;
      });
      return newWorkspace;
    },

    removeWorkspace: async (id) => {
      console.log('[WorkspaceStore] Removing workspace:', id);

      // First, kill terminals in main process
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          await (window as any).electronAPI.deleteWorkspace(id);
          console.log('[WorkspaceStore] Workspace deleted in main process');
        } catch (err) {
          console.error('[WorkspaceStore] Failed to delete workspace in main process:', err);
        }
      }

      // Then update local state
      set((state) => {
        const updatedWorkspaces = state.workspaces.filter((ws) => ws.id !== id);
        const newState = {
          workspaces: updatedWorkspaces,
          currentWorkspace: state.currentWorkspace?.id === id
            ? (updatedWorkspaces[0] || null)
            : state.currentWorkspace,
        };

        // Save immediately for delete operations (more critical)
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, updatedWorkspaces)
            .then(() => console.log('[WorkspaceStore] Workspace removed and saved'))
            .catch((err: any) => console.error('[WorkspaceStore] Failed to save after remove:', err));
        }

        return newState;
      });
    },

    updateWorkspace: (id, updates) => {
      console.log('[WorkspaceStore] Updating workspace:', id, updates);
      set((state) => {
        const updatedWorkspaces = state.workspaces.map(ws =>
          ws.id === id ? { ...ws, ...updates, lastUsed: Date.now() } : ws
        );

        const newState = {
          workspaces: updatedWorkspaces,
          currentWorkspace: state.currentWorkspace?.id === id
            ? { ...state.currentWorkspace, ...updates, lastUsed: Date.now() }
            : state.currentWorkspace,
        };

        // Debounce save for updates
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          debounceSave(async () => {
            try {
              await (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, updatedWorkspaces);
              console.log('[WorkspaceStore] Workspace updated and saved (debounced)');
            } catch (err) {
              console.error('[WorkspaceStore] Failed to save after update:', err);
            }
          }, 300);
        }

        return newState;
      });
    },

    setActiveTerminal: (id) => {
      console.log('[WorkspaceStore] Setting active terminal:', id);
      set({ activeTerminalId: id });
    },

    setTheme: (theme) => {
      console.log('[WorkspaceStore] Setting theme:', theme);
      set({ theme });
    },

    setWorkspaceModalOpen: (isOpen) => {
      if (!isOpen) {
        set({ editingWorkspace: null });
      }
      set({ isWorkspaceModalOpen: isOpen });
    },

    setWorkspaceModalOpenWithEdit: (workspace) => {
      console.log('[WorkspaceStore] Opening modal for edit:', workspace.name);
      set({ 
        editingWorkspace: workspace,
        isWorkspaceModalOpen: true 
      });
    },

    updateTerminalAgent: (terminalId, agentConfig) => {
      set((state) => {
        if (!state.currentWorkspace) return state;

        const updatedTerminals = state.currentWorkspace.terminals.map(term =>
          term.id === terminalId ? { ...term, agent: agentConfig } : term
        );

        const updatedWorkspace = {
          ...state.currentWorkspace,
          terminals: updatedTerminals,
        };

        // Also update in workspaces list
        const updatedWorkspaces = state.workspaces.map(ws =>
          ws.id === state.currentWorkspace!.id ? updatedWorkspace : ws
        );

        const newState = {
          currentWorkspace: updatedWorkspace,
          workspaces: updatedWorkspaces,
        };

        // Debounce save for agent updates
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
          debounceSave(async () => {
            try {
              await (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, updatedWorkspaces);
              console.log('[WorkspaceStore] Terminal agent updated and saved (debounced)');
            } catch (err) {
              console.error('[WorkspaceStore] Failed to save after agent update:', err);
            }
          }, 300);
        }

        return newState;
      });
    },

    updateTerminalStatus: (terminalId, status) => {
      set((state) => {
        if (!state.currentWorkspace) return state;

        const updatedTerminals = state.currentWorkspace.terminals.map(term =>
          term.id === terminalId ? { ...term, status } : term
        );

        const updatedWorkspace = {
          ...state.currentWorkspace,
          terminals: updatedTerminals,
        };

        const updatedWorkspaces = state.workspaces.map(ws =>
          ws.id === state.currentWorkspace!.id ? updatedWorkspace : ws
        );

        return {
          currentWorkspace: updatedWorkspace,
          workspaces: updatedWorkspaces,
        };
      });
    },

    setTerminalProcessId: (terminalId, pid) => {
      set((state) => {
        if (!state.currentWorkspace) return state;

        const updatedTerminals = state.currentWorkspace.terminals.map(term =>
          term.id === terminalId ? { ...term, processId: pid } : term
        );

        const updatedWorkspace = {
          ...state.currentWorkspace,
          terminals: updatedTerminals,
        };

        const updatedWorkspaces = state.workspaces.map(ws =>
          ws.id === state.currentWorkspace!.id ? updatedWorkspace : ws
        );

        return {
          currentWorkspace: updatedWorkspace,
          workspaces: updatedWorkspaces,
        };
      });
    },

    removeTerminal: async (terminalId: string) => {
      const state = get();
      if (!state.currentWorkspace) return;

      const terminals = state.currentWorkspace.terminals;
      if (terminals.length <= 1) {
        console.warn('[WorkspaceStore] Cannot remove last terminal');
        return;
      }

      // Kill terminal process in main process
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          await (window as any).electronAPI.terminalKill(terminalId);
          console.log('[WorkspaceStore] Terminal process killed:', terminalId);
        } catch (err) {
          console.error('[WorkspaceStore] Failed to kill terminal:', err);
        }
      }

      // Remove terminal from list
      const updatedTerminals = terminals.filter(t => t.id !== terminalId);
      
      // Calculate new grid dimensions
      const totalTerminals = updatedTerminals.length;
      let newColumns = state.currentWorkspace.columns;
      let newRows = state.currentWorkspace.rows;
      
      // Try to maintain aspect ratio, prefer wider layouts
      const aspectRatio = newColumns / newRows;
      newRows = Math.ceil(Math.sqrt(totalTerminals / aspectRatio));
      newColumns = Math.ceil(totalTerminals / newRows);

      // Update titles to match new positions
      const retitledTerminals = updatedTerminals.map((term, index) => ({
        ...term,
        title: `Terminal ${index + 1}`,
      }));

      const updatedWorkspace = {
        ...state.currentWorkspace,
        terminals: retitledTerminals,
        columns: newColumns,
        rows: newRows,
      };

      const updatedWorkspaces = state.workspaces.map(ws =>
        ws.id === state.currentWorkspace!.id ? updatedWorkspace : ws
      );

      // Switch to next available terminal
      const terminalIndex = terminals.findIndex(t => t.id === terminalId);
      const nextTerminal = retitledTerminals[Math.min(terminalIndex, retitledTerminals.length - 1)];

      set({
        currentWorkspace: updatedWorkspace,
        workspaces: updatedWorkspaces,
        activeTerminalId: nextTerminal?.id || null,
      });

      // Save to storage (debounced)
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        debounceSave(async () => {
          try {
            await (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, updatedWorkspaces);
            console.log('[WorkspaceStore] Terminal removed and saved (debounced)');
          } catch (err) {
            console.error('[WorkspaceStore] Failed to save after remove:', err);
          }
        }, 300);
      }
    },

    splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => {
      const state = get();
      if (!state.currentWorkspace) return;

      const terminals = state.currentWorkspace.terminals;
      const terminalIndex = terminals.findIndex(t => t.id === terminalId);
      
      if (terminalIndex === -1) return;

      // Create new terminal with same config
      const sourceTerminal = terminals[terminalIndex];
      const newTerminal: TerminalPane = {
        id: generateId(),
        title: `Terminal ${terminals.length + 1}`,
        cwd: sourceTerminal.cwd,
        shell: sourceTerminal.shell,
        status: 'stopped',
        agent: sourceTerminal.agent ? { ...sourceTerminal.agent } : { type: 'none', enabled: false },
      };

      // Insert new terminal after the source
      const updatedTerminals = [
        ...terminals.slice(0, terminalIndex + 1),
        newTerminal,
        ...terminals.slice(terminalIndex + 1),
      ];

      // Update grid dimensions
      let newColumns = state.currentWorkspace.columns;
      let newRows = state.currentWorkspace.rows;

      if (direction === 'vertical') {
        // Split vertically = add column
        newColumns = Math.min(newColumns + 1, 4); // Max 4 columns
      } else {
        // Split horizontally = add row
        newRows = Math.min(newRows + 1, 4); // Max 4 rows
      }

      const updatedWorkspace = {
        ...state.currentWorkspace,
        terminals: updatedTerminals,
        columns: newColumns,
        rows: newRows,
      };

      const updatedWorkspaces = state.workspaces.map(ws =>
        ws.id === state.currentWorkspace!.id ? updatedWorkspace : ws
      );

      set({
        currentWorkspace: updatedWorkspace,
        workspaces: updatedWorkspaces,
        activeTerminalId: newTerminal.id,
      });

      // Save to storage (debounced)
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        debounceSave(async () => {
          try {
            await (window as any).electronAPI.setStoreValue(WORKSPACES_STORAGE_KEY, updatedWorkspaces);
            console.log('[WorkspaceStore] Terminal split and saved (debounced)');
          } catch (err) {
            console.error('[WorkspaceStore] Failed to save after split:', err);
          }
        }, 300);
      }
    },

    // Helper methods for keyboard navigation
    getNextWorkspace: () => {
      const state = get();
      if (!state.currentWorkspace || state.workspaces.length <= 1) return null;
      const currentIndex = state.workspaces.findIndex(ws => ws.id === state.currentWorkspace!.id);
      const nextIndex = (currentIndex + 1) % state.workspaces.length;
      return state.workspaces[nextIndex];
    },

    getPreviousWorkspace: () => {
      const state = get();
      if (!state.currentWorkspace || state.workspaces.length <= 1) return null;
      const currentIndex = state.workspaces.findIndex(ws => ws.id === state.currentWorkspace!.id);
      const previousIndex = (currentIndex - 1 + state.workspaces.length) % state.workspaces.length;
      return state.workspaces[previousIndex];
    },

    getNextTerminal: () => {
      const state = get();
      if (!state.currentWorkspace || !state.activeTerminalId) return null;
      const currentIndex = state.currentWorkspace.terminals.findIndex(t => t.id === state.activeTerminalId);
      const nextIndex = (currentIndex + 1) % state.currentWorkspace.terminals.length;
      return state.currentWorkspace.terminals[nextIndex];
    },

    getPreviousTerminal: () => {
      const state = get();
      if (!state.currentWorkspace || !state.activeTerminalId) return null;
      const currentIndex = state.currentWorkspace.terminals.findIndex(t => t.id === state.activeTerminalId);
      const previousIndex = (currentIndex - 1 + state.currentWorkspace.terminals.length) % state.currentWorkspace.terminals.length;
      return state.currentWorkspace.terminals[previousIndex];
    },

    getWorkspaceByIndex: (index: number) => {
      const state = get();
      if (index < 0 || index >= state.workspaces.length) return null;
      return state.workspaces[index];
    },

    getTerminalByIndex: (terminalIndex: number) => {
      const state = get();
      if (!state.currentWorkspace) return null;
      if (terminalIndex < 0 || terminalIndex >= state.currentWorkspace.terminals.length) return null;
      return state.currentWorkspace.terminals[terminalIndex];
    },

    restartTerminal: async (terminalId: string) => {
      const state = get();
      if (!state.currentWorkspace) return;

      const terminal = state.currentWorkspace.terminals.find(t => t.id === terminalId);
      if (!terminal) return;

      console.log('[WorkspaceStore] Restarting terminal:', terminalId);

      // Kill existing terminal process
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          await (window as any).electronAPI.terminalKill(terminalId);
          console.log('[WorkspaceStore] Killed terminal process for restart:', terminalId);
        } catch (err) {
          console.error('[WorkspaceStore] Failed to kill terminal for restart:', err);
        }

        // Update status to stopped
        useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'stopped');

        // Small delay to ensure process is fully killed
        await new Promise(resolve => setTimeout(resolve, 100));

        // Spawn new terminal with same config (use agent spawn if agent is enabled)
        try {
          let result;
          if (terminal.agent?.enabled && terminal.agent.type !== 'none') {
            result = await (window as any).electronAPI.spawnTerminalWithAgent(
              terminalId,
              terminal.cwd,
              terminal.agent,
              state.currentWorkspace.id
            );
          } else {
            result = await (window as any).electronAPI.spawnTerminal(
              terminalId,
              terminal.cwd,
              state.currentWorkspace.id
            );
          }

          if (result.success) {
            console.log('[WorkspaceStore] Terminal restarted successfully:', terminalId);
            useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'running');
            if (result.pid) {
              useWorkspaceStore.getState().setTerminalProcessId(terminalId, result.pid);
            }
          }
        } catch (err) {
          console.error('[WorkspaceStore] Failed to restart terminal:', err);
          useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'error');
        }
      }
    },
  };
});
