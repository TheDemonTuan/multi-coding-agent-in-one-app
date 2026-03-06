import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import './TitleBar.css';

export const TitleBar: React.FC = () => {
  const { theme, setTheme, currentWorkspace } = useWorkspaceStore();
  const [vnPatchStatus, setVnPatchStatus] = useState<{ isPatched: boolean; enabled: boolean } | null>(null);

  useEffect(() => {
    // Check Vietnamese IME patch status
    const checkStatus = async () => {
      try {
        const [patchStatus, vnSettings] = await Promise.all([
          window.electronAPI?.checkVietnameseImePatchStatus(),
          window.electronAPI?.getVietnameseImeSettings(),
        ]);
        
        setVnPatchStatus({
          isPatched: patchStatus?.isPatched || false,
          enabled: vnSettings?.enabled || false,
        });
      } catch (err) {
        console.error('[TitleBar] Failed to check VN patch status:', err);
      }
    };
    
    checkStatus();
    
    // Re-check when patch is applied (for auto-patch)
    const unsubscribe = window.electronAPI?.onVietnameseImePatchApplied(() => {
      setTimeout(() => checkStatus(), 1500);
    });
    
    return () => unsubscribe?.();
  }, []);

  const handleMinimize = () => window.electronAPI?.windowMinimize();
  const handleMaximize = () => window.electronAPI?.windowMaximize();
  const handleClose = () => window.electronAPI?.windowClose();

  return (
    <div className="title-bar">
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
        
        {/* Vietnamese IME Patch Indicator */}
        {vnPatchStatus?.enabled && (
          <div 
            className="vn-patch-indicator"
            title={vnPatchStatus.isPatched ? '✅ Vietnamese IME Patched' : '⚠️ Vietnamese IME Enabled (Not Patched)'}
          >
            🇻🇳
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: vnPatchStatus.isPatched ? '#a6e3a1' : '#f9e2af',
              display: 'inline-block',
              marginLeft: '4px',
            }} />
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
      </div>
    </div>
  );
};
