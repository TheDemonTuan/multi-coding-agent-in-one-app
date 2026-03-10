package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"tdt-space/internal/platform"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// TerminalService — manages all PTY processes
// ============================================================================

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
	Ctx       context.Context // Set by App.startup()
	mu        sync.RWMutex
	processes map[string]*ptyProcess
}

// NewTerminalService creates a new TerminalService.
func NewTerminalService() *TerminalService {
	return &TerminalService{
		processes: make(map[string]*ptyProcess),
	}
}

// getCtx returns the current Wails context (may be nil before startup).
func (t *TerminalService) getCtx() context.Context {
	return t.Ctx
}

// ============================================================================
// SpawnTerminal — spawn a plain terminal (no agent)
// ============================================================================

// SpawnTerminalOptions mirrors the Electron spawn options.
type SpawnTerminalOptions struct {
	ID   string `json:"id"`
	CWD  string `json:"cwd,omitempty"`
	Cols int    `json:"cols,omitempty"`
	Rows int    `json:"rows,omitempty"`
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
		return SpawnResult{Success: false, Error: err.Error()}
	}

	ctx, cancel := context.WithCancel(context.Background())
	batcher := newTerminalBatcher(opts.ID, t.getCtx)
	proc := &ptyProcess{
		id:         opts.ID,
		pty:        handle,
		cancelFunc: cancel,
		batcher:    batcher,
	}

	t.mu.Lock()
	t.processes[opts.ID] = proc
	t.mu.Unlock()

	// Emit terminal-started event
	if ctx := t.getCtx(); ctx != nil {
		wailsruntime.EventsEmit(ctx, "terminal-started", map[string]interface{}{
			"terminalId": opts.ID,
			"pid":        handle.Pid,
		})
	}

	go t.readPTYOutput(ctx, proc)
	go t.watchProcessExitByPTY(proc)

	return SpawnResult{Success: true, PID: handle.Pid}
}

// ============================================================================
// SpawnTerminalWithAgent — spawn a terminal running an AI agent
// ============================================================================

// SpawnAgentOptions mirrors the Electron spawn-terminal-with-agent options.
type SpawnAgentOptions struct {
	ID        string   `json:"id"`
	CWD       string   `json:"cwd,omitempty"`
	AgentType string   `json:"agentType"`
	Command   string   `json:"command,omitempty"` // override command
	Args      []string `json:"args,omitempty"`    // additional args
	Cols      int      `json:"cols,omitempty"`
	Rows      int      `json:"rows,omitempty"`
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
		return SpawnResult{Success: false, Error: errMsg}
	}

	ctx, cancel := context.WithCancel(context.Background())
	batcher := newTerminalBatcher(opts.ID, t.getCtx)
	proc := &ptyProcess{
		id:         opts.ID,
		pty:        handle,
		cancelFunc: cancel,
		batcher:    batcher,
	}

	t.mu.Lock()
	t.processes[opts.ID] = proc
	t.mu.Unlock()

	// Emit terminal-started event
	if ctx := t.getCtx(); ctx != nil {
		wailsruntime.EventsEmit(ctx, "terminal-started", map[string]interface{}{
			"terminalId": opts.ID,
			"pid":        handle.Pid,
		})
	}

	go t.readPTYOutput(ctx, proc)
	go t.watchProcessExitByPTY(proc)

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
	buf := make([]byte, 4096)
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
			return
		}
	}
}

// watchProcessExitByPTY waits for the PTY process to exit (pid-based, works for both Unix and Windows).
func (t *TerminalService) watchProcessExitByPTY(proc *ptyProcess) {
	exitCode := 0

	// Unix path: wait on exec.Cmd
	if proc.cmd != nil {
		if err := proc.cmd.Wait(); err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			}
		}
	} else {
		// Windows ConPTY path: poll until PID is gone
		pid := proc.pty.Pid
		if pid > 0 {
			for {
				p, err := os.FindProcess(pid)
				if err != nil {
					break
				}
				// On Windows, Signal(0) returns nil if process is still alive
				if err := p.Signal(os.Signal(nil)); err != nil {
					break
				}
				time.Sleep(500 * time.Millisecond)
			}
		}
	}

	t.mu.Lock()
	delete(t.processes, proc.id)
	t.mu.Unlock()

	if ctx := t.getCtx(); ctx != nil {
		wailsruntime.EventsEmit(ctx, "terminal-exit", map[string]interface{}{
			"terminalId": proc.id,
			"exitCode":   exitCode,
		})
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
	env = append(env,
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
		"TDT_TERMINAL_ID="+terminalID,
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