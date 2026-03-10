//go:build windows

package platform

import "syscall"

// HiddenWindowAttr returns SysProcAttr that hides console windows on Windows.
func HiddenWindowAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{HideWindow: true}
}

// killUnixProcessGroup is a no-op on Windows.
func killUnixProcessGroup(_ int) error {
	return nil
}
