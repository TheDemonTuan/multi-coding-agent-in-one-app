import React, { useEffect, useRef } from 'react';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

interface TerminalContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (actionId: string) => void;
  actions?: ContextMenuAction[];
}

const defaultActions: ContextMenuAction[] = [
  { id: 'copy', label: 'Copy', icon: '📋', shortcut: 'Ctrl+C' },
  { id: 'paste', label: 'Paste', icon: '📄', shortcut: 'Ctrl+V' },
  { id: 'select-all', label: 'Select All', icon: '☰', shortcut: 'Ctrl+A' },
  { type: 'separator' } as any,
  { id: 'split-horizontal', label: 'Split Horizontal', icon: '⬌' },
  { id: 'split-vertical', label: 'Split Vertical', icon: '⬍' },
  { id: 'toggle-layout', label: 'Toggle Layout', icon: '⇄', shortcut: 'Swap Rows/Cols' },
  { type: 'separator' } as any,
  { id: 'clear', label: 'Clear Terminal', icon: '🗑️' },
  { id: 'restart', label: 'Restart Terminal', icon: '🔄' },
  { type: 'separator' } as any,
  { id: 'remove-terminal', label: 'Remove Terminal', icon: '❌', danger: true },
];

export const TerminalContextMenu: React.FC<TerminalContextMenuProps> = ({
  x,
  y,
  onClose,
  onAction,
  actions = defaultActions,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleActionClick = (actionId: string) => {
    onAction(actionId);
    onClose();
  };

  // Calculate menu position to keep it within viewport
  const menuWidth = 220;
  const menuHeight = actions.length * 36 + 16;

  let positionedX = x;
  let positionedY = y;

  if (x + menuWidth > window.innerWidth) {
    positionedX = window.innerWidth - menuWidth - 8;
  }
  if (y + menuHeight > window.innerHeight) {
    positionedY = window.innerHeight - menuHeight - 8;
  }

  return (
    <div
      ref={menuRef}
      style={{
        ...styles.container,
        left: positionedX,
        top: positionedY,
      }}
    >
      {actions.map((action, index) => {
        if ((action as any).type === 'separator') {
          return <div key={index} style={styles.separator} />;
        }

        return (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.id)}
            disabled={action.disabled}
            onMouseEnter={() => !action.disabled && setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              ...styles.actionButton,
              ...(action.danger ? styles.dangerButton : {}),
              ...(action.disabled ? styles.disabledButton : {}),
              ...(hoveredIndex === index && !action.disabled ? styles.hoverButton : {}),
            }}
          >
            {action.icon && <span style={styles.icon}>{action.icon}</span>}
            <span style={styles.label}>{action.label}</span>
            {action.shortcut && <span style={styles.shortcut}>{action.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    zIndex: 9999,
    backgroundColor: '#1e1e2e',
    border: '1px solid #45475a',
    borderRadius: '8px',
    padding: '6px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    minWidth: '180px',
  },
  separator: {
    height: '1px',
    backgroundColor: '#45475a',
    margin: '6px 0',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    color: '#cdd6f4',
    transition: 'background-color 0.15s',
  },
  icon: {
    fontSize: '14px',
    width: '16px',
    display: 'inline-flex',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  shortcut: {
    fontSize: '11px',
    color: '#6c7086',
    marginLeft: 'auto',
  },
  dangerButton: {
    color: '#f38ba8',
  },
  disabledButton: {
    color: '#6c7086',
    cursor: 'not-allowed',
  },
  hoverButton: {
    backgroundColor: '#45475a',
  },
};
