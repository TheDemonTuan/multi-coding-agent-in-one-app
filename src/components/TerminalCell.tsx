import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { TerminalPane, AgentType } from '../types/workspace';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { TerminalContextMenu } from './TerminalContextMenu';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { TerminalSearch } from './TerminalSearch';

// Theme constants
const DARK_THEME = {
  background: '#0c0c0c',
  foreground: '#cccccc',
  cursor: '#cccccc',
  black: '#0c0c0c',
  red: '#c50f1f',
  green: '#13a10e',
  yellow: '#c19c00',
  blue: '#0037da',
  magenta: '#881798',
  cyan: '#3a96dd',
  white: '#cccccc',
  brightBlack: '#767676',
  brightRed: '#ea5848',
  brightGreen: '#16c60c',
  brightYellow: '#f9f1a5',
  brightBlue: '#3b78ff',
  brightMagenta: '#b4009e',
  brightCyan: '#61d6d6',
  brightWhite: '#f2f2f2',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#000000',
  cursor: '#000000',
  black: '#000000',
  red: '#800000',
  green: '#008000',
  yellow: '#808000',
  blue: '#000080',
  magenta: '#800080',
  cyan: '#008080',
  white: '#c0c0c0',
  brightBlack: '#808080',
  brightRed: '#ea5848',
  brightGreen: '#00ff00',
  brightYellow: '#ffff00',
  brightBlue: '#0000ff',
  brightMagenta: '#ff00ff',
  brightCyan: '#00ffff',
  brightWhite: '#ffffff',
};

const AGENT_ICONS: Record<AgentType, string> = {
  'claude-code': '🤖',
  'opencode': '📦',
  'droid': '⚡',
  'none': '',
};

interface TerminalCellProps {
  terminal: TerminalPane;
  isActive: boolean;
  onActivate: () => void;
  onSplit?: (direction: 'horizontal' | 'vertical') => void;
  onClear?: () => void;
}

const agentIcons = AGENT_ICONS;

export const TerminalCell: React.FC<TerminalCellProps> = ({
  terminal,
  isActive,
  onActivate,
  onSplit,
  onClear,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasInitializedRef = useRef(false);

  const listenersRef = useRef<{
    unsubscribeData?: () => void;
    unsubscribeStarted?: () => void;
    unsubscribeExit?: () => void;
    unsubscribeError?: () => void;
  }>({});

  const [hasStarted, setHasStarted] = useState(false);
  const theme = useWorkspaceStore((state: any) => state.theme);
  const { updateTerminalStatus, setTerminalProcessId, currentWorkspace } = useWorkspaceStore();

  const [unreadCount, setUnreadCount] = useState(0);
  const isScrolledUp = unreadCount > 0;

  const [searchOpen, setSearchOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
      });
    }
  }, []);

  const handleContextAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'copy':
        if (terminalRef.current) {
          terminalRef.current.selectAll();
          const selectedText = terminalRef.current.getSelection();
          if (selectedText) {
            navigator.clipboard.writeText(selectedText);
            terminalRef.current.clearSelection();
          }
        }
        break;
      case 'paste':
        if (terminalRef.current) {
          navigator.clipboard.readText().then((text) => {
            (window as any).electronAPI?.terminalWrite(terminal.id, text);
          });
        }
        break;
      case 'select-all':
        terminalRef.current?.selectAll();
        break;
      case 'split-horizontal':
        onSplit?.('horizontal');
        break;
      case 'split-vertical':
        onSplit?.('vertical');
        break;
      case 'clear':
        terminalRef.current?.clear();
        break;
      case 'reset':
        console.log('Reset terminal requested');
        break;
    }
  }, [onSplit, terminal.id]);

  const handleScrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollToBottom();
      setUnreadCount(0);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (terminalRef.current) {
      const buffer = terminalRef.current.buffer.active;
      const isAtBottom = buffer.viewportY >= buffer.baseY - buffer.viewportY;

      if (isAtBottom) {
        setUnreadCount(0);
      }
    }
  }, []);

  // Keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }

      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, searchOpen]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filePaths = Array.from(e.dataTransfer.files).map((f: any) => f.path).filter(Boolean);

      if (filePaths.length > 0 && terminalRef.current) {
        const pathString = filePaths.join(' ');
        (window as any).electronAPI?.terminalWrite(terminal.id, pathString);
      }
    }
  }, [terminal.id]);

  const handleSearch = useCallback((query: string, options: { caseSensitive: boolean; regex: boolean; wholeWord: boolean }) => {
    if (!terminalRef.current || !searchAddonRef.current) return;

    if (!query) {
      searchAddonRef.current.clearDecorations();
      setMatchCount(0);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      const found = searchAddonRef.current.findNext(query, {
        caseSensitive: options.caseSensitive,
        matchWholeWord: options.wholeWord,
        regex: options.regex,
      } as any);

      if (found) {
        setMatchCount(1);
        setCurrentMatchIndex(0);
      } else {
        setMatchCount(0);
      }
    } catch (err: any) {
      console.error('Search error:', err);
    }
  }, []);

  const handleFindNext = useCallback(() => {
    if (!terminalRef.current || !searchAddonRef.current) return;
    searchAddonRef.current.findNext('');
  }, []);

  const handleFindPrevious = useCallback(() => {
    if (!terminalRef.current || !searchAddonRef.current) return;
    searchAddonRef.current.findPrevious('');
  }, []);

  // Initialize terminal - runs ONCE per terminal instance
  useEffect(() => {
    if (!containerRef.current) return;
    if (hasInitializedRef.current) return; // Prevent re-initialization

    if (!(window as any).electronAPI) {
      updateTerminalStatus(terminal.id, 'error');
      return;
    }

    console.log(`[TerminalCell ${terminal.id}] Initializing terminal`);

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    hasInitializedRef.current = true;

    term.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;

    resizeObserverRef.current = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current!.fit();
        (window as any).electronAPI.terminalResize(terminal.id, terminalRef.current.cols, terminalRef.current.rows);
      }
    });
    resizeObserverRef.current.observe(containerRef.current);

    term.onScroll(handleScroll);

    // Show agent startup message
    if (terminal.agent?.enabled && terminal.agent.type !== 'none') {
      const agentIcon = agentIcons[terminal.agent.type] || '🔧';
      term.write(`\x1b[36m${agentIcon} Starting ${terminal.agent.type}...\x1b[0m\r\n`);
    }

    // Setup event listeners
    listenersRef.current.unsubscribeData = (window as any).electronAPI.onTerminalData(({ id, data }: { id: string; data: string }) => {
      if (id === terminal.id && terminalRef.current) {
        terminalRef.current.write(data);

        const buffer = terminalRef.current.buffer.active;
        if (buffer.viewportY < buffer.baseY - buffer.viewportY) {
          setUnreadCount((prev: number) => prev + 1);
        }
      }
    });

    listenersRef.current.unsubscribeStarted = (window as any).electronAPI.onTerminalStarted(({ id }: { id: string }) => {
      if (id === terminal.id) {
        updateTerminalStatus(terminal.id, 'running');
        setHasStarted(true);
        terminalRef.current?.focus();
      }
    });

    listenersRef.current.unsubscribeExit = (window as any).electronAPI.onTerminalExit(({ id, code }: { id: string; code: number }) => {
      if (id === terminal.id) {
        terminalRef.current?.write(`\r\n\x1b[33mTerminal exited with code ${code}\x1b[0m\r\n`);
        updateTerminalStatus(terminal.id, 'stopped');
      }
    });

    listenersRef.current.unsubscribeError = (window as any).electronAPI.onTerminalError(({ id, error }: { id: string; error: string }) => {
      if (id === terminal.id) {
        terminalRef.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        updateTerminalStatus(terminal.id, 'error');
      }
    });

    term.onData((data: string) => {
      (window as any).electronAPI.terminalWrite(terminal.id, data);
    });

    // Spawn terminal process
    const workspaceId = currentWorkspace?.id;

    const spawnPromise = terminal.agent?.enabled && terminal.agent.type !== 'none'
      ? (window as any).electronAPI.spawnTerminalWithAgent(terminal.id, terminal.cwd, terminal.agent, workspaceId)
      : (window as any).electronAPI.spawnTerminal(terminal.id, terminal.cwd, workspaceId);

    spawnPromise
      .then((result: any) => {
        if (result?.pid) {
          setTerminalProcessId(terminal.id, result.pid);
          console.log(`[TerminalCell ${terminal.id}] Spawned process with PID: ${result.pid}`);
        }
      })
      .catch((err: any) => {
        updateTerminalStatus(terminal.id, 'error');
        term.write(`\r\n\x1b[31mFailed to start terminal: ${err}\x1b[0m\r\n`);
      });

    // Cleanup - only on actual unmount (component removed from DOM entirely)
    return () => {
      console.log(`[TerminalCell ${terminal.id}] Cleaning up terminal`);

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      listenersRef.current.unsubscribeData?.();
      listenersRef.current.unsubscribeStarted?.();
      listenersRef.current.unsubscribeExit?.();
      listenersRef.current.unsubscribeError?.();
      listenersRef.current = {};

      if (terminalRef.current) {
        try {
          terminalRef.current.dispose();
        } catch (err: any) {
          console.error(`[TerminalCell ${terminal.id}] Error disposing terminal:`, err);
        }
        terminalRef.current = null;
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []); // Empty deps - only run once per terminal lifetime

  // Update theme when changed
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
  }, [theme]);

  // Handle visibility change - fit and focus when becoming active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current!.fit();
          (window as any).electronAPI.terminalResize(
            terminal.id,
            terminalRef.current.cols,
            terminalRef.current.rows
          );
          terminalRef.current.scrollToBottom();
          terminalRef.current.focus();
        }
      }, 100);
    }
  }, [isActive, terminal.id]);

  // Re-fit terminal when workspace becomes visible (using currentWorkspace.id change)
  useEffect(() => {
    if (terminalRef.current && fitAddonRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        fitAddonRef.current!.fit();
        (window as any).electronAPI.terminalResize(
          terminal.id,
          terminalRef.current!.cols,
          terminalRef.current!.rows
        );
      }, 50);
    }
  }, [currentWorkspace?.id, terminal.id]);

  const agentIcon = terminal.agent?.enabled && terminal.agent.type !== 'none'
    ? agentIcons[terminal.agent.type]
    : '';

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && isHovered && !isActive) {
      e.preventDefault();
      e.stopPropagation();
      onActivate();
    }
  }, [isHovered, isActive, onActivate]);

  return (
    <div
      className={`terminal-cell ${isActive ? 'active' : ''}`}
      onClick={onActivate}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleContainerKeyDown}
      tabIndex={-1}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: isActive ? '1px solid #89b4fa' : isHovered ? '1px solid #89b4fa80' : '1px solid #45475a60',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: theme === 'dark' ? '#1e1e2e' : '#ffffff',
        position: 'relative',
        transition: 'border-color 0.15s ease',
        outline: 'none',
        height: '100%',
      }}
    >
      <div
        className="terminal-header"
        style={{
          padding: '4px 8px',
          backgroundColor: theme === 'dark' ? '#313244' : '#e0e0e0',
          borderBottom: '1px solid #45475a40',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {agentIcon && <span style={{ fontSize: '14px' }}>{agentIcon}</span>}
          <span style={{ fontSize: '12px', fontWeight: 600 }}>
            {terminal.title}
          </span>
          {terminal.agent?.enabled && terminal.agent.type !== 'none' && (
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              backgroundColor: '#89b4fa20',
              color: '#89b4fa',
              borderRadius: '4px',
              fontWeight: 600,
            }}>
              {terminal.agent.type.toUpperCase()}
            </span>
          )}
          {isHovered && !isActive && (
            <span style={{
              fontSize: '9px',
              padding: '2px 4px',
              backgroundColor: '#89b4fa40',
              color: '#89b4fa',
              borderRadius: '3px',
              fontWeight: 600,
              marginLeft: '4px',
            }}>
              Tab để focus
            </span>
          )}
        </div>
        <div className="terminal-status">
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                terminal.status === 'running'
                  ? '#a6e3a1'
                  : terminal.status === 'error'
                  ? '#f38ba8'
                  : '#6c7086',
              marginRight: '4px',
            }}
          />
          <span style={{ fontSize: '11px', color: '#6c7086' }}>
            {terminal.status}
          </span>
        </div>
      </div>

      {searchOpen && (
        <TerminalSearch
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearch={handleSearch}
          onFindNext={handleFindNext}
          onFindPrevious={handleFindPrevious}
          matchCount={matchCount}
          currentMatchIndex={currentMatchIndex}
        />
      )}

      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '2px',
          minHeight: '100px',
          position: 'relative',
          backgroundColor: isDragOver ? 'rgba(137, 180, 250, 0.2)' : 'transparent',
          transition: 'background-color 0.2s',
          overflow: 'hidden',
        }}
      >
        {isDragOver && (
          <div style={styles.dragOverlay}>
            <span style={styles.dragText}>Drop files to insert paths</span>
          </div>
        )}
      </div>

      <ScrollToBottomButton
        isVisible={isScrolledUp}
        onClick={handleScrollToBottom}
        unreadCount={unreadCount > 0 ? unreadCount : undefined}
      />

      {contextMenu.visible && (
        <TerminalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  },
  dragText: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#89b4fa',
    backgroundColor: 'rgba(30, 30, 46, 0.9)',
    padding: '16px 24px',
    borderRadius: '8px',
    border: '2px dashed #89b4fa',
  },
};
