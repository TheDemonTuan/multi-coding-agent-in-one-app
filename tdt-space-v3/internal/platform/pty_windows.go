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

	// Prepare environment with UTF-8 encoding support for Windows ConPTY
	// This helps prevent text scrambling and encoding issues
	env := opts.Env
	if env == nil {
		env = []string{}
	}
	// Add Windows-specific UTF-8 environment variables
	env = appendUTF8Env(env)

	cptyOpts := []conpty.ConPtyOption{
		conpty.ConPtyDimensions(int(opts.Cols), int(opts.Rows)),
	}
	if opts.Dir != "" {
		cptyOpts = append(cptyOpts, conpty.ConPtyWorkDir(opts.Dir))
	}
	if len(env) > 0 {
		cptyOpts = append(cptyOpts, conpty.ConPtyEnv(env))
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

// appendUTF8Env adds Windows-specific UTF-8 environment variables.
// These settings help ConPTY handle Unicode correctly and prevent text scrambling.
func appendUTF8Env(env []string) []string {
	// Check if already has these vars
	hasChcp := false
	hasCodepage := false
	for _, e := range env {
		if strings.HasPrefix(e, "CHCP=") {
			hasChcp = true
		}
		if strings.HasPrefix(e, "CODEPAGE=") {
			hasCodepage = true
		}
	}

	// Add UTF-8 codepage settings
	if !hasChcp {
		env = append(env, "CHCP=65001")
	}
	if !hasCodepage {
		env = append(env, "CODEPAGE=65001")
	}

	// Add other Windows UTF-8 settings
	env = append(env,
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
		"LESSCHARSET=utf-8",
		// Force Virtual Terminal Processing for better escape sequence handling
		"ENABLE_VIRTUAL_TERMINAL_PROCESSING=1",
	)

	return env
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
