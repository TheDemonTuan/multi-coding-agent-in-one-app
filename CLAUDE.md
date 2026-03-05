# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TDT Space** - Multi-Agent Terminal for TDT Vibe Coding. An Electron desktop application that provides a grid-based terminal interface with support for running multiple AI coding agents (claude-code, opencode, droid) in parallel terminal panes.

## Tech Stack

- **Framework**: Electron 34 + Vite 7 + React 19
- **Language**: TypeScript 5.9 (strict mode)
- **State Management**: Zustand
- **Terminal**: xterm.js with node-pty
- **Storage**: electron-store
- **Package Manager**: Bun (bun.lock present)

## Commands

```bash
bun run dev           # Start Vite dev server + Electron (development)
bun run build         # Build React frontend
bun run electron:start  # Start Electron in production mode
bun run electron:dev    # Start Electron in dev mode
bun run electron:only   # Start Electron with built files only
bun run preview       # Preview production build
```

## Architecture

### Process Structure
- **Main Process** (`src/electron/main.ts`): Electron main process handling window management, IPC handlers, and PTY terminal spawning
- **Renderer Process** (`src/`): React + Vite frontend
- **Preload Script** (`src/electron/preload.cjs`): Exposes electronAPI via contextBridge (CommonJS format)

### Frontend Structure
- **Stores** (`src/stores/`):
  - `workspaceStore.ts` - Workspace CRUD, terminal state management (persists to electron-store)
  - `templateStore.ts` - Built-in and custom workspace templates
  - `settingsStore.ts` - User settings
  - `terminalHistoryStore.ts` - Terminal command history
- **Components** (`src/components/`):
  - `TerminalGrid.tsx` - Renders terminal pane grid based on workspace layout
  - `TerminalCell.tsx` - Individual terminal container
  - `WorkspaceTabBar.tsx` - Multi-workspace tab navigation
  - `LayoutSelector.tsx` - Grid configuration (1x1, 2x1, 2x2, 3x2, 4x4)
  - `TitleBar.tsx` - Custom frameless window controls
- **Hooks** (`src/hooks/`):
  - `useTerminal.ts` - xterm.js initialization and lifecycle
  - `useCommandHistory.ts` - Command history management
- **Types** (`src/types/`):
  - `workspace.ts` - Workspace, Terminal, Agent, Template type definitions

### Data Flow
1. Workspaces are persisted in electron-store under key `workspaces`
2. Each workspace contains a grid of terminal panes (configurable rows × columns)
3. Terminals spawn via IPC to main process using node-pty
4. Terminal data flows: PTY → IPC → Renderer → xterm.js display
5. Agent allocation per terminal stored in workspace config

### Key Patterns
- **Debounced persistence**: Workspace saves are debounced (300ms) to prevent rapid writes
- **Workspace-terminal binding**: Each terminal is bound to a workspaceId for cleanup on switch
- **GPU disabled**: Electron runs with all GPU features disabled for compatibility
- **ConPTY disabled**: node-pty uses `useConpty: false` on Windows to avoid errors

## Path Alias

`@/*` resolves to `./src/*` (configured in tsconfig.json and vite.config.ts)

## Important Notes

- Preload script must remain CommonJS (`.cjs`) - required by Electron
- Vite config includes custom plugin to copy preload.cjs during dev
- Terminal processes are cleaned up when switching workspaces or quitting app
- CSP in index.html restricts connections to `self`, `ws:`, `wss:`
