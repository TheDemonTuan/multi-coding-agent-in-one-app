package services

import (
	"context"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Terminal Data Batching — optimizes xterm.js rendering
// ============================================================================
// Batches PTY output: flush every 16ms (~60fps) OR when buffer >= 4096 bytes.
// Data is passed as []byte which Wails serializes to base64 JSON automatically.
// ============================================================================

const (
	batchFlushInterval = 16 * time.Millisecond // ~60fps
	batchMaxSize       = 4096                  // bytes
)

// terminalBatcher batches PTY output for a single terminal.
type terminalBatcher struct {
	terminalID string
	ctxGetter  func() context.Context
	mu         sync.Mutex
	buf        []byte
	timer      *time.Timer
	done       chan struct{}
}

// newTerminalBatcher creates a batcher for the given terminal.
func newTerminalBatcher(terminalID string, ctxGetter func() context.Context) *terminalBatcher {
	return &terminalBatcher{
		terminalID: terminalID,
		ctxGetter:  ctxGetter,
		buf:        make([]byte, 0, batchMaxSize),
		done:       make(chan struct{}),
	}
}

// write accepts data from the PTY and schedules a flush.
func (b *terminalBatcher) write(data []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

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

// flushLocked sends buffered data to the frontend. Must be called with mu held.
func (b *terminalBatcher) flushLocked() {
	if len(b.buf) == 0 {
		return
	}

	payload := make([]byte, len(b.buf))
	copy(payload, b.buf)
	b.buf = b.buf[:0]

	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}

	// Emit event to frontend — Wails serializes []byte as base64 automatically
	if ctx := b.ctxGetter(); ctx != nil {
		runtime.EventsEmit(ctx, "terminal-data", map[string]interface{}{
			"terminalId": b.terminalID,
			"data":       payload,
		})
	}
}

// stop stops the batcher and flushes remaining data.
func (b *terminalBatcher) stop() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
	b.flushLocked()

	select {
	case <-b.done:
		// already closed
	default:
		close(b.done)
	}
}
