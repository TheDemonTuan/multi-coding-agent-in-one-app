import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { TerminalPane, AgentType } from '../../types/workspace';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { TerminalContextMenu } from './TerminalContextMenu';
import { ScrollToBottomButton } from '../ui/ScrollToBottomButton';
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasInitializedRef = useRef(false);
  const hasInitiallyFitRef = useRef(false);
  const dataBufferRef = useRef<string[]>([]);
  const isInitialFitCompleteRef = useRef(false);

  const { restartTerminal, getNextWorkspace, getPreviousWorkspace, setCurrentWorkspace, switchTerminalAgent } = useWorkspaceStore();

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
  const theme = useWorkspaceStore((state: any) => state.theme);
  const { updateTerminalStatus, setTerminalProcessId, currentWorkspace, isTerminalRestarting } = useWorkspaceStore();

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
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    // Disable WebGL - use canvas rendering only for better compatibility
    // WebGL causes issues on many systems with GPU virtualization
    // Note: Not loading WebglAddon at all to avoid "Stacking order" and WebGL errors

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

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    webLinksAddonRef.current = webLinksAddon;
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
            console.log(`[TerminalCell ${terminal.id}] Resizing terminal to ${cols}x${rows} (debounced)`);
            (window as any).electronAPI.terminalResize(terminal.id, cols, rows);
          } else {
            console.log(`[TerminalCell ${terminal.id}] Resize skipped - dimensions unchanged at ${cols}x${rows}`);
          }
        }
      }, 150); // 150ms debounce delay (VAL-PERF-001: 100-200ms range)
    });
    resizeObserverRef.current.observe(containerRef.current);

    // Store onScroll handler disposable (VAL-MEM-004)
    xtermDisposablesRef.current.onScrollDisposable = term.onScroll(handleScroll);
    console.log(`[TerminalCell ${terminal.id}] Registered onScroll handler`);

    if (terminal.agent?.enabled && terminal.agent.type !== 'none') {
      const agentIcon = agentIcons[terminal.agent.type] || '🔧';
      term.write(`\x1b[36m${agentIcon} Starting ${terminal.agent.type}...\x1b[0m\r\n`);
    }

    // Setup event listeners (VAL-MEM-003)
    console.log(`[TerminalCell ${terminal.id}] Subscribing to IPC events...`);

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
    console.log(`[TerminalCell ${terminal.id}] Subscribed to onTerminalData`);

    listenersRef.current.unsubscribeStarted = (window as any).electronAPI.onTerminalStarted(({ id }: { id: string }) => {
      if (id === terminal.id) {
        updateTerminalStatus(terminal.id, 'running');
        setHasStarted(true);
        terminalRef.current?.focus();

        // Re-sync terminal dimensions with PTY after (re)start
        // New PTY starts with default cols/rows, but xterm may already be sized differently
        if (terminalRef.current && fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
            const { cols, rows } = terminalRef.current;
            (window as any).electronAPI?.terminalResize(terminal.id, cols, rows);
            console.log(`[TerminalCell ${terminal.id}] Synced PTY size after start: ${cols}x${rows}`);
          } catch (err) {
            console.warn(`[TerminalCell ${terminal.id}] Failed to sync size after start:`, err);
          }
        }
      }
    });
    console.log(`[TerminalCell ${terminal.id}] Subscribed to onTerminalStarted`);

    listenersRef.current.unsubscribeExit = (window as any).electronAPI.onTerminalExit(({ id, code, signal }: { id: string; code: number | null; signal?: string }) => {
      if (id === terminal.id) {
        // Skip exit processing if terminal is restarting (prevents race condition setting status to stopped)
        if (isTerminalRestarting(terminal.id)) {
          console.log(`[TerminalCell ${terminal.id}] Ignoring exit event because terminal is restarting`);
          return;
        }

        const exitMessage = code !== null && code !== undefined
          ? `Terminal exited with code ${code}`
          : signal
            ? `Terminal exited (signal: ${signal})`
            : 'Terminal exited';
        terminalRef.current?.write(`\r\n\x1b[33m${exitMessage}\x1b[0m\r\n`);
        updateTerminalStatus(terminal.id, 'stopped');
      }
    });
    console.log(`[TerminalCell ${terminal.id}] Subscribed to onTerminalExit`);

    listenersRef.current.unsubscribeError = (window as any).electronAPI.onTerminalError(({ id, error }: { id: string; error: string }) => {
      if (id === terminal.id) {
        terminalRef.current?.write(`\r\n\x1b[31m❌ Error: ${error}\x1b[0m\r\n`);
        updateTerminalStatus(terminal.id, 'error');
        setSpawnError(error);

        // Auto-hide error toast after 10 seconds
        const timer = setTimeout(() => setSpawnError(null), 10000);
        errorToastTimersRef.current.push(timer);
      }
    });

    // Store onData handler disposable (VAL-MEM-004)
    xtermDisposablesRef.current.onDataDisposable = term.onData((data: string) => {
      (window as any).electronAPI.terminalWrite(terminal.id, data);
    });
    console.log(`[TerminalCell ${terminal.id}] Registered onData handler`);

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

    // Store cleanup function to mark handler as unregistered
    xtermDisposablesRef.current.customKeyHandlerCleanup = () => {
      customKeyHandlerRegistered = false;
    };
    console.log(`[TerminalCell ${terminal.id}] Registered custom key event handler`);

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
        } else if (result?.success === false && result?.error) {
          // Handle validation errors from main process
          setSpawnError(result.error);
          updateTerminalStatus(terminal.id, 'error');
          term.write(`\r\n\x1b[31m❌ ${result.error}\x1b[0m\r\n`);
          const timer = setTimeout(() => setSpawnError(null), 10000);
          errorToastTimersRef.current.push(timer);
        }
      })
      .catch((err: any) => {
        updateTerminalStatus(terminal.id, 'error');
        const errorMsg = err?.message || String(err);
        setSpawnError(errorMsg);
        term.write(`\r\n\x1b[31m❌ Failed to start terminal: ${errorMsg}\x1b[0m\r\n`);
        const timer = setTimeout(() => setSpawnError(null), 10000);
        errorToastTimersRef.current.push(timer);
      });

    return () => {
      console.log(`[TerminalCell ${terminal.id}] Cleaning up terminal`);

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
      console.log(`[TerminalCell ${terminal.id}] Unsubscribing IPC listeners...`);
      if (listenersRef.current.unsubscribeData) {
        console.log(`[TerminalCell ${terminal.id}] Unsubscribing onTerminalData listener`);
        listenersRef.current.unsubscribeData();
      }
      if (listenersRef.current.unsubscribeStarted) {
        console.log(`[TerminalCell ${terminal.id}] Unsubscribing onTerminalStarted listener`);
        listenersRef.current.unsubscribeStarted();
      }
      if (listenersRef.current.unsubscribeExit) {
        console.log(`[TerminalCell ${terminal.id}] Unsubscribing onTerminalExit listener`);
        listenersRef.current.unsubscribeExit();
      }
      if (listenersRef.current.unsubscribeError) {
        console.log(`[TerminalCell ${terminal.id}] Unsubscribing onTerminalError listener`);
        listenersRef.current.unsubscribeError();
      }
      console.log(`[TerminalCell ${terminal.id}] IPC listeners unsubscribed, listenersRef.current:`, listenersRef.current);
      listenersRef.current = {};
      console.log(`[TerminalCell ${terminal.id}] listenersRef.current cleared:`, listenersRef.current);

      // Kill PTY process in main process BEFORE disposing UI terminal
      // This ensures the process is terminated and won't send more data
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // Synchronously fire-and-forget to avoid await delays during cleanup
        (window as any).electronAPI.terminalKill(terminal.id).catch((err: any) => {
          console.warn(`[TerminalCell ${terminal.id}] Failed to kill terminal process:`, err);
        });
      }

      // Dispose xterm.js event handlers (VAL-MEM-004)
      // Must be done BEFORE terminal.dispose() to properly detach all handlers
      console.log(`[TerminalCell ${terminal.id}] Disposing xterm.js event handlers...`);

      // Dispose onData handler
      if (xtermDisposablesRef.current.onDataDisposable) {
        console.log(`[TerminalCell ${terminal.id}] Disposing onData handler`);
        xtermDisposablesRef.current.onDataDisposable.dispose();
        xtermDisposablesRef.current.onDataDisposable = undefined;
      }

      // Dispose onScroll handler
      if (xtermDisposablesRef.current.onScrollDisposable) {
        console.log(`[TerminalCell ${terminal.id}] Disposing onScroll handler`);
        xtermDisposablesRef.current.onScrollDisposable.dispose();
        xtermDisposablesRef.current.onScrollDisposable = undefined;
      }

      // Cleanup custom key event handler
      if (xtermDisposablesRef.current.customKeyHandlerCleanup) {
        console.log(`[TerminalCell ${terminal.id}] Disposing custom key event handler`);
        xtermDisposablesRef.current.customKeyHandlerCleanup();
        xtermDisposablesRef.current.customKeyHandlerCleanup = undefined;
      }

      console.log(`[TerminalCell ${terminal.id}] xterm.js event handlers disposed`);

      // Dispose xterm.js terminal and all addons (VAL-MEM-004)
      // Dispose addons explicitly before terminal disposal for clarity
      // Note: terminal.dispose() will dispose all loaded addons automatically,
      // but we dispose them explicitly here for better debugging and clarity
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.dispose();
        } catch (err: any) {
          console.warn(`[TerminalCell ${terminal.id}] Error disposing FitAddon:`, err);
        }
        fitAddonRef.current = null;
      }

      if (webLinksAddonRef.current) {
        try {
          webLinksAddonRef.current.dispose();
        } catch (err: any) {
          console.warn(`[TerminalCell ${terminal.id}] Error disposing WebLinksAddon:`, err);
        }
        webLinksAddonRef.current = null;
      }

      if (searchAddonRef.current) {
        try {
          searchAddonRef.current.dispose();
        } catch (err: any) {
          console.warn(`[TerminalCell ${terminal.id}] Error disposing SearchAddon:`, err);
        }
        searchAddonRef.current = null;
      }

      // Dispose the terminal instance - this handles:
      // - Texture atlas clearing
      // - WebGL context release (if WebGL addon is active)
      // - Any remaining internal cleanup
      if (terminalRef.current) {
        try {
          console.log(`[TerminalCell ${terminal.id}] Calling terminal.dispose()`);
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
            <span style={{ fontSize: '10px', marginLeft: '4px' }} title="Vietnamese IME Patched">🇻🇳</span>
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
          currentAgentType={terminal.agent?.type}
        />
      )}

      {/* Spawn Error Toast Notification */}
      {spawnError && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f38ba8',
            color: '#1e1e2e',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          <span>⚠️</span>
          <span>{spawnError}</span>
          <button
            onClick={() => setSpawnError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e1e2e',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0 4px',
              marginLeft: '8px',
              opacity: 0.7,
            }}
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
