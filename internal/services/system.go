package services

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"tdt-space/internal/platform"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// SystemService — replaces system.handlers.ts
// ============================================================================

// SystemService provides system information and native dialogs.
type SystemService struct {
	Ctx context.Context
}

// NewSystemService creates a new SystemService.
func NewSystemService() *SystemService {
	return &SystemService{}
}

// GetAppVersion returns the application version.
func (s *SystemService) GetAppVersion() string {
	if v := os.Getenv("TDT_VERSION"); v != "" {
		return v
	}
	return "1.0.0"
}

// GetPlatform returns the current OS platform.
// Returns Electron-compatible values: "win32", "darwin", "linux"
func (s *SystemService) GetPlatform() string {
	switch runtime.GOOS {
	case "windows":
		return "win32"
	case "darwin":
		return "darwin"
	default:
		return "linux"
	}
}

// GetCwd returns the current working directory.
func (s *SystemService) GetCwd() string {
	cwd, err := os.Getwd()
	if err != nil {
		return platform.GetUserHome()
	}
	return cwd
}

// ShowOpenDialog shows a native open dialog.
func (s *SystemService) ShowOpenDialog(opts DialogOptions) DialogResult {
	isDir := false
	for _, p := range opts.Properties {
		if p == "openDirectory" {
			isDir = true
			break
		}
	}

	if isDir {
		path, err := wailsruntime.OpenDirectoryDialog(s.Ctx, wailsruntime.OpenDialogOptions{
			Title:                opts.Title,
			DefaultDirectory:     opts.DefaultPath,
			CanCreateDirectories: true,
		})
		if err != nil || path == "" {
			return DialogResult{Canceled: true, FilePaths: []string{}}
		}
		return DialogResult{Canceled: false, FilePaths: []string{path}}
	}

	path, err := wailsruntime.OpenFileDialog(s.Ctx, wailsruntime.OpenDialogOptions{
		Title:            opts.Title,
		DefaultDirectory: opts.DefaultPath,
	})
	if err != nil || path == "" {
		return DialogResult{Canceled: true, FilePaths: []string{}}
	}
	return DialogResult{Canceled: false, FilePaths: []string{path}}
}

// GetEnv returns an environment variable value.
func (s *SystemService) GetEnv(key string) string {
	return os.Getenv(key)
}

// OpenExternal opens a URL or path in the system's default application.
func (s *SystemService) OpenExternal(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
		cmd.SysProcAttr = platform.HiddenWindowAttr()
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

// GetShellInfo returns information about the current shell.
func (s *SystemService) GetShellInfo() map[string]string {
	shell := platform.GetDefaultShell()
	parts := strings.Fields(shell)
	name := ""
	if len(parts) > 0 {
		name = parts[len(parts)-1]
	}
	return map[string]string{
		"path": shell,
		"name": name,
	}
}
