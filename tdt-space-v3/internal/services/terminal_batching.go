package services

import (
	"log"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// ============================================================================
// Terminal Data Batching — optimizes xterm.js rendering
// ============================================================================
// Batches PTY output: flush every 12ms (~83fps) OR when buffer >= 16384 bytes.
// Optimized for Option C: Balanced - faster flush with larger batch size
// to reduce overhead while maintaining responsiveness.
// Data is passed as string which Wails serializes as a JSON string.
// Buffers data when context is nil and flushes when context becomes available.
// ============================================================================

const (
	batchFlushInterval  = 16 * time.Millisecond // ~60fps - standard terminal refresh rate
	batchMaxSize        = 32768                 // 32KB - larger for TUI burst output
	maxBufferedDataSize = 1024 * 1024           // 1MB max buffered data for TUI apps
	// Background workspace optimization
	backgroundBufferMaxSize = 256 * 1024       // 256KB max for background terminals
	backgroundBufferTTL     = 30 * time.Second // TTL for background buffered data
)

// terminalBatcher batches PTY output for a single terminal.
type terminalBatcher struct {
	terminalID     string
	workspaceID    string // Track workspace for background optimization
	appGetter      func() *application.App
	isActiveGetter func() bool // Function to check if workspace is active
	mu             sync.Mutex
	buf            []byte
	timer          *time.Timer
	done           chan struct{}
	// Buffer for data events when context is nil
	bufferedData [][]byte
	bufferedSize int
	// Background buffering (workspace not active)
	backgroundBuffer   [][]byte
	backgroundSize     int
	backgroundBufferAt time.Time // When buffering started for TTL
	isBackground       bool      // Whether currently in background mode
}

// newTerminalBatcher creates a batcher for the given terminal.
func newTerminalBatcher(terminalID string, appGetter func() *application.App) *terminalBatcher {
	return &terminalBatcher{
		terminalID:       terminalID,
		workspaceID:      "",
		appGetter:        appGetter,
		isActiveGetter:   func() bool { return true }, // Default to active
		buf:              make([]byte, 0, batchMaxSize),
		done:             make(chan struct{}),
		bufferedData:     make([][]byte, 0),
		bufferedSize:     0,
		backgroundBuffer: make([][]byte, 0),
		backgroundSize:   0,
		isBackground:     false,
	}
}

// SetWorkspace sets the workspace ID for this terminal's batcher.
func (b *terminalBatcher) SetWorkspace(workspaceID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.workspaceID = workspaceID
}

// SetActive sets whether this terminal's workspace is currently active.
// When inactive, data is buffered instead of emitted to reduce CPU/memory usage.
func (b *terminalBatcher) SetActive(active bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if active && b.isBackground {
		// Transitioning from background to active - will flush on next write
		b.isBackground = false
		log.Printf("[INFO] Terminal %s: workspace active, will flush background buffer", b.terminalID)
	} else if !active {
		b.isBackground = true
		b.backgroundBufferAt = time.Now()
		log.Printf("[INFO] Terminal %s: workspace inactive, buffering data", b.terminalID)
	}
}

// GetBacklog returns the buffered background data as a single string.
// Used when workspace becomes active to catch up on missed output.
func (b *terminalBatcher) GetBacklog() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.backgroundBuffer) == 0 {
		return ""
	}

	// Concatenate all buffered data
	totalSize := 0
	for _, data := range b.backgroundBuffer {
		totalSize += len(data)
	}

	result := make([]byte, 0, totalSize)
	for _, data := range b.backgroundBuffer {
		result = append(result, data...)
	}

	return string(result)
}

// ClearBacklog clears the background buffer after it has been retrieved.
func (b *terminalBatcher) ClearBacklog() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.backgroundBuffer = make([][]byte, 0)
	b.backgroundSize = 0
}

// write accepts data from the PTY and schedules a flush.
func (b *terminalBatcher) write(data []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

	// If in background mode, buffer data instead of emitting
	if b.isBackground {
		b.bufferBackgroundLocked(data)
		return
	}

	b.buf = append(b.buf, data...)

	// Flush immediately if buffer is large enough
	if len(b.buf) >= batchMaxSize {
		b.flushLocked()
		return
	}

	// Schedule timed flush if not already scheduled
	if b.timer == nil {
		b.timer = time.AfterFunc(batchFlushInterval, func() {
			b.mu.Lock()
			defer b.mu.Unlock()
			b.flushLocked()
		})
	}
}

// bufferBackgroundLocked buffers data when workspace is inactive.
// Implements TTL and size limits to prevent memory leaks.
// Must be called with mu held.
func (b *terminalBatcher) bufferBackgroundLocked(data []byte) {
	// Check TTL - discard old data
	if time.Since(b.backgroundBufferAt) > backgroundBufferTTL {
		log.Printf("[WARN] Terminal %s: background buffer TTL exceeded, discarding old data", b.terminalID)
		b.backgroundBuffer = make([][]byte, 0)
		b.backgroundSize = 0
		b.backgroundBufferAt = time.Now()
	}

	// Check size limit - discard oldest if exceeded
	if b.backgroundSize+len(data) > backgroundBufferMaxSize {
		// Remove oldest entries until we have room
		for len(b.backgroundBuffer) > 0 && b.backgroundSize+len(data) > backgroundBufferMaxSize {
			oldest := b.backgroundBuffer[0]
			b.backgroundBuffer = b.backgroundBuffer[1:]
			b.backgroundSize -= len(oldest)
		}

		// If still too large, clear everything and start fresh
		if b.backgroundSize+len(data) > backgroundBufferMaxSize {
			log.Printf("[WARN] Terminal %s: background buffer full, dropping data", b.terminalID)
			b.backgroundBuffer = make([][]byte, 0)
			b.backgroundSize = 0
			b.backgroundBufferAt = time.Now()
		}
	}

	// Add data to buffer
	dataCopy := make([]byte, len(data))
	copy(dataCopy, data)
	b.backgroundBuffer = append(b.backgroundBuffer, dataCopy)
	b.backgroundSize += len(data)
}

// flushLocked sends buffered data to the frontend. Must be called with mu held.
func (b *terminalBatcher) flushLocked() {
	if len(b.buf) == 0 && len(b.bufferedData) == 0 {
		return
	}

	// Note: minFlushInterval was removed as it was identical to batchFlushInterval (16ms)
	// The batch timer already enforces this rate limit, making this check redundant

	app := b.appGetter()
	if app == nil {
		// Application not ready - buffer the data for later
		if b.bufferedSize < maxBufferedDataSize {
			dataCopy := make([]byte, len(b.buf))
			copy(dataCopy, b.buf)
			b.bufferedData = append(b.bufferedData, dataCopy)
			b.bufferedSize += len(b.buf)
		} else {
			log.Printf("[WARN] Terminal %s: max buffer size exceeded, dropping data", b.terminalID)
		}
		b.buf = b.buf[:0]
		log.Printf("[DEBUG] terminalBatcher %s: application nil, buffered data", b.terminalID)
		return
	}

	// Flush buffered data first
	if len(b.bufferedData) > 0 {
		for _, data := range b.bufferedData {
			app.Event.Emit("terminal-data", TerminalDataEvent{
				TerminalID: b.terminalID,
				Data:       string(data),
			})
		}
		log.Printf("[INFO] Terminal %s: flushed %d buffered data events", b.terminalID, len(b.bufferedData))
		b.bufferedData = make([][]byte, 0)
		b.bufferedSize = 0
	}

	// Flush current buffer
	if len(b.buf) > 0 {
		payload := make([]byte, len(b.buf))
		copy(payload, b.buf)
		b.buf = b.buf[:0]

		// Always stop timer before clearing to prevent stale callbacks
		if b.timer != nil {
			b.timer.Stop()
			b.timer = nil
		}

		// Emit event to frontend — data is converted to string to prevent base64 encoding
		app.Event.Emit("terminal-data", TerminalDataEvent{
			TerminalID: b.terminalID,
			Data:       string(payload),
		})
	}
}

// stop stops the batcher and flushes remaining data.
func (b *terminalBatcher) stop(shuttingDown bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}

	// Don't flush during shutdown - Wails runtime may already be shutting down
	if !shuttingDown {
		b.flushLocked()
	} else {
		b.buf = b.buf[:0]
		b.bufferedData = nil
		b.bufferedSize = 0
	}

	select {
	case <-b.done:
		// already closed
	default:
		close(b.done)
	}
}

// getWorkspaceID returns the workspace ID for this terminal.
func (b *terminalBatcher) getWorkspaceID() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.workspaceID
}
