import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import './TerminalCell.css';
import { TerminalPane, AgentType } from '../../types/workspace';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { TerminalContextMenu } from './TerminalContextMenu';
import { ScrollToBottomButton } from '../ui/ScrollToBottomButton';
import { TerminalSearch } from './TerminalSearch';
import { parseOSC133, CommandBlockTracker } from '../../lib/osc133Parser';
import { backendAPI, isWailsAvailable } from '../../services/wails-bridge';

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
  'gemini-cli': '✨',
  'cursor': '🎯',
  'codex': '🧠',
  'oh-my-pi': '🥧',
  'aider': '🚀',
  'goose': '🪿',
  'warp': '⚡',
  'amp': '🔥',
  'kiro': '☁️',
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

// Memoize TerminalCell to prevent unnecessary re-renders (VAL-PERF-005)
export const TerminalCell = React.memo<TerminalCellProps>(({
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
  const webLinksAddonRef = useRef<WebLinksAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasInitializedRef = useRef(false);
  const hasInitiallyFitRef = useRef(false);
  const dataBufferRef = useRef<string[]>([]);
  const isInitialFitCompleteRef = useRef(false);
  const commandBlockTrackerRef = useRef<CommandBlockTracker | null>(null);

  // Actions — stable references in Zustand, destructuring is fine here
  const { restartTerminal, getNextWorkspace, getPreviousWorkspace, setCurrentWorkspace, switchTerminalAgent } = useWorkspaceStore();
  const { updateTerminalStatus, setTerminalProcessId, isTerminalRestarting } = useWorkspaceStore();

  // Individual selectors for reactive state (subscribes to changes)
  const theme = useWorkspaceStore((state: any) => state.theme);
  const currentWorkspace = useWorkspaceStore((state: any) => state.currentWorkspace);

  const listenersRef = useRef<{
    unsubscribeData?: () => void;
    unsubscribeStarted?: () => void;
    unsubscribeExit?: () => void;
    unsubscribeError?: () => void;
  }>({});

  // Store xterm.js event disposables (VAL-MEM-004)
  // xterm.js returns IDisposable objects from onEvent methods, but void from attachCustomKeyEventHandler
  const xtermDisposablesRef = useRef<{
    onDataDisposable?: { dispose(): void };
    onScrollDisposable?: { dispose(): void };
    // attachCustomKeyEventHandler returns void, so we store a cleanup flag instead
    customKeyHandlerCleanup?: () => void;
  }>({});

  const [hasStarted, setHasStarted] = useState(false);

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
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const errorToastTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Check Vietnamese IME patch status for Claude Code terminals
  React.useEffect(() => {
    if (terminal.agent?.type === 'claude-code') {
      const checkPatch = async () => {
        try {
          const status = await backendAPI.checkVietnameseImePatchStatus();
          setVnPatched(status?.isPatched || false);
        } catch (err) {
          console.error('[TerminalCell] Failed to check VN patch:', err);
        }
      };
      checkPatch();

      // Re-check when patch is applied (for auto-patch)
      const unsubscribe = backendAPI.onVietnameseImePatchApplied(() => {
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
            backendAPI.terminalWrite(terminal.id, text);
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
        commandBlockTrackerRef.current?.clear();
        break;
      case 'restart':
        terminalRef.current?.clear();
        restartTerminal(terminal.id);
        break;
      case 'remove-terminal':
        onClose?.();
        break;
      // Agent switch actions
      case 'switch-agent-claude-code':
        switchTerminalAgent(terminal.id, 'claude-code');
        break;
      case 'switch-agent-opencode':
        switchTerminalAgent(terminal.id, 'opencode');
        break;
      case 'switch-agent-droid':
        switchTerminalAgent(terminal.id, 'droid');
        break;
      case 'switch-agent-gemini-cli':
        switchTerminalAgent(terminal.id, 'gemini-cli');
        break;
      case 'switch-agent-cursor':
        switchTerminalAgent(terminal.id, 'cursor');
        break;
      case 'switch-agent-codex':
        switchTerminalAgent(terminal.id, 'codex');
        break;
      case 'switch-agent-oh-my-pi':
        switchTerminalAgent(terminal.id, 'oh-my-pi');
        break;
      case 'switch-agent-aider':
        switchTerminalAgent(terminal.id, 'aider');
        break;
      case 'switch-agent-goose':
        switchTerminalAgent(terminal.id, 'goose');
        break;
      case 'switch-agent-warp':
        switchTerminalAgent(terminal.id, 'warp');
        break;
      case 'switch-agent-amp':
        switchTerminalAgent(terminal.id, 'amp');
        break;
      case 'switch-agent-kiro':
        switchTerminalAgent(terminal.id, 'kiro');
        break;
      case 'switch-agent-none':
        switchTerminalAgent(terminal.id, 'none');
        break;
    }
  }, [onSplit, onClose, terminal.id, restartTerminal, currentWorkspace, switchTerminalAgent]);

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
        backendAPI.terminalWrite(terminal.id, pathString);
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

    if (!isWailsAvailable() && typeof (window as any).go === 'undefined') {
      // Allow stub bridge in dev; only bail out if neither Wails nor stub is ready
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Optimized terminal options for better performance (VAL-PERF-008)
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
      allowProposedApi: true,
      // Configure scrollback buffer to prevent memory bloat (VAL-PERF-002)
      scrollback: 1000, // Limit to 1000 lines for optimal memory usage

      // Performance optimizations (VAL-PERF-008)
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1, // Skip contrast recalculation for performance

      // Smooth scrolling improvements
      fastScrollSensitivity: 5,
      smoothScrollDuration: 125,

      // Windows/ConPTY specific fixes to prevent text duplication/scrambling
      // macOptionIsMeta: false prevents double character input on some systems
      macOptionIsMeta: false,
      // Better handling of wide characters (CJK, emoji)
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    term.open(containerRef.current);

    // Try to enable GPU-accelerated WebGL rendering (up to ~900% faster than Canvas).
    // Falls back gracefully to Canvas 2D renderer if WebGL is unavailable
    // (e.g., headless environments, GPU virtualization, or driver issues).
    // Note: On Windows with ConPTY, WebGL can sometimes cause text scrambling,
    // so we only enable it on non-Windows platforms.
    const isWindows = navigator.platform.toLowerCase().includes('win');
    if (!isWindows) {
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
          webglAddonRef.current = null;
        });
        term.loadAddon(webglAddon);
        webglAddonRef.current = webglAddon;
      } catch (err) {
      }
    }

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
          backendAPI.terminalResize(terminal.id, cols, rows);

          // Mark initial fit as complete and flush buffered data
          isInitialFitCompleteRef.current = true;
          dataBufferRef.current.forEach(data => term.write(data));
          dataBufferRef.current = [];
          hasInitiallyFitRef.current = true;
        }
      });
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    webLinksAddonRef.current = webLinksAddon;
    searchAddonRef.current = searchAddon;
    hasInitializedRef.current = true;

    // Initialize OSC 133 command block tracker — uses live terminal row position
    commandBlockTrackerRef.current = new CommandBlockTracker(
      () => terminalRef.current?.buffer.active.baseY ?? 0
    );

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
            // Add small delay to let xterm.js finish rendering before notifying PTY
            // This helps prevent text scrambling during resize on Windows ConPTY
            setTimeout(() => {
              backendAPI.terminalResize(terminal.id, cols, rows);
            }, 10);
          }
        }
      }, 200); // 200ms debounce to prevent rapid resize events (increased from 150ms)
    });
    resizeObserverRef.current.observe(containerRef.current);

    // Store onScroll handler disposable (VAL-MEM-004)
    xtermDisposablesRef.current.onScrollDisposable = term.onScroll(handleScroll);

    if (terminal.agent?.enabled && terminal.agent.type !== 'none') {
      const agentIcon = agentIcons[terminal.agent.type] || '🔧';
      term.write(`\x1b[36m${agentIcon} Starting ${terminal.agent.type}...\x1b[0m\r\n`);
    }

    // Setup event listeners (VAL-MEM-003)

    listenersRef.current.unsubscribeData = backendAPI.onTerminalData((event: { terminalId: string; data: string }) => {
      console.log('[TerminalCell] Received terminal-data event:', event.terminalId, 'length:', event.data?.length);
      if (event.terminalId === terminal.id && terminalRef.current) {
        // Debug logging
        console.log('[TerminalCell] Processing data for', event.terminalId, 'length:', event.data.length, 'fitComplete:', isInitialFitCompleteRef.current);
        
        // Fast-path: only invoke OSC 133 parser if escape sequence is present.
        // The regex scan avoids garbage on every keystroke in terminals that
        // don't emit shell-integration markers (the common case).
        const hasOSC = event.data.includes('\x1b]133;');
        let outputData = event.data;
        if (hasOSC) {
          const { cleaned, markers } = parseOSC133(event.data);
          if (markers.length > 0) {
            commandBlockTrackerRef.current?.processMarkers(markers);
            outputData = cleaned;
          }
        }

        // Buffer data until initial fit is complete to prevent garbled output
        if (!isInitialFitCompleteRef.current) {
          console.log('[TerminalCell] Buffering data, buffer size:', dataBufferRef.current.length);
          dataBufferRef.current.push(outputData);
          return;
        }
        terminalRef.current.write(outputData);

        const buffer = terminalRef.current.buffer.active;
        if (buffer.viewportY < buffer.baseY - buffer.viewportY) {
          setUnreadCount((prev: number) => prev + 1);
        }
      }
    });

    listenersRef.current.unsubscribeStarted = backendAPI.onTerminalStarted((event: { terminalId: string; pid?: number }) => {
      console.log('[TerminalCell] Received terminal-started event:', event.terminalId);
      if (event.terminalId === terminal.id) {
        console.log('[TerminalCell] Processing terminal-started for:', event.terminalId);
        updateTerminalStatus(terminal.id, 'running');
        setHasStarted(true);
        terminalRef.current?.focus();

        // Re-sync terminal dimensions with PTY after (re)start
        // New PTY starts with default cols/rows, but xterm may already be sized differently
        if (terminalRef.current && fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
            const { cols, rows } = terminalRef.current;
            backendAPI.terminalResize(terminal.id, cols, rows);
          } catch (err) {
          }
        }
      }
    });

    listenersRef.current.unsubscribeExit = backendAPI.onTerminalExit((event: { terminalId: string; code: number | null; signal?: string }) => {
      if (event.terminalId === terminal.id) {
        // Skip exit processing if terminal is restarting (prevents race condition setting status to stopped)
        if (isTerminalRestarting(terminal.id)) {
          return;
        }

        const exitMessage = event.code !== null && event.code !== undefined
          ? `Terminal exited with code ${event.code}`
          : event.signal
            ? `Terminal exited (signal: ${event.signal})`
            : 'Terminal exited';
        terminalRef.current?.write(`\r\n\x1b[33m${exitMessage}\x1b[0m\r\n`);
        updateTerminalStatus(terminal.id, 'stopped');
      }
    });


    listenersRef.current.unsubscribeError = backendAPI.onTerminalError((event: { terminalId: string; error: string }) => {
      console.log('[TerminalCell] Received terminal-error event:', event.terminalId, event.error);
      if (event.terminalId === terminal.id) {
        console.log('[TerminalCell] Processing error for terminal:', event.terminalId);
        terminalRef.current?.write(`\r\n\x1b[31m❌ Error: ${event.error}\x1b[0m\r\n`);
        updateTerminalStatus(terminal.id, 'error');
        setSpawnError(event.error);

        // Auto-hide error toast after 10 seconds
        const timer = setTimeout(() => setSpawnError(null), 10000);
        errorToastTimersRef.current.push(timer);
      }
    });

    // Store onData handler disposable (VAL-MEM-004)
    xtermDisposablesRef.current.onDataDisposable = term.onData((data: string) => {
      backendAPI.terminalWrite(terminal.id, data);
    });


    // Register custom key event handler (VAL-MEM-004)
    // attachCustomKeyEventHandler returns void, so we store a cleanup function
    let customKeyHandlerRegistered = true;
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Handler is no longer registered, don't process events
      if (!customKeyHandlerRegistered) return true;

      if (e.type !== 'keydown') return true;

      // Ctrl+Tab: Switch to next workspace
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const nextWs = getNextWorkspace();
        if (nextWs) {
          setCurrentWorkspace(nextWs);
          // Dispatch custom event to notify App.tsx to open workspace switcher modal
          window.dispatchEvent(new CustomEvent('open-workspace-switcher'));
        }
        return false;
      }

      // Ctrl+Shift+Tab: Switch to previous workspace
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const prevWs = getPreviousWorkspace();
        if (prevWs) {
          setCurrentWorkspace(prevWs);
          // Dispatch custom event to notify App.tsx to open workspace switcher modal
          window.dispatchEvent(new CustomEvent('open-workspace-switcher'));
        }
        return false;
      }

      // Ctrl+Shift+Up: navigate to previous command block (OSC 133)
      if (e.ctrlKey && e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const tracker = commandBlockTrackerRef.current;
        if (tracker && terminalRef.current) {
          const currentRow = terminalRef.current.buffer.active.viewportY;
          const promptRows = tracker.getPromptRows();
          const prevRow = [...promptRows].reverse().find(r => r < currentRow - 1);
          if (prevRow !== undefined) {
            terminalRef.current.scrollToLine(prevRow);
          }
        }
        return false;
      }

      // Ctrl+Shift+Down: navigate to next command block (OSC 133)
      if (e.ctrlKey && e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const tracker = commandBlockTrackerRef.current;
        if (tracker && terminalRef.current) {
          const currentRow = terminalRef.current.buffer.active.viewportY;
          const promptRows = tracker.getPromptRows();
          const nextRow = promptRows.find(r => r > currentRow + 1);
          if (nextRow !== undefined) {
            terminalRef.current.scrollToLine(nextRow);
          } else {
            terminalRef.current.scrollToBottom();
          }
        }
        return false;
      }

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
          backendAPI.terminalWrite(terminal.id, text);
        });
        return false;
      }

      return true;
    });

    // Store cleanup function to mark handler as unregistered
    xtermDisposablesRef.current.customKeyHandlerCleanup = () => {
      customKeyHandlerRegistered = false;
    };


    // Spawn terminal process
    const workspaceId = currentWorkspace?.id;

    // Timeout for terminal-started event (Change 3 from plan)
    const startTimeout = setTimeout(() => {
      // Only trigger timeout if terminal hasn't started yet
      if (!hasStarted) {
        updateTerminalStatus(terminal.id, 'error');
        const timeoutMsg = `Terminal ${terminal.agent?.type || 'process'} failed to start within 5 seconds`;
        setSpawnError(timeoutMsg);
        term.write(`\r\n\x1b[31m❌ ${timeoutMsg}\x1b[0m\r\n`);
        const timer = setTimeout(() => setSpawnError(null), 10000);
        errorToastTimersRef.current.push(timer);
      }
    }, 5000);

    const spawnPromise = terminal.agent?.enabled && terminal.agent.type !== 'none'
      ? backendAPI.spawnTerminalWithAgent(terminal.id, terminal.cwd, terminal.agent, workspaceId)
      : backendAPI.spawnTerminal(terminal.id, terminal.cwd, workspaceId);

    console.log('[TerminalCell] Spawn promise started for:', terminal.id, terminal.agent?.type);
    console.log('[TerminalCell] BackendAPI available:', isWailsAvailable());
    spawnPromise
      .then((result: any) => {
        console.log('[TerminalCell] Spawn promise resolved for:', terminal.id, result);
        // Clear timeout on spawn response
        clearTimeout(startTimeout);

        if (result?.pid) {
          console.log('[TerminalCell] Spawn succeeded with PID:', result.pid);
          setTerminalProcessId(terminal.id, result.pid);
          // Note: Don't update status to 'running' here - wait for terminal-started event
          // This ensures status is only updated when event is actually received
          console.log('[TerminalCell] Waiting for terminal-started event to update status');

          // Status reconciliation: query backend if we missed the terminal-started event
          setTimeout(() => {
            if (terminal.status === 'stopped') {
              backendAPI.getTerminalStatus(terminal.id).then((status) => {
                console.log('[TerminalCell] Status reconciliation:', terminal.id, status);
                if (status.exists && status.status === 'running') {
                  updateTerminalStatus(terminal.id, 'running');
                  setHasStarted(true);
                }
              });
            }
          }, 1000); // Wait 1s for event, then reconcile

        } else if (result?.success === false && result?.error) {
          // Handle validation errors from main process
          console.log('[TerminalCell] Spawn failed with error:', result.error);
          setSpawnError(result.error);
          updateTerminalStatus(terminal.id, 'error');
          term.write(`\r\n\x1b[31m❌ ${result.error}\x1b[0m\r\n`);
          const timer = setTimeout(() => setSpawnError(null), 10000);
          errorToastTimersRef.current.push(timer);
        } else {
          console.log('[TerminalCell] Spawn resolved with unexpected result:', result);
        }
      })
      .catch((err: any) => {
        console.log('[TerminalCell] Spawn promise rejected for:', terminal.id, err);
        // Clear timeout on spawn error
        clearTimeout(startTimeout);
        
        updateTerminalStatus(terminal.id, 'error');
        const errorMsg = err?.message || String(err);
        setSpawnError(errorMsg);
        term.write(`\r\n\x1b[31m❌ Failed to start terminal: ${errorMsg}\x1b[0m\r\n`);
        const timer = setTimeout(() => setSpawnError(null), 10000);
        errorToastTimersRef.current.push(timer);
      });

    return () => {


      // Clear all error toast timers to prevent memory leaks
      errorToastTimersRef.current.forEach(timer => clearTimeout(timer));
      errorToastTimersRef.current = [];

      // Clear any pending debounce timers first to prevent memory leaks
      if (fitDebounceRef.current) {
        clearTimeout(fitDebounceRef.current);
        fitDebounceRef.current = null;
      }

      // Disconnect ResizeObserver to prevent layout observation after unmount
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Unsubscribe all IPC event listeners to prevent memory leaks (VAL-MEM-003)

      if (listenersRef.current.unsubscribeData) {

        listenersRef.current.unsubscribeData();
      }
      if (listenersRef.current.unsubscribeStarted) {

        listenersRef.current.unsubscribeStarted();
      }
      if (listenersRef.current.unsubscribeExit) {

        listenersRef.current.unsubscribeExit();
      }
      if (listenersRef.current.unsubscribeError) {

        listenersRef.current.unsubscribeError();
      }

      listenersRef.current = {};


      // Kill PTY process BEFORE disposing UI terminal
      // This ensures the process is terminated and won't send more data
      backendAPI.terminalKill(terminal.id).catch((_err: any) => {
        // fire-and-forget; ignore errors during cleanup
      });

      // Dispose xterm.js event handlers (VAL-MEM-004)
      // Must be done BEFORE terminal.dispose() to properly detach all handlers


      // Dispose onData handler
      if (xtermDisposablesRef.current.onDataDisposable) {

        xtermDisposablesRef.current.onDataDisposable.dispose();
        xtermDisposablesRef.current.onDataDisposable = undefined;
      }

      // Dispose onScroll handler
      if (xtermDisposablesRef.current.onScrollDisposable) {

        xtermDisposablesRef.current.onScrollDisposable.dispose();
        xtermDisposablesRef.current.onScrollDisposable = undefined;
      }

      // Cleanup custom key event handler
      if (xtermDisposablesRef.current.customKeyHandlerCleanup) {

        xtermDisposablesRef.current.customKeyHandlerCleanup();
        xtermDisposablesRef.current.customKeyHandlerCleanup = undefined;
      }



      // Dispose xterm.js terminal and all addons (VAL-MEM-004)
      // Dispose addons explicitly before terminal disposal for clarity
      // Note: terminal.dispose() will dispose all loaded addons automatically,
      // but we dispose them explicitly here for better debugging and clarity
      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose();
        } catch (err: any) {

        }
        webglAddonRef.current = null;
      }

      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.dispose();
        } catch (err: any) {

        }
        fitAddonRef.current = null;
      }

      if (webLinksAddonRef.current) {
        try {
          webLinksAddonRef.current.dispose();
        } catch (err: any) {

        }
        webLinksAddonRef.current = null;
      }

      if (searchAddonRef.current) {
        try {
          searchAddonRef.current.dispose();
        } catch (err: any) {

        }
        searchAddonRef.current = null;
      }

      // Dispose the terminal instance - this handles:
      // - Texture atlas clearing
      // - WebGL context release (if WebGL addon is active)
      // - Any remaining internal cleanup
      if (terminalRef.current) {
        try {

          terminalRef.current.dispose();
        } catch (err: any) {
          console.error(`[TerminalCell ${terminal.id}] Error disposing terminal:`, err);
        }
        terminalRef.current = null;
      }

      // Clear container to ensure no DOM references remain
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Nullify all refs to prevent stale references (VAL-MEM-002)
      // Clear xterm disposables ref
      xtermDisposablesRef.current = {};
      hasInitializedRef.current = false;
      hasInitiallyFitRef.current = false;
      isInitialFitCompleteRef.current = false;
      dataBufferRef.current = [];
      lastDimensionsRef.current = null;
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
      data-theme={theme}
      onClick={onActivate}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleContainerKeyDown}
      tabIndex={-1}
    >
      <div className="terminal-header">
        <div className="terminal-header-left">
          {agentIcon && <span className="terminal-agent-icon">{agentIcon}</span>}
          <span className="terminal-title">{terminal.title}</span>
          {terminal.agent?.type === 'claude-code' && vnPatched && (
            <span className="terminal-vn-flag" title="Vietnamese IME Patched">🇻🇳</span>
          )}
          {terminal.agent?.enabled && terminal.agent.type !== 'none' && (
            <span className="terminal-agent-badge">{terminal.agent.type.toUpperCase()}</span>
          )}
          {!isActive && (
            <span className="tab-to-focus-hint">Tab to focus</span>
          )}
        </div>
        <div className="terminal-header-right">
          <div className="terminal-status">
            <span
              className={`terminal-status-dot ${terminal.status}`}
            />
            <span className="terminal-status-text">{terminal.status}</span>
          </div>
          {terminalsCount > 1 && (
            <button
              className="terminal-close-btn"
              onClick={handleCloseClick}
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
        className={`terminal-canvas-area${isDragOver ? ' drag-over' : ''}`}
      >
        {isDragOver && (
          <div className="terminal-drag-overlay">
            <span className="terminal-drag-text">Drop files to insert paths</span>
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
          currentAgentType={terminal.agent?.type}
        />
      )}

      {/* Spawn Error Toast Notification */}
      {spawnError && (
        <div className="terminal-error-toast">
          <span>⚠️</span>
          <span>{spawnError}</span>
          <button
            onClick={() => setSpawnError(null)}
            className="terminal-error-toast-close"
            title="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo (VAL-PERF-005)
  // Prevent re-render if these props haven't changed
  return (
    prevProps.terminal.id === nextProps.terminal.id &&
    prevProps.terminal.status === nextProps.terminal.status &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.terminal.agent?.type === nextProps.terminal.agent?.type &&
    prevProps.terminal.agent?.enabled === nextProps.terminal.agent?.enabled
  );
});

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
