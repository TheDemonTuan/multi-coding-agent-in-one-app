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

// Theme constants - VS Code / xterm.js recommended dark terminal colors
const DARK_THEME = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#383a42',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
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
  onClose?: () => void;
}

const agentIcons = AGENT_ICONS;

export const TerminalCell: React.FC<TerminalCellProps> = ({
  terminal,
  isActive,
  onActivate,
  onSplit,
  onClear,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasInitializedRef = useRef(false);
  const hasInitiallyFitRef = useRef(false);
  const dataBufferRef = useRef<string[]>([]);
  const isInitialFitCompleteRef = useRef(false);

  const { restartTerminal } = useWorkspaceStore();

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
  const terminalsCount = currentWorkspace?.terminals.length || 0;

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  
  const [vnPatched, setVnPatched] = useState(false);

  // Check Vietnamese IME patch status for Claude Code terminals
  React.useEffect(() => {
    if (terminal.agent?.type === 'claude-code') {
      const checkPatch = async () => {
        try {
          const status = await window.electronAPI?.checkVietnameseImePatchStatus();
          setVnPatched(status?.isPatched || false);
        } catch (err) {
          console.error('[TerminalCell] Failed to check VN patch:', err);
        }
      };
      checkPatch();
      
      // Re-check when patch is applied (for auto-patch)
      const unsubscribe = window.electronAPI?.onVietnameseImePatchApplied(() => {
        setTimeout(() => checkPatch(), 1500); // Wait 1.5s for patch to complete
      });
      
      return () => unsubscribe?.();
    }
  }, [terminal.agent?.type]);

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
      case 'toggle-layout':
        // Toggle between vertical and horizontal layout
        if (currentWorkspace) {
          useWorkspaceStore.getState().updateWorkspace(currentWorkspace.id, {
            columns: currentWorkspace.rows,
            rows: currentWorkspace.columns,
          });
        }
        break;
      case 'clear':
        terminalRef.current?.clear();
        break;
      case 'restart':
        terminalRef.current?.clear();
        restartTerminal(terminal.id);
        break;
      case 'remove-terminal':
        onClose?.();
        break;
    }
  }, [onSplit, onClose, terminal.id, restartTerminal, currentWorkspace]);

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

  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null);
  const fitDebounceRef = useRef<NodeJS.Timeout | null>(null);

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
    if (hasInitializedRef.current) return;

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

    // Delay initial fit to ensure container has proper dimensions
    // This prevents garbled/corrupted text rendering on first load
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Check container has valid dimensions before fitting
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          fitAddon.fit();
          // Update PTY with initial size
          const { cols, rows } = term;
          lastDimensionsRef.current = { cols, rows };
          (window as any).electronAPI?.terminalResize(terminal.id, cols, rows);

          // Mark initial fit as complete and flush buffered data
          isInitialFitCompleteRef.current = true;
          dataBufferRef.current.forEach(data => term.write(data));
          dataBufferRef.current = [];
          hasInitiallyFitRef.current = true;
        }
      });
    });

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== 'keydown') return true;

      // Ctrl+C or Ctrl+Shift+C: copy selected text instead of sending SIGINT
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = term.getSelection();
        if (selection) {
          e.preventDefault();
          navigator.clipboard.writeText(selection);
          term.clearSelection();
          return false;
        }
      }

      // Ctrl+V or Ctrl+Shift+V: paste from clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          (window as any).electronAPI?.terminalWrite(terminal.id, text);
        });
        return false;
      }

      return true;
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    hasInitializedRef.current = true;

    term.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;

    // Store initial dimensions so ResizeObserver won't fire a resize on first observation
    lastDimensionsRef.current = { cols: term.cols, rows: term.rows };

    resizeObserverRef.current = new ResizeObserver(() => {
      // Skip resize until initial fit is complete
      if (!hasInitiallyFitRef.current) return;

      if (fitDebounceRef.current) {
        clearTimeout(fitDebounceRef.current);
      }

      fitDebounceRef.current = setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRef.current;

          if (!lastDimensionsRef.current ||
              lastDimensionsRef.current.cols !== cols ||
              lastDimensionsRef.current.rows !== rows) {
            lastDimensionsRef.current = { cols, rows };
            (window as any).electronAPI.terminalResize(terminal.id, cols, rows);
          }
        }
      }, 100);
    });
    resizeObserverRef.current.observe(containerRef.current);

    term.onScroll(handleScroll);

    if (terminal.agent?.enabled && terminal.agent.type !== 'none') {
      const agentIcon = agentIcons[terminal.agent.type] || '🔧';
      term.write(`\x1b[36m${agentIcon} Starting ${terminal.agent.type}...\x1b[0m\r\n`);
    }

    // Setup event listeners
    listenersRef.current.unsubscribeData = (window as any).electronAPI.onTerminalData(({ id, data }: { id: string; data: string }) => {
      if (id === terminal.id && terminalRef.current) {
        // Buffer data until initial fit is complete to prevent garbled output
        if (!isInitialFitCompleteRef.current) {
          dataBufferRef.current.push(data);
          return;
        }
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

    listenersRef.current.unsubscribeExit = (window as any).electronAPI.onTerminalExit(({ id, code, signal }: { id: string; code: number | null; signal?: string }) => {
      if (id === terminal.id) {
        const exitMessage = code !== null && code !== undefined
          ? `Terminal exited with code ${code}`
          : signal
            ? `Terminal exited (signal: ${signal})`
            : 'Terminal exited';
        terminalRef.current?.write(`\r\n\x1b[33m${exitMessage}\x1b[0m\r\n`);
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

    return () => {
      console.log(`[TerminalCell ${terminal.id}] Cleaning up terminal`);

      // Kill PTY process in main process before disposing UI
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        (window as any).electronAPI.terminalKill(terminal.id).catch((err: any) => {
          console.warn(`[TerminalCell ${terminal.id}] Failed to kill terminal process:`, err);
        });
      }

      if (fitDebounceRef.current) {
        clearTimeout(fitDebounceRef.current);
      }

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

      // Reset initialization flags
      hasInitializedRef.current = false;
      hasInitiallyFitRef.current = false;
      isInitialFitCompleteRef.current = false;
      dataBufferRef.current = [];
    };
  }, []);

  // Update theme when changed
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
  }, [theme]);

  // When becoming active: only focus the terminal, do NOT call fit().
  // Border width is now constant (2px) so container size doesn't change on focus switch.
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.scrollToBottom();
      terminalRef.current.focus();
    }
  }, [isActive, terminal.id]);

  // Re-fit terminal only when switching workspaces (not when switching terminals within same workspace)
  const lastWorkspaceIdRef = useRef<string | null>(currentWorkspace?.id ?? null);
  useEffect(() => {
    const newId = currentWorkspace?.id ?? null;
    if (newId !== lastWorkspaceIdRef.current) {
      lastWorkspaceIdRef.current = newId;
      if (terminalRef.current && fitAddonRef.current) {
        setTimeout(() => {
          fitAddonRef.current?.fit();
        }, 50);
      }
    }
  }, [currentWorkspace?.id]);

  const agentIcon = terminal.agent?.enabled && terminal.agent.type !== 'none'
    ? agentIcons[terminal.agent.type]
    : '';

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !isActive) {
      e.preventDefault();
      e.stopPropagation();
      onActivate();
    }
  }, [isActive, onActivate]);

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
  }, [onClose]);

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
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: isActive ? '2px solid #89b4fa' : '2px solid #45475a60',
        borderRadius: '4px',
        overflow: 'hidden',
        backgroundColor: theme === 'dark' ? '#1e1e2e' : '#ffffff',
        position: 'relative',
        outline: 'none',
        height: '100%',
        boxSizing: 'border-box',
        boxShadow: isActive
          ? '0 0 0 2px rgba(137, 180, 250, 0.3), 0 4px 12px rgba(137, 180, 250, 0.2)'
          : 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {agentIcon && <span style={{ fontSize: '14px' }}>{agentIcon}</span>}
          <span style={{ fontSize: '12px', fontWeight: 600 }}>
            {terminal.title}
          </span>
          {terminal.agent?.type === 'claude-code' && vnPatched && (
            <span style={{fontSize:'10px', marginLeft:'4px'}} title="Vietnamese IME Patched">🇻🇳</span>
          )}
          {terminal.agent?.enabled && terminal.agent.type !== 'none' && (
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              backgroundColor: '#45475a40',
              color: '#a6adc8',
              borderRadius: '4px',
              fontWeight: 600,
            }}>
              {terminal.agent.type.toUpperCase()}
            </span>
          )}
          {!isActive && (
            <span
              className="tab-to-focus-hint"
              style={{
                fontSize: '9px',
                padding: '2px 4px',
                backgroundColor: '#89b4fa40',
                color: '#89b4fa',
                borderRadius: '3px',
                fontWeight: 600,
                marginLeft: '4px',
                opacity: 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              Tab to focus
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          {terminalsCount > 1 && (
            <button
              className="close-button"
              onClick={handleCloseClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                padding: 0,
                border: 'none',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: '#a6adc8',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.15s ease',
                opacity: 0,
              }}
              title="Remove terminal"
            >
              ×
            </button>
          )}
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
