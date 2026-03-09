import React, { useEffect, useState } from 'react';
import { TitleBar, TerminalGrid, WorkspaceTabBar, WorkspaceSwitcherModal, SettingsModal, WorkspaceCreationModal } from './components';
import { useWorkspaceStore } from './stores';
import { getAppVersion } from './utils/version';
import { useWorkspaceNavigation } from './hooks';

function App() {
  // Use workspace navigation hook
  const {
    nextWorkspace,
    previousWorkspace,
    switchToWorkspaceByIndex,
    getCurrentWorkspaceIndex,
  } = useWorkspaceNavigation();

  const theme = useWorkspaceStore((state) => state.theme);
  const workspace = useWorkspaceStore((state) => state.currentWorkspace);
  const loadWorkspaces = useWorkspaceStore((state) => state.loadWorkspaces);
  const setWorkspaceModalOpen = useWorkspaceStore((state) => state.setWorkspaceModalOpen);
  const editingWorkspace = useWorkspaceStore((state) => state.editingWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const setActiveTerminal = useWorkspaceStore((state) => state.setActiveTerminal);
  const getNextTerminal = useWorkspaceStore((state) => state.getNextTerminal);
  const getPreviousTerminal = useWorkspaceStore((state) => state.getPreviousTerminal);
  const getTerminalByIndex = useWorkspaceStore((state) => state.getTerminalByIndex);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeTerminalId = useWorkspaceStore((state) => state.activeTerminalId);

  // Workspace switcher modal state
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Load app version
  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

  // Load workspaces from electron-store on mount (only once)
  useEffect(() => {
    console.log('[App] Loading workspaces on mount...');
    loadWorkspaces();
  }, []);

  // Listen for workspace switcher open event from TerminalCell
  useEffect(() => {
    const handleOpenWorkspaceSwitcher = () => {
      console.log('[App] Received open-workspace-switcher event from TerminalCell');
      setWorkspaceSwitcherOpen(true);
    };

    window.addEventListener('open-workspace-switcher', handleOpenWorkspaceSwitcher);
    return () => window.removeEventListener('open-workspace-switcher', handleOpenWorkspaceSwitcher);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

        // Always cycle to next workspace when Ctrl+Tab is pressed
        const nextWs = nextWorkspace();
        console.log('[App] Ctrl+Tab pressed, cycling to next workspace:', nextWs?.name);

        // Open modal to show preview
        setWorkspaceSwitcherOpen(true);
        return;
      }

      // Ctrl+Shift+Tab: Previous workspace
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const prevWorkspace = previousWorkspace();
        console.log('[App] Ctrl+Shift+Tab pressed, cycling to previous workspace:', prevWorkspace?.name);
        setWorkspaceSwitcherOpen(true);
        return;
      }

      // Ctrl+PageUp: Previous workspace
      if (e.ctrlKey && e.key === 'PageUp') {
        e.preventDefault();
        const prevWorkspace = previousWorkspace();
        console.log('[App] Ctrl+PageUp pressed, switching to:', prevWorkspace?.name);
        return;
      }

      // Ctrl+PageDown: Next workspace
      if (e.ctrlKey && e.key === 'PageDown') {
        e.preventDefault();
        const nextWorkspaceResult = nextWorkspace();
        console.log('[App] Ctrl+PageDown pressed, switching to:', nextWorkspaceResult?.name);
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
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        // Close workspace switcher when Ctrl is released
        if (workspaceSwitcherOpen) {
          console.log('[App] Ctrl released, closing modal');
          setWorkspaceSwitcherOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    workspaceSwitcherOpen,
    nextWorkspace,
    previousWorkspace,
    switchToWorkspaceByIndex,
    getNextTerminal,
    getPreviousTerminal,
    getTerminalByIndex,
    setCurrentWorkspace,
    setActiveTerminal,
    setWorkspaceModalOpen,
    setSettingsModalOpen,
    workspaces,
    workspace
  ]);

  const handleSelectWorkspace = (workspaceId: string) => {
    console.log('[App] handleSelectWorkspace called with:', workspaceId);
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      setCurrentWorkspace(ws);
      console.log('[App] Switched to workspace:', ws.name);
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
          console.log('[App] Modal onClose called');
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
