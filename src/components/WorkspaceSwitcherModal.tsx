import React from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import './WorkspaceSwitcherModal.css';

interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (workspaceId: string) => void;
}

export const WorkspaceSwitcherModal: React.FC<WorkspaceSwitcherModalProps> = ({
  isOpen,
  onClose,
  onSelectWorkspace,
}) => {
  const { workspaces, currentWorkspace } = useWorkspaceStore();

  if (!isOpen) return null;

  return (
    <div className="workspace-switcher-overlay">
      <div className="workspace-switcher-modal">
        <div className="workspace-switcher-header">
          <span className="switcher-icon">📂</span>
          <h3>Switch Workspace</h3>
          <span className="switcher-hint">Ctrl+Tab để chuyển, thả Ctrl để chọn</span>
        </div>

        <div className="workspace-switcher-list">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === currentWorkspace?.id;

            return (
              <div
                key={workspace.id}
                className={`workspace-switcher-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  console.log('[Modal] Workspace clicked:', workspace.name);
                  onSelectWorkspace(workspace.id);
                }}
              >
                <span className="workspace-icon">{workspace.icon || '📁'}</span>
                <div className="workspace-info">
                  <span className="workspace-name">{workspace.name}</span>
                  {isActive && <span className="workspace-badge">Current</span>}
                </div>
                <span className="workspace-layout">{workspace.columns}×{workspace.rows}</span>
              </div>
            );
          })}
        </div>

        <div className="workspace-switcher-footer">
          <span className="footer-hint">
            <kbd>Ctrl+Tab</kbd> Tiếp theo
          </span>
          <span className="footer-hint">
            <kbd>Ctrl+Shift+Tab</kbd> Lùi
          </span>
          <span className="footer-hint">
            <kbd>Ctrl+PgUp/PgDn</kbd> Nhanh
          </span>
        </div>
      </div>
    </div>
  );
};
