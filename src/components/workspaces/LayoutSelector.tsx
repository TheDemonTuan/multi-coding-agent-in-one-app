import React from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import './LayoutSelector.css';

interface LayoutSelectorProps {
  compact?: boolean;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({ compact }) => {
  const { setWorkspaceModalOpen, currentWorkspace, setWorkspaceModalOpenWithEdit } = useWorkspaceStore();

  const handleEditLayout = () => {
    if (currentWorkspace) {
      setWorkspaceModalOpenWithEdit(currentWorkspace);
    }
  };

  const handleNewWorkspace = () => {
    setWorkspaceModalOpen(true);
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className="layout-selector-btn compact"
          onClick={handleNewWorkspace}
          title="New Workspace"
        >
          <span className="btn-icon">+</span>
        </button>
        <button
          className="layout-selector-btn compact"
          onClick={handleEditLayout}
          title="Edit Current Workspace Layout"
          disabled={!currentWorkspace}
          style={!currentWorkspace ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        >
          <span className="btn-icon">⚙️</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        className="layout-selector-btn"
        onClick={handleNewWorkspace}
      >
        <span className="btn-icon">+</span>
        <span className="btn-text">New Workspace</span>
      </button>
      <button
        className="layout-selector-btn"
        onClick={handleEditLayout}
        disabled={!currentWorkspace}
        title="Edit Current Workspace Layout"
        style={!currentWorkspace ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
      >
        <span className="btn-icon">⚙️</span>
        <span className="btn-text">Edit Layout</span>
      </button>
    </div>
  );
};
