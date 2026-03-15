<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { SearchAddon } from '@xterm/addon-search';
  import { WebLinksAddon } from '@xterm/addon-web-links';
  import '@xterm/xterm/css/xterm.css';
  import type { TerminalPane } from '../../types/workspace';
  import { workspaceStore } from '../../stores';
  import { backendAPI } from '../../services/wails-bridge';
  import ScrollToBottomButton from '../ui/ScrollToBottomButton.svelte';
  import TerminalSearch from './TerminalSearch.svelte';
  import { WorkspaceService } from '../../services/workspace.service';
  import { parseCommandLine } from '../../lib/terminalParser';
  import { useTerminalHistoryStore } from '../../stores/terminalHistoryStore';
  import type { AgentType } from '../../types/agent';
  import { getAgentDisplayName } from '../../config/agents';

  interface Props {
    terminal: TerminalPane;
    workspaceId: string;
    isActive: boolean;
    isWorkspaceActive: boolean;
    gridColumns: number;
    gridRows: number;
    onActivate: () => void;
  }

  let { terminal, workspaceId, isActive, isWorkspaceActive, gridColumns, gridRows, onActivate }: Props = $props();

  // DOM refs
  let containerRef: HTMLDivElement;
  let terminalContainerRef: HTMLDivElement;

  // Local state
  let hasStarted = $state(false);
  let isReady = $state(false);  // Hide until initial fit completes
  let unreadCount = $state(0);
  let searchOpen = $state(false);
  let spawnError = $state<string | null>(null);
  let userScrolledUp = $state(false);
  let hasBeenActiveOnce = $state(false);
  let isHovered = $state(false);
  let showActions = $state(false);

  // Terminal instances
  let terminalInstance: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let searchAddon = $state<SearchAddon | null>(null);
  let unsubscribers: Array<() => void> = [];
  let resizeObserverTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingResizeSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  let fallbackSpawnTimeout: ReturnType<typeof setTimeout> | null = null;
  let scheduledFitTimeout: ReturnType<typeof setTimeout> | null = null;
  let fitFrameOne: number | null = null;
  let fitFrameTwo: number | null = null;
  let lastMeasuredSize: { cols: number; rows: number } | null = null;
  let lastAppliedSize: { cols: number; rows: number } | null = null;
  let lastSyncedSize: { cols: number; rows: number } | null = null;
  let lastObservedContainerSize: { width: number; height: number } | null = null;
  let needsPtySync = false;
  let lastLayoutSignature: string | null = null;
  let scrollDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // RAF write buffering for performance (prevents main thread blocking)
  let writeBuffer = '';
  let writeRafScheduled = false;
  let writeRafId: number | null = null;
  // Debounced command parsing to avoid parsing on every chunk
  let commandParseTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingCommandBuffer = '';

  // Command parsing state
  let commandBuffer = $state('');
  let lastPrompt = $state('');

  // ============================================================================
  // RAF-scheduled terminal write to prevent main thread blocking
  // ============================================================================
  function flushWriteBuffer() {
    if (writeRafId !== null) {
      cancelAnimationFrame(writeRafId);
      writeRafId = null;
    }
    if (terminalInstance && writeBuffer.length > 0) {
      terminalInstance.write(writeBuffer);
      writeBuffer = '';
    }
    writeRafScheduled = false;
  }

  function scheduleTerminalWrite(data: string) {
    writeBuffer += data;
    if (!writeRafScheduled) {
      writeRafScheduled = true;
      writeRafId = requestAnimationFrame(() => {
        flushWriteBuffer();
      });
    }
  }
  // Theme
  const DARK_THEME = {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#353749',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#cba6f7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#cba6f7',
    brightCyan: '#94e2d5',
    brightWhite: '#cdd6f4',
  };

  const LIGHT_THEME = {
    background: '#f5f5f5',
    foreground: '#1e1e2e',
    cursor: '#1e1e2e',
    selectionBackground: '#d0d0d0',
    black: '#45475a',
    red: '#d20f39',
    green: '#40a02b',
    yellow: '#df8e1d',
    blue: '#1e66f5',
    magenta: '#8839ef',
    cyan: '#179299',
    white: '#5c5f77',
    brightBlack: '#6c6f85',
    brightRed: '#d20f39',
    brightGreen: '#40a02b',
    brightYellow: '#df8e1d',
    brightBlue: '#1e66f5',
    brightMagenta: '#8839ef',
    brightCyan: '#179299',
    brightWhite: '#4c4f69',
  };

  let theme = $derived(workspaceStore.theme);
  let isRestarting = $derived(workspaceStore.isTerminalRestarting(terminal.id));

  // Agent configuration
  function getAgentConfig(agentType?: AgentType) {
    const configs: Record<AgentType | string, { icon: string; color: string; bgColor: string; label: string }> = {
      claude: { icon: '🟣', color: '#cba6f7', bgColor: 'rgba(203, 166, 247, 0.15)', label: 'Claude' },
      opencode: { icon: '🔵', color: '#89b4fa', bgColor: 'rgba(137, 180, 250, 0.15)', label: 'OpenCode' },
      droid: { icon: '🟢', color: '#a6e3a1', bgColor: 'rgba(166, 227, 161, 0.15)', label: 'Droid' },
      aider: { icon: '🟠', color: '#fab387', bgColor: 'rgba(250, 179, 135, 0.15)', label: 'Aider' },
      cursor: { icon: '🔷', color: '#74c7ec', bgColor: 'rgba(116, 199, 236, 0.15)', label: 'Cursor' },
      none: { icon: '⚪', color: '#6c7086', bgColor: 'rgba(108, 112, 134, 0.15)', label: 'Terminal' },
    };
    return configs[agentType || 'none'] || configs.none;
  }

  let agentConfig = $derived(getAgentConfig(terminal.agent?.type));

  function getLoadingMessage(agentType?: string): string {
    if (!agentType || agentType === 'none') {
      return '\x1b[90mStarting terminal...\x1b[0m\r\n';
    }
    const displayName = getAgentDisplayName(agentType);
    return `\x1b[36m▶ Starting ${displayName}...\x1b[0m\r\n`;
  }

  // Initialize terminal
  function initTerminal() {
    if (!terminalContainerRef) return;

    terminalInstance = new Terminal({
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
      cursorBlink: true,
      scrollback: 10000,
      theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
      allowProposedApi: true,
      cursorStyle: 'block',
      drawBoldTextInBrightColors: true,
      letterSpacing: 0,
      lineHeight: 1.2,
    });
    fitAddon = new FitAddon();
    searchAddon = new SearchAddon();
    terminalInstance.loadAddon(fitAddon);
    terminalInstance.loadAddon(searchAddon);
    terminalInstance.loadAddon(new WebLinksAddon());
    terminalInstance.open(terminalContainerRef);

    // Allow Ctrl+B to propagate to window for sidebar toggle
    terminalInstance.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Let Ctrl+B propagate to window handler
      if (event.ctrlKey && (event.key === 'b' || event.key === 'B')) {
        return false; // false = let browser handle it (propagate)
      }
      return true; // true = xterm.js handles it
    });

    // Setup ResizeObserver to handle container resize
    setupResizeObserver();

    // Fit first so the initial spawn uses the real viewport size whenever possible.
    queueFit();
    scheduleFallbackSpawn();

    // Handle data from terminal (user input)
    terminalInstance.onData((data) => {
      backendAPI.terminalWrite(terminal.id, data);
    });

    // Handle scroll to track if user scrolled up
    terminalInstance.onScroll((position) => {
      if (scrollDebounceTimeout) {
        clearTimeout(scrollDebounceTimeout);
      }
      scrollDebounceTimeout = setTimeout(() => {
        const buffer = terminalInstance?.buffer.active;
        if (buffer && terminalInstance) {
          const viewportBottom = position + terminalInstance.rows;
          const isAtBottom = viewportBottom >= buffer.length - 2;
          userScrolledUp = !isAtBottom;
        }
        scrollDebounceTimeout = null;
      }, 50);
    });
  }

  // Simple ResizeObserver to handle container resize
  function setupResizeObserver() {
    if (!terminalContainerRef || !fitAddon || !terminalInstance) return;

    const initialRect = terminalContainerRef.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      lastObservedContainerSize = { width: initialRect.width, height: initialRect.height };
    }

    const observer = new ResizeObserver((entries) => {
      if (!isWorkspaceActive || !isTerminalVisible()) return;

      const entry = entries[entries.length - 1];
      if (!entry) return;

      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;
      if (nextWidth <= 0 || nextHeight <= 0) return;

      if (lastObservedContainerSize) {
        const widthDelta = Math.abs(nextWidth - lastObservedContainerSize.width);
        const heightDelta = Math.abs(nextHeight - lastObservedContainerSize.height);
        if (widthDelta <= 1 && heightDelta <= 1) {
          return;
        }
      }

      lastObservedContainerSize = { width: nextWidth, height: nextHeight };

      if (resizeObserverTimeout) {
        clearTimeout(resizeObserverTimeout);
      }

      resizeObserverTimeout = setTimeout(() => {
        if (isWorkspaceActive && isTerminalVisible()) {
          queueFit();
        }
      }, 180);
    });

    observer.observe(terminalContainerRef);

    unsubscribers.push(() => {
      observer.disconnect();
      if (resizeObserverTimeout) {
        clearTimeout(resizeObserverTimeout);
        resizeObserverTimeout = null;
      }
    });
  }

  function clearQueuedFit() {
    if (scheduledFitTimeout) {
      clearTimeout(scheduledFitTimeout);
      scheduledFitTimeout = null;
    }

    if (fitFrameOne !== null) {
      cancelAnimationFrame(fitFrameOne);
      fitFrameOne = null;
    }

    if (fitFrameTwo !== null) {
      cancelAnimationFrame(fitFrameTwo);
      fitFrameTwo = null;
    }
  }

  function isTerminalVisible() {
    if (!terminalContainerRef) return false;

    const rect = terminalContainerRef.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getMeasuredSize() {
    if (!fitAddon || !terminalInstance) return null;
    if (!isTerminalVisible()) return null;

    const dims = fitAddon.proposeDimensions();
    if (!dims || dims.cols <= 0 || dims.rows <= 0) {
      return null;
    }

    return { cols: dims.cols, rows: dims.rows };
  }

  function syncPtySize(cols: number, rows: number) {
    if (!hasStarted || !needsPtySync) return;

    if (lastSyncedSize?.cols === cols && lastSyncedSize?.rows === rows) {
      needsPtySync = false;
      return;
    }

    if (pendingResizeSyncTimeout) {
      clearTimeout(pendingResizeSyncTimeout);
    }

    pendingResizeSyncTimeout = setTimeout(async () => {
      pendingResizeSyncTimeout = null;

      try {
        await backendAPI.terminalResize(terminal.id, cols, rows);
        lastSyncedSize = { cols, rows };
        needsPtySync = false;
      } catch (err) {
        console.error('[TerminalCell] Failed to sync PTY size:', err);
      }
    }, 40);
  }

  function queueFit(delay = 0) {
    clearQueuedFit();

    scheduledFitTimeout = setTimeout(() => {
      scheduledFitTimeout = null;
      fitFrameOne = requestAnimationFrame(() => {
        fitFrameOne = null;
        fitFrameTwo = requestAnimationFrame(() => {
          fitFrameTwo = null;
          const measuredSize = fitTerminal();
          if (!hasStarted && measuredSize) {
            void spawnTerminal(measuredSize);
          }
        });
      });
    }, delay);
  }

  function scheduleFallbackSpawn() {
    if (hasStarted) return;

    if (fallbackSpawnTimeout) {
      clearTimeout(fallbackSpawnTimeout);
    }

    fallbackSpawnTimeout = setTimeout(() => {
      fallbackSpawnTimeout = null;
      if (!hasStarted && isWorkspaceActive) {
        void spawnTerminal(null, true);
      }
    }, 400);
  }

  // Fit to container and keep canonical terminal geometry in sync with PTY.
  function fitTerminal() {
    if (!terminalInstance) return null;
    if (!isWorkspaceActive) return null;

    const measuredSize = getMeasuredSize();
    if (!measuredSize) {
      return null;
    }

    isReady = true;

    // Resize only when character geometry changes.
    const sizeChanged =
      lastAppliedSize?.cols !== measuredSize.cols || lastAppliedSize?.rows !== measuredSize.rows;
    if (sizeChanged) {
      terminalInstance.resize(measuredSize.cols, measuredSize.rows);
    }

    // Use terminal geometry after resize as canonical source of truth.
    const canonicalSize = {
      cols: terminalInstance.cols,
      rows: terminalInstance.rows,
    };

    lastMeasuredSize = canonicalSize;
    const canonicalChanged =
      !lastAppliedSize ||
      lastAppliedSize.cols !== canonicalSize.cols ||
      lastAppliedSize.rows !== canonicalSize.rows;

    if (canonicalChanged) {
      lastAppliedSize = canonicalSize;
      if (hasStarted) {
        needsPtySync = true;
      }
    }

    if ((terminal.status === 'running' || !!terminal.processId) && needsPtySync) {
      syncPtySize(canonicalSize.cols, canonicalSize.rows);
    }

    return canonicalSize;
  }

  async function fetchBacklog() {
    try {
      const backlog = await WorkspaceService.getTerminalBacklog(terminal.id);
      if (backlog && terminalInstance) {
        terminalInstance.write(backlog);
      }
    } catch (err) {
      console.error('[TerminalCell] Failed to fetch backlog:', err);
    }
  }

  async function spawnTerminal(
    measuredSize: { cols: number; rows: number } | null = null,
    allowFallback = false
  ) {
    if (!terminalInstance) return;
    if (hasStarted) return;
    if (!isWorkspaceActive) return;

    const size = measuredSize ?? lastMeasuredSize ?? getMeasuredSize();
    if (!size && !allowFallback) return;

    clearQueuedFit();

    if (fallbackSpawnTimeout) {
      clearTimeout(fallbackSpawnTimeout);
      fallbackSpawnTimeout = null;
    }

    const cols = size?.cols ?? terminalInstance.cols ?? 80;
    const rows = size?.rows ?? terminalInstance.rows ?? 24;

    if (size && (terminalInstance.cols !== cols || terminalInstance.rows !== rows)) {
      terminalInstance.resize(cols, rows);
    }
    if (size) {
      lastAppliedSize = { cols, rows };
    }

    hasStarted = true;
    spawnError = null;

    const loadingMessage = getLoadingMessage(terminal.agent?.type);
    terminalInstance.write(loadingMessage);
    terminalInstance.scrollToBottom();
    unreadCount = 0;
    userScrolledUp = false;

    try {
      const result = terminal.agent?.type && terminal.agent.type !== 'none'
        ? await backendAPI.spawnTerminalWithAgent(
            terminal.id,
            terminal.cwd,
            terminal.agent,
            workspaceId || '',
            cols,
            rows
          )
        : await backendAPI.spawnTerminal(
            terminal.id,
            terminal.cwd,
            workspaceId || '',
            cols,
            rows
          );

      if (result.success) {
        spawnError = null;
        lastSyncedSize = size ? { cols, rows } : null;
        needsPtySync = !size;
      } else {
        hasStarted = false;
        lastSyncedSize = null;
        needsPtySync = false;
        spawnError = result.error || 'Failed to spawn terminal';
      }
    } catch (err) {
      hasStarted = false;
      lastSyncedSize = null;
      needsPtySync = false;
      spawnError = String(err);
    }
  }

  function setupEventListeners() {
    // Listen for terminal data from backend
    const unsubData = backendAPI.onTerminalData((event) => {
      if (event.terminalId === terminal.id && terminalInstance) {
        // Use RAF-scheduled write to prevent main thread blocking
        scheduleTerminalWrite(event.data);

        // Accumulate command buffer for parsing
        pendingCommandBuffer += event.data;

        // Debounce command parsing to avoid parsing on every chunk
        if (commandParseTimeout) {
          clearTimeout(commandParseTimeout);
        }
        commandParseTimeout = setTimeout(() => {
          commandBuffer += pendingCommandBuffer;
          pendingCommandBuffer = '';
          const { isCommand, command } = parseCommandLine(commandBuffer);
          if (isCommand && command) {
            const historyStore = useTerminalHistoryStore.getState();
            historyStore.addCommandBlock(terminal.id, {
              id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              terminalId: terminal.id,
              command,
              output: '',
              status: 'running',
              timestamp: Date.now(),
            });
            commandBuffer = '';
          }
        }, 100);

        if (hasBeenActiveOnce && isWorkspaceActive && !isActive && !userScrolledUp) {
          unreadCount++;
        }
      }
    });

    unsubscribers.push(unsubData);

    // Listen for terminal started
    const unsubStarted = backendAPI.onTerminalStarted((event) => {
      if (event.terminalId === terminal.id) {
        workspaceStore.updateTerminalStatus(terminal.id, 'running');
        if (event.pid) {
          workspaceStore.setTerminalProcessId(terminal.id, event.pid);
        }
      }
    });
    unsubscribers.push(unsubStarted);

    // Listen for terminal exit
    const unsubExit = backendAPI.onTerminalExit((event) => {
      if (event.terminalId === terminal.id) {
        if (!isRestarting) {
          workspaceStore.updateTerminalStatus(terminal.id, 'stopped');
        }
      }
    });
    unsubscribers.push(unsubExit);

    // Listen for terminal error
    const unsubError = backendAPI.onTerminalError((event) => {
      if (event.terminalId === terminal.id) {
        workspaceStore.updateTerminalStatus(terminal.id, 'error');
      }
    });
    unsubscribers.push(unsubError);
  }

  function cleanup() {
    clearQueuedFit();
    if (pendingResizeSyncTimeout) {
      clearTimeout(pendingResizeSyncTimeout);
      pendingResizeSyncTimeout = null;
    }
    if (fallbackSpawnTimeout) {
      clearTimeout(fallbackSpawnTimeout);
      fallbackSpawnTimeout = null;
    }
    if (scrollDebounceTimeout) {
      clearTimeout(scrollDebounceTimeout);
      scrollDebounceTimeout = null;
    }
    // Clear RAF write buffer and cancel pending frame
    if (writeRafId !== null) {
      cancelAnimationFrame(writeRafId);
      writeRafId = null;
    }
    writeBuffer = '';
    writeRafScheduled = false;
    // Clear command parse timeout
    if (commandParseTimeout) {
      clearTimeout(commandParseTimeout);
      commandParseTimeout = null;
    }
    pendingCommandBuffer = '';
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
    terminalInstance?.dispose();
    backendAPI.terminalKill(terminal.id).catch(() => {});
  }

  function scrollToBottom() {
    terminalInstance?.scrollToBottom();
    unreadCount = 0;
    userScrolledUp = false;
  }

  function clearTerminal() {
    terminalInstance?.clear();
    backendAPI.clearTerminalBacklog(terminal.id).catch(() => {});
  }

  function restartTerminal() {
    spawnError = null;  // Reset error to allow retry
    workspaceStore.restartTerminal(terminal.id);
  }

  function closeTerminal() {
    workspaceStore.removeTerminal(terminal.id);
  }

  function toggleSearch() {
    searchOpen = !searchOpen;
  }

  // Lifecycle
  onMount(() => {
    initTerminal();
    setupEventListeners();
    return cleanup;
  });

  $effect(() => {
    if (!terminalInstance || !isWorkspaceActive) {
      lastLayoutSignature = null;
      lastObservedContainerSize = null;
      return;
    }

    const layoutSignature = `${gridColumns}x${gridRows}`;
    if (lastLayoutSignature !== layoutSignature) {
      lastLayoutSignature = layoutSignature;
      queueFit();
    }
  });

  $effect(() => {
    if (terminalInstance && isWorkspaceActive && !hasStarted && !spawnError) {
      scheduleFallbackSpawn();
    }
  });

  // Theme change effect
  $effect(() => {
    if (terminalInstance) {
      terminalInstance.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
  });

  // Active terminal effect - scroll to bottom and fetch backlog
  $effect(() => {
    if (isActive) {
      hasBeenActiveOnce = true;
    }

    if (isActive && terminalInstance) {
      terminalInstance.scrollToBottom();
      unreadCount = 0;
      // Reset scroll state when becoming active
      const buffer = terminalInstance?.buffer.active;
      if (buffer) {
        const currentPosition = terminalInstance.buffer.active.viewportY;
        const viewportBottom = currentPosition + terminalInstance.rows;
        const isAtBottom = viewportBottom >= buffer.length - 2;
        userScrolledUp = !isAtBottom;
      }
      fetchBacklog();
    }
  });

  $effect(() => {
    const terminalRunning = terminal.status === 'running' || !!terminal.processId;

    if (!terminalRunning) {
      lastSyncedSize = null;
      needsPtySync = false;
      return;
    }

    if (
      terminalInstance &&
      isWorkspaceActive &&
      hasStarted &&
      lastAppliedSize &&
      (
        !lastSyncedSize ||
        lastSyncedSize.cols !== lastAppliedSize.cols ||
        lastSyncedSize.rows !== lastAppliedSize.rows
      )
    ) {
      needsPtySync = true;
      syncPtySize(lastAppliedSize.cols, lastAppliedSize.rows);
    }
  });

  // Track previous status to detect restart
  let previousStatus = $state<string>('stopped');

  $effect(() => {
    const currentStatus = terminal.status;

    // Detect transition from 'running' to 'stopped' (restart/kill)
    if (currentStatus === 'stopped' && previousStatus === 'running') {
      // Reset states to force re-fit on next spawn
      hasStarted = false;
      lastAppliedSize = null;
      lastSyncedSize = null;
      needsPtySync = false;

      // Clear terminal to prevent duplicate text
      if (terminalInstance) {
        terminalInstance.clear();
      }
    }

    previousStatus = currentStatus;
  });

</script>

<div
  bind:this={containerRef}
  class="terminal-cell"
  class:active={isActive}
  class:hovered={isHovered}
  onclick={onActivate}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onActivate()}
  onmouseenter={() => { isHovered = true; showActions = true; }}
  onmouseleave={() => { isHovered = false; showActions = false; }}
  role="tabpanel"
  tabindex="0"
  aria-label="{terminal.title || 'Terminal'}"
>
  <!-- Header -->
  <div class="terminal-header">
    <div class="header-left">
      <!-- Status indicator -->
      <div
        class="status-indicator"
        class:running={terminal.status === 'running'}
        class:stopped={terminal.status === 'stopped'}
        class:error={terminal.status === 'error'}
        title={terminal.status === 'running' ? 'Running' : terminal.status === 'error' ? 'Error' : 'Stopped'}
      ></div>

      <!-- Agent badge -->
      {#if terminal.agent?.type && terminal.agent.type !== 'none'}
        <div
          class="agent-badge"
          style="--agent-color: {agentConfig.color}; --agent-bg: {agentConfig.bgColor};"
          title={agentConfig.label}
        >
          <span class="agent-icon">{agentConfig.icon}</span>
          <span class="agent-label">{agentConfig.label}</span>
        </div>
      {:else}
        <span class="terminal-title">{terminal.title}</span>
      {/if}
    </div>

    <div class="header-actions" class:visible={showActions || isActive}>
      <button
        class="action-btn"
        class:active={searchOpen}
        onclick={(e) => { e.stopPropagation(); toggleSearch(); }}
        title="Search (Ctrl+F)"
        aria-label="Search terminal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
      <button
        class="action-btn"
        onclick={(e) => { e.stopPropagation(); clearTerminal(); }}
        title="Clear Terminal"
        aria-label="Clear terminal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>

      <button
        class="action-btn"
        class:spinning={isRestarting}
        onclick={(e) => { e.stopPropagation(); restartTerminal(); }}
        title={isRestarting ? 'Restarting...' : 'Restart Terminal'}
        aria-label="Restart terminal"
        disabled={isRestarting}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>

      <button
        class="action-btn danger"
        onclick={(e) => { e.stopPropagation(); closeTerminal(); }}
        title="Close Terminal"
        aria-label="Close terminal"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  <!-- Terminal container -->
  <div class="terminal-container" class:ready={isReady} bind:this={terminalContainerRef}></div>

  <!-- Search overlay -->
  <TerminalSearch
    isOpen={searchOpen}
    onClose={() => searchOpen = false}
    {searchAddon}
  />

  <!-- Error overlay -->
  {#if spawnError}
    <div class="error-overlay">
      <div class="error-content">
        <div class="error-icon-wrapper">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <span class="error-message">{spawnError}</span>
        <button class="retry-btn" onclick={restartTerminal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Retry
        </button>
      </div>
    </div>
  {/if}

  <!-- Unread indicator / Scroll to bottom button -->
  <ScrollToBottomButton
    isVisible={unreadCount > 0 || userScrolledUp}
    onClick={scrollToBottom}
    {unreadCount}
  />

  <!-- Focus hint -->
  {#if !isActive}
    <div class="focus-hint" class:visible={isHovered}>
      <span>Click to focus</span>
    </div>
  {/if}
</div>

<style>
  .terminal-cell {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    height: 100%;
    background: var(--color-bg-base);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: border-color var(--transition-normal) var(--ease-default),
                box-shadow var(--transition-normal) var(--ease-default);
    position: relative;
  }

  .terminal-cell:hover {
    border-color: var(--color-border-hover);
    box-shadow: var(--shadow-md);
  }

  .terminal-cell.active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(137, 180, 250, 0.2), var(--shadow-glow-blue);
  }

  .terminal-cell.hovered:not(.active) {
    border-color: var(--color-border-hover);
  }

  /* Header */
  .terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-mantle);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    min-height: var(--terminal-header-height);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }

  /* Status Indicator */
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background-color: var(--color-text-overlay0);
    flex-shrink: 0;
    transition: background-color var(--transition-fast);
  }

  .status-indicator.running {
    background-color: var(--color-success);
    animation: status-pulse 2s infinite;
  }

  .status-indicator.error {
    background-color: var(--color-error);
  }

  .status-indicator.stopped {
    background-color: var(--color-text-overlay0);
  }

  @keyframes status-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(166, 227, 161, 0.4);
    }
    70% {
      box-shadow: 0 0 0 6px rgba(166, 227, 161, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(166, 227, 161, 0);
    }
  }

  /* Agent Badge */
  .agent-badge {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--agent-color);
    background-color: var(--agent-bg);
    border-radius: var(--radius-full);
    border: 1px solid color-mix(in srgb, var(--agent-color) 20%, transparent);
  }

  .agent-icon {
    font-size: var(--text-xs);
  }

  .agent-label {
    white-space: nowrap;
  }

  .terminal-title {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-subtext1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Header Actions */
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    opacity: 0;
    transform: translateX(8px);
    transition: all var(--transition-fast) var(--ease-out);
  }

  .header-actions.visible {
    opacity: 1;
    transform: translateX(0);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-overlay0);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover {
    background-color: var(--color-bg-surface0);
    color: var(--color-text);
  }

  .action-btn.danger:hover {
    background-color: var(--color-error);
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.spinning svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Terminal Container */
  .terminal-container {
    flex: 1;
    min-height: 0;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    opacity: 0;  /* Hidden until initial fit completes */
    transition: opacity 0.1s ease-out;
  }

  .terminal-container.ready {
    opacity: 1;  /* Show when fit is complete */
  }

  .terminal-container :global(.xterm) {
    width: 100%;
    height: 100%;
  }

  .terminal-container :global(.xterm-viewport) {
    background-color: transparent !important;
  }

  /* Error Overlay */
  .error-overlay {
    position: absolute;
    inset: var(--terminal-header-height) 0 0 0;
    background: rgba(30, 30, 46, 0.95);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    animation: fadeIn 200ms var(--ease-out);
  }

  .error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6);
    text-align: center;
  }

  .error-icon-wrapper {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(243, 139, 168, 0.15);
    border-radius: var(--radius-xl);
    color: var(--color-error);
  }

  .error-message {
    color: var(--color-error);
    font-size: var(--text-sm);
    max-width: 240px;
    line-height: var(--leading-relaxed);
  }

  .retry-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-bg-base);
    background-color: var(--color-primary);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .retry-btn:hover {
    background-color: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  /* Focus Hint */
  .focus-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(17, 17, 27, 0.7);
    backdrop-filter: blur(2px);
    opacity: 0;
    visibility: hidden;
    transition: all var(--transition-fast);
    z-index: 5;
    pointer-events: none;
  }

  .focus-hint.visible {
    opacity: 1;
    visibility: visible;
  }

  .focus-hint span {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text);
    background-color: var(--color-bg-surface0);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

