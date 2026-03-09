import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import './TitleBar.css';

export const TitleBar: React.FC = () => {
  const { theme, setTheme, currentWorkspace } = useWorkspaceStore();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Detect platform to conditionally show/hide custom window controls
    window.electronAPI?.getPlatform().then((p: string) => setIsMac(p === 'darwin')).catch(() => { });
  }, []);

  const handleMinimize = () => window.electronAPI?.windowMinimize();
  const handleMaximize = () => window.electronAPI?.windowMaximize();
  const handleClose = () => window.electronAPI?.windowClose();

  return (
    <div className={`title-bar${isMac ? ' macos' : ''}`}>
      <div className="title-left">
        <div className="app-identity">
          <span className="app-icon">🚀</span>
          <span className="app-title">TDT Space</span>
        </div>
        {currentWorkspace && (
          <div className="workspace-indicator">
            <span className="indicator-separator">/</span>
            <span className="workspace-icon">{currentWorkspace.icon || '📁'}</span>
            <span className="workspace-name">{currentWorkspace.name}</span>
          </div>
        )}
      </div>

      <div className="title-right">
        <button
          className="theme-toggle-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        {/* Hide custom window controls on macOS — native traffic lights handle them */}
        {!isMac && (
          <div className="window-controls">
            <button className="window-control-btn minimize" onClick={handleMinimize} title="Minimize">
              −
            </button>
            <button className="window-control-btn maximize" onClick={handleMaximize} title="Maximize">
              □
            </button>
            <button className="window-control-btn close" onClick={handleClose} title="Close">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
