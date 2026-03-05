import React, { useState } from 'react';
import { Template, AgentAllocation } from '../types/workspace';

interface CustomTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Template) => void;
  existingLayout?: { columns: number; rows: number } | null;
}

const emojis = ['💼', '🚀', '💻', '🔧', '⚡', '🎯', '📦', '🛠️', '📊', '🎨', '◈', '◇', '◆', '□', '■'];

export const CustomTemplateModal: React.FC<CustomTemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingLayout,
}) => {
  const [templateName, setTemplateName] = useState('My Template');
  const [templateDescription, setTemplateDescription] = useState('Custom workspace layout');
  const [selectedIcon, setSelectedIcon] = useState(emojis[0]);
  const [columns, setColumns] = useState(existingLayout?.columns || 2);
  const [rows, setRows] = useState(existingLayout?.rows || 2);

  const handleSave = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const template: Template = {
      id: `custom-${Date.now()}`,
      name: templateName.trim(),
      description: templateDescription.trim(),
      layout: 'custom',
      columns,
      rows,
      icon: selectedIcon,
      isBuiltIn: false,
      createdAt: Date.now(),
    };

    onSave(template);
    handleClose();
  };

  const handleClose = () => {
    setTemplateName('My Template');
    setTemplateDescription('Custom workspace layout');
    setSelectedIcon(emojis[0]);
    setColumns(2);
    setRows(2);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Create Custom Template</h2>
          <button onClick={handleClose} style={styles.closeButton}>×</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Template Name */}
          <div style={styles.section}>
            <label style={styles.label}>Template Name</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              style={styles.input}
              placeholder="Enter template name"
              autoFocus
            />
          </div>

          {/* Description */}
          <div style={styles.section}>
            <label style={styles.label}>Description</label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              style={styles.textarea}
              placeholder="Describe your template"
              rows={2}
            />
          </div>

          {/* Icon Selection */}
          <div style={styles.section}>
            <label style={styles.label}>Icon</label>
            <div style={styles.emojiPicker}>
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedIcon(emoji)}
                  style={{
                    ...styles.emojiButton,
                    backgroundColor: selectedIcon === emoji ? '#45475a' : 'transparent',
                    border: selectedIcon === emoji ? '2px solid #89b4fa' : '1px solid #45475a',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Layout Configuration */}
          <div style={styles.section}>
            <label style={styles.label}>Layout Configuration</label>
            <div style={styles.layoutConfig}>
              <div style={styles.layoutInput}>
                <label style={styles.subLabel}>Columns</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={columns}
                  onChange={(e) => setColumns(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={styles.numberInput}
                />
              </div>
              <div style={styles.layoutInput}>
                <label style={styles.subLabel}>Rows</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={rows}
                  onChange={(e) => setRows(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={styles.numberInput}
                />
              </div>
            </div>

            {/* Preview */}
            <div style={styles.previewSection}>
              <label style={styles.subLabel}>Preview</label>
              <div style={styles.previewContainer}>
                <div
                  style={{
                    ...styles.previewGrid,
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: columns * rows }).map((_, i) => (
                    <div key={i} style={styles.previewCell} />
                  ))}
                </div>
              </div>
              <p style={styles.previewInfo}>
                {columns} × {rows} = {columns * rows} terminal{columns * rows > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={handleClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button onClick={handleSave} style={styles.saveButton}>
            💾 Save Template
          </button>
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
    maxWidth: '500px',
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
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  section: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#bac2de',
    marginBottom: '8px',
  },
  subLabel: {
    fontSize: '12px',
    color: '#a6adc8',
    marginBottom: '6px',
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    color: '#cdd6f4',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    color: '#cdd6f4',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  emojiPicker: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  emojiButton: {
    fontSize: '20px',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutConfig: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },
  layoutInput: {
    flex: 1,
  },
  numberInput: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    backgroundColor: '#313244',
    border: '1px solid #45475a',
    borderRadius: '6px',
    color: '#cdd6f4',
    outline: 'none',
    boxSizing: 'border-box',
  },
  previewSection: {
    marginTop: '16px',
  },
  previewContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px',
    backgroundColor: '#181825',
    borderRadius: '8px',
    border: '1px solid #45475a',
  },
  previewGrid: {
    display: 'grid',
    gap: '4px',
    width: '100%',
    maxWidth: '200px',
  },
  previewCell: {
    aspectRatio: '1',
    backgroundColor: 'rgba(137, 180, 250, 0.3)',
    border: '1px solid #89b4fa',
    borderRadius: '4px',
  },
  previewInfo: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#6c7086',
    marginTop: '8px',
    margin: '8px 0 0 0',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #45475a',
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
