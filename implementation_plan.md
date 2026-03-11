# Terminal Input/Output Fix & Optimization

The user is experiencing text disappearing, blanks appearing, and cursor-like artifacts when typing in xterm.js terminals. After thorough analysis of the entire terminal pipeline (Go backend → Wails events → xterm.js frontend), I identified **5 root-cause issues** that, combined, cause the intermittent input corruption.

## User Review Required

> [!CAUTION]
> **Phase 1 is the most impactful change**. The current echo prevention system in [TerminalCell.tsx](file:///E:/tdt-clone/src/components/terminals/TerminalCell.tsx) (lines 629–671) is actively stripping legitimate PTY output. Removing it will fix the core "text disappearing" bug, but if there was a real echo problem in the past, removing this may re-expose it. I believe the echo prevention was a workaround for a problem that no longer exists — ConPTY does not echo user input back by default. If echo duplication reappears after this change, we can address it properly at the PTY level.

> [!IMPORTANT]
> **Phase 2 changes TERM from `cygwin` to `xterm-256color` on Windows**. This affects how programs inside the terminal interpret escape sequences. `cygwin` is a non-standard TERM type that most modern CLI tools (Claude Code, etc.) don't handle well. `xterm-256color` is what Windows Terminal, VS Code terminal, and Warp all use.

---

## Proposed Changes

### Phase 1: Remove Broken Echo Prevention

The echo prevention logic in [TerminalCell.tsx](file:///E:/tdt-clone/src/components/terminals/TerminalCell.tsx) is the **primary cause** of text disappearing. It tracks recent user keystrokes and tries to strip them from incoming PTY output. The problem:

1. **It matches against legitimate output**, not just echoes — e.g., typing `l` matches against [ls](file:///E:/tdt-clone/src/services/wails-bridge.ts#104-110) output
2. **It does partial substring removal**, which corrupts multi-byte escape sequences
3. **It splits data mid-stream**, writing partial data that breaks ANSI parsing
4. **ConPTY on Windows does NOT echo input** — the echo prevention solves a non-existent problem

#### [MODIFY] [TerminalCell.tsx](file:///E:/tdt-clone/src/components/terminals/TerminalCell.tsx)

**Changes:**
1. **Remove** `recentInputsRef`, `inputBufferTimeoutRef`, `MAX_RECENT_INPUTS` refs (lines 143–145)
2. **Remove** the entire echo prevention block in [onTerminalData](file:///E:/tdt-clone/src/services/wails-bridge.ts#167-169) handler (lines 629–674)
3. **Simplify** `onData` handler — remove input tracking, keep only the `backendAPI.terminalWrite()` call (lines 759–780)
4. **Remove** cleanup code for echo prevention refs (lines 883–888)

The [onTerminalData](file:///E:/tdt-clone/src/services/wails-bridge.ts#167-169) handler becomes simply:

```diff
 listenersRef.current.unsubscribeData = backendAPI.onTerminalData((event) => {
   if (event.terminalId === terminal.id && terminalRef.current) {
-    // PREVENT ECHO LOOP ... 40+ lines of echo prevention ...
     let outputData = event.data;
     
+    // Parse OSC 133 shell integration markers if present
     const hasOSC = outputData.includes('\x1b]133;');
     if (hasOSC) {
       // ... OSC parsing unchanged ...
     }
     
     if (!isInitialFitCompleteRef.current) {
       dataBufferRef.current.push(outputData);
       return;
     }
     terminalRef.current.write(outputData);
   }
 });
```

The `onData` handler becomes:

```diff
 xtermDisposablesRef.current.onDataDisposable = term.onData((data: string) => {
-  // echo tracking code removed
   backendAPI.terminalWrite(terminal.id, data);
 });
```

---

### Phase 2: Fix TERM Environment & Encoding

#### [MODIFY] [terminal.go](file:///E:/tdt-clone/internal/services/terminal.go)

**Changes to [buildEnv()](file:///E:/tdt-clone/internal/services/terminal.go#486-507) function (lines 486–506):**

1. **Use `xterm-256color` on all platforms** — `TERM=cygwin` causes escape sequence misinterpretation
2. **Remove `ConEmuANSI=ON`** — this is a ConEmu-specific variable that has no effect in ConPTY
3. **Keep `LC_ALL` and `LANG`** UTF-8 settings

```diff
 func buildEnv(terminalID string) []string {
   env := os.Environ()
-  termVar := "TERM=xterm-256color"
-  if platform.IsWindows() {
-    termVar = "TERM=cygwin"
-  }
+  termVar := "TERM=xterm-256color"
   
   env = append(env,
     termVar,
     "COLORTERM=truecolor",
     "TDT_TERMINAL_ID="+terminalID,
     "LC_ALL=C.UTF-8",
     "LANG=en_US.UTF-8",
-    "ConEmuANSI=ON",
   )
   return filterEnv(env, "TERM_PROGRAM")
 }
```

---

### Phase 3: Fix Batching Timer Race Conditions

#### [MODIFY] [terminal_batching.go](file:///E:/tdt-clone/internal/services/terminal_batching.go)

The batcher has a subtle race: [flushLocked()](file:///E:/tdt-clone/internal/services/terminal_batching.go#77-151) can re-enter itself via timer rescheduling while the `minFlushInterval` gate resets the timer. This can cause data ordering issues.

**Changes:**
1. **Always stop the timer before rescheduling** to prevent stale callbacks
2. **Update `lastFlushTime`** even when context is nil (to avoid burst on context availability)
3. **Increase `batchMaxSize` from 4096 to 8192** — reducing it previously was premature optimization that increases flush frequency

```diff
 const (
   batchFlushInterval  = 16 * time.Millisecond
-  batchMaxSize        = 4096
+  batchMaxSize        = 8192
   maxBufferedDataSize = 512 * 1024
-  minFlushInterval    = 5 * time.Millisecond
+  minFlushInterval    = 8 * time.Millisecond
 )
```

Additionally, fix the log statement on line 111 that logs `len(b.buf)` **after** the buffer was already cleared on line 110:

```diff
   b.buf = b.buf[:0]
-  log.Printf("[DEBUG] terminalBatcher %s: context nil, buffering %d bytes", b.terminalID, len(b.buf))
+  log.Printf("[DEBUG] terminalBatcher %s: context nil, buffered data", b.terminalID)
```

---

### Phase 4: Fix Resize Event Flooding

#### [MODIFY] [TerminalCell.tsx](file:///E:/tdt-clone/src/components/terminals/TerminalCell.tsx)

Multiple resize triggers fire simultaneously, each calling `backendAPI.terminalResize()`:
- `ResizeObserver` callback (line 581)
- `IntersectionObserver` callback (line 1077)
- `terminal-started` event handler (line 717)
- Workspace switch effect (lines 1104–1119, fires **twice** at 250ms and 500ms)

**Changes:**
1. **Centralize resize** into a single debounced function shared across all resize triggers
2. **Remove** the duplicate 250ms+500ms workspace switch resize calls — a single 300ms delay is sufficient
3. **Remove** the unconditional fit+resize in `terminal-started` handler — the initial spawn already sends correct dimensions

---

### Phase 5: Remove Excessive Debug Logging

#### [MODIFY] [terminal.go](file:///E:/tdt-clone/internal/services/terminal.go)

Remove the per-read debug log on line 441 that fires for **every single PTY read operation**:

```diff
-  log.Printf("[DEBUG] readPTYOutput for %s: read %d bytes", proc.id, n)
```

#### [MODIFY] [terminal_batching.go](file:///E:/tdt-clone/internal/services/terminal_batching.go)

Remove per-flush debug log on line 143 that fires every 16ms:

```diff
-  log.Printf("[DEBUG] terminalBatcher %s: emitting terminal-data with %d bytes", b.terminalID, len(payload))
```

#### [MODIFY] [TerminalCell.tsx](file:///E:/tdt-clone/src/components/terminals/TerminalCell.tsx)

Remove `console.log` lines on lines 620, 623, 690, 424–425, 428, 432–434, 438–443, 449, 458, 462, 704, 706:

```diff
-  console.log('[TerminalCell] Received terminal-data event:', ...);
-  console.log('[TerminalCell] Processing data for', ...);
-  console.log('[TerminalCell] Buffering data, buffer size:', ...);
+  // (keep only error-level console.error calls)
```

---

## Verification Plan

### Manual Verification

Since this is a Wails desktop application, the primary verification method is running the app and testing terminal behavior:

1. **Start the app**: `wails dev`
2. **Test basic typing**: Open a terminal, type commands like [ls](file:///E:/tdt-clone/src/services/wails-bridge.ts#104-110), `echo hello`, `dir` — text should appear immediately without flickering or disappearing
3. **Test fast typing**: Type a long command quickly (e.g., `echo abcdefghijklmnopqrstuvwxyz`) — all characters should appear in order
4. **Test paste**: Paste a multi-line block of text into the terminal — no characters should be dropped
5. **Test resize**: Resize the window while a command is running (e.g., `ping localhost`) — output should re-flow correctly without corruption
6. **Test agent spawn**: Create a terminal with Claude Code agent — the agent should start correctly and accept input
7. **Test workspace switching**: Switch between workspaces — terminals should retain their content and resize correctly
