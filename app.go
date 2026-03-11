package main

import (
	"context"
	"fmt"
	"log"

	"tdt-space/internal/services"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct holds the application context and services.
type App struct {
	ctx              context.Context
	terminalSvc      *services.TerminalService
	storeSvc         *services.StoreService
	systemSvc        *services.SystemService
	vietnameseIMESvc *services.VietnameseIMEService
}

// NewApp creates a new App with required services.
func NewApp(terminalSvc *services.TerminalService, storeSvc *services.StoreService, systemSvc *services.SystemService, vietnameseIMESvc *services.VietnameseIMEService) *App {
	return &App{
		terminalSvc:      terminalSvc,
		storeSvc:         storeSvc,
		systemSvc:        systemSvc,
		vietnameseIMESvc: vietnameseIMESvc,
	}
}

// startup is called when the app starts. The context is saved here.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Pass context to services that need to emit events
	// Use SetContext for TerminalService to flush any pending events
	if a.terminalSvc != nil {
		a.terminalSvc.SetContext(ctx)
	}
	if a.systemSvc != nil {
		a.systemSvc.Ctx = ctx
	}
}

// beforeClose is called before the window is closed, returning true will prevent close.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	// Cleanup all terminals on close
	if a.terminalSvc != nil {
		a.terminalSvc.CleanupAllTerminals()
	}
	return false
}

// shutdown is called when the app shuts down.
func (a *App) shutdown(ctx context.Context) {
	// Close the store
	if a.storeSvc != nil {
		a.storeSvc.Close()
	}
}

// menu builds the application menu.
func (a *App) menu() *menu.Menu {
	appMenu := menu.NewMenu()

	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("New Workspace", keys.CmdOrCtrl("n"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "menu:new-workspace")
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("Settings", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "menu:open-settings")
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		runtime.Quit(a.ctx)
	})

	viewMenu := appMenu.AddSubmenu("View")
	viewMenu.AddText("Toggle Fullscreen", keys.Key("F11"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "menu:toggle-fullscreen")
	})

	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.AddText("About TDT Space", nil, func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "menu:about")
	})

	return appMenu
}

// WindowMinimize minimizes the window.
func (a *App) WindowMinimize() {
	runtime.WindowMinimise(a.ctx)
}

// WindowMaximize toggles maximize state.
func (a *App) WindowMaximize() {
	if runtime.WindowIsMaximised(a.ctx) {
		runtime.WindowUnmaximise(a.ctx)
	} else {
		runtime.WindowMaximise(a.ctx)
	}
}

// WindowClose closes the app.
func (a *App) WindowClose() {
	runtime.Quit(a.ctx)
}

// WindowIsMaximized returns whether the window is maximized.
func (a *App) WindowIsMaximized() bool {
	return runtime.WindowIsMaximised(a.ctx)
}

// ============================================================================
// TerminalService wrappers
// ============================================================================

// SpawnTerminal spawns a new terminal.
func (a *App) SpawnTerminal(id string, cwd string, workspaceId string, cols int, rows int) map[string]interface{} {
	result := a.terminalSvc.SpawnTerminal(services.SpawnTerminalOptions{
		ID:          id,
		CWD:         cwd,
		Cols:        cols,
		Rows:        rows,
		WorkspaceID: workspaceId,
	})
	return map[string]interface{}{
		"success": result.Success,
		"pid":     result.PID,
		"error":   result.Error,
	}
}

// SpawnTerminalWithAgent spawns a new terminal with an AI agent.
func (a *App) SpawnTerminalWithAgent(id string, cwd string, agentType string, workspaceId string, cols int, rows int) map[string]interface{} {
	fmt.Printf("[DEBUG] SpawnTerminalWithAgent: id=%s, agentType=%s, cwd=%s, workspaceId=%s, cols=%d, rows=%d\n", id, agentType, cwd, workspaceId, cols, rows)
	result := a.terminalSvc.SpawnTerminalWithAgent(services.SpawnAgentOptions{
		ID:          id,
		CWD:         cwd,
		AgentType:   agentType,
		Cols:        cols,
		Rows:        rows,
		WorkspaceID: workspaceId,
	})
	fmt.Printf("[DEBUG] SpawnTerminalWithAgent result: success=%v, pid=%d, error=%s\n", result.Success, result.PID, result.Error)

	// Also log to standard log for visibility
	if !result.Success {
		log.Printf("[SpawnTerminalWithAgent] Failed for %s (agent=%s): %s", id, agentType, result.Error)
	}

	return map[string]interface{}{
		"success": result.Success,
		"pid":     result.PID,
		"error":   result.Error,
	}
}

// WriteToTerminal writes data to a terminal.
func (a *App) WriteToTerminal(id string, data string) map[string]interface{} {
	result := a.terminalSvc.WriteToTerminal(id, data)
	return map[string]interface{}{
		"success": result.Success,
		"error":   result.Error,
	}
}

// KillTerminal kills a terminal.
func (a *App) KillTerminal(id string) map[string]interface{} {
	result := a.terminalSvc.KillTerminal(id)
	return map[string]interface{}{
		"success": result.Success,
		"error":   result.Error,
	}
}

// ResizeTerminal resizes a terminal.
func (a *App) ResizeTerminal(id string, cols int, rows int) map[string]interface{} {
	result := a.terminalSvc.ResizeTerminal(id, cols, rows)
	return map[string]interface{}{
		"success": result.Success,
		"error":   result.Error,
	}
}

// GetTerminalStatus returns the status of a terminal.
func (a *App) GetTerminalStatus(id string) map[string]interface{} {
	return a.terminalSvc.GetTerminalStatus(id)
}

// SetWorkspaceActive sets whether a workspace is active (for background optimization).
func (a *App) SetWorkspaceActive(workspaceID string, active bool) map[string]interface{} {
	a.terminalSvc.SetWorkspaceActive(workspaceID, active)
	return map[string]interface{}{
		"success": true,
	}
}

// GetTerminalBacklog returns buffered data for a terminal.
func (a *App) GetTerminalBacklog(terminalID string) map[string]interface{} {
	backlog := a.terminalSvc.GetTerminalBacklog(terminalID)
	return map[string]interface{}{
		"success": true,
		"backlog": backlog,
	}
}

// ClearTerminalBacklog clears the backlog for a terminal.
func (a *App) ClearTerminalBacklog(terminalID string) map[string]interface{} {
	a.terminalSvc.ClearTerminalBacklog(terminalID)
	return map[string]interface{}{
		"success": true,
	}
}

// ============================================================================
// StoreService wrappers
// ============================================================================

// GetValue gets a value from the store.
func (a *App) GetValue(key string) interface{} {
	return a.storeSvc.GetValue(key)
}

// SetValue sets a value in the store.
func (a *App) SetValue(key string, value interface{}) map[string]interface{} {
	result := a.storeSvc.SetValue(key, value)
	return map[string]interface{}{
		"success": result.Success,
		"error":   result.Error,
	}
}

// DeleteValue deletes a value from the store.
func (a *App) DeleteValue(key string) map[string]interface{} {
	result := a.storeSvc.DeleteValue(key)
	return map[string]interface{}{
		"success": result.Success,
		"error":   result.Error,
	}
}

// ============================================================================
// SystemService wrappers
// ============================================================================

// GetAppVersion returns the app version.
func (a *App) GetAppVersion() string {
	return a.systemSvc.GetAppVersion()
}

// GetPlatform returns the current platform.
func (a *App) GetPlatform() string {
	return a.systemSvc.GetPlatform()
}

// GetCwd returns the current working directory.
func (a *App) GetCwd() string {
	return a.systemSvc.GetCwd()
}

// ShowOpenDialog shows a native open dialog for selecting files or directories.
func (a *App) ShowOpenDialog(opts services.DialogOptions) services.DialogResult {
	return a.systemSvc.ShowOpenDialog(opts)
}

// ListDirectory returns a list of entries in the specified directory.
func (a *App) ListDirectory(path string) services.DirectoryListing {
	return a.systemSvc.ListDirectory(path)
}

// ============================================================================
// VietnameseIMEService wrappers
// ============================================================================

// ApplyVietnameseImePatch applies the Vietnamese IME patch to Claude Code.
func (a *App) ApplyVietnameseImePatch() services.PatchResult {
	return a.vietnameseIMESvc.ApplyVietnameseImePatch()
}

// CheckVietnameseImePatchStatus returns the current patch status.
func (a *App) CheckVietnameseImePatchStatus() services.PatchStatus {
	return a.vietnameseIMESvc.GetPatchStatus()
}

// GetVietnameseImeSettings returns the Vietnamese IME settings.
func (a *App) GetVietnameseImeSettings() services.IMESettings {
	return a.vietnameseIMESvc.GetIMESettings()
}

// SetVietnameseImeSettings sets the Vietnamese IME settings.
func (a *App) SetVietnameseImeSettings(settings services.IMESettings) services.Result {
	return a.vietnameseIMESvc.SaveIMESettings(settings)
}

// RestoreVietnameseImePatch restores the original Claude Code from backup.
func (a *App) RestoreVietnameseImePatch() services.RestoreResult {
	return a.vietnameseIMESvc.RestoreFromBackup()
}

// ValidateVietnameseImePatch validates the current patch status.
func (a *App) ValidateVietnameseImePatch() services.PatchValidation {
	return a.vietnameseIMESvc.ValidatePatch()
}
