# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ SERENA TOOLS - MANDATORY FIRST PRIORITY

**CRITICAL**: When working with code, you **MUST** use Serena tools as **FIRST PRIORITY**. Default tools are **FORBIDDEN** for code operations when a Serena alternative exists.

### Complete Serena Tools Reference

| Category | Task | Default Tool (AVOID) | Serena Tool (MANDATORY) |
|----------|------|---------------------|------------------------|
| **File Reading** | Read file/directory | `cat`, `head`, `tail`, `ls`, `Read`, `Glob` | `mcp__plugin_serena_serena__read_file`, `mcp__plugin_serena_serena__list_dir` |
| **File Discovery** | Find files | `find`, `ls`, `Glob` | `mcp__plugin_serena_serena__find_file` |
| **Content Search** | Search text/regex | `grep`, `rg`, `Grep` | `mcp__plugin_serena_serena__search_for_pattern` |
| **Symbol Discovery** | Find classes/functions/variables | - | `mcp__plugin_serena_serena__find_symbol` |
| **Symbol Overview** | Get file structure | - | `mcp__plugin_serena_serena__get_symbols_overview` |
| **References** | Find usages | - | `mcp__plugin_serena_serena__find_referencing_symbols` |
| **Symbol Edit** | Replace function/class body | `Edit`, `sed` | `mcp__plugin_serena_serena__replace_symbol_body` |
| **Insert Code** | Add code before/after symbol | `Edit` | `mcp__plugin_serena_serena__insert_before_symbol`, `mcp__plugin_serena_serena__insert_after_symbol` |
| **Rename** | Rename symbol everywhere | - | `mcp__plugin_serena_serena__rename_symbol` |
| **File Edit** | Regex/string replacement | `sed`, `awk`, `Edit` | `mcp__plugin_serena_serena__replace_content` |
| **File Create** | Create new file | `Write`, `echo >` | `mcp__plugin_serena_serena__create_text_file` |
| **Shell** | Execute commands | `Bash` | `mcp__plugin_serena_serena__execute_shell_command` |
| **Memory** | Project memory | - | `mcp__plugin_serena_serena__write_memory`, `mcp__plugin_serena_serena__read_memory`, `mcp__plugin_serena_serena__list_memories`, `mcp__plugin_serena_serena__edit_memory`, `mcp__plugin_serena_serena__delete_memory`, `mcp__plugin_serena_serena__rename_memory` |
| **Project** | Project config | - | `mcp__plugin_serena_serena__get_current_config`, `mcp__plugin_serena_serena__activate_project`, `mcp__plugin_serena_serena__check_onboarding_performed`, `mcp__plugin_serena_serena__onboarding` |
| **Modes** | Operation modes | - | `mcp__plugin_serena_serena__switch_modes` |
| **Dashboard** | Open web UI | - | `mcp__plugin_serena_serena__open_dashboard` |
| **Session** | Prepare new conversation | - | `mcp__plugin_serena_serena__prepare_for_new_conversation` |

### Decision Flow (STRICT)

```
┌─────────────────────────────────────────────────────────┐
│  Starting a code-related task?                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  1. Can Serena do this?        │─────────NO─────────┐
         └────────────────────────────────┘                    │
                          │ YES                                │
                          ▼                                    ▼
         ┌────────────────────────────────┐         ┌──────────────────────┐
         │  2. Is it a code operation?    │         │  Use default tools:  │
         └────────────────────────────────┘         │  - git commands      │
                          │                         │  - bun/npm commands  │
         ┌────────────────┴────────────────┐        │  - system commands   │
         │ YES                             │        └──────────────────────┘
         ▼                                 │
┌────────────────────────────────┐         │
│  3. Use Serena tool EXCLUSIVELY│         │
│  - find_symbol for code search │         │
│  - replace_symbol_body for     │         │
│    function/class edits        │         │
│  - replace_content for         │         │
│    regex-based file edits      │         │
│  - search_for_pattern for      │         │
│    content exploration         │         │
│  - read_file for file reading  │         │
│  - list_dir for directories    │         │
│  - find_file for file masks    │         │
└────────────────────────────────┘         │
         │                                 │
         └─────────────────────────────────┘
```

### Forbidden Patterns (NEVER USE)

| Instead of... | Use... |
|---------------|--------|
| `grep "pattern" src/` | `search_for_pattern` |
| `find . -name "*.ts"` | `find_file` with `*.ts` |
| `cat src/file.ts` | `read_file` |
| `ls src/components/` | `list_dir` |
| `sed -i 's/old/new/g' file.ts` | `replace_content` with regex mode |
| `Edit` tool for symbol edits | `replace_symbol_body`, `insert_before_symbol`, `insert_after_symbol` |
| `Read` tool for files | `read_file` |
| `Glob` for files | `find_file` |
| `Grep` for content | `search_for_pattern` |

### Allowed Default Tool Usage

Only use non-Serena tools for:
- **Git operations**: `git status`, `git diff`, `git commit`, `git log`, etc.
- **Package manager**: `bun install`, `bun run`, `npm`, `yarn`, `pnpm`
- **System operations**: Platform checks, environment variables (when not code-related)

### Serena Best Practices

1. **Symbol-first editing**: Always try `find_symbol` + `replace_symbol_body` before `replace_content`
2. **Regex mode**: Use `replace_content` with `mode: "regex"` for complex multi-line replacements
3. **Smart patterns**: Use `.*?` non-greedy wildcards to avoid over-matching
4. **File masks**: Use `find_file` with masks like `*.handler.ts` for precise file discovery
5. **Symbol paths**: Use absolute paths like `/TerminalService/constructor` for precise targeting

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start Vite dev server (React + Electron)
bun run build            # Build React app and Electron main process
bun run electron:start   # Run Electron app in development mode
bun run electron:build   # Build and package production app
bun run electron:build:mac  # Build for macOS (DMG + ZIP)
bun run package:linux    # Build for Linux (AppImage, deb)
bun run package          # Package app with ASAR bundling (Windows)
```

### Testing

```bash
# Test files are excluded from TypeScript build (tsconfig.json)
# Test runner: Check for vitest/jest configuration
# Test files: **/*.test.ts, **/*.spec.ts
```

## Architecture

**TDT Space** is an Electron desktop application providing a grid-based terminal workspace for running multiple AI coding agents in parallel.

### Tech Stack
- **Framework**: Electron (main process) + React 19 (renderer)
- **Build**: Vite with `vite-plugin-electron` and `vite-plugin-electron-renderer`
- **State**: Zustand stores
- **Terminal**: node-pty + xterm.js (+addons: fit, search, web-links, webgl)
- **Storage**: electron-store (persistent settings)
- **Package Manager**: Bun
- **Language**: TypeScript (strict mode, path alias `@/` → `src/`)

### Architectural Overview

The codebase follows a **modular, domain-based architecture** with clear separation of concerns:

```
src/
├── electron/
│   ├── main.ts              # Entry point, window creation, app lifecycle
│   ├── preload.cjs          # Context bridge (contextIsolation: true)
│   ├── terminal.ts          # PTY utilities
│   └── ipc/                 # IPC handlers organized by domain
│       ├── terminal.handlers.ts       # Spawn, write, kill, resize
│       ├── workspace.handlers.ts      # CRUD, switch, patch validation
│       ├── template.handlers.ts       # Template CRUD
│       ├── store.handlers.ts          # electron-store access
│       ├── window.handlers.ts         # Minimize, maximize, close
│       ├── system.handlers.ts         # Platform, version, cwd
│       ├── terminal-history.handlers.ts
│       └── vietnamese-ime.handlers.ts # IME patch management
├── components/              # React UI (domain-organized)
│   ├── agents/              # AgentAllocationSlider, AgentInstallGuide, etc.
│   ├── modals/              # SettingsModal, CustomTemplateModal, etc.
│   ├── terminals/           # TerminalCell, TerminalGrid, TerminalSearch, etc.
│   ├── workspaces/          # WorkspaceTabBar, LayoutSelector, etc.
│   ├── ui/                  # TitleBar, ScrollToBottomButton
│   └── index.ts             # Barrel exports
├── config/                  # Centralized configuration
│   ├── agents.ts            # Agent command configs (claude, opencode, droid)
│   ├── templates.ts         # Default layout templates
│   ├── constants.ts         # IPC channels, shortcuts, storage keys
│   └── index.ts
├── hooks/                   # Custom React hooks
│   ├── useTerminal.ts       # Terminal lifecycle, xterm.js setup
│   ├── useTerminalSearch.ts # Search addon integration
│   ├── useWorkspaceNavigation.ts  # Workspace cycling helpers
│   ├── useCommandHistory.ts
│   └── index.ts
├── lib/                     # Low-level utilities
│   ├── logger.ts            # Centralized logging (error only; debug/info/warn are no-ops)
│   ├── debounce.ts          # Debounce helper
│   ├── memoryMonitor.ts     # Memory monitoring utility
│   ├── osc133Parser.ts      # Terminal escape sequence parser
│   ├── platform.ts          # Platform detection
│   └── index.ts
├── services/                # Business logic layer (renderer-side)
│   ├── terminal.service.ts  # TerminalService singleton (spawn, write, kill)
│   └── workspace.service.ts
├── stores/                  # Zustand state management
│   ├── workspaceStore.ts    # Workspace CRUD, terminals, agent assignments
│   ├── templateStore.ts     # Layout template management
│   ├── settingsStore.ts     # App settings (theme, terminal options)
│   └── terminalHistoryStore.ts
├── types/                   # TypeScript definitions (domain-specific)
│   ├── agent.ts             # AgentConfig, AgentType, AgentSpawnOptions
│   ├── ipc.ts               # IPC request/response types
│   ├── terminal.ts          # TerminalPane, TerminalStatus
│   ├── workspace.ts         # WorkspaceState, WorkspaceLayout
│   ├── workspace.agents.ts  # Agent-related workspace types
│   └── electron.d.ts        # Electron API type declarations
└── utils/                   # Helper utilities
    ├── storage.ts           # electron-store wrappers
    ├── shortcuts.ts         # Keyboard shortcut utilities
    ├── version.ts           # App version helper
    └── vietnameseImePatch.ts # Vietnamese IME patch for Claude Code
```

### Key Architectural Patterns

**1. Domain-Based Organization**
- Components organized by feature domain (agents, terminals, workspaces, modals)
- Type definitions mirror domain structure
- IPC handlers separated by domain concern

**2. Service Layer Pattern**
- `TerminalService` singleton encapsulates terminal operations
- Business logic separated from UI components
- Service methods handle electronAPI communication

**3. Centralized Configuration**
- All constants in `config/constants.ts` (IPC channels, shortcuts, storage keys)
- Agent commands configured in `config/agents.ts`
- Layout templates in `config/templates.ts`

**4. Centralized Logging**
- `Logger` class with levels (debug, info, warn, error)
- Child loggers with prefix chaining (e.g., `[Main]`, `[IPC:Terminal]`)
- Timestamp-based logging for debugging

**5. Type-Safe IPC**
- All IPC channels defined as constants
- Request/response types in `types/ipc.ts`
- Context isolation enabled for security

### Terminal Lifecycle

**Spawn Flow**:
1. Renderer: `TerminalService.spawnTerminal()` or `spawnTerminalWithAgent()`
2. IPC: `spawn-terminal` or `spawn-terminal-with-agent` handler
3. Main: `pty.spawn()` with PowerShell (Win) or bash (Unix)
4. Data: `ptyProcess.onData()` → `terminal-data` IPC event → xterm.js

**Cleanup Flow**:
1. Workspace switch or app quit triggers cleanup
2. `cleanupAllTerminals()` kills all PTY processes
3. Windows: `taskkill /f /t` for process tree killing
4. Unix: `ptyProcess.kill()`

**Agent Integration**:
- Supported agents: `claude-code`, `opencode`, `droid`, `gemini-cli`, `aider`, etc.
- Agent commands configured per-terminal in workspace state
- Auto-patch system for Vietnamese IME support in Claude Code

### State Management

**Zustand Stores**:
- `workspaceStore`: Active workspace, terminal list, agent assignments, theme
- `templateStore`: User-saved layout templates
- `settingsStore`: Terminal preferences (font, colors, scrollback)
- `terminalHistoryStore`: Command history per terminal

**Persistence**:
- All stores synced to electron-store with debounced saves (300ms)
- Workspace changes trigger immediate save for critical operations (delete)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+N` | Create new workspace |
| `Ctrl+Tab` | Cycle to next workspace (modal preview) |
| `Ctrl+Shift+Tab` | Cycle to previous workspace |
| `Ctrl+PageUp` | Previous workspace |
| `Ctrl+PageDown` | Next workspace |
| `Ctrl+T` | Next terminal (or `Ctrl+1-9` for specific) |
| `Ctrl+Shift+T` | Previous terminal |
| `Alt+1-9` | Switch to workspace by index |
| `Ctrl+,` | Open Settings |

### Build Configuration

**vite.config.ts**:
- Custom plugin copies `preload.cjs` directly (bypasses Vite transform)
- Electron main process: CJS format, outputs to `dist-electron/main/`
- React renderer: ESM, outputs to `dist/`
- Base path: `./` for Electron compatibility

**package.js** (Windows):
- ASAR bundling for production
- Unpacks `node-pty` and `@xterm` (native modules)
- Outputs to `release/win-unpacked-<timestamp>/`
- Creates junction link to `release/win-unpacked/`

**package.js** (macOS/Linux):
- Delegates to electron-builder
- macOS: DMG + ZIP (x64 + arm64)
- Linux: AppImage + deb

### Platform Notes

**Multi-platform support**:
- **Windows**: Primary platform (Shell: PowerShell with `-NoLogo -NoExit`)
- **macOS**: Supported (Shell: zsh/bash, DMG/ZIP builds via electron-builder)
- **Linux**: Supported (Shell: bash, AppImage/deb builds via electron-builder)

**Other**:
- GPU acceleration enabled for xterm.js WebGL rendering
- Vietnamese IME patch system for Claude Code CLI
- GL flag: `--use-gl=angle` with `--use-angle=d3d11` on Windows

### Additional Configuration

**Logger Behavior** (`lib/logger.ts`):
- Only `error` level is active (outputs to console.error)
- `debug`, `info`, `warn` are no-ops (disabled in production)

**Storage Keys** (`config/constants.ts`):
- `workspaces` - Workspace layouts and configurations
- Other keys defined in constants file

**TypeScript** (`tsconfig.json`):
- Test files excluded from build: `**/*.test.ts`, `**/*.spec.ts`
- Path alias: `@/*` → `src/*`
- Strict mode enabled
