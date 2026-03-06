# TDT Space - Multi-Agent Terminal

<div align="center">

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![GitHub Release](https://img.shields.io/github/v/release/TheDemonTuan/all-agent-in-one)
![Electron](https://img.shields.io/badge/Electron-34.5.8-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows)
![License](https://img.shields.io/github/license/TheDemonTuan/all-agent-in-one)

**A powerful desktop terminal that runs multiple AI coding agents in parallel**

[Download](#-download) • [Features](#-features) • [Usage](#-usage) • [Development](#-development)

*Built by [TheDemonTuan](https://github.com/TheDemonTuan)*

</div>

---

## 📖 Overview

**TDT Space** is a grid-based terminal application that allows you to run multiple AI coding agents simultaneously in separate terminal panes. Perfect for developers who work with multiple AI assistants like Claude Code, OpenCode, Droid, and more.

**TDT** stands for **TheDemonTuan** - the author of this project.

---

## ✨ Features

### 🏗️ Modular Architecture (New in v1.1.0)
- **Restructured Codebase**: Clean separation of concerns with domain-specific modules
- **Domain-Based Components**: Organized into agents, modals, terminals, ui, and workspaces
- **Separated IPC Handlers**: Clean architecture with dedicated handler files by domain
- **Centralized Configuration**: Unified constants, agent configs, and templates
- **Type-Safe Architecture**: Domain-specific TypeScript definitions for better IDE support
- **Service Layer**: Business logic separated from UI and IPC handling
- **Centralized Logging**: Structured logging throughout the application
- **Barrel Exports**: Clean imports using index.ts pattern across all modules

### 🖥️ Grid Terminal System
- **Flexible Layouts**: Choose from 1×1, 2×1, 2×2, 3×2, or 4×4 grid configurations
- **Independent Panes**: Each terminal pane runs independently with its own process
- **Resizable Interface**: Clean, modern UI optimized for productivity

### 🤖 Multi-Agent Support
Run multiple AI coding agents at the same time:
- **Claude Code** - Anthropic's AI coding assistant
- **OpenCode** - Open-source coding assistant
- **Droid** - AI coding agent
- **Any CLI-based agent** - Works with any terminal-based AI tool

### 💾 Workspace Management
- **Save Workspaces**: Store your terminal layouts and configurations
- **Quick Switch**: Jump between different workspace setups instantly
- **Custom Templates**: Create and reuse workspace templates

### 🎯 Productivity Features
- **Agent Allocation**: Assign specific AI agents to specific terminal panes
- **Command History**: Track and reuse previous commands
- **Terminal Search**: Find text in terminal output
- **Custom Themes**: Light and dark mode support
- **Workspace Navigation**: Quick workspace cycling with keyboard shortcuts (Ctrl+Tab, Ctrl+Shift+Tab)
- **Vietnamese IME Support**: Native support for Vietnamese input method in Claude Code CLI

---

## 📥 Download

### Windows (Pre-built)

**Option 1: From Releases (Recommended)**
1. Go to [Releases](https://github.com/TheDemonTuan/all-agent-in-one/releases)
2. Download the latest `TDT-Space-vX.X.X-win.zip`
3. Extract to any folder (e.g., `C:\Programs\TDT Space`)
4. Run `TDT Space.exe`

**Option 2: Build from Source**
```bash
# Clone the repository
git clone https://github.com/TheDemonTuan/all-agent-in-one.git
cd all-agent-in-one

# Install dependencies
bun install

# Build the application
bun run electron:build

# The executable will be in the dist/ folder
```

---

## 🚀 Quick Start

### 1. First Launch
- Run `TDT Space.exe`
- Click **"+ New Workspace"** to create your first workspace

### 2. Choose Layout
Select a grid layout:
- **1×1** - Single terminal (simple)
- **2×1** - Two vertical panes (compare two agents)
- **2×2** - Four panes (most popular)
- **3×2** - Six panes (advanced)
- **4×4** - Sixteen panes (power users)

### 3. Allocate Agents
- Click on any terminal pane
- Select an AI agent from the dropdown
- Start coding with multiple AI assistants!

### 4. Save Workspace
- Name your workspace (e.g., "Default", "Coding Session")
- It will be saved automatically
- Switch between workspaces using the tab bar

---

## 💡 Usage Guide

### Workspace Management

| Action | How To |
|--------|--------|
| Create Workspace | Click "+ New Workspace" button |
| Switch Workspace | Use tabs in the workspace tab bar |
| Delete Workspace | Right-click tab → Delete |
| Rename Workspace | Double-click tab name |

### Terminal Layouts

**Recommended setups:**

- **Solo Development**: 1×1 or 2×1
- **Agent Comparison**: 2×1 (Claude vs OpenCode)
- **Multi-Tasking**: 2×2 (4 different agents/tasks)
- **Team Setup**: 3×2 or 4×4 (multiple projects)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + T` | Create new workspace |
| `Ctrl + W` | Close current workspace |
| `Ctrl + F` | Search in terminal |
| `Ctrl + Shift + P` | Command palette |
| `F11` | Toggle fullscreen |

---

## ⚙️ Configuration

### Settings

Access settings via the gear icon (⚙️) in the title bar:

**Terminal Settings:**
- Font size and family
- Color themes (Light/Dark/Custom)
- Scrollback buffer size
- Cursor style

**Agent Configuration:**
- Set default commands for each AI agent
- Configure agent-specific paths
- Auto-start agents on workspace load

**Workspace Settings:**
- Auto-save interval
- Default layout for new workspaces
- Restore previous session on startup

### Custom Templates

1. Set up your ideal workspace layout
2. Allocate agents to specific panes
3. Click **"Save as Template"**
4. Name your template (e.g., "Daily Coding", "Code Review")
5. Reuse across multiple workspaces

---

## 🛠️ Development

### Prerequisites

- **Node.js** v18 or higher
- **Bun** v1.0 or higher (package manager)
- **Windows** 10/11 (64-bit)

### Setup

```bash
# Clone repository
git clone https://github.com/TheDemonTuan/all-agent-in-one.git
cd all-agent-in-one

# Install dependencies
bun install

# Start development mode
bun run dev
```

### Available Scripts

```bash
bun run dev              # Start Vite dev server
bun run build            # Build for production
bun run electron:start   # Run Electron app
bun run electron:build   # Build and package app
bun run preview          # Preview production build
```

### Project Structure

```
all-agent-in-one/
├── src/
│   ├── components/       # React components (organized by domain)
│   │   ├── agents/       # Agent-related components
│   │   ├── modals/       # Modal dialogs
│   │   ├── terminals/    # Terminal UI components
│   │   ├── ui/           # Generic UI elements
│   │   ├── workspaces/   # Workspace management UI
│   │   └── index.ts      # Barrel exports
│   ├── config/           # Application configuration
│   │   ├── agents.ts     # Agent configurations
│   │   ├── constants.ts  # IPC channels, defaults
│   │   └── templates.ts  # Layout templates
│   ├── electron/
│   │   ├── ipc/          # IPC handlers by domain
│   │   │   ├── terminal.handlers.ts
│   │   │   ├── workspace.handlers.ts
│   │   │   ├── template.handlers.ts
│   │   │   └── ...
│   │   └── main.ts       # Electron main process (200 lines)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Low-level utilities
│   │   ├── logger.ts     # Centralized logging
│   │   ├── debounce.ts
│   │   └── platform.ts
│   ├── services/         # Business logic layer
│   │   ├── terminal.service.ts
│   │   └── workspace.service.ts
│   ├── stores/           # Zustand state management
│   └── types/            # TypeScript type definitions
│       ├── agent.ts
│       ├── terminal.ts
│       ├── ipc.ts
│       └── workspace.ts
├── dist/                 # Build output
├── public/               # Static assets
└── package.json          # Project configuration
```

### Tech Stack

- **Framework**: Electron 34.5.8
- **Frontend**: React 19.2.4 + Vite 7.3.1
- **Language**: TypeScript 5.9.3 (strict mode)
- **State**: Zustand 4.5.0
- **Terminal**: xterm.js 6.0.0 + node-pty 1.1.0
- **Storage**: electron-store 8.2.0
- **Package Manager**: Bun

---

## 🎯 Use Cases

### 1. AI Agent Comparison
Test multiple AI coding assistants side-by-side:
- Pane 1: Claude Code
- Pane 2: OpenCode
- Pane 3: Droid
- Compare responses and pick the best one

### 2. Multi-Project Development
Work on multiple projects simultaneously:
- Pane 1: Frontend development
- Pane 2: Backend API
- Pane 3: Database migrations
- Pane 4: Testing

### 3. Learning & Experimentation
- Try different AI agents on the same problem
- Learn from multiple AI perspectives
- Experiment with various coding approaches

---

## 📸 Screenshots

*Coming soon - Update will include application screenshots*

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Ways to Contribute
1. **Report Bugs**: Create an issue with detailed steps to reproduce
2. **Suggest Features**: Share your ideas in GitHub Discussions
3. **Submit PRs**: Fix bugs or add new features
4. **Improve Docs**: Help with documentation and translations

### Pull Request Process
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'feat: Add your feature'`
6. Push: `git push origin feature/your-feature`
7. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

**TL;DR**: Free to use, modify, and distribute. Just keep the copyright notice.

---

## 🙏 Acknowledgments

### Libraries & Frameworks
- [xterm.js](https://xtermjs.org/) - Terminal rendering engine
- [node-pty](https://github.com/microsoft/node-pty) - PTY spawning
- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://react.dev/) - UI library
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [Vite](https://vitejs.dev/) - Build tool

### AI Agents Supported
- [Claude Code](https://www.anthropic.com/claude) - by Anthropic
- [OpenCode](https://github.com/openchats/openchats) - Open source
- [Droid](https://github.com/termux/termux-app) - Terminal agent
- And many more...

---

## 📞 Support & Contact

### Getting Help
- **🐛 Report a Bug**: [GitHub Issues](https://github.com/TheDemonTuan/all-agent-in-one/issues)
- **💡 Request a Feature**: [GitHub Discussions](https://github.com/TheDemonTuan/all-agent-in-one/discussions)
- **📖 Documentation**: This README file
- **💬 Community**: Join discussions on GitHub

### About the Author

**TheDemonTuan (TDT)**
- GitHub: [@TheDemonTuan](https://github.com/TheDemonTuan)
- Project: TDT Space (named after the author)

**TDT** = **T**he**D**emon**T**uan

---

## 🚀 What's Next?

### Planned for v1.2.0
- [ ] Terminal pane resizing (drag to resize)
- [ ] Custom color themes
- [ ] Command palette with fuzzy search
- [ ] Keyboard shortcuts customization
- [ ] Notifications for long-running commands

### Recent Updates (v1.1.0)
- ✅ Complete codebase refactor into modular architecture
- ✅ Domain-based component organization
- ✅ Extracted IPC handlers into separate files
- ✅ Added centralized configuration layer
- ✅ Introduced service layer for business logic
- ✅ Enhanced type definitions for all domains
- ✅ Added centralized logging system
- ✅ Improved workspace navigation with hooks
- ✅ Vietnamese IME support for Claude Code

### Future Roadmap
- [ ] macOS support
- [ ] Linux support
- [ ] Auto-updater
- [ ] Plugin system
- [ ] Cloud workspace sync

---

<div align="center">

### ⭐ Enjoy TDT Space?

If you find this project helpful, please consider:
- **Starring** this repository
- **Sharing** with other developers
- **Contributing** to the project

**Built with ❤️ by TheDemonTuan**

[Report an Issue](https://github.com/TheDemonTuan/all-agent-in-one/issues) • [Request a Feature](https://github.com/TheDemonTuan/all-agent-in-one/discussions) • [Download Latest](https://github.com/TheDemonTuan/all-agent-in-one/releases)

</div>
