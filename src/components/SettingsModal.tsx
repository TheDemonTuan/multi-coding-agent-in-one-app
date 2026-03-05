import React, { useState } from 'react';

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

const defaultSettings: TerminalSettings = {
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
  cursorBlink: true,
  scrollback: 10000,
  showCommandBlocks: true,
  theme: 'dark',
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
  const [activeTab, setActiveTab] = useState<'terminal' | 'templates'>('terminal');

  const handleSave = () => {
    // Save settings to electron-store
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.setStoreValue('terminal-settings', settings);
    }
    onClose();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
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
          <button
            onClick={() => setActiveTab('terminal')}
            style={{
              ...styles.tab,
              ...(activeTab === 'terminal' ? styles.activeTab : {}),
            }}
          >
            Terminal
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              ...styles.tab,
              ...(activeTab === 'templates' ? styles.activeTab : {}),
            }}
          >
            Templates
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'terminal' && (
            <div style={styles.tabContent}>
              {/* Font Size */}
              <div style={styles.section}>
                <label style={styles.label}>Font Size</label>
                <div style={styles.sliderContainer}>
                  <input
                    type="range"
                    min={10}
                    max={24}
                    value={settings.fontSize}
                    onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                    style={styles.slider}
                  />
                  <span style={styles.sliderValue}>{settings.fontSize}px</span>
                </div>
              </div>

              {/* Font Family */}
              <div style={styles.section}>
                <label style={styles.label}>Font Family</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                  style={styles.select}
                >
                  {fontOptions.map((font) => (
                    <option key={font} value={font}>{font.split(',')[0].replace(/"/g, '')}</option>
                  ))}
                </select>
              </div>

              {/* Cursor Blink */}
              <div style={styles.section}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={settings.cursorBlink}
                    onChange={(e) => setSettings({ ...settings, cursorBlink: e.target.checked })}
                  />
                  <span style={styles.checkboxText}>Blinking cursor</span>
                </label>
              </div>

              {/* Scrollback */}
              <div style={styles.section}>
                <label style={styles.label}>Scrollback Buffer (lines)</label>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={100}
                  value={settings.scrollback}
                  onChange={(e) => setSettings({ ...settings, scrollback: parseInt(e.target.value) || 10000 })}
                  style={styles.input}
                />
              </div>

              {/* Show Command Blocks */}
              <div style={styles.section}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={settings.showCommandBlocks}
                    onChange={(e) => setSettings({ ...settings, showCommandBlocks: e.target.checked })}
                  />
                  <span style={styles.checkboxText}>Show command blocks (Warp-style)</span>
                </label>
              </div>

              {/* Theme */}
              <div style={styles.section}>
                <label style={styles.label}>Theme</label>
                <div style={styles.themeSelector}>
                  {(['dark', 'light', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setSettings({ ...settings, theme })}
                      style={{
                        ...styles.themeButton,
                        ...(settings.theme === theme ? styles.activeThemeButton : {}),
                      }}
                    >
                      {theme === 'dark' && '🌙'} {theme === 'light' && '☀️'} {theme === 'system' && '💻'} {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div style={styles.tabContent}>
              <div style={styles.infoBox}>
                <p style={styles.infoText}>
                  Manage your custom templates here.
                </p>
                <p style={styles.infoSubtext}>
                  Templates can be created from the workspace creation modal or by saving your current workspace layout.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={handleReset} style={styles.resetButton}>
            🔄 Reset to Defaults
          </button>
          <div style={styles.footerActions}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button onClick={handleSave} style={styles.saveButton}>
              💾 Save Settings
            </button>
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
};
