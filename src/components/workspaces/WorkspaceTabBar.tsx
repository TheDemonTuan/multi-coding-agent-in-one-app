import React, { useState, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { LayoutSelector } from './LayoutSelector';
import { WorkspaceCreationModal } from './WorkspaceCreationModal';
import './WorkspaceTabBar.css';

interface ContextMenuProps {
  x: number;
  y: number;
  workspaceId: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onEditLayout: (id: string) => void;
}

interface DeleteConfirmModalProps {
  icon: string;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface RenameModalProps {
  workspaceId: string;
  currentName: string;
  onConfirm: (id: string, newName: string) => void;
  onCancel: () => void;
}

const RenameModal: React.FC<RenameModalProps> = ({
  workspaceId,
  currentName,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = React.useState(currentName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(workspaceId, name.trim());
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rename-modal-header">
          <span className="rename-modal-icon">✏️</span>
          <h3 className="rename-modal-title">Rename Workspace</h3>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="rename-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter workspace name"
            maxLength={50}
          />
          <div className="rename-modal-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-rename" disabled={!name.trim()}>
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  icon,
  title,
  description,
  confirmText,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-icon-wrapper">
          <span className="delete-modal-icon">{icon}</span>
        </div>
        <h3 className="delete-modal-title">{title}</h3>
        <p className="delete-modal-description">{description}</p>
        <div className="delete-modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-delete" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  workspaceId,
  onClose,
  onDelete,
  onRename,
  onEditLayout,
}) => {
  return (
    <div
      className="context-menu"
      style={{ top: y, left: x }}
      role="menu"
      aria-label="Workspace actions"
    >
      <div
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onEditLayout(workspaceId);
          onClose();
        }}
        role="menuitem"
      >
        <span className="context-menu-icon settings">⚙️</span>
        <span>Edit Layout</span>
      </div>
      <div
        className="context-menu-item"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRename(workspaceId);
          onClose();
        }}
        role="menuitem"
      >
        <span className="context-menu-icon edit">✏️</span>
        <span>Rename</span>
      </div>
      <div className="context-menu-divider" />
      <div
        className="context-menu-item danger"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDelete(workspaceId);
          onClose();
        }}
        role="menuitem"
      >
        <span className="context-menu-icon delete">🗑️</span>
        <span>Delete</span>
      </div>
    </div>
  );
};

export const WorkspaceTabBar: React.FC = () => {
  const { workspaces, currentWorkspace, setCurrentWorkspace, removeWorkspace, updateWorkspace, setWorkspaceModalOpen, theme, setTheme, isWorkspaceModalOpen, setWorkspaceModalOpenWithEdit } = useWorkspaceStore();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workspaceId: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    workspaceId: string;
    workspaceName: string;
  } | null>(null);
  const [renameModal, setRenameModal] = useState<{
    workspaceId: string;
    currentName: string;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      workspaceId,
    });
  }, []);

  const requestDelete = useCallback((id: string, name: string) => {
    setDeleteModal({ isOpen: true, workspaceId: id, workspaceName: name });
    setContextMenu(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteModal) {
      console.log('[TabBar] Deleting workspace:', deleteModal.workspaceId);
      removeWorkspace(deleteModal.workspaceId);
      setDeleteModal(null);
    }
  }, [deleteModal, removeWorkspace]);

  const cancelDelete = useCallback(() => {
    setDeleteModal(null);
  }, []);

  const handleRename = useCallback((id: string) => {
    const workspace = workspaces.find(ws => ws.id === id);
    if (!workspace) return;

    setRenameModal({
      workspaceId: id,
      currentName: workspace.name,
    });
    setContextMenu(null);
  }, [workspaces]);

  const confirmRename = useCallback((id: string, newName: string) => {
    updateWorkspace(id, { name: newName });
    setRenameModal(null);
  }, [updateWorkspace]);

  const cancelRename = useCallback(() => {
    setRenameModal(null);
  }, []);

  const handleEditLayout = useCallback((id: string) => {
    const workspace = workspaces.find(ws => ws.id === id);
    if (!workspace) return;
    
    setWorkspaceModalOpenWithEdit(workspace);
    setContextMenu(null);
  }, [workspaces, setWorkspaceModalOpenWithEdit]);

  const handleDeleteAll = useCallback(() => {
    setDeleteModal({ isOpen: true, workspaceId: 'ALL', workspaceName: 'all workspaces' });
  }, []);

  const confirmDeleteAll = useCallback(() => {
    const idsToDelete = workspaces.map(ws => ws.id);
    idsToDelete.forEach(id => removeWorkspace(id));
    setDeleteModal(null);
  }, [workspaces, removeWorkspace]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
      setRenameModal(null);
    };
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, closeContextMenu]);

  const handleWorkspaceClick = useCallback((workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    console.log('[TabBar] Workspace tab clicked:', ws?.name);
    setCurrentWorkspace(ws!);
  }, [workspaces, setCurrentWorkspace]);

  const isDeleteAll = deleteModal?.workspaceId === 'ALL';

  const getTerminalCount = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    return workspace?.terminals?.length || 0;
  }, [workspaces]);

  const totalTerminals = workspaces.reduce((acc, ws) => acc + getTerminalCount(ws.id), 0);

  return (
    <>
      <div className="workspace-tab-bar">
        <div className="tabs-container" role="tablist" aria-label="Workspaces">
          {workspaces.map((workspace) => {
            const isActive = currentWorkspace?.id === workspace.id;
            const terminalCount = getTerminalCount(workspace.id);

            return (
              <div
                key={workspace.id}
                className={`workspace-tab ${isActive ? 'active' : ''}`}
                onClick={() => handleWorkspaceClick(workspace.id)}
                onContextMenu={(e) => handleContextMenu(e, workspace.id)}
                title={`${workspace.name} - ${terminalCount} terminal${terminalCount !== 1 ? 's' : ''}`}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
              >
                <span className="tab-icon" aria-hidden="true">{workspace.icon || '📁'}</span>
                <span className="tab-name">{workspace.name}</span>
                <span className="terminal-badge" aria-label={`${terminalCount} terminal${terminalCount !== 1 ? 's' : ''}`}>
                  {terminalCount}
                </span>
                <button
                  className="tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestDelete(workspace.id, workspace.name);
                  }}
                  title="Delete workspace"
                  aria-label={`Delete ${workspace.name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="tab-actions">
          {totalTerminals > 0 && (
            <div className="total-count-badge" title={`Total: ${totalTerminals} terminal${totalTerminals !== 1 ? 's' : ''}`}>
              <span className="total-count-icon">📊</span>
              <span className="total-count-number">{totalTerminals}</span>
            </div>
          )}
          
          <button
            className="action-btn new-workspace-btn"
            onClick={() => setWorkspaceModalOpen(true)}
            title="New Workspace"
            aria-label="Create new workspace"
          >
            <span className="btn-icon-plus">+</span>
          </button>
          
          {currentWorkspace && (
            <button
              className="action-btn edit-layout-btn"
              onClick={() => setWorkspaceModalOpenWithEdit(currentWorkspace)}
              title="Edit Current Layout"
              aria-label="Edit current workspace layout"
            >
              <span className="btn-icon-settings">⚙️</span>
            </button>
          )}

          {workspaces.length > 1 && (
            <button
              className="action-btn delete-all-btn"
              onClick={handleDeleteAll}
              title="Delete All Workspaces"
              aria-label="Delete all workspaces"
            >
              <span className="btn-icon-delete">🗑️</span>
            </button>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          workspaceId={contextMenu.workspaceId}
          onClose={closeContextMenu}
          onDelete={(id) => {
            const ws = workspaces.find(w => w.id === id);
            if (ws) requestDelete(id, ws.name);
          }}
          onRename={handleRename}
          onEditLayout={handleEditLayout}
        />
      )}

      {renameModal && (
        <RenameModal
          workspaceId={renameModal.workspaceId}
          currentName={renameModal.currentName}
          onConfirm={confirmRename}
          onCancel={cancelRename}
        />
      )}

      {deleteModal && (
        <DeleteConfirmModal
          icon={isDeleteAll ? '⚠️' : '🗑️'}
          title={isDeleteAll ? 'Delete All Workspaces' : 'Delete Workspace'}
          description={
            isDeleteAll ? (
              <>
                Are you sure you want to delete <strong>all {workspaces.length} workspaces</strong>?
                <br />
                This will remove <strong>{totalTerminals} terminals</strong> and cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to delete <strong>"{deleteModal.workspaceName}"</strong>?
                <br />
                This action cannot be undone.
              </>
            )
          }
          confirmText={isDeleteAll ? 'Delete All' : 'Delete'}
          onConfirm={isDeleteAll ? confirmDeleteAll : confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {isWorkspaceModalOpen && (
        <WorkspaceCreationModal
          isOpen={isWorkspaceModalOpen}
          onClose={() => setWorkspaceModalOpen(false)}
          editingWorkspace={useWorkspaceStore.getState().editingWorkspace}
        />
      )}
    </>
  );
};
