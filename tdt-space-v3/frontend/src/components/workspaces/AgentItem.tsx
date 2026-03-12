import React, { memo, useState, useCallback } from 'react';

interface AgentItemProps {
  type: string;
  label: string;
  icon: string;
  count: number;
  maxValue: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChange: (value: number) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export const AgentItem = memo(({
  type,
  label,
  icon,
  count,
  maxValue,
  onIncrement,
  onDecrement,
  onChange,
  onDragStart,
  onDragEnd,
}: AgentItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(count.toString());

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      onChange(0);
      setInputValue('0');
    } else if (numValue > maxValue) {
      onChange(maxValue);
      setInputValue(maxValue.toString());
    } else {
      onChange(numValue);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(count.toString());
    }
  };

  const handleClickValue = () => {
    setIsEditing(true);
    setInputValue(count.toString());
  };

  return (
    <div className="agent-item">
      <div 
        className="agent-draggable"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <img src={icon} alt={label} className="agent-icon-img" draggable={false} />
        <span className="agent-name">{label}</span>
        <span 
          className={`agent-count ${isEditing ? 'editing' : ''}`}
          onClick={handleClickValue}
          title="Click to edit"
        >
          {isEditing ? (
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              autoFocus
              onClick={e => e.stopPropagation()}
              className="agent-count-input"
            />
          ) : (
            count
          )}
        </span>
      </div>
      <div className="agent-controls">
        <button 
          className="agent-btn"
          onClick={onDecrement}
        >
          −
        </button>
        <span className="agent-value">{count}</span>
        <button 
          className="agent-btn primary"
          onClick={onIncrement}
        >
          +
        </button>
      </div>
    </div>
  );
});

AgentItem.displayName = 'AgentItem';
