//go:build windows

package platform

import (
	"fmt"
	"strings"

	"github.com/UserExistsError/conpty"
)

// StartPTY spawns the command described by opts using Windows ConPTY.
// conpty.Start accepts a full command-line string and functional options.
func StartPTY(opts PTYOptions) (*PTYHandle, error) {
	// Build the command-line string from command + args
	args := append([]string{opts.Command}, opts.Args...)
	cmdLine := buildCommandLine(args)

	cptyOpts := []conpty.ConPtyOption{
		conpty.ConPtyDimensions(int(opts.Cols), int(opts.Rows)),
	}
	if opts.Dir != "" {
		cptyOpts = append(cptyOpts, conpty.ConPtyWorkDir(opts.Dir))
	}
	if len(opts.Env) > 0 {
		cptyOpts = append(cptyOpts, conpty.ConPtyEnv(opts.Env))
	}

	cpty, err := conpty.Start(cmdLine, cptyOpts...)
	if err != nil {
		return nil, fmt.Errorf("ConPTY start failed: %w", err)
	}

	handle := &PTYHandle{
		ReadWriter: cpty,
		Pid:        cpty.Pid(),
		closeFn:    cpty.Close,
		resizeFn: func(cols, rows uint16) error {
			return cpty.Resize(int(cols), int(rows))
		},
	}
	return handle, nil
}

// buildCommandLine joins args into a Windows-safe command-line string,
// quoting any argument that contains spaces.
func buildCommandLine(args []string) string {
	parts := make([]string, len(args))
	for i, a := range args {
		if strings.ContainsAny(a, " \t\r\n") {
			parts[i] = `"` + strings.ReplaceAll(a, `"`, `""`) + `"`
		} else {
			parts[i] = a
		}
	}
	return strings.Join(parts, " ")
}
