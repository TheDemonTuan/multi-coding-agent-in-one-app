import React, { memo, useCallback } from 'react';
import { Template } from '../../types/workspace';

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: (template: Template) => void;
}

export const TemplateCard = memo(({ template, isSelected, onSelect }: TemplateCardProps) => {
  return (
    <button
      className={`template-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(template)}
    >
      <div className="template-preview">
        <div 
          className="template-grid-preview"
          style={{
            gridTemplateColumns: `repeat(${template.columns}, 1fr)`,
            gridTemplateRows: `repeat(${template.rows}, 1fr)`,
          }}
        >
          {Array.from({ length: template.columns * template.rows }).map((_, i) => (
            <div key={i} className="template-cell" />
          ))}
        </div>
      </div>
      <div className="template-details">
        <span className="template-icon">{template.icon}</span>
        <span className="template-name">{template.name}</span>
        <span className="template-size">
          {template.columns}×{template.rows}
        </span>
      </div>
      {!template.isBuiltIn && <span className="custom-badge">Custom</span>}
    </button>
  );
});

TemplateCard.displayName = 'TemplateCard';
