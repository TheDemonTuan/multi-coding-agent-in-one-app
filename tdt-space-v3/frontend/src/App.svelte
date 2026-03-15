<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Sidebar,
    StatusBar,
    TitleBar,
    TerminalGrid,
    WorkspaceSwitcherModal,
    SettingsModal,
    WorkspaceCreationModal,
  } from './components';
  import { workspaceStore, initializePlatformInfo } from './stores';
  import { getAppVersion } from './utils/version';
  import { backendAPI } from './services/wails-bridge';
  import { MemoryMonitor } from './lib/memoryMonitor';

  // State
  let workspaceSwitcherOpen = $state(false);
  let settingsModalOpen = $state(false);
  let appVersion = $state('');

  // Hover sidebar state
  let sidebarHoverOpen = $state(false);
  let sidebarHoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // Derived state
  let theme = $derived(workspaceStore.theme);
  let workspace = $derived(workspaceStore.currentWorkspace);
  let workspaces = $derived(workspaceStore.workspaces);
  let sidebarVisible = $derived(workspaceStore.sidebarVisible);

  // Workspace navigation helpers
  function nextWorkspace() {
    const next = workspaceStore.getNextWorkspace();
    if (next) {
      workspaceStore.setCurrentWorkspace(next);
      return next;
    }
    return null;
  }

  function previousWorkspace() {
    const prev = workspaceStore.getPreviousWorkspace();
    if (prev) {
      workspaceStore.setCurrentWorkspace(prev);
      return prev;
    }
    return null;
  }

  function switchToWorkspaceByIndex(index: number) {
    if (index < 0 || index >= workspaces.length) {
      return null;
    }
    const ws = workspaceStore.getWorkspaceByIndex(index);
    if (ws) {
      workspaceStore.setCurrentWorkspace(ws);
      return ws;
    }
    return null;
  }

  // Keyboard shortcuts handler
  function handleKeyDown(e: KeyboardEvent) {
    // Don't trigger shortcuts when typing in input fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Toggle sidebar with Ctrl+B
    if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      workspaceStore.toggleSidebar();
      return;
    }

    // Alt+F4: Close window (for frameless windows on Windows)
    if (e.altKey && e.key === 'F4') {
      e.preventDefault();
      backendAPI.windowClose();
      return;
    }

    // Ctrl+, (comma): Open Settings
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      settingsModalOpen = true;
      return;
    }

    // Ctrl+Shift+N: New workspace
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      workspaceStore.setWorkspaceModalOpen(true);
      return;
    }

    // Ctrl+Tab: Cycle to next workspace with modal preview
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      nextWorkspace();
      workspaceSwitcherOpen = true;
      return;
    }

    // Ctrl+Shift+Tab: Previous workspace
    if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      previousWorkspace();
      workspaceSwitcherOpen = true;
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

    // Ctrl+T: Next terminal
    if (e.ctrlKey && !e.shiftKey && e.key === 't') {
      e.preventDefault();
      const nextTerminal = workspaceStore.getNextTerminal();
      if (nextTerminal) {
        workspaceStore.setActiveTerminal(nextTerminal.id);
      }
      return;
    }

    // Ctrl+1 through Ctrl+9: Switch to terminal by index
    if (e.ctrlKey && !e.shiftKey && e.key.match(/^[1-9]$/)) {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      const terminal = workspaceStore.getTerminalByIndex(index);
      if (terminal) {
        workspaceStore.setActiveTerminal(terminal.id);
      }
      return;
    }

    // Ctrl+Shift+T: Previous terminal
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      const prevTerminal = workspaceStore.getPreviousTerminal();
      if (prevTerminal) {
        workspaceStore.setActiveTerminal(prevTerminal.id);
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
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'Control') {
      workspaceSwitcherOpen = false;
    }
  }

  function handleSelectWorkspace(workspaceId: string) {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      workspaceStore.setCurrentWorkspace(ws);
    }
    workspaceSwitcherOpen = false;
  }

  function handleCreateWorkspace() {
    workspaceStore.setWorkspaceModalOpen(true);
  }

  function handleOpenSettings() {
    settingsModalOpen = true;
  }

  // Lifecycle
  onMount(() => {
    // Load app version
    getAppVersion().then(v => appVersion = v);

    // Initialize platform info from backend
    initializePlatformInfo();

    // Load workspaces from store on mount
    workspaceStore.loadWorkspaces();

    // Enable memory monitoring in production to track startup memory spike
    MemoryMonitor.startMonitoring(10000);

    // Log initial memory stats after 5 seconds
    const initialStatsTimeout = setTimeout(() => {
      const stats = MemoryMonitor.getStats();
      if (stats) {
        console.log('[App] Initial memory stats:', {
          usedMB: (stats.usedJSHeapSize / 1024 / 1024).toFixed(2),
          totalMB: (stats.totalJSHeapSize / 1024 / 1024).toFixed(2),
          limitMB: (stats.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
          usagePercent: ((stats.usedJSHeapSize / stats.jsHeapSizeLimit) * 100).toFixed(2) + '%',
        });
      }
    }, 5000);

    // Listen for workspace switcher open event from TerminalCell
    const handleOpenWorkspaceSwitcher = () => {
      workspaceSwitcherOpen = true;
    };
    window.addEventListener('open-workspace-switcher', handleOpenWorkspaceSwitcher);

    // Listen for sidebar hover leave to close hover-opened sidebar
    const handleSidebarHoverLeave = () => {
      sidebarHoverOpen = false;
    };
    window.addEventListener('sidebar-hover-leave', handleSidebarHoverLeave);

    return () => {
      MemoryMonitor.stopMonitoring();
      clearTimeout(initialStatsTimeout);
      window.removeEventListener('open-workspace-switcher', handleOpenWorkspaceSwitcher);
      window.removeEventListener('sidebar-hover-leave', handleSidebarHoverLeave);
    };
  });
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<div
  class="app-container"
  class:dark={theme === 'dark'}
  data-theme={theme}
>
  <TitleBar />

  <div class="app-body">
    <!-- Sidebar Navigation -->
    <Sidebar
      onCreateWorkspace={handleCreateWorkspace}
      onOpenSettings={handleOpenSettings}
      sidebarVisible={sidebarVisible || sidebarHoverOpen}
      isHoverOpen={sidebarHoverOpen}
    />
    <!-- Edge Handle / Sidebar Rail (shown when sidebar is hidden) -->
    {#if !sidebarVisible && !sidebarHoverOpen}
      <div
        class="sidebar-edge-handle"
        onclick={() => workspaceStore.toggleSidebar()}
        onkeydown={(e) => e.key === 'Enter' && workspaceStore.toggleSidebar()}
        onmouseenter={() => {
          if (sidebarHoverTimeout) clearTimeout(sidebarHoverTimeout);
          sidebarHoverOpen = true;
        }}
        role="button"
        tabindex="0"
        title="Show Sidebar (Ctrl+B)"
      >
        <div class="edge-handle-bar"></div>
      </div>
    {/if}

    <!-- Main Content Area -->
    <main class="main-content">
      {#if workspaces.length > 0}
        <!-- Header for current workspace -->
        <div class="content-header">
          <div class="workspace-header">
            <span class="header-icon">{workspace?.icon || '📁'}</span>
            <div class="header-info">
              <h1 class="header-title">{workspace?.name || 'Workspace'}</h1>
              <span class="header-meta">
                {workspace?.columns || 0}×{workspace?.rows || 0} layout • {workspace?.terminals?.length || 0} terminals
              </span>
            </div>
          </div>

          <div class="header-actions">
            <button
              class="header-btn"
              onclick={() => {
                if (workspace) {
                  workspaceStore.setWorkspaceModalOpenWithEdit(workspace);
                }
              }}
              title="Edit Layout"
              disabled={!workspace}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Edit</span>
            </button>
          </div>
        </div>

        <!-- Render all workspaces, show only active one -->
        <div class="workspaces-container">
          {#each workspaces as ws (ws.id)}
            <div 
              class="workspace-container" 
              class:active={ws.id === workspace?.id}
            >
              <div class="terminal-area">
                <TerminalGrid workspace={ws} isWorkspaceActive={ws.id === workspace?.id} />
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-content">
            <div class="empty-icon-wrapper">
              <span class="empty-icon">🚀</span>
            </div>
            <h2 class="empty-title">Welcome to TDT Space</h2>
            <p class="empty-description">
              A multi-agent terminal workspace for AI-powered development.
              <br />
              Create your first workspace to get started.
            </p>
            <button
              class="btn btn-primary btn-lg"
              onclick={handleCreateWorkspace}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Workspace
            </button>

            <div class="empty-shortcuts">
              <div class="shortcut-hint">
                <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd>
                <span>to create workspace</span>
              </div>
              <div class="shortcut-hint">
                <kbd>Ctrl</kbd> + <kbd>,</kbd>
                <span>for settings</span>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </main>
  </div>

  <!-- Status Bar -->
  <StatusBar {appVersion} onOpenSettings={handleOpenSettings} />

  <!-- Modals -->
  <WorkspaceSwitcherModal
    isOpen={workspaceSwitcherOpen}
    onClose={() => workspaceSwitcherOpen = false}
    onSelectWorkspace={handleSelectWorkspace}
  />

  <SettingsModal
    isOpen={settingsModalOpen}
    onClose={() => settingsModalOpen = false}
  />

  <WorkspaceCreationModal
    isOpen={workspaceStore.isWorkspaceModalOpen}
    onClose={() => workspaceStore.setWorkspaceModalOpen(false)}
  />
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: var(--color-bg-base);
    color: var(--color-text);
  }

  .app-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  /* Content Header */
  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--color-border);
    background-color: var(--color-bg-mantle);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .header-icon {
    font-size: var(--text-xl);
  }

  .header-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .header-title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    margin: 0;
    line-height: var(--leading-tight);
  }

  .header-meta {
    font-size: var(--text-xs);
    color: var(--color-text-subtext0);
    font-family: var(--font-mono);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .header-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-subtext1);
    background-color: var(--color-bg-surface0);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .header-btn:hover {
    background-color: var(--color-bg-surface1);
    color: var(--color-text);
    border-color: var(--color-border-hover);
  }

  /* Workspaces Container */
  .workspaces-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .workspace-container {
    flex: 1;
    display: none;
    overflow: hidden;
    flex-direction: column;
  }

  .workspace-container.active {
    display: flex;
  }

  /* Terminal Area */
  .terminal-area {
    flex: 1;
    overflow: hidden;
    padding: 2px;
    background-color: var(--color-bg-base);
    display: flex;
  }

  /* Empty State */
  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    background-color: var(--color-bg-base);
  }

  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-6);
    max-width: 480px;
  }

  .empty-icon-wrapper {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-bg-surface0), var(--color-bg-surface1));
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border);
  }

  .empty-icon {
    font-size: 40px;
    filter: drop-shadow(0 0 16px rgba(137, 180, 250, 0.3));
  }

  .empty-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--color-text);
    margin: 0;
  }

  .empty-description {
    font-size: var(--text-base);
    color: var(--color-text-subtext0);
    line-height: var(--leading-relaxed);
    margin: 0;
  }

  .empty-shortcuts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding: var(--space-4);
    background-color: var(--color-bg-surface0);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
  }

  .shortcut-hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-subtext0);
  }

  .shortcut-hint kbd {
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    background-color: var(--color-bg-surface1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xs);
    color: var(--color-text);
  }

  .shortcut-hint span {
    opacity: 0.8;
  }

  /* Button styles */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    line-height: var(--leading-tight);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast) var(--ease-default);
    white-space: nowrap;
    user-select: none;
  }

  .btn-primary {
    background-color: var(--color-primary);
    color: var(--color-bg-base);
  }

  .btn-primary:hover {
    background-color: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-lg {
    padding: var(--space-3) var(--space-6);
    font-size: var(--text-base);
  }

  /* Scrollbar styling for the main content */
  .main-content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .main-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .main-content::-webkit-scrollbar-thumb {
    background: var(--color-bg-surface1);
    border-radius: var(--radius-full);
  }

  .main-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-bg-surface2);
  }

  /* Edge Handle / Sidebar Rail */
  .sidebar-edge-handle {
    position: fixed;
    top: 0;
    left: 0;
    width: 8px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: var(--z-sticky);
    background: transparent;
    transition: background-color var(--transition-fast), width var(--transition-fast);
  }

  .sidebar-edge-handle:hover {
    background-color: var(--color-bg-surface0);
    width: 12px;
  }

  .edge-handle-bar {
    width: 3px;
    height: 48px;
    background-color: var(--color-border);
    border-radius: var(--radius-full);
    opacity: 0.4;
    transition: opacity var(--transition-fast), background-color var(--transition-fast), height var(--transition-fast);
  }

  .sidebar-edge-handle:hover .edge-handle-bar {
    opacity: 1;
    background-color: var(--color-accent);
    height: 64px;
  }
</style>
