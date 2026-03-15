<script lang="ts">
  import { workspaceStore } from '../../stores';
  import type { WorkspaceLayout } from '../../types/workspace';

  // Props
  interface Props {
    onCreateWorkspace: () => void;
    onOpenSettings: () => void;
    sidebarVisible?: boolean;
    isHoverOpen?: boolean;
  }

  let { onCreateWorkspace, onOpenSettings, sidebarVisible = true, isHoverOpen = false }: Props = $props();

  // Local state
  let contextMenu = $state<{ x: number; y: number; workspaceId: string } | null>(null);
  let hoveredWorkspace = $state<string | null>(null);

  // Derived state
  let workspaces = $derived(workspaceStore.workspaces);
  let currentWorkspace = $derived(workspaceStore.currentWorkspace);
  let theme = $derived(workspaceStore.theme);

  function getTerminalCount(workspaceId: string): number {
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    return workspace?.terminals?.length || 0;
  }

  function handleWorkspaceClick(workspaceId: string) {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      workspaceStore.setCurrentWorkspace(ws);
    }
  }

  function handleContextMenu(e: MouseEvent, workspaceId: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { x: e.clientX, y: e.clientY, workspaceId };
  }

  function handleEditLayout(workspaceId: string) {
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      workspaceStore.setWorkspaceModalOpenWithEdit(workspace);
    }
    contextMenu = null;
  }

  function handleRename(workspaceId: string) {
    // For now, use a simple prompt - could be replaced with inline edit
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    if (workspace) {
      const newName = prompt('Rename workspace:', workspace.name);
      if (newName && newName.trim()) {
        workspaceStore.updateWorkspace(workspaceId, { name: newName.trim() });
      }
    }
    contextMenu = null;
  }

  function handleDelete(workspaceId: string) {
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    if (workspace && confirm(`Delete workspace "${workspace.name}"?`)) {
      workspaceStore.removeWorkspace(workspaceId);
    }
    contextMenu = null;
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  // Close context menu on click outside
  $effect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  });

  // Keyboard shortcut: Alt+1-9 for workspace switching, Ctrl+B for sidebar toggle
  function handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      workspaceStore.toggleSidebar();
      return;
    }

    if (e.altKey && e.key.match(/^[1-9]$/)) {
      e.preventDefault();
      const index = parseInt(e.key) - 1;
      if (index < workspaces.length) {
        handleWorkspaceClick(workspaces[index].id);
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<aside
  class="sidebar"
  class:dark={theme === 'dark'}
  class:hidden={!sidebarVisible}
  class:hover-open={isHoverOpen}
  onmouseleave={() => {
    if (isHoverOpen) {
      window.dispatchEvent(new CustomEvent('sidebar-hover-leave'));
    }
  }}
>
  <!-- Sidebar Header -->
  <div class="sidebar-header">
    <div class="logo">
      <span class="logo-icon">🚀</span>
      {#if sidebarVisible}
        <span class="logo-text">TDT Space</span>
      {/if}
    </div>
    <!-- Toggle Button -->
    <button
      class="sidebar-toggle-btn"
      onclick={() => workspaceStore.toggleSidebar()}
      title={sidebarVisible ? 'Hide Sidebar (Ctrl+B)' : 'Show Sidebar (Ctrl+B)'}
      aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
    >
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
        class="toggle-icon"
        class:collapsed={!sidebarVisible}
      >
        {#if sidebarVisible}
          <polyline points="15 18 9 12 15 6"></polyline>
        {:else}
          <polyline points="9 18 15 12 9 6"></polyline>
        {/if}
      </svg>
    </button>
  </div>

  <!-- Workspaces Section -->
  <div class="sidebar-section">
    {#if sidebarVisible}
      <div class="section-header">
        <span class="section-title">Workspaces</span>
        <button
          class="btn btn-ghost btn-icon-sm add-btn"
          onclick={onCreateWorkspace}
          title="New Workspace (Ctrl+Shift+N)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    {/if}

    <nav class="workspaces-list" aria-label="Workspaces">
      {#each workspaces.filter(Boolean) as workspace, index (workspace.id)}
        {@const isActive = currentWorkspace?.id === workspace.id}
        {@const terminalCount = getTerminalCount(workspace.id)}
        {@const isHovered = hoveredWorkspace === workspace.id}

        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="workspace-item"
          class:active={isActive}
          class:collapsed={!sidebarVisible}
          onclick={() => handleWorkspaceClick(workspace.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleWorkspaceClick(workspace.id);
            }
          }}
          oncontextmenu={(e) => handleContextMenu(e, workspace.id)}
          onmouseenter={() => hoveredWorkspace = workspace.id}
          onmouseleave={() => hoveredWorkspace = null}
          role="button"
          tabindex="0"
          aria-pressed={isActive}
          title="{workspace.name} - {terminalCount} terminal{terminalCount !== 1 ? 's' : ''} (Alt+{index + 1})"
        >
          <!-- Active indicator -->
          <div class="active-indicator"></div>

          <!-- Icon -->
          <span class="workspace-icon">{workspace.icon || '📁'}</span>

          <!-- Name - only show when expanded -->
          {#if sidebarVisible}
            <span class="workspace-name">{workspace.name}</span>
          {/if}

          <!-- Terminal count badge - only show when expanded -->
          {#if sidebarVisible && terminalCount > 0}
            <span class="terminal-badge" aria-label="{terminalCount} terminal{terminalCount !== 1 ? 's' : ''}">
              {terminalCount}
            </span>
          {/if}

          <!-- Hover actions - only show when expanded -->
          {#if sidebarVisible}
            <div class="hover-actions" class:visible={isHovered && !isActive}>
              <button
                class="action-btn"
                onclick={(e) => { e.stopPropagation(); handleEditLayout(workspace.id); }}
                title="Edit Layout"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                class="action-btn danger"
                onclick={(e) => { e.stopPropagation(); handleDelete(workspace.id); }}
                title="Delete Workspace"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          {/if}
        </div>
        {/each}
    </nav>

    {#if workspaces.length === 0}
      <div class="empty-workspaces">
        <span class="empty-icon">📂</span>
        <span class="empty-text">No workspaces yet</span>
        <button class="btn btn-primary btn-sm" onclick={onCreateWorkspace}>
          Create one
        </button>
      </div>
    {/if}
  </div>

  <!-- Sidebar Footer -->
  <div class="sidebar-footer">
    <button
      class="footer-btn"
      class:collapsed={!sidebarVisible}
      onclick={onOpenSettings}
      title="Settings (Ctrl+,)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      {#if sidebarVisible}
        <span>Settings</span>
      {/if}
    </button>
  </div>
</aside>

<!-- Context Menu -->
{#if contextMenu}
  <div
    class="context-menu"
    style="top: {contextMenu.y}px; left: {contextMenu.x}px;"
    role="menu"
  >
    <button
      class="context-item"
      onclick={() => {
        const ws = workspaces.find(w => w.id === contextMenu?.workspaceId);
        if (ws) handleWorkspaceClick(ws.id);
        closeContextMenu();
      }}
      role="menuitem"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Switch to Workspace</span>
    </button>
    <button
      class="context-item"
      onclick={() => contextMenu && handleEditLayout(contextMenu.workspaceId)}
      role="menuitem"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      <span>Edit Layout</span>
    </button>
    <button
      class="context-item"
      onclick={() => contextMenu && handleRename(contextMenu.workspaceId)}
      role="menuitem"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      <span>Rename</span>
    </button>
    <div class="context-divider"></div>
    <button
      class="context-item danger"
      onclick={() => contextMenu && handleDelete(contextMenu.workspaceId)}
      role="menuitem"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>Delete</span>
    </button>
  </div>
{/if}

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-mantle);
    border-right: 1px solid var(--color-border);
    transition: width var(--transition-normal) var(--ease-out),
                opacity var(--transition-fast) var(--ease-out);
    flex-shrink: 0;
    overflow: hidden;
  }

  .sidebar.hidden {
    width: 0;
    min-width: 0;
    border-right: none;
    opacity: 0;
  }

  .sidebar.hover-open {
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    z-index: var(--z-overlay, 100);
    box-shadow: var(--shadow-xl);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    overflow: hidden;
  }

  .logo-icon {
    font-size: var(--text-xl);
    filter: drop-shadow(0 0 8px rgba(137, 180, 250, 0.3));
    flex-shrink: 0;
  }

  .logo-text {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-text);
    letter-spacing: var(--tracking-tight);
    white-space: nowrap;
    transition: opacity var(--transition-fast) var(--ease-out);
  }

  /* Toggle Button */
  .sidebar-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background-color: var(--color-bg-surface0);
    color: var(--color-text-subtext0);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .sidebar-toggle-btn:hover {
    background-color: var(--color-bg-surface1);
    color: var(--color-text);
    border-color: var(--color-border-hover);
  }

  .toggle-icon {
    transition: transform var(--transition-fast) var(--ease-out);
  }

  .toggle-icon.collapsed {
    transform: rotate(180deg);
  }

  /* Sidebar Section */
  .sidebar-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    padding-top: var(--space-4);
  }

  .section-title {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtext0);
  }

  .add-btn {
    color: var(--color-text-subtext0);
    padding: var(--space-1);
  }

  .add-btn:hover {
    color: var(--color-text);
    background-color: var(--color-bg-surface0);
  }

  .workspaces-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--space-2);
    padding-bottom: var(--space-2);
  }

  .workspace-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    margin: var(--space-1) 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast) var(--ease-default);
    position: relative;
    overflow: hidden;
  }

  .workspace-item:hover {
    background-color: var(--color-bg-surface0);
  }

  .workspace-item.active {
    background-color: var(--color-bg-surface0);
  }

  .workspace-item.collapsed {
    justify-content: center;
    padding: var(--space-2);
  }

  .workspace-item.collapsed .workspace-icon {
    margin: 0;
  }

  .active-indicator {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background-color: var(--color-primary);
    border-radius: 0 var(--radius-full) var(--radius-full) 0;
    transition: height var(--transition-fast) var(--ease-out);
  }

  .workspace-item.active .active-indicator {
    height: 20px;
  }

  .workspace-icon {
    font-size: var(--text-base);
    flex-shrink: 0;
  }

  .workspace-name {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-subtext1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--transition-fast);
  }

  .workspace-item:hover .workspace-name,
  .workspace-item.active .workspace-name {
    color: var(--color-text);
  }

  .terminal-badge {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    padding: var(--space-1) var(--space-2);
    background-color: var(--color-bg-surface1);
    color: var(--color-text-subtext0);
    border-radius: var(--radius-full);
    min-width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .hover-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    opacity: 0;
    transform: translateX(8px);
    transition: all var(--transition-fast) var(--ease-out);
  }

  .hover-actions.visible {
    opacity: 1;
    transform: translateX(0);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--color-text-overlay0);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background-color: var(--color-bg-surface1);
    color: var(--color-text);
  }

  .action-btn.danger:hover {
    background-color: var(--color-error);
    color: white;
  }

  .empty-workspaces {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--color-text-subtext0);
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.6;
  }

  .empty-text {
    font-size: var(--text-sm);
  }

  .sidebar-footer {
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
    background-color: var(--color-bg-crust);
  }

  .footer-btn {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--color-text-subtext0);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .footer-btn:hover {
    background-color: var(--color-bg-surface0);
    color: var(--color-text);
  }

  .footer-btn.collapsed {
    justify-content: center;
    padding: var(--space-2);
  }

  .footer-btn.collapsed span {
    display: none;
  }

  /* Smooth transitions for sidebar sections */
  .sidebar-section,
  .sidebar-footer {
    transition: opacity var(--transition-fast) var(--ease-out);
  }

  /* Context Menu */
  .context-menu {
    position: fixed;
    min-width: 180px;
    background-color: var(--color-bg-surface0);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
    animation: fadeInScale 150ms var(--ease-out) forwards;
    overflow: hidden;
  }

  .context-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-4);
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .context-item:hover {
    background-color: var(--color-bg-surface1);
  }

  .context-item.danger {
    color: var(--color-error);
  }

  .context-item.danger:hover {
    background-color: rgba(243, 139, 168, 0.15);
  }

  .context-divider {
    height: 1px;
    margin: var(--space-1) 0;
    background-color: var(--color-border);
  }

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
