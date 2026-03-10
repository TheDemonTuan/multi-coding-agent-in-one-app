// Package platform provides cross-platform utilities for shell detection,
// path resolution, and process management.
package platform

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

// IsWindows returns true on Windows.
func IsWindows() bool { return runtime.GOOS == "windows" }

// IsMacOS returns true on macOS.
func IsMacOS() bool { return runtime.GOOS == "darwin" }

// IsLinux returns true on Linux.
func IsLinux() bool { return runtime.GOOS == "linux" }

// ============================================================================
// SHELL CONFIGURATION
// ============================================================================

// GetDefaultShell returns the appropriate shell for the current platform.
func GetDefaultShell() string {
	if IsWindows() {
		return "powershell.exe"
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	if IsMacOS() {
		return "/bin/zsh"
	}
	return "/bin/bash"
}

// GetShellArgs returns the arguments to pass to the shell.
func GetShellArgs() []string {
	if IsWindows() {
		return []string{"-NoLogo", "-NoExit"}
	}
	return []string{}
}

// GetDefaultShellAndArgs returns the shell and its arguments as a pair.
func GetDefaultShellAndArgs() (string, []string) {
	return GetDefaultShell(), GetShellArgs()
}

// ============================================================================
// CONFIG DIRECTORY
// ============================================================================

// GetConfigDir returns the OS-appropriate config directory for tdt-space.
// Windows: %APPDATA%/tdt-space
// macOS:   ~/Library/Application Support/tdt-space
// Linux:   ~/.config/tdt-space
func GetConfigDir() string {
	var base string

	if IsWindows() {
		base = os.Getenv("APPDATA")
		if base == "" {
			home, _ := os.UserHomeDir()
			base = filepath.Join(home, "AppData", "Roaming")
		}
	} else if IsMacOS() {
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, "Library", "Application Support")
	} else {
		base = os.Getenv("XDG_CONFIG_HOME")
		if base == "" {
			home, _ := os.UserHomeDir()
			base = filepath.Join(home, ".config")
		}
	}

	dir := filepath.Join(base, "tdt-space")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

// ============================================================================
// PROCESS KILLING
// ============================================================================

// KillProcessTree kills a process and all its children.
// Windows: taskkill /f /t /pid <pid>
// Unix:    kills the process group
func KillProcessTree(pid int) error {
	if IsWindows() {
		cmd := exec.Command("taskkill", "/f", "/t", "/pid", fmt.Sprintf("%d", pid))
		cmd.SysProcAttr = HiddenWindowAttr()
		return cmd.Run()
	}
	return killUnixProcessGroup(pid)
}

// KillProcessByName kills all processes with the given image name (Windows only).
func KillProcessByName(name string) (int, error) {
	if !IsWindows() {
		return 0, nil
	}
	cmd := exec.Command("taskkill", "/F", "/IM", name)
	cmd.SysProcAttr = HiddenWindowAttr()
	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 128 {
				return 0, nil
			}
		}
		outStr := string(out)
		if strings.Contains(outStr, "No running instance") ||
			strings.Contains(outStr, "not running") {
			return 0, nil
		}
		return 0, err
	}

	count := strings.Count(string(out), "Successfully terminated")
	if count == 0 && len(out) > 0 {
		count = 1
	}
	return count, nil
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

// ExpandTilde replaces a leading ~ with the user's home directory.
func ExpandTilde(path string) string {
	if !strings.HasPrefix(path, "~") {
		return path
	}
	home := GetUserHome()
	if home == "" {
		return path
	}
	return filepath.Join(home, path[1:])
}

// RunCommand runs a command and returns the first line of stdout.
func RunCommand(cmd string, args ...string) string {
	c := exec.Command(cmd, args...)
	c.SysProcAttr = HiddenWindowAttr()
	out, err := c.Output()
	if err != nil {
		return ""
	}
	lines := strings.SplitN(strings.TrimSpace(string(out)), "\n", 2)
	if len(lines) > 0 {
		return strings.TrimSpace(strings.TrimRight(lines[0], "\r"))
	}
	return ""
}

// FileExists returns true if the given path exists and is accessible.
func FileExists(path string) bool {
	if path == "" {
		return false
	}
	_, err := os.Stat(path)
	return err == nil
}

// ResolveSymlink resolves symlinks and returns the real path.
func ResolveSymlink(path string) string {
	real, err := filepath.EvalSymlinks(path)
	if err != nil {
		return path
	}
	return real
}

// GetUserHome returns the user's home directory.
func GetUserHome() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return home
}
