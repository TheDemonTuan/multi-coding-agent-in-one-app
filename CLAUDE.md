# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start Vite dev server (React + Electron)
bun run build            # Build React app and Electron main process
bun run electron:start   # Run Electron app in development mode
bun run electron:build   # Build and package production app
bun run package          # Package app with ASAR bundling
```

## Architecture

**TDT Space** is an Electron desktop application providing a grid-based terminal workspace for running multiple AI coding agents in parallel.

### Tech Stack
- **Framework**: Electron (main process) + React 19 (renderer)
- **Build**: Vite with `vite-plugin-electron` and `vite-plugin-electron-renderer`
- **State**: Zustand stores
- **Terminal**: node-pty + xterm.js
- **Storage**: electron-store (persistent settings)
- **Package Manager**: Bun
- **Language**: TypeScript (strict mode, path alias `@/` → `src/`)

### Project Structure

```
src/
├── electron/
│   ├── main.ts          # Electron main process - IPC handlers, terminal spawning
│   ├── preload.cjs      # Context bridge for renderer↔main communication
│   └── terminal.ts      # Terminal utilities
├── components/          # React UI components
│   ├── TerminalGrid.tsx     # Main grid layout renderer
│   ├── TerminalCell.tsx     # Individual terminal pane
│   ├── WorkspaceTabBar.tsx  # Workspace switching tabs
│   ├── SettingsModal.tsx    # App settings UI
│   └── ...
├── stores/              # Zustand state management
│   ├── workspaceStore.ts    # Workspace CRUD, terminal state
│   ├── templateStore.ts     # Layout template management
│   ├── settingsStore.ts     # App settings
│   └── terminalHistoryStore.ts  # Command history
├── hooks/               # Custom React hooks (useTerminal, useTerminalSearch)
├── types/               # TypeScript definitions
└── utils/               # Helper utilities
```

### Key Patterns

**Terminal Lifecycle** (main process `src/electron/main.ts`):
1. Renderer calls IPC handler (`spawn-terminal` or `spawn-terminal-with-agent`)
2. Main process spawns node-pty process with PowerShell/bash shell
3. Data flows via `onData` → IPC `terminal-data` event → xterm renderer
4. Resize/write/kill commands sent via IPC from renderer to main

**Agent Integration**:
- Supported agents: claude-code, opencode, droid
- Agent commands spawned via `spawn-terminal-with-agent` IPC handler
- Agent config stored per-terminal in workspace state

**State Management**:
- `workspaceStore`: Current workspace, terminal list, agent assignments
- `templateStore`: Pre-built layouts (1×1, 2×1, 2×2, 3×2, 4×4, etc.)
- All state persisted to electron-store with debounced saves

**IPC API** (renderer → main):
- Terminal: `spawn-terminal`, `terminal-write`, `terminal-kill`, `terminal-resize`
- Workspace: `get-workspaces`, `create-workspace`, `delete-workspace`, `switch-workspace`
- Storage: `get-store-value`, `set-store-value`
- Templates: `get-templates`, `save-template`, `delete-template`
- Window: `window-minimize`, `window-maximize`, `window-close`

### Keyboard Shortcuts (App.tsx)
- `Ctrl+Tab` / `Ctrl+Shift+Tab`: Cycle workspaces
- `Ctrl+PageUp` / `Ctrl+PageDown`: Prev/next workspace
- `Ctrl+T`: Next terminal (or `Ctrl+1-9` for specific index)
- `Ctrl+Shift+T`: Previous terminal
- `Alt+1-9`: Switch to workspace by index
- `Ctrl+Shift+N`: New workspace modal

### Build Configuration

**vite.config.ts**:
- Custom plugin copies `preload.cjs` to `dist-electron/preload/`
- Electron build outputs to `dist-electron/main/` (CJS format)
- React build outputs to `dist/`

**package.js**:
- Creates production build with ASAR bundling
- Bundles node_modules into `resources/app.asar`
- Outputs to `release/win-unpacked-<timestamp>/`

### Platform Notes
- Windows-only application (shell detection in main.ts)
- Uses PowerShell for terminal spawning on Windows
- GPU features disabled for compatibility
