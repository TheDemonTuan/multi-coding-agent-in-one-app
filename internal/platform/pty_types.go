package platform

import "io"

// PTYHandle wraps a platform-specific PTY with a unified I/O interface.
// On Windows this wraps a ConPTY; on Unix it wraps /dev/ptmx via creack/pty.
type PTYHandle struct {
	io.ReadWriter
	// pid of the spawned child process.
	Pid int
	// close releases all PTY resources and kills the child.
	closeFn  func() error
	// resize updates the terminal dimensions.
	resizeFn func(cols, rows uint16) error
}

// Close releases all resources associated with the PTY.
func (p *PTYHandle) Close() error {
	if p.closeFn != nil {
		return p.closeFn()
	}
	return nil
}

// Resize updates the terminal window size.
func (p *PTYHandle) Resize(cols, rows uint16) error {
	if p.resizeFn != nil {
		return p.resizeFn(cols, rows)
	}
	return nil
}

// PTYOptions carries platform-agnostic spawn parameters.
type PTYOptions struct {
	Command string
	Args    []string
	Dir     string
	Env     []string
	Cols    uint16
	Rows    uint16
}
