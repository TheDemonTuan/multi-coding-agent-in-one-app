package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"tdt-space/internal/platform"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ============================================================================
// SystemService — replaces system.handlers.ts
// ============================================================================

// SystemService provides system information and native dialogs.
type SystemService struct {
	app *application.App
}

// NewSystemService creates a new SystemService.
func NewSystemService() *SystemService {
	return &SystemService{}
}

// SetApplication sets the Wails application instance for dialog operations.
func (s *SystemService) SetApplication(app *application.App) {
	s.app = app
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

	if s.app == nil {
		return DialogResult{Canceled: true, FilePaths: []string{}}
	}

	if isDir {
		dialog := s.app.Dialog.OpenFile().
			SetTitle(opts.Title).
			CanChooseDirectories(true).
			CanChooseFiles(false).
			CanCreateDirectories(true)
		if opts.DefaultPath != "" {
			dialog.SetDirectory(opts.DefaultPath)
		}
		path, err := dialog.PromptForSingleSelection()
		if err != nil || path == "" {
			return DialogResult{Canceled: true, FilePaths: []string{}}
		}
		return DialogResult{Canceled: false, FilePaths: []string{path}}
	}

	dialog := s.app.Dialog.OpenFile().
		SetTitle(opts.Title).
		CanChooseDirectories(false).
		CanChooseFiles(true)
	if opts.DefaultPath != "" {
		dialog.SetDirectory(opts.DefaultPath)
	}
	path, err := dialog.PromptForSingleSelection()
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

// ListDirectory returns a list of entries in the specified directory.
// Expands ~ to the user's home directory.
func (s *SystemService) ListDirectory(path string) DirectoryListing {
	// Expand ~ to home directory
	if strings.HasPrefix(path, "~") {
		home := platform.GetUserHome()
		path = filepath.Join(home, strings.TrimPrefix(path, "~"))
	}

	// Handle relative paths
	if !filepath.IsAbs(path) {
		cwd, err := os.Getwd()
		if err != nil {
			return DirectoryListing{Error: err.Error()}
		}
		path = filepath.Join(cwd, path)
	}

	// Clean the path
	path = filepath.Clean(path)

	// Read directory contents
	entries, err := os.ReadDir(path)
	if err != nil {
		return DirectoryListing{Error: err.Error()}
	}

	// Convert to DirectoryEntry slice
	result := make([]DirectoryEntry, 0, len(entries))
	for _, entry := range entries {
		fullPath := filepath.Join(path, entry.Name())
		result = append(result, DirectoryEntry{
			Name:        entry.Name(),
			Path:        fullPath,
			IsDirectory: entry.IsDir(),
		})
	}

	return DirectoryListing{Entries: result}
}
