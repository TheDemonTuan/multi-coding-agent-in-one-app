import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
  showCommandBlocks: boolean;
  theme: 'dark' | 'light' | 'system';
}

interface VietnameseImeSettings {
  enabled: boolean;
  autoPatch: boolean;
}

const defaultSettings: TerminalSettings = {
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
  cursorBlink: true,
  scrollback: 10000,
  showCommandBlocks: true,
  theme: 'dark',
};

const defaultVietnameseImeSettings: VietnameseImeSettings = {
  enabled: false,
  autoPatch: true,
};

const fontOptions = [
  '"Cascadia Code", "Fira Code", Consolas, monospace',
  '"Fira Code", Consolas, monospace',
  '"JetBrains Mono", Consolas, monospace',
  'Consolas, monospace',
  '"Courier New", monospace',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<TerminalSettings>(defaultSettings);
  const [vietnameseImeSettings, setVietnameseImeSettings] = useState<VietnameseImeSettings>(defaultVietnameseImeSettings);
  const [activeTab, setActiveTab] = useState<'terminal' | 'vietnamese'>('terminal');
  const [patchStatus, setPatchStatus] = useState<any>(null);
  const [isPatching, setIsPatching] = useState(false);
  const [patchMessage, setPatchMessage] = useState<string | null>(null);

  // Load Vietnamese IME settings on mount
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.getVietnameseImeSettings().then((vn: VietnameseImeSettings) => {
        setVietnameseImeSettings(vn || defaultVietnameseImeSettings);
      });
      (window as any).electronAPI.checkVietnameseImePatchStatus().then(setPatchStatus);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setStoreValue('terminal-settings', settings);
      (window as any).electronAPI.setVietnameseImeSettings(vietnameseImeSettings);
    }
    onClose();
  };

  const handleApplyPatch = async () => {
    setIsPatching(true);
    setPatchMessage(null);
    try {
      const result = await (window as any).electronAPI.applyVietnameseImePatch();
      if (result.success) {
        let msg = '✅ Patch Applied!\n';
        if (result.version) msg += `• Version: v${result.version}\n`;
        if (result.processesKilled) msg += `• Closed ${result.processesKilled} processes\n`;
        msg += '\n⚠️ Restart Claude Code terminals.';
        setPatchMessage(msg);
        setPatchStatus((p: any) => ({...p, isPatched: true}));
      } else {
        setPatchMessage(`✗ ${result.message}`);
      }
    } catch (err: any) {
      setPatchMessage(`✗ ${err.message}`);
    } finally {
      setIsPatching(false);
      setTimeout(() => setPatchMessage(null), 6000);
    }
  };

  const handleRestore = async () => {
    setIsPatching(true);
    setPatchMessage(null);
    try {
      const result = await (window as any).electronAPI.restoreVietnameseImePatch();
      setPatchMessage(result.success ? '✓ Restored! Restart terminals to test.' : `✗ ${result.message}`);
      if (result.success) setPatchStatus((p: any) => ({...p, isPatched: false}));
    } catch (err: any) {
      setPatchMessage(`✗ ${err.message}`);
    } finally {
      setIsPatching(false);
      setTimeout(() => setPatchMessage(null), 5000);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button onClick={() => setActiveTab('terminal')} style={{...styles.tab, ...(activeTab === 'terminal' ? styles.activeTab : {})}}>Terminal</button>
          <button onClick={() => setActiveTab('vietnamese')} style={{...styles.tab, ...(activeTab === 'vietnamese' ? styles.activeTab : {})}}>🇻🇳 Vietnamese IME</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'terminal' && (
            <div style={styles.tabContent}>
              {/* Font Size */}
              <div style={styles.section}>
                <label style={styles.label}>Font Size</label>
                <div style={styles.sliderContainer}>
                  <input type="range" min={10} max={24} value={settings.fontSize} onChange={(e) => setSettings({...settings, fontSize: parseInt(e.target.value)})} style={styles.slider} />
                  <span style={styles.sliderValue}>{settings.fontSize}px</span>
                </div>
              </div>

              {/* Font Family */}
              <div style={styles.section}>
                <label style={styles.label}>Font Family</label>
                <select value={settings.fontFamily} onChange={(e) => setSettings({...settings, fontFamily: e.target.value})} style={styles.select}>
                  {fontOptions.map((font) => (<option key={font} value={font}>{font.split(',')[0].replace(/"/g, '')}</option>))}
                </select>
              </div>

              {/* Cursor Blink */}
              <div style={styles.section}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={settings.cursorBlink} onChange={(e) => setSettings({...settings, cursorBlink: e.target.checked})} />
                  <span style={styles.checkboxText}>Blinking cursor</span>
                </label>
              </div>

              {/* Scrollback */}
              <div style={styles.section}>
                <label style={styles.label}>Scrollback Buffer (lines)</label>
                <input type="number" min={100} max={100000} step={100} value={settings.scrollback} onChange={(e) => setSettings({...settings, scrollback: parseInt(e.target.value) || 10000})} style={styles.input} />
              </div>

              {/* Show Command Blocks */}
              <div style={styles.section}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={settings.showCommandBlocks} onChange={(e) => setSettings({...settings, showCommandBlocks: e.target.checked})} />
                  <span style={styles.checkboxText}>Show command blocks (Warp-style)</span>
                </label>
              </div>

              {/* Theme */}
              <div style={styles.section}>
                <label style={styles.label}>Theme</label>
                <div style={styles.themeSelector}>
                  {(['dark', 'light', 'system'] as const).map((theme) => (
                    <button key={theme} onClick={() => setSettings({...settings, theme})} style={{...styles.themeButton, ...(settings.theme === theme ? styles.activeThemeButton : {})}}>
                      {theme === 'dark' && '🌙'} {theme === 'light' && '☀️'} {theme === 'system' && '💻'} {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vietnamese' && (
            <div style={styles.tabContent}>
              <div style={styles.vnHeader}>
                <h3 style={{margin:'0 0 8px 0',fontSize:'16px'}}>🇻🇳 Vietnamese IME Patch</h3>
                <p style={styles.infoSubtext}>Fix typing issues with OpenKey, EVKey, UniKey, PHTV</p>
              </div>

              {!patchStatus?.claudeCodeInstalled && (
                <div style={styles.errorBox}>
                  <p style={styles.errorText}>⚠️ Claude Code Not Found</p>
                  <p style={styles.errorSubtext}>Install: <code>bun install -g @anthropic-ai/claude-code</code></p>
                </div>
              )}

              {patchStatus?.claudeCodeInstalled && (
                <>
                  <div style={styles.statusCard}>
                    <div style={styles.statusGrid}>
                      <div><strong>Status:</strong> {patchStatus.isPatched ? <span style={{color:'#a6e3a1'}}>✅ Patched</span> : <span style={{color:'#f9e2af'}}>○ Not Patched</span>}</div>
                      {patchStatus.version && <div><strong>Version:</strong> v{patchStatus.version}</div>}
                      <div><strong>Type:</strong> <span style={{color: patchStatus.installedVia === 'bun' ? '#a6e3a1' : patchStatus.installedVia === 'binary' ? '#89b4fa' : '#f38ba8'}}>{patchStatus.installedVia}</span></div>
                      <div><strong>Backup:</strong> {patchStatus.hasBackup ? <span style={{color:'#a6e3a1'}}>✅ Yes</span> : <span style={{color:'#6c7086'}}>No</span>}</div>
                    </div>
                    <div style={{fontSize:'10px',color:'#6c7086',fontFamily:'monospace',marginTop:'8px',wordBreak:'break-all'}}>{patchStatus.claudePath}</div>
                  </div>

                  <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
                    <button onClick={handleApplyPatch} disabled={isPatching || patchStatus.isPatched} style={{...styles.actionButton, backgroundColor: patchStatus.isPatched ? '#45475a' : '#a6e3a1', color: patchStatus.isPatched ? '#6c7086' : '#1e1e2e'}}>
                      🔧 {isPatching ? 'Applying...' : 'Apply Patch'}
                    </button>
                    {patchStatus.isPatched && patchStatus.hasBackup && (
                      <button onClick={handleRestore} disabled={isPatching} style={{...styles.actionButton, backgroundColor:'#fab387',color:'#1e1e2e'}}>🔄 Restore</button>
                    )}
                  </div>
                </>
              )}

              <div style={styles.settingsSection}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={vietnameseImeSettings.enabled} onChange={(e) => {const v = {...vietnameseImeSettings, enabled: e.target.checked}; setVietnameseImeSettings(v); (window as any).electronAPI.setVietnameseImeSettings(v);}} />
                  <span>Enable Vietnamese IME Fix</span>
                </label>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={vietnameseImeSettings.autoPatch} onChange={(e) => {const v = {...vietnameseImeSettings, autoPatch: e.target.checked}; setVietnameseImeSettings(v); (window as any).electronAPI.setVietnameseImeSettings(v);}} disabled={!vietnameseImeSettings.enabled} />
                  <span style={{opacity: vietnameseImeSettings.enabled ? 1 : 0.5}}>Auto-patch when spawning Claude Code</span>
                </label>
              </div>

              {patchMessage && (
                <div style={{...styles.patchMessage, backgroundColor: patchMessage.startsWith('✅') || patchMessage.startsWith('✓') ? '#1e3a2f' : patchMessage.startsWith('✗') ? '#3a1e1e' : '#313244', border: '1px solid ' + (patchMessage.startsWith('✅') || patchMessage.startsWith('✓') ? '#a6e3a1' : patchMessage.startsWith('✗') ? '#f38ba8' : '#45475a')}}>
                  {patchMessage}
                </div>
              )}

              <div style={styles.helpText}>
                <p style={{margin:'0 0 8px 0',fontWeight:600,fontSize:'13px'}}>💡 How it works:</p>
                <ol style={{margin:0,paddingLeft:'20px',fontSize:'12px',color:'#bac2de'}}>
                  <li>Patch modifies Claude Code to handle Vietnamese IME backspace correctly</li>
                  <li>Auto-patch runs when spawning Claude Code terminal (if enabled)</li>
                  <li>Backup created before patching - can restore anytime</li>
                  <li>Supports Telex, VNI, all Vietnamese IMEs</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerActions}>
            <button onClick={onClose} style={styles.cancelButton}>Cancel</button>
            <button onClick={handleSave} style={styles.saveButton}>💾 Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e1e2e',
    borderRadius: '12px',
    border: '1px solid #45475a',
    width: '90%',
    maxWidth: '550px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #45475a',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#cdd6f4',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#a6adc8',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px 0',
    borderBottom: '1px solid #45475a',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#a6adc8',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeTab: {
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    borderColor: '#45475a',
    borderBottomColor: '#1e1e2e',
    marginBottom: '-1px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#bac2de',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    color: '#cdd6f4',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    color: '#cdd6f4',
    outline: 'none',
    cursor: 'pointer',
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  slider: {
    flex: 1,
    height: '6px',
    backgroundColor: '#45475a',
    borderRadius: '3px',
    outline: 'none',
    WebkitAppearance: 'slider-horizontal',
  },
  sliderValue: {
    fontSize: '14px',
    color: '#cdd6f4',
    minWidth: '50px',
    textAlign: 'right',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#bac2de',
  },
  checkboxText: {
    userSelect: 'none',
  },
  themeSelector: {
    display: 'flex',
    gap: '8px',
  },
  themeButton: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#a6adc8',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeThemeButton: {
    backgroundColor: '#45475a',
    color: '#cdd6f4',
    borderColor: '#89b4fa',
  },
  infoBox: {
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '8px',
    padding: '16px',
  },
  infoText: {
    fontSize: '14px',
    color: '#bac2de',
    margin: '0 0 8px 0',
  },
  infoSubtext: {
    fontSize: '13px',
    color: '#6c7086',
    margin: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderTop: '1px solid #45475a',
  },
  resetButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#313244',
    color: '#a6adc8',
    border: '1px solid #45475a',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  footerActions: {
    display: 'flex',
    gap: '12px',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: 'transparent',
    color: '#a6adc8',
    border: '1px solid #45475a',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButton: {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#89b4fa',
    color: '#1e1e2e',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  // Vietnamese IME
  vnHeader: {marginBottom: '16px'},
  statusCard: {backgroundColor:'#313244',border:'1px solid #45475a',borderRadius:'8px',padding:'16px',marginBottom:'16px'},
  statusGrid: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'},
  actionButton: {flex:1,padding:'10px 16px',fontSize:'13px',fontWeight:600,border:'none',borderRadius:'6px',cursor:'pointer'},
  settingsSection: {backgroundColor:'#313244',border:'1px solid #45475a',borderRadius:'8px',padding:'16px',marginBottom:'16px',display:'flex',flexDirection:'column' as const,gap:'12px'},
  patchMessage: {padding:'12px',borderRadius:'6px',fontSize:'13px',whiteSpace:'pre-wrap' as const,marginBottom:'16px'},
  helpText: {backgroundColor:'#313244',border:'1px solid #45475a',borderRadius:'6px',padding:'12px',fontSize:'12px'},
};
