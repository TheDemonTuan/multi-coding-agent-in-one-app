package services

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Terminal Data Batching — optimizes xterm.js rendering
// ============================================================================
// Batches PTY output: flush every 16ms (~60fps) OR when buffer >= 8192 bytes.
// Data is passed as string which Wails serializes as a JSON string.
// Buffers data when context is nil and flushes when context becomes available.
// ============================================================================

const (
	batchFlushInterval  = 16 * time.Millisecond // ~60fps
	batchMaxSize        = 8192                  // bytes - increased for better throughput
	maxBufferedDataSize = 1024 * 1024           // 1MB max buffered data
	minFlushInterval    = 5 * time.Millisecond  // minimum time between flushes to prevent overwhelming xterm.js
)

// terminalBatcher batches PTY output for a single terminal.
type terminalBatcher struct {
	terminalID   string
	ctxGetter    func() context.Context
	mu           sync.Mutex
	buf          []byte
	timer        *time.Timer
	done         chan struct{}
	lastFlushTime time.Time // track last flush time to enforce minFlushInterval
	// Buffer for data events when context is nil
	bufferedData [][]byte
	bufferedSize int
}

// newTerminalBatcher creates a batcher for the given terminal.
func newTerminalBatcher(terminalID string, ctxGetter func() context.Context) *terminalBatcher {
	return &terminalBatcher{
		terminalID:    terminalID,
		ctxGetter:     ctxGetter,
		buf:           make([]byte, 0, batchMaxSize),
		done:          make(chan struct{}),
		lastFlushTime: time.Now(),
		bufferedData:  make([][]byte, 0),
		bufferedSize:  0,
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
	if len(b.buf) == 0 && len(b.bufferedData) == 0 {
		return
	}

	// Enforce minimum flush interval to prevent overwhelming xterm.js
	// This helps prevent text scrambling when data comes too fast
	timeSinceLastFlush := time.Since(b.lastFlushTime)
	if timeSinceLastFlush < minFlushInterval {
		// Reschedule timer for remaining time
		if b.timer != nil {
			b.timer.Stop()
		}
		b.timer = time.AfterFunc(minFlushInterval-timeSinceLastFlush, func() {
			b.mu.Lock()
			defer b.mu.Unlock()
			b.flushLocked()
		})
		return
	}

	ctx := b.ctxGetter()
	if ctx == nil {
		// Context not ready - buffer the data for later
		if b.bufferedSize < maxBufferedDataSize {
			dataCopy := make([]byte, len(b.buf))
			copy(dataCopy, b.buf)
			b.bufferedData = append(b.bufferedData, dataCopy)
			b.bufferedSize += len(b.buf)
		} else {
			log.Printf("[WARN] Terminal %s: max buffer size exceeded, dropping data", b.terminalID)
		}
		b.buf = b.buf[:0]
		log.Printf("[DEBUG] terminalBatcher %s: context nil, buffering %d bytes", b.terminalID, len(b.buf))
		return
	}

	// Flush buffered data first
	if len(b.bufferedData) > 0 {
		log.Printf("[DEBUG] terminalBatcher %s: flushing %d buffered events", b.terminalID, len(b.bufferedData))
		for _, data := range b.bufferedData {
			runtime.EventsEmit(ctx, "terminal-data", map[string]interface{}{
				"terminalId": b.terminalID,
				"data":       string(data),
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

		if b.timer != nil {
			b.timer.Stop()
			b.timer = nil
		}

		// Update last flush time
		b.lastFlushTime = time.Now()

		log.Printf("[DEBUG] terminalBatcher %s: emitting terminal-data with %d bytes", b.terminalID, len(payload))
		// Emit event to frontend — data is converted to string to prevent base64 encoding
		runtime.EventsEmit(ctx, "terminal-data", map[string]interface{}{
			"terminalId": b.terminalID,
			"data":       string(payload),
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
