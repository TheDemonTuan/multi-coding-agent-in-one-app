//go:build !windows

package platform

import (
	"os/exec"
	"syscall"
)

// HiddenWindowAttr returns empty SysProcAttr on Unix (no-op).
func HiddenWindowAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{}
}

// hiddenWindowForCmd is a no-op on Unix.
func hiddenWindowForCmd(_ *exec.Cmd) {}

// killUnixProcessGroup kills the process group of the given PID using SIGKILL.
func killUnixProcessGroup(pid int) error {
	return syscall.Kill(-pid, syscall.SIGKILL)
}
