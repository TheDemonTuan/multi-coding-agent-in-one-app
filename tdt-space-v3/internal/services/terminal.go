package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"tdt-space/internal/platform"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ============================================================================
// TerminalService — manages all PTY processes
// ============================================================================

// pendingEvent represents an event waiting to be emitted when context becomes available.
type pendingEvent struct {
	eventName string
	payload   interface{}
}

// ptyProcess wraps a PTY with its associated metadata.
type ptyProcess struct {
	id         string
	pty        *platform.PTYHandle
	cmd        *exec.Cmd // nil on Windows (ConPTY manages the process)
	cancelFunc context.CancelFunc
	batcher    *terminalBatcher
}

// TerminalService manages all PTY processes.
type TerminalService struct {
	app              *application.App
	mu               sync.RWMutex
	processes        map[string]*ptyProcess
	pendingEvents    []pendingEvent // Queue for events when context is nil
	eventsMu         sync.Mutex     // Protects pendingEvents

	// Workspace active state tracking (Option C: Hybrid background optimization)
	workspaceActiveMu sync.RWMutex
	workspaceActive   map[string]bool // workspaceID -> active state
}

// NewTerminalService creates a new TerminalService.
func NewTerminalService() *TerminalService {
	return &TerminalService{
		processes:       make(map[string]*ptyProcess),
		pendingEvents:   make([]pendingEvent, 0),
		workspaceActive: make(map[string]bool),
	}
}

// SetApplication sets the Wails application instance.
// Called by App.ServiceStartup() when the application is ready.
func (t *TerminalService) SetApplication(app *application.App) {
	t.eventsMu.Lock()
	t.app = app
	hasPending := len(t.pendingEvents) > 0
	t.eventsMu.Unlock()

	if hasPending {
		t.flushPendingEvents()
	}
}

// getApp returns the current Wails application instance (may be nil before startup).
func (t *TerminalService) getApp() *application.App {
	return t.app
}

// emitEvent emits an event or queues it if application is not yet available.
func (t *TerminalService) emitEvent(eventName string, payload map[string]interface{}) {
	t.eventsMu.Lock()
	defer t.eventsMu.Unlock()

	app := t.getApp()
	if app != nil {
		log.Printf("[DEBUG] Emitting event %s: %v", eventName, payload)
		app.Event.Emit(eventName, payload)
	} else {
		// Queue the event for later emission when application becomes available
		t.pendingEvents = append(t.pendingEvents, pendingEvent{
			eventName: eventName,
			payload:   payload,
		})
		log.Printf("[WARN] Application is nil, queuing event %s for later emission", eventName)
	}
}

// flushPendingEvents emits all queued events once application is available.
// Must be called with eventsMu held or from a context where race is not possible.
func (t *TerminalService) flushPendingEvents() {
	t.eventsMu.Lock()
	defer t.eventsMu.Unlock()

	app := t.getApp()
	if app == nil {
		log.Printf("[WARN] flushPendingEvents called but application is still nil")
		return
	}

	pendingCount := len(t.pendingEvents) // Save count BEFORE clearing
	for _, event := range t.pendingEvents {
		app.Event.Emit(event.eventName, event.payload)
		log.Printf("[INFO] Flushed pending event: %s", event.eventName)
	}
	t.pendingEvents = make([]pendingEvent, 0)
	log.Printf("[INFO] Flushed %d pending events", pendingCount) // Use saved count
}

// ============================================================================
// SpawnTerminal — spawn a plain terminal (no agent)
// ============================================================================

// SpawnTerminalOptions mirrors the Electron spawn options.
type SpawnTerminalOptions struct {
	ID          string `json:"id"`
	CWD         string `json:"cwd,omitempty"`
	Cols        int    `json:"cols,omitempty"`
	Rows        int    `json:"rows,omitempty"`
	WorkspaceID string `json:"workspaceId,omitempty"` // For background optimization
}

// SpawnTerminal spawns a new PTY process.
func (t *TerminalService) SpawnTerminal(opts SpawnTerminalOptions) SpawnResult {
	if opts.ID == "" {
		return SpawnResult{Success: false, Error: "terminal ID is required"}
	}

	t.killProcess(opts.ID) // kill any existing process with same ID

	cols, rows := clampSize(opts.Cols, opts.Rows)
	cwd := resolveCWD(opts.CWD)

	shell, shellArgs := platform.GetDefaultShellAndArgs()

	handle, err := platform.StartPTY(platform.PTYOptions{
		Command: shell,
		Args:    shellArgs,
		Dir:     cwd,
		Env:     buildEnv(opts.ID),
		Cols:    uint16(cols),
		Rows:    uint16(rows),
	})
	if err != nil {
		errMsg := err.Error()
		// Emit error event BEFORE returning so frontend can display error
		t.emitEvent("terminal-error", map[string]interface{}{
			"terminalId": opts.ID,
			"error":      errMsg,
		})
		return SpawnResult{Success: false, Error: errMsg}
	}

	ctx, cancel := context.WithCancel(context.Background())
	batcher := newTerminalBatcher(opts.ID, t.getApp)
	if opts.WorkspaceID != "" {
		batcher.SetWorkspace(opts.WorkspaceID)
		// Check if workspace is active
		batcher.SetActive(t.IsWorkspaceActive(opts.WorkspaceID))
	}
	proc := &ptyProcess{
		id:         opts.ID,
		pty:        handle,
		cancelFunc: cancel,
		batcher:    batcher,
	}

	t.mu.Lock()
	t.processes[opts.ID] = proc
	t.mu.Unlock()

	// Emit terminal-started event (queued if context not yet available)
	t.emitEvent("terminal-started", map[string]interface{}{
		"terminalId": opts.ID,
		"pid":        handle.Pid,
	})

	go t.readPTYOutput(ctx, proc)

	return SpawnResult{Success: true, PID: handle.Pid}
}

// ============================================================================
// SpawnTerminalWithAgent — spawn a terminal running an AI agent
// ============================================================================

// SpawnAgentOptions mirrors the Electron spawn-terminal-with-agent options.
type SpawnAgentOptions struct {
	ID          string   `json:"id"`
	CWD         string   `json:"cwd,omitempty"`
	AgentType   string   `json:"agentType"`
	Command     string   `json:"command,omitempty"` // override command
	Args        []string `json:"args,omitempty"`    // additional args
	Cols        int      `json:"cols,omitempty"`
	Rows        int      `json:"rows,omitempty"`
	WorkspaceID string   `json:"workspaceId,omitempty"` // For background optimization
}

// SpawnTerminalWithAgent spawns a PTY running an AI agent command.
func (t *TerminalService) SpawnTerminalWithAgent(opts SpawnAgentOptions) SpawnResult {
	if opts.ID == "" {
		return SpawnResult{Success: false, Error: "terminal ID is required"}
	}
	if opts.AgentType == "" {
		return SpawnResult{Success: false, Error: "agent type is required"}
	}

	t.killProcess(opts.ID)

	cols, rows := clampSize(opts.Cols, opts.Rows)
	cwd := resolveCWD(opts.CWD)

	agentCmd, agentArgs := resolveAgentCommand(opts.AgentType, opts.Command, opts.Args)
	if agentCmd == "" {
		return SpawnResult{Success: false, Error: fmt.Sprintf("unsupported agent type: '%s'. Supported: claude-code, opencode, droid, gemini-cli, aider, codex, amp, continue", opts.AgentType)}
	}

	// Pre-check: verify command exists in PATH before attempting to spawn
	if _, err := exec.LookPath(agentCmd); err != nil {
		installCmd := getAgentInstallCommand(opts.AgentType, agentCmd)
		errMsg := fmt.Sprintf("command '%s' not found in PATH", agentCmd)
		if installCmd != "" {
			errMsg += fmt.Sprintf(". Please install with: %s", installCmd)
		}
		// Emit error event BEFORE returning so frontend can display error
		log.Printf("[DEBUG] Emitting terminal-error for %s: %s", opts.ID, errMsg)
		t.emitEvent("terminal-error", map[string]interface{}{
			"terminalId": opts.ID,
			"error":      errMsg,
		})
		return SpawnResult{Success: false, Error: errMsg}
	}

	handle, err := platform.StartPTY(platform.PTYOptions{
		Command: agentCmd,
		Args:    agentArgs,
		Dir:     cwd,
		Env:     buildEnv(opts.ID),
		Cols:    uint16(cols),
		Rows:    uint16(rows),
	})
	if err != nil {
		// Provide user-friendly error message based on error type
		errMsg := fmt.Sprintf("failed to spawn agent: %v", err)
		if strings.Contains(err.Error(), "executable file not found") ||
			strings.Contains(err.Error(), "system cannot find the file") {
			installCmd := getAgentInstallCommand(opts.AgentType, agentCmd)
			errMsg = fmt.Sprintf("command '%s' not found in PATH", agentCmd)
			if installCmd != "" {
				errMsg += fmt.Sprintf(". Please install with: %s", installCmd)
			}
		}
		// Emit error event BEFORE returning so frontend can display error
		log.Printf("[DEBUG] Emitting terminal-error for %s (PTY error): %s", opts.ID, errMsg)
		t.emitEvent("terminal-error", map[string]interface{}{
			"terminalId": opts.ID,
			"error":      errMsg,
		})
		return SpawnResult{Success: false, Error: errMsg}
	}

	ctx, cancel := context.WithCancel(context.Background())
	batcher := newTerminalBatcher(opts.ID, t.getApp)
	if opts.WorkspaceID != "" {
		batcher.SetWorkspace(opts.WorkspaceID)
		// Check if workspace is active
		batcher.SetActive(t.IsWorkspaceActive(opts.WorkspaceID))
	}
	proc := &ptyProcess{
		id:         opts.ID,
		pty:        handle,
		cancelFunc: cancel,
		batcher:    batcher,
	}

	t.mu.Lock()
	t.processes[opts.ID] = proc
	t.mu.Unlock()

	// Emit terminal-started event (queued if context not yet available)
	t.emitEvent("terminal-started", map[string]interface{}{
		"terminalId": opts.ID,
		"pid":        handle.Pid,
	})

	go t.readPTYOutput(ctx, proc)

	return SpawnResult{Success: true, PID: handle.Pid}
}

// ============================================================================
// WriteToTerminal, ResizeTerminal, KillTerminal, Cleanup
// ============================================================================

// WriteToTerminal writes data to the terminal's PTY stdin.
func (t *TerminalService) WriteToTerminal(id string, data string) Result {
	t.mu.RLock()
	proc, ok := t.processes[id]
	t.mu.RUnlock()

	if !ok {
		return Result{Success: false, Error: fmt.Sprintf("terminal %s not found", id)}
	}

	_, err := io.WriteString(proc.pty, data)
	if err != nil {
		return Result{Success: false, Error: err.Error()}
	}
	return Result{Success: true}
}

// ResizeTerminal resizes the PTY window.
func (t *TerminalService) ResizeTerminal(id string, cols, rows int) Result {
	t.mu.RLock()
	proc, ok := t.processes[id]
	t.mu.RUnlock()

	if !ok {
		return Result{Success: false, Error: fmt.Sprintf("terminal %s not found", id)}
	}

	cols, rows = clampSize(cols, rows)
	err := proc.pty.Resize(uint16(cols), uint16(rows))
	if err != nil {
		return Result{Success: false, Error: err.Error()}
	}
	return Result{Success: true}
}

// KillTerminal kills the PTY process with the given ID.
func (t *TerminalService) KillTerminal(id string) KillResult {
	err := t.killProcess(id)
	if err != nil {
		return KillResult{Success: false, Error: err.Error()}
	}
	return KillResult{Success: true}
}

// CleanupAllTerminals kills all active PTY processes.
func (t *TerminalService) CleanupAllTerminals() CleanupResult {
	t.mu.Lock()
	ids := make([]string, 0, len(t.processes))
	for id := range t.processes {
		ids = append(ids, id)
	}
	t.mu.Unlock()

	for _, id := range ids {
		t.killProcess(id)
	}

	return CleanupResult{Success: true, Cleaned: ids}
}

// GetTerminalStatus returns the current status of a terminal process.
func (t *TerminalService) GetTerminalStatus(id string) map[string]interface{} {
	t.mu.RLock()
	proc, exists := t.processes[id]
	t.mu.RUnlock()

	if !exists {
		return map[string]interface{}{
			"exists": false,
			"status": "stopped",
		}
	}

	return map[string]interface{}{
		"exists": true,
		"status": "running",
		"pid":    proc.pty.Pid,
	}
}

// CleanupWorkspaceTerminals kills terminals belonging to a specific workspace.
func (t *TerminalService) CleanupWorkspaceTerminals(workspaceID string) CleanupResult {
	t.mu.Lock()
	var toKill []string
	for id := range t.processes {
		if strings.HasPrefix(id, workspaceID+"-") || strings.Contains(id, workspaceID) {
			toKill = append(toKill, id)
		}
	}
	t.mu.Unlock()

	for _, id := range toKill {
		t.killProcess(id)
	}
	return CleanupResult{Success: true, Cleaned: toKill}
}

// ============================================================================
// Internal helpers
// ============================================================================

func (t *TerminalService) killProcess(id string) error {
	t.mu.Lock()
	proc, ok := t.processes[id]
	if ok {
		delete(t.processes, id)
	}
	t.mu.Unlock()

	if !ok {
		return nil
	}

	if proc.batcher != nil {
		proc.batcher.stop()
	}

	proc.cancelFunc()
	proc.pty.Close()

	// For Unix, we also have proc.cmd; ConPTY manages its own process.
	if proc.cmd != nil && proc.cmd.Process != nil {
		platform.KillProcessTree(proc.cmd.Process.Pid)

		done := make(chan struct{})
		go func() {
			proc.cmd.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
		}
	} else if proc.pty.Pid > 0 {
		platform.KillProcessTree(proc.pty.Pid)
	}

	return nil
}

func (t *TerminalService) readPTYOutput(ctx context.Context, proc *ptyProcess) {
	// Increased buffer size for better handling of large output bursts
	// This helps prevent text scrambling when ConPTY sends large chunks
	buf := make([]byte, 16384)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		n, err := proc.pty.Read(buf)
		if n > 0 {
			data := make([]byte, n)
			copy(data, buf[:n])
			proc.batcher.write(data)
		}
		if err != nil {
			// PTY closed, process has exited - emit terminal-exit
			t.mu.Lock()
			delete(t.processes, proc.id)
			t.mu.Unlock()

			// Emit terminal-exit event (queued if context not yet available)
			t.emitEvent("terminal-exit", map[string]interface{}{
				"terminalId": proc.id,
				"exitCode":   0,
			})
			return
		}
	}
}

// ============================================================================
// Utility functions
// ============================================================================

func clampSize(cols, rows int) (int, int) {
	if cols <= 0 || cols > 500 {
		cols = 80
	}
	if rows <= 0 || rows > 200 {
		rows = 24
	}
	return cols, rows
}

func resolveCWD(cwd string) string {
	if cwd == "" {
		return platform.GetUserHome()
	}
	cwd = platform.ExpandTilde(cwd)
	if _, err := os.Stat(cwd); err != nil {
		return platform.GetUserHome()
	}
	return cwd
}

func buildEnv(terminalID string) []string {
	env := os.Environ()

	// Use xterm-256color on all platforms for better escape sequence support
	// This is what Windows Terminal, VS Code terminal, and Warp all use
	termVar := "TERM=xterm-256color"

	env = append(env,
		termVar,
		"COLORTERM=truecolor",
		"TDT_TERMINAL_ID="+terminalID,
		"LC_ALL=C.UTF-8",
		"LANG=en_US.UTF-8",
	)
	return filterEnv(env, "TERM_PROGRAM")
}

func filterEnv(env []string, keys ...string) []string {
	result := env[:0]
	for _, e := range env {
		keep := true
		for _, k := range keys {
			if strings.HasPrefix(e, k+"=") {
				keep = false
				break
			}
		}
		if keep {
			result = append(result, e)
		}
	}
	return result
}

// resolveAgentCommand maps agent type to command + args.
// Mirrors src/config/agents.ts AGENT_CONFIGS.
func resolveAgentCommand(agentType, overrideCmd string, extraArgs []string) (string, []string) {
	if overrideCmd != "" {
		return overrideCmd, extraArgs
	}

	configs := map[string]struct {
		cmd  string
		args []string
	}{
		"claude-code": {cmd: "claude", args: []string{}},
		"opencode":    {cmd: "opencode", args: []string{}},
		"droid":       {cmd: "droid", args: []string{}},
		"gemini-cli":  {cmd: "gemini", args: []string{}},
		"aider":       {cmd: "aider", args: []string{}},
		"codex":       {cmd: "codex", args: []string{}},
		"amp":         {cmd: "amp", args: []string{}},
		"continue":    {cmd: "continue", args: []string{}},
	}

	if cfg, ok := configs[agentType]; ok {
		args := append(cfg.args, extraArgs...)
		return cfg.cmd, args
	}

	return "", nil
}

// getAgentInstallCommand returns the install command for a given agent type.
// Helps users install missing agents with a single copy-paste command.
func getAgentInstallCommand(agentType, agentCmd string) string {
	installs := map[string]string{
		"claude-code":  "bun install -g @anthropics/claude-code",
		"opencode":     "bun install -g opencode-ai",
		"droid":        "bun install -g @droid/cli",
		"gemini-cli":   "npm install -g @anthropic-ai/gemini-cli",
		"aider":        "pip install aider-chat",
		"codex":        "npm install -g codex",
		"amp":          "npm install -g @amp/cli",
		"continue":     "npm install -g continue",
	}
	if cmd, ok := installs[agentType]; ok {
		return cmd
	}
	return ""
}

// ============================================================================
// Workspace Active State Tracking (Option C: Hybrid background optimization)
// ============================================================================

// SetWorkspaceActive sets whether a workspace is currently active (visible to user).
// When inactive, terminal data is buffered instead of emitted to reduce CPU/memory usage.
func (t *TerminalService) SetWorkspaceActive(workspaceID string, active bool) {
	t.workspaceActiveMu.Lock()
	t.workspaceActive[workspaceID] = active
	t.workspaceActiveMu.Unlock()

	// Update all terminals belonging to this workspace
	t.mu.RLock()
	defer t.mu.RUnlock()

	for _, proc := range t.processes {
		if proc.batcher != nil && proc.batcher.getWorkspaceID() == workspaceID {
			proc.batcher.SetActive(active)
		}
	}

	log.Printf("[INFO] Workspace %s: set active=%v", workspaceID, active)
}

// IsWorkspaceActive returns whether a workspace is currently active.
func (t *TerminalService) IsWorkspaceActive(workspaceID string) bool {
	t.workspaceActiveMu.RLock()
	defer t.workspaceActiveMu.RUnlock()

	// Default to true if not set (workspace is active by default)
	active, exists := t.workspaceActive[workspaceID]
	if !exists {
		return true
	}
	return active
}

// GetTerminalBacklog returns buffered data for a terminal when workspace becomes active.
func (t *TerminalService) GetTerminalBacklog(terminalID string) string {
	t.mu.RLock()
	defer t.mu.RUnlock()

	proc, exists := t.processes[terminalID]
	if !exists || proc.batcher == nil {
		return ""
	}

	return proc.batcher.GetBacklog()
}

// ClearTerminalBacklog clears the backlog after it has been retrieved.
func (t *TerminalService) ClearTerminalBacklog(terminalID string) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	proc, exists := t.processes[terminalID]
	if !exists || proc.batcher == nil {
		return
	}

	proc.batcher.ClearBacklog()
}
