import React, { useState, useEffect } from 'react';
import { useTemplateStore } from '../stores/templateStore';
import { Template, AgentAllocation } from '../types/workspace';

interface TemplateSelectorProps {
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
  onCustomTemplateClick?: (template: Template) => void;
  onCreateNewTemplate?: () => void;
  onDeleteTemplate?: (template: Template) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onSelectTemplate,
  onCustomTemplateClick,
}) => {
  const { getBuiltInTemplates, getCustomTemplates, loadTemplates, isLoading } = useTemplateStore();
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin');

  useEffect(() => {
    loadTemplates();
  }, []);

  const builtinTemplates = getBuiltInTemplates();
  const customTemplates = getCustomTemplates();

  const handleTemplateSelect = (template: Template) => {
    onSelectTemplate(template);
  };

  const handleCustomTemplateClick = (template: Template) => {
    if (onCustomTemplateClick) {
      onCustomTemplateClick(template);
    }
    onSelectTemplate(template);
  };

  const currentTemplates = activeTab === 'builtin' ? builtinTemplates : customTemplates;

  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('builtin')}
          style={{
            ...styles.tab,
            ...(activeTab === 'builtin' ? styles.activeTab : {}),
          }}
        >
          Built-in Templates
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          style={{
            ...styles.tab,
            ...(activeTab === 'custom' ? styles.activeTab : {}),
          }}
        >
          Custom Templates
          {customTemplates.length > 0 && (
            <span style={styles.badge}>{customTemplates.length}</span>
          )}
        </button>
      </div>

      {/* Templates Grid */}
      <div style={styles.templatesGrid}>
        {isLoading ? (
          <div style={styles.loading}>Loading templates...</div>
        ) : currentTemplates.length === 0 ? (
          activeTab === 'custom' ? (
            <div style={styles.emptyState}>
              <p>No custom templates yet.</p>
              <p style={styles.emptyStateSub}>Create a custom template from your current workspace layout.</p>
            </div>
          ) : (
            <div style={styles.emptyState}>No templates available.</div>
          )
        ) : (
          currentTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                if (template.isBuiltIn) {
                  handleTemplateSelect(template);
                } else {
                  handleCustomTemplateClick(template);
                }
              }}
              style={{
                ...styles.templateCard,
                ...(selectedTemplate?.id === template.id ? styles.selectedCard : {}),
              }}
            >
              {/* Preview Grid */}
              <div style={styles.previewContainer}>
                <div
                  style={{
                    ...styles.previewGrid,
                    gridTemplateColumns: `repeat(${template.columns}, 1fr)`,
                    gridTemplateRows: `repeat(${template.rows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: template.columns * template.rows }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.previewCell,
                        backgroundColor: selectedTemplate?.id === template.id
                          ? 'rgba(137, 180, 250, 0.5)'
                          : 'rgba(69, 71, 90, 0.5)',
                        border: selectedTemplate?.id === template.id
                          ? '1px solid #89b4fa'
                          : '1px solid #585b70',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Template Info */}
              <div style={styles.templateInfo}>
                <div style={styles.templateHeader}>
                  <span style={styles.templateIcon}>{template.icon}</span>
                  <span style={styles.templateName}>{template.name}</span>
                </div>
                <p style={styles.templateDescription}>{template.description}</p>
                <p style={styles.templateSize}>
                  {template.columns} × {template.rows} ({template.columns * template.rows} terminals)
                </p>
              </div>

              {/* Selection Indicator */}
              {selectedTemplate?.id === template.id && (
                <div style={styles.selectedIndicator}>✓</div>
              )}

              {/* Custom Template Badge */}
              {!template.isBuiltIn && (
                <div style={styles.customBadge}>Custom</div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #45475a',
    paddingBottom: '8px',
  },
  tab: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#a6adc8',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  activeTab: {
    backgroundColor: '#313244',
    color: '#cdd6f4',
    borderColor: '#89b4fa',
  },
  badge: {
    fontSize: '11px',
    padding: '2px 6px',
    backgroundColor: '#89b4fa',
    color: '#1e1e2e',
    borderRadius: '10px',
    fontWeight: 600,
  },
  templatesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '8px',
  },
  loading: {
    textAlign: 'center',
    color: '#a6adc8',
    padding: '32px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#6c7086',
    padding: '32px',
    gridColumn: '1 / -1',
  },
  emptyStateSub: {
    fontSize: '13px',
    marginTop: '8px',
  },
  templateCard: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    backgroundColor: '#1e1e2e',
    border: '2px solid #45475a',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  selectedCard: {
    borderColor: '#89b4fa',
    backgroundColor: 'rgba(137, 180, 250, 0.1)',
    boxShadow: '0 0 20px rgba(137, 180, 250, 0.3)',
  },
  previewContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#181825',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  previewGrid: {
    display: 'grid',
    gap: '4px',
    width: '100%',
    maxWidth: '120px',
  },
  previewCell: {
    aspectRatio: '1',
    borderRadius: '4px',
    transition: 'all 0.2s',
  },
  templateInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  templateHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  templateIcon: {
    fontSize: '18px',
  },
  templateName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#cdd6f4',
  },
  templateDescription: {
    fontSize: '12px',
    color: '#a6adc8',
    margin: '0',
  },
  templateSize: {
    fontSize: '11px',
    color: '#6c7086',
    margin: '0',
  },
  selectedIndicator: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '24px',
    height: '24px',
    backgroundColor: '#89b4fa',
    color: '#1e1e2e',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
  },
  customBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '2px 8px',
    backgroundColor: '#45475a',
    color: '#fab387',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    border: '1px solid #585b70',
  },
};
