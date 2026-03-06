import React, { useState } from 'react';

interface AgentAllocationSliderProps {
  label: string;
  icon: string;
  value: number;
  maxValue: number;
  onChange: (value: number) => void;
  color: string;
  description?: string;
}

export const AgentAllocationSlider: React.FC<AgentAllocationSliderProps> = ({
  label,
  icon,
  value,
  maxValue,
  onChange,
  color,
  description,
}) => {
  const [inputValue, setInputValue] = useState<string>(value.toString());
  const [isEditing, setIsEditing] = useState(false);

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
      setInputValue(value.toString());
    }
  };

  const handleClickValue = () => {
    setIsEditing(true);
    setInputValue(value.toString());
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>
          {icon} {label}
        </span>
        {isEditing ? (
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            autoFocus
            style={styles.input}
          />
        ) : (
          <span
            style={styles.value}
            onClick={handleClickValue}
            title="Click to edit"
          >
            {value}
          </span>
        )}
      </div>
      <input
        type="range"
        min="0"
        max={maxValue}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          ...styles.slider,
          backgroundImage: `linear-gradient(to right, ${color} 0%, ${color} ${(value / maxValue) * 100}%, #45475a ${(value / maxValue) * 100}%, #45475a 100%)`,
        }}
      />
      {description && <span style={styles.description}>{description}</span>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#cdd6f4',
  },
  value: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#89b4fa',
    backgroundColor: '#313244',
    padding: '4px 8px',
    borderRadius: '4px',
    minWidth: '32px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  input: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#cdd6f4',
    backgroundColor: '#313244',
    border: '2px solid #89b4fa',
    borderRadius: '4px',
    padding: '4px 8px',
    minWidth: '48px',
    textAlign: 'center',
    outline: 'none',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: '#45475a',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
  },
  description: {
    display: 'block',
    fontSize: '12px',
    color: '#a6adc8',
    marginTop: '4px',
  },
};
