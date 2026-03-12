//go:build !windows

package platform

import (
	"os"
	"os/exec"

	"github.com/creack/pty"
)

// StartPTY spawns the command described by opts in a Unix PTY.
func StartPTY(opts PTYOptions) (*PTYHandle, error) {
	cmd := exec.Command(opts.Command, opts.Args...)
	cmd.Dir = opts.Dir
	cmd.Env = opts.Env

	ptyFile, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: opts.Cols,
		Rows: opts.Rows,
	})
	if err != nil {
		return nil, err
	}

	pid := 0
	if cmd.Process != nil {
		pid = cmd.Process.Pid
	}

	var ptyOsFile *os.File = ptyFile

	handle := &PTYHandle{
		ReadWriter: ptyFile,
		Pid:        pid,
		closeFn: func() error {
			return ptyOsFile.Close()
		},
		resizeFn: func(cols, rows uint16) error {
			return pty.Setsize(ptyOsFile, &pty.Winsize{Cols: cols, Rows: rows})
		},
	}
	return handle, nil
}
