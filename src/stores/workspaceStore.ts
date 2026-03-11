import { create } from 'zustand';
import { WorkspaceState, WorkspaceLayout, TerminalPane, WorkspaceCreationConfig, AgentConfig, AgentType } from '../types/workspace';
import { useTerminalHistoryStore } from './terminalHistoryStore';
import { backendAPI } from '../services/wails-bridge';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Default fallback values - will be updated asynchronously when backendAPI is available
let cachedPlatform = 'win32';
let cachedCwd = './';

// Flag to track if platform/cwd have been initialized from backend
let platformInitialized = false;

// Initialize with default values
const getWorkingDirectory = (): string => cachedCwd;

const getShell = (): string => {
  if (cachedPlatform === 'win32') return 'powershell.exe';
  if (cachedPlatform === 'darwin') return '/bin/zsh';
  return '/bin/bash';
};

/**
 * Lazy initialization - call this when component mounts or on user interaction
 * This avoids calling backendAPI before Wails runtime is ready
 */
export const initializePlatformInfo = async (): Promise<void> => {
  if (platformInitialized) return; // Prevent duplicate initialization

  platformInitialized = true;

  try {
    const platform = await backendAPI.getPlatform();
    cachedPlatform = platform;
  } catch (err) {
    console.warn('[WorkspaceStore] Failed to get platform:', err);
  }

  try {
    const cwd = await backendAPI.getCwd();
    cachedCwd = cwd;
  } catch (err) {
    console.warn('[WorkspaceStore] Failed to get cwd:', err);
  }
};

const createDefaultWorkspace = (config: WorkspaceCreationConfig): WorkspaceLayout => {
  const terminals: TerminalPane[] = [];
  const totalTerminals = config.columns * config.rows;

  for (let i = 0; i < totalTerminals; i++) {
    const terminalId = generateId();
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

// Storage key for BuntDB (via StoreService)
const WORKSPACES_STORAGE_KEY = 'workspaces';

// Debounce helper
const createDebounceSave = () => {
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const debounceSave = (fn: () => Promise<void>, delay: number) => {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }
    saveDebounceTimer = setTimeout(fn, delay);
  };

  debounceSave.clear = () => {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
  };

  return debounceSave;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const debounceSave = createDebounceSave();

  const initialState = {
    currentWorkspace: null,
    workspaces: [],
    activeTerminalId: null,
    theme: 'dark' as const,
    isWorkspaceModalOpen: false,
    restartingTerminals: new Set<string>(),
  };

  return {
    ...initialState,
    editingWorkspace: null,

    isTerminalRestarting: (terminalId) => get().restartingTerminals.has(terminalId),

    loadWorkspaces: async () => {
      try {
        const workspaces = await backendAPI.getWorkspaces();
        // Filter out null/undefined workspaces and those without id
        const validWorkspaces = (workspaces || []).filter((ws: any) => ws && ws.id);
        if (validWorkspaces.length > 0) {
          set({
            workspaces: validWorkspaces,
            currentWorkspace: validWorkspaces[0] || null
          });
        } else {
          set({
            workspaces: [],
            currentWorkspace: null
          });
        }
      } catch (err) {
        console.error('[WorkspaceStore] Failed to load workspaces from backend:', err);
        set({
          workspaces: [],
          currentWorkspace: null
        });
      }
    },

    saveWorkspaces: () => {
      // No-op: workspaces are saved individually via CRUD methods
      // This method is kept for backward compatibility but does nothing
    },

    setCurrentWorkspace: (workspace) => {
      set({ currentWorkspace: workspace });

      // Validate Vietnamese IME patch when switching to workspace with Claude Code terminals
      backendAPI.validatePatchForWorkspace(workspace).catch((err: any) => {
        console.error('[WorkspaceStore] Patch validation failed:', err);
      });
    },

    addWorkspace: async (config) => {
      const newWorkspace = createDefaultWorkspace(config);
      console.log('[WorkspaceStore] addWorkspace: created default workspace with', newWorkspace.terminals.length, 'terminals');

      // Convert to backend Workspace format (they should be compatible)
      try {
        console.log('[WorkspaceStore] addWorkspace: calling backendAPI.createWorkspace...');
        const created = await backendAPI.createWorkspace(newWorkspace);
        console.log('[WorkspaceStore] addWorkspace: backend returned:', created);
        if (!created) {
          console.error('[WorkspaceStore] addWorkspace: backend returned null/undefined');
          throw new Error('Backend returned null');
        }
        if (!created.id) {
          console.error('[WorkspaceStore] addWorkspace: backend returned workspace without id');
          throw new Error('Backend returned workspace without id');
        }
        if (!created.terminals || created.terminals.length === 0) {
          console.error('[WorkspaceStore] addWorkspace: backend returned workspace without terminals');
          throw new Error('Backend returned workspace without terminals');
        }
        set((state) => {
          const updatedWorkspaces = [...state.workspaces, created];
          return {
            workspaces: updatedWorkspaces,
            currentWorkspace: created,
          };
        });
        return created;
      } catch (err) {
        console.error('[WorkspaceStore] Failed to create workspace in backend:', err);
        // Fallback: add locally only
        set((state) => {
          const updatedWorkspaces = [...state.workspaces, newWorkspace];
          return {
            workspaces: updatedWorkspaces,
            currentWorkspace: newWorkspace,
          };
        });
        return newWorkspace;
      }
    },

    removeWorkspace: async (id) => {
      // Delete from backend first
      try {
        await backendAPI.deleteWorkspace(id);
      } catch (err) {
        console.error('[WorkspaceStore] Failed to delete workspace in backend:', err);
      }

      // Update local state
      set((state) => {
        const updatedWorkspaces = state.workspaces.filter((ws) => ws.id !== id);
        return {
          workspaces: updatedWorkspaces,
          currentWorkspace: state.currentWorkspace?.id === id
            ? (updatedWorkspaces[0] || null)
            : state.currentWorkspace,
        };
      });
    },

    updateWorkspace: async (id, updates) => {
      set((state) => {
        const updatedWorkspaces = state.workspaces.map(ws =>
          ws.id === id ? { ...ws, ...updates, lastUsed: Date.now() } : ws
        );

        const updatedCurrentWorkspace = state.currentWorkspace?.id === id
          ? { ...state.currentWorkspace, ...updates, lastUsed: Date.now() }
          : state.currentWorkspace;

        // Update backend asynchronously
        backendAPI.updateWorkspace(updatedWorkspaces.find(ws => ws.id === id)!)
          .catch((err) => {
            console.error('[WorkspaceStore] Failed to update workspace in backend:', err);
          });

        return {
          workspaces: updatedWorkspaces,
          currentWorkspace: updatedCurrentWorkspace,
        };
      });
    },

    setActiveTerminal: (id) => {
      set({ activeTerminalId: id });
    },

    setTheme: (theme) => {
      set({ theme });
    },

    setWorkspaceModalOpen: (isOpen) => {
      if (!isOpen) {
        set({ editingWorkspace: null });
      }
      set({ isWorkspaceModalOpen: isOpen });
    },

    setWorkspaceModalOpenWithEdit: (workspace) => {
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

        const updatedWorkspaces = state.workspaces.map(ws =>
          ws.id === state.currentWorkspace!.id ? updatedWorkspace : ws
        );

        // Update backend asynchronously
        backendAPI.updateWorkspace(updatedWorkspace)
          .catch((err) => {
            console.error('[WorkspaceStore] Failed to save after agent update:', err);
          });

        return {
          currentWorkspace: updatedWorkspace,
          workspaces: updatedWorkspaces,
        };
      });
    },

    updateTerminalStatus: (terminalId, status) => {
      console.log('[WorkspaceStore] updateTerminalStatus called:', terminalId, status);
      set((state) => {
        if (!state.currentWorkspace) {
          console.warn('[WorkspaceStore] No currentWorkspace, cannot update status');
          return state;
        }

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

        console.log('[WorkspaceStore] Status updated successfully');
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
        return;
      }

      // Kill terminal process in backend
      try {
        await backendAPI.terminalKill(terminalId);
      } catch (err) {
        console.error('[WorkspaceStore] Failed to kill terminal:', err);
      }

      const updatedTerminals = terminals.filter(t => t.id !== terminalId);

      // Clean up terminal history
      useTerminalHistoryStore.getState().removeTerminalHistory(terminalId);

      // Calculate new grid dimensions
      const totalTerminals = updatedTerminals.length;
      let newColumns = state.currentWorkspace.columns;
      let newRows = state.currentWorkspace.rows;

      const aspectRatio = newColumns / newRows;
      newRows = Math.ceil(Math.sqrt(totalTerminals / aspectRatio));
      newColumns = Math.ceil(totalTerminals / newRows);

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

      const terminalIndex = terminals.findIndex(t => t.id === terminalId);
      const nextTerminal = retitledTerminals[Math.min(terminalIndex, retitledTerminals.length - 1)];

      set({
        currentWorkspace: updatedWorkspace,
        workspaces: updatedWorkspaces,
        activeTerminalId: nextTerminal?.id || null,
      });

      // Update backend asynchronously
      backendAPI.updateWorkspace(updatedWorkspace)
        .catch((err) => {
          console.error('[WorkspaceStore] Failed to save after remove terminal:', err);
        });
    },

    splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => {
      const state = get();
      if (!state.currentWorkspace) return;

      const terminals = state.currentWorkspace.terminals;
      const terminalIndex = terminals.findIndex(t => t.id === terminalId);

      if (terminalIndex === -1) return;

      const sourceTerminal = terminals[terminalIndex];
      const newTerminal: TerminalPane = {
        id: generateId(),
        title: `Terminal ${terminals.length + 1}`,
        cwd: sourceTerminal.cwd,
        shell: sourceTerminal.shell,
        status: 'stopped',
        agent: sourceTerminal.agent ? { ...sourceTerminal.agent } : { type: 'none', enabled: false },
      };

      const updatedTerminals = [
        ...terminals.slice(0, terminalIndex + 1),
        newTerminal,
        ...terminals.slice(terminalIndex + 1),
      ];

      let newColumns = state.currentWorkspace.columns;
      let newRows = state.currentWorkspace.rows;

      if (direction === 'vertical') {
        newColumns = Math.min(newColumns + 1, 4);
      } else {
        newRows = Math.min(newRows + 1, 4);
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

      // Update backend asynchronously
      backendAPI.updateWorkspace(updatedWorkspace)
        .catch((err) => {
          console.error('[WorkspaceStore] Failed to save after split terminal:', err);
        });
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

      // Add to restarting set to suppress exit events
      set((state) => {
        const newSet = new Set(state.restartingTerminals);
        newSet.add(terminalId);
        return { restartingTerminals: newSet };
      });

      try {
        await backendAPI.terminalKill(terminalId);
      } catch (err) {
        console.error('[WorkspaceStore] Failed to kill terminal for restart:', err);
      }

      useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'stopped');
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        let result;
        if (terminal.agent?.enabled && terminal.agent.type !== 'none') {
          result = await backendAPI.spawnTerminalWithAgent(
            terminalId,
            terminal.cwd,
            terminal.agent,
            state.currentWorkspace.id,
            0,
            0
          );
        } else {
          result = await backendAPI.spawnTerminal(
            terminalId,
            terminal.cwd,
            state.currentWorkspace.id,
            0,
            0
          );
        }

        if (result.success) {
          useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'running');
          if (result.pid) {
            useWorkspaceStore.getState().setTerminalProcessId(terminalId, result.pid);
          }
        }
      } catch (err) {
        console.error('[WorkspaceStore] Failed to restart terminal:', err);
        useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'error');
      } finally {
        setTimeout(() => {
          set((state) => {
            const newSet = new Set(state.restartingTerminals);
            newSet.delete(terminalId);
            return { restartingTerminals: newSet };
          });
        }, 500);
      }
    },

    switchTerminalAgent: async (terminalId: string, newAgentType: string) => {
      const state = get();
      if (!state.currentWorkspace) return;

      const terminal = state.currentWorkspace.terminals.find(t => t.id === terminalId);
      if (!terminal) return;

      const agentConfig = newAgentType === 'none' || newAgentType === ''
        ? { type: 'none' as const, enabled: false }
        : { type: newAgentType as AgentType, enabled: true };

      useWorkspaceStore.getState().updateTerminalAgent(terminalId, agentConfig);

      set((state) => {
        const newSet = new Set(state.restartingTerminals);
        newSet.add(terminalId);
        return { restartingTerminals: newSet };
      });

      try {
        await backendAPI.terminalKill(terminalId);
      } catch (err) {
        console.error('[WorkspaceStore] Failed to kill terminal for agent switch:', err);
      }

      useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'stopped');
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        let result;
        if (agentConfig.enabled && agentConfig.type !== 'none') {
          result = await backendAPI.spawnTerminalWithAgent(
            terminalId,
            terminal.cwd,
            agentConfig,
            state.currentWorkspace.id,
            0,
            0
          );
        } else {
          result = await backendAPI.spawnTerminal(
            terminalId,
            terminal.cwd,
            state.currentWorkspace.id,
            0,
            0
          );
        }

        if (result.success) {
          useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'running');
          if (result.pid) {
            useWorkspaceStore.getState().setTerminalProcessId(terminalId, result.pid);
          }
        }
      } catch (err) {
        console.error('[WorkspaceStore] Failed to switch terminal agent:', err);
        useWorkspaceStore.getState().updateTerminalStatus(terminalId, 'error');
      } finally {
        setTimeout(() => {
          set((state) => {
            const newSet = new Set(state.restartingTerminals);
            newSet.delete(terminalId);
            return { restartingTerminals: newSet };
          });
        }, 500);
      }
    },

    /**
     * Cleanup debounce timers on app quit
     */
    _cleanupDebounceTimers: () => {
      debounceSave.clear();
    },
  };
});
