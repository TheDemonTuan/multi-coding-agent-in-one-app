# Terminal Input/Output Fix & Optimization

## Tasks

- [x] Research terminal pipeline (backend + frontend)
- [x] Write implementation plan
- [x] **Phase 1: Remove broken echo prevention** (TerminalCell.tsx)
- [x] **Phase 2: Fix TERM env & encoding** (terminal.go)
- [x] **Phase 3: Fix batching timer race** (terminal_batching.go)
- [x] **Phase 4: Fix resize event flooding** (TerminalCell.tsx)
- [x] **Phase 5: Remove excessive debug logging** (terminal.go, terminal_batching.go)
- [x] **Phase 6: Verify changes** (manual testing via `wails dev`)
