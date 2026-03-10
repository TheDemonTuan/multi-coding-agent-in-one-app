import React, { useEffect, useCallback, useState } from 'react';
import { TitleBar, TerminalGrid, WorkspaceTabBar, WorkspaceSwitcherModal, SettingsModal, WorkspaceCreationModal } from './components';
import { useWorkspaceStore, initializePlatformInfo } from './stores';
import { getAppVersion } from './utils/version';
import { useWorkspaceNavigation } from './hooks';

function App() {
  // Use workspace navigation hook
  const {
    nextWorkspace,
    previousWorkspace,
    switchToWorkspaceByIndex,
  } = useWorkspaceNavigation();

  // Individual selectors to avoid re-rendering when unrelated state changes
  const theme = useWorkspaceStore((state) => state.theme);
  const workspace = useWorkspaceStore((state) => state.currentWorkspace);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  // Actions are stable references in Zustand - selector is still preferred for clarity
  const loadWorkspaces = useWorkspaceStore((state) => state.loadWorkspaces);
  const setWorkspaceModalOpen = useWorkspaceStore((state) => state.setWorkspaceModalOpen);
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const setActiveTerminal = useWorkspaceStore((state) => state.setActiveTerminal);
  const getNextTerminal = useWorkspaceStore((state) => state.getNextTerminal);
  const getPreviousTerminal = useWorkspaceStore((state) => state.getPreviousTerminal);
  const getTerminalByIndex = useWorkspaceStore((state) => state.getTerminalByIndex);

  // Workspace switcher modal state
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Load app version
  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

  // Initialize platform info from backend (lazy initialization to avoid timing issues with Wails runtime)
  useEffect(() => {
    initializePlatformInfo();
  }, []);

  // Load workspaces from electron-store on mount (only once)
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Listen for workspace switcher open event from TerminalCell
  useEffect(() => {
    const handleOpenWorkspaceSwitcher = () => {
      setWorkspaceSwitcherOpen(true);
    };

    window.addEventListener('open-workspace-switcher', handleOpenWorkspaceSwitcher);
    return () => window.removeEventListener('open-workspace-switcher', handleOpenWorkspaceSwitcher);
  }, []);

  // Keyboard shortcuts
  // NOTE: handlers use useCallback to get stable references so the effect
  // deps list is minimal and doesn't re-register on every render.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Ctrl+, (comma): Open Settings
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      setSettingsModalOpen(true);
      return;
    }

    // Ctrl+Shift+N: New workspace
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      setWorkspaceModalOpen(true);
      return;
    }

    // Ctrl+Tab: Cycle to next workspace with modal preview
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      nextWorkspace();
      setWorkspaceSwitcherOpen(true);
      return;
    }

    // Ctrl+Shift+Tab: Previous workspace
    if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      previousWorkspace();
      setWorkspaceSwitcherOpen(true);
      return;
    }

    // Ctrl+PageUp: Previous workspace
    if (e.ctrlKey && e.key === 'PageUp') {
      e.preventDefault();
      previousWorkspace();
      return;
    }

    // Ctrl+PageDown: Next workspace
    if (e.ctrlKey && e.key === 'PageDown') {
      e.preventDefault();
      nextWorkspace();
      return;
    }

    // Ctrl+T: Next terminal (or terminal at index with number)
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();

      // Check if a number key is pressed (Ctrl+1 through Ctrl+9)
      const numKey = e.code.match(/Digit(\d)/);
      if (numKey) {
        const index = parseInt(numKey[1]) - 1;
        const terminal = getTerminalByIndex(index);
        if (terminal) {
          setActiveTerminal(terminal.id);
        }
      } else {
        const nextTerminal = getNextTerminal();
        if (nextTerminal) {
          setActiveTerminal(nextTerminal.id);
        }
      }
      return;
    }

    // Ctrl+Shift+T: Previous terminal
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      const prevTerminal = getPreviousTerminal();
      if (prevTerminal) {
        setActiveTerminal(prevTerminal.id);
      }
      return;
    }

    // Alt+1 through Alt+9: Switch to workspace by index
    if (e.altKey && e.key.match(/^[1-9]$/)) {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      switchToWorkspaceByIndex(index);
      return;
    }
  }, [
    nextWorkspace,
    previousWorkspace,
    switchToWorkspaceByIndex,
    getNextTerminal,
    getPreviousTerminal,
    getTerminalByIndex,
    setActiveTerminal,
    setWorkspaceModalOpen,
  ]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      setWorkspaceSwitcherOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleSelectWorkspace = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      setCurrentWorkspace(ws);
    }
    setWorkspaceSwitcherOpen(false);
  };

  return (
    <div
      className="app-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme === 'dark' ? '#1e1e2e' : '#f5f5f5',
        color: theme === 'dark' ? '#cdd6f4' : '#1e1e2e',
      }}
    >
      <TitleBar />

      <WorkspaceTabBar />

      <main
        className="main-content"
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {workspace ? (
          <TerminalGrid />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              color: '#6c7086',
            }}
          >
            <div style={{ fontSize: '48px' }}>📂</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>No workspace selected</div>
            <div style={{ fontSize: '14px' }}>
              Create a new workspace to get started
            </div>
            <button
              onClick={() => setWorkspaceModalOpen(true)}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                backgroundColor: '#89b4fa',
                color: '#1e1e2e',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginTop: '8px',
              }}
            >
              + Create Workspace
            </button>
          </div>
        )}
      </main>

      <footer
        className="status-bar"
        style={{
          padding: '6px 16px',
          backgroundColor: theme === 'dark' ? '#11111b' : '#d0d0d0',
          borderTop: '1px solid #45475a',
          fontSize: '12px',
          color: '#6c7086',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>v{appVersion} - Multi-terminal Workspace</span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>Ctrl+Tab: Switch Workspace</span>
          <span>Ctrl+PgUp/PgDn: Prev/Next Workspace</span>
          <span>Ctrl+T: Next Terminal</span>
          <button
            onClick={() => setSettingsModalOpen(true)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#313244',
              color: '#cdd6f4',
              border: '1px solid #45475a',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </footer>

      <WorkspaceSwitcherModal
        isOpen={workspaceSwitcherOpen}
        onClose={() => {
          setWorkspaceSwitcherOpen(false);
        }}
        onSelectWorkspace={handleSelectWorkspace}
      />


      {/* WorkspaceCreationModal is rendered inside WorkspaceTabBar — do NOT duplicate here */}


      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}

export default App;
