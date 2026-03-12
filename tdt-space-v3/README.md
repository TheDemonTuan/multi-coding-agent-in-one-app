# TDT Space - Wails v3 Migration

This is the Wails v3 migrated version of TDT Space.

## Prerequisites

- Go 1.22+
- Bun 1.0+
- wails3 CLI: `go install github.com/wailsapp/wails/v3/cmd/wails3@latest`
- Task (taskfile runner): https://taskfile.dev/installation/

## Project Structure

```
tdt-space-v3/
├── main.go                      # Entry point
├── app.go                       # App struct with service wrappers
├── Taskfile.yml                 # Build configuration (v3 uses Taskfile)
├── build/                       # Build scripts
│   ├── Taskfile.yml            # Common tasks
│   └── windows/                # Windows-specific tasks
├── go.mod                       # Go dependencies (v3)
├── internal/
│   ├── platform/               # PTY implementations
│   └── services/               # Business logic services
│       ├── terminal.go         # Migrated for v3
│       ├── terminal_batching.go # Migrated for v3
│       ├── system.go           # Migrated for v3
│       ├── store.go            # No changes needed
│       ├── workspace.go        # No changes needed
│       ├── template.go         # No changes needed
│       ├── ime.go              # No changes needed
│       └── types.go            # No changes needed
└── frontend/
    ├── package.json            # Updated for v3
    ├── src/
    │   └── services/
    │       └── wails-bridge.ts # Migrated for v3
    └── dist/                   # Built frontend
```

## Key Changes from v2 to v3

### Backend (Go)

1. **Application Pattern**:
   - v2: `wails.Run(&options.App{...})`
   - v3: `application.New(application.Options{...})`

2. **Service Registration**:
   - v2: `Bind: []interface{}{...}`
   - v3: `Services: []application.Service{application.NewService(&svc), ...}`

3. **Event System**:
   - v2: `runtime.EventsEmit(ctx, eventName, data)`
   - v3: `app.Event.Emit(eventName, data)`

4. **Window Controls**:
   - v2: `runtime.WindowMinimise(ctx)`
   - v3: `app.Window.Current().Minimise()`

5. **Dialog APIs**:
   - v2: `runtime.OpenDirectoryDialog(ctx, opts)`
   - v3: `app.Dialog.OpenFile().SetTitle(...).PromptForSingleSelection()`

6. **Menu**:
   - v2: `menu.NewMenu()` with callbacks using `runtime.EventsEmit`
   - v3: `application.NewMenu()` with `app.Event.Emit`

7. **Build System**:
   - v2: `wails.json`
   - v3: `Taskfile.yml`

### Frontend (TypeScript)

1. **Event System**:
   - v2: `window.runtime.EventsOn(eventName, callback)`
   - v3: `Events.On(eventName, callback)` from `@wailsio/runtime`

2. **Bindings**:
   - v2: `window.go.main.App.MethodName()`
   - v3: Auto-generated in `../bindings/main.ts`

3. **Package**:
   - v3: Added `@wailsio/runtime` dependency

## Development

```bash
# Install dependencies
cd frontend && bun install

# Run in development mode (frontend + backend with hot reload)
task dev

# Or run frontend only
cd frontend && bun run dev
```

## Building

```bash
# Build production binary
task build

# Build and package (creates installer on Windows)
task package
```

## Verification

```bash
# Verify Go compilation
go build ./...

# Verify frontend compilation
cd frontend && bun run build

# Check wails3 installation
wails3 doctor
```

## Known Issues / TODO

1. **Event Registration**: Wails v3 uses type-safe events. Frontend needs to register event types.
2. **Bindings**: Auto-generated bindings need to be regenerated with `wails3 generate bindings`.
3. **Testing**: Full integration testing needed for all features.

## Migration Notes

The migration maintains backward compatibility in the API surface:
- All service methods work the same way
- Frontend types are preserved
- Event names are unchanged

The main changes are in:
- How the application is initialized (main.go)
- How services are registered
- How events are emitted
- How dialogs are opened

## References

- [Wails v3 Documentation](https://v3.wails.io/)
- [Wails v3 Migration Guide](https://v3.wails.io/docs/migration)
