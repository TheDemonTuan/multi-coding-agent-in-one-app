import React, { useEffect, useRef } from 'react';
import { getSupportedAgentTypes, getAgentDisplayName } from '../../config/agents';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

interface SubmenuAction {
  id: string;
  label: string;
  icon?: string;
  submenu: ContextMenuAction[];
}

type Action = ContextMenuAction | SubmenuAction;

interface TerminalContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (actionId: string) => void;
  actions?: Action[];
  currentAgentType?: string;
}

const agentIcons: Record<string, string> = {
  'claude-code': '🤖',
  'opencode': '📦',
  'droid': '⚡',
  'gemini-cli': '✨',
  'cursor': '🎯',
  'codex': '🧠',
  'oh-my-pi': '🥧',
  'aider': '🚀',
  'goose': '🪿',
  'warp': '⚡',
  'amp': '🔥',
  'kiro': '☁️',
};

// Popular agents shown first
const POPULAR_AGENTS = ['claude-code', 'opencode', 'droid', 'gemini-cli', 'aider'];

const buildAgentSubmenu = (currentAgentType?: string): SubmenuAction => {
  const supportedAgents = getSupportedAgentTypes();

  // Split into popular and others
  const popular = supportedAgents.filter(t => POPULAR_AGENTS.includes(t));
  const others = supportedAgents.filter(t => !POPULAR_AGENTS.includes(t));

  const createAgentAction = (type: string): ContextMenuAction => ({
    id: `switch-agent-${type}`,
    label: getAgentDisplayName(type),
    icon: agentIcons[type] || '🔧',
  });

  const popularActions = popular.map(createAgentAction);
  const otherActions = others.map(createAgentAction);

  return {
    id: 'switch-agent',
    label: 'Change Agent',
    icon: '🔄',
    submenu: [
      ...popularActions,
      { type: 'separator' } as any,
      ...otherActions,
      { type: 'separator' } as any,
      {
        id: 'switch-agent-none',
        label: 'None (Plain Terminal)',
        icon: '❌',
      },
    ],
  };
};

const defaultActions: Action[] = [
  { id: 'copy', label: 'Copy', icon: '📋', shortcut: 'Ctrl+C' },
  { id: 'paste', label: 'Paste', icon: '📄', shortcut: 'Ctrl+V' },
  { id: 'select-all', label: 'Select All', icon: '☰', shortcut: 'Ctrl+A' },
  { type: 'separator' } as any,
  { id: 'split-horizontal', label: 'Split Horizontal', icon: '⬌' },
  { id: 'split-vertical', label: 'Split Vertical', icon: '⬍' },
  { id: 'toggle-layout', label: 'Toggle Layout', icon: '⇄', shortcut: 'Swap Rows/Cols' },
  { type: 'separator' } as any,
  buildAgentSubmenu(),
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
  currentAgentType,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuTriggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = React.useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = React.useState({ x: 0, y: 0 });
  const submenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
    };
  }, [onClose]);

  const handleActionClick = (actionId: string) => {
    onAction(actionId);
    onClose();
  };

  const showSubmenu = (actionId: string, index: number, element: HTMLElement) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    const rect = element.getBoundingClientRect();
    const submenuWidth = 220;
    
    // Calculate position relative to viewport with boundary checks
    let newX = rect.right + 4; // Small gap from parent
    let newY = rect.top;
    
    // Check if submenu would go off right edge - position to left instead
    if (rect.right + submenuWidth > window.innerWidth - 8) {
      newX = rect.left - submenuWidth - 4;
    }
    
    // Ensure submenu doesn't go off bottom
    const submenuMaxHeight = 400;
    if (rect.top + submenuMaxHeight > window.innerHeight - 8) {
      newY = window.innerHeight - submenuMaxHeight - 8;
    }
    
    // Ensure submenu doesn't go off top
    if (newY < 8) {
      newY = 8;
    }
    
    setSubmenuPosition({ x: newX, y: newY });
    setActiveSubmenu(actionId);
    setHoveredIndex(index);
  };

  const hideSubmenu = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
      setHoveredIndex(null);
    }, 300);
  };

  const cancelHideSubmenu = () => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
      submenuTimeoutRef.current = null;
    }
  };

  // Initialize refs array
  submenuTriggerRefs.current = new Array(actions.length).fill(null);

  // Calculate menu position to keep it within viewport
  const menuWidth = 220;
  const menuHeight = actions.length * 34 + 8;

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

        const hasSubmenu = 'submenu' in action;
        const isSubmenuOpen = activeSubmenu === action.id;

        return (
          <div key={action.id} style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasSubmenu) {
                  // Toggle submenu on click
                  const element = submenuTriggerRefs.current[index];
                  if (element && activeSubmenu === action.id) {
                    setActiveSubmenu(null);
                    setHoveredIndex(null);
                  } else if (element) {
                    cancelHideSubmenu();
                    showSubmenu(action.id, index, element);
                  }
                } else {
                  handleActionClick(action.id);
                }
              }}
              onMouseEnter={() => {
                if (hasSubmenu) {
                  const element = submenuTriggerRefs.current[index];
                  if (element) {
                    cancelHideSubmenu();
                    showSubmenu(action.id, index, element);
                  }
                } else if (!(action as ContextMenuAction).disabled) {
                  setHoveredIndex(index);
                }
              }}
              onMouseLeave={hideSubmenu}
              ref={(el) => { submenuTriggerRefs.current[index] = el; }}
              disabled={(action as ContextMenuAction).disabled}
              style={{
                ...styles.actionButton,
                ...((action as ContextMenuAction).danger ? styles.dangerButton : {}),
                ...((action as ContextMenuAction).disabled ? styles.disabledButton : {}),
                ...(hoveredIndex === index && !(action as ContextMenuAction).disabled ? styles.hoverButton : {}),
                ...(isSubmenuOpen ? styles.activeSubmenuButton : {}),
              }}
            >
              {action.icon && <span style={styles.icon}>{action.icon}</span>}
              <span style={styles.label}>{action.label}</span>
              {(action as ContextMenuAction).shortcut && (
                <span style={styles.shortcut}>{(action as ContextMenuAction).shortcut}</span>
              )}
              {hasSubmenu && (
                <span style={{
                  ...styles.submenuArrow,
                  ...(isSubmenuOpen ? styles.activeSubmenuArrow : {}),
                }}>▶</span>
              )}
            </button>
            {hasSubmenu && isSubmenuOpen && (
              <div
                onMouseEnter={cancelHideSubmenu}
                onMouseLeave={hideSubmenu}
                style={{
                  ...styles.submenu,
                  left: submenuPosition.x,
                  top: submenuPosition.y,
                }}
              >
                {action.submenu.map((subAction, subIndex) => {
                  if ((subAction as any).type === 'separator') {
                    return <div key={subIndex} style={styles.submenuSeparator} />;
                  }
                  // Check if this is the current agent
                  const agentType = subAction.id.replace('switch-agent-', '');
                  const isCurrentAgent = currentAgentType === agentType;

                  return (
                    <button
                      key={subAction.id}
                      onClick={() => handleActionClick(subAction.id)}
                      style={{
                        ...styles.submenuAction,
                        ...(hoveredIndex === `sub-${index}-${subIndex}` ? styles.hoverButton : {}),
                        ...(isCurrentAgent ? styles.currentAgentAction : {}),
                      }}
                      onMouseEnter={() => setHoveredIndex(`sub-${index}-${subIndex}` as any)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      title={isCurrentAgent ? 'Current agent' : undefined}
                    >
                      {isCurrentAgent && <span style={styles.checkmark}>✓</span>}
                      {!isCurrentAgent && <span style={styles.emptyIcon} />}
                      {subAction.icon && <span style={styles.icon}>{subAction.icon}</span>}
                      <span style={styles.label}>{subAction.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
    padding: '4px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    minWidth: '180px',
  },
  separator: {
    height: '1px',
    backgroundColor: '#45475a',
    margin: '4px 0',
  },
  submenuSeparator: {
    height: '1px',
    backgroundColor: '#45475a',
    margin: '4px 0',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 10px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '12px',
    color: '#cdd6f4',
    transition: 'background-color 0.15s',
    position: 'relative',
  },
  activeSubmenuButton: {
    backgroundColor: '#313244',
  },
  submenuArrow: {
    fontSize: '10px',
    color: '#6c7086',
    marginLeft: 'auto',
  },
  activeSubmenuArrow: {
    color: '#89b4fa',
  },
  submenu: {
    position: 'fixed',
    zIndex: 10001,
    backgroundColor: '#1e1e2e',
    border: '1px solid #45475a',
    borderRadius: '8px',
    padding: '4px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    minWidth: '200px',
    maxWidth: '250px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  submenuAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '6px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '12px',
    color: '#cdd6f4',
    transition: 'background-color 0.15s',
  },
  currentAgentAction: {
    backgroundColor: '#313244',
    color: '#89b4fa',
  },
  checkmark: {
    fontSize: '12px',
    color: '#89b4fa',
    width: '14px',
    display: 'inline-flex',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  emptyIcon: {
    width: '14px',
    display: 'inline-flex',
    justifyContent: 'center',
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
    fontSize: '10px',
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
