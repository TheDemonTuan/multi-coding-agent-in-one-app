# User Testing Surface

Manual and automated testing procedures for TDT Space optimization validation.

**What belongs here:** Testing tools, URLs, setup steps, test accounts, isolation notes, known quirks.
**What does NOT belong here:** Assertion definitions (use `validation-contract.md`).

---

## Application Entry Points

### Development Mode
```bash
bun run dev
```
- Opens Electron window automatically
- Vite dev server on http://localhost:5173
- Hot reload enabled

### Production Build
```bash
bun run build
bun run electron:start
```

---

## Testing Tools

### Manual Testing
1. **Chrome DevTools** (built into Electron)
   - Memory panel: Heap snapshots, allocation timelines
   - Performance panel: FPS, event timelines, IPC monitoring
   - Console: Error messages, warnings, logs

2. **Task Manager / Process Monitor**
   - Windows Task Manager: Verify PTY process cleanup
   - Process Monitor (ProcMon): Detailed process tree monitoring

3. **React DevTools**
   - Component tree inspection
   - Hook state verification

### Automated Testing
```bash
# Unit and component tests
bun run test

# With coverage
bun run test:coverage

# E2E tests
bun run test:e2e

# Performance tests
bun run test:performance
```

---

## Test Scenarios

### 1. Workspace Switching Stress Test
**Steps:**
1. Create 10 workspaces with 2-4 terminals each
2. Switch rapidly: Workspace 1 → 2 → 3 → ... → 10 → 1
3. Monitor memory in Chrome DevTools Memory panel
4. Check Task Manager for orphaned processes

**Expected:**
- Memory growth < 10MB after 10 complete cycles
- No orphaned PTY processes
- Switch latency < 100ms

### 2. Extended Terminal Session
**Steps:**
1. Open terminal with active process (e.g., `bun run dev`)
2. Let run for 30 minutes
3. Execute commands producing varied output
4. Monitor memory every 5 minutes

**Expected:**
- Memory stable within ±5%
- Terminal remains responsive
- No GC pressure warnings

### 3. Rapid Resize Test
**Steps:**
1. Open terminal
2. Rapidly resize window 50+ times in 10 seconds
3. Check console for IPC call count
4. Verify terminal text integrity

**Expected:**
- Single IPC call per resize sequence (debounced)
- No text loss or corruption
- Smooth resize without lag

### 4. Terminal Lifecycle Test
**Steps:**
1. Spawn 20+ terminals rapidly
2. Kill all terminals
3. Check process count
4. Verify memory returns to baseline

**Expected:**
- All PTY processes terminated
- Memory returns to baseline
- No "MaxListenersExceededWarning"

### 5. Long-Running Output Test
**Steps:**
1. Run command producing 10,000+ lines (`dir /s` or `findstr`)
2. Monitor memory during output
3. Call `terminal.clear()` to clear buffer
4. Verify memory freed

**Expected:**
- Memory stable during output (scrollback limit)
- `terminal.clear()` frees memory
- No performance degradation

---

## Test Accounts / Authentication

None required. This is a local desktop application.

---

## Test Data Isolation

### Workspaces
- Each workspace has unique ID (UUID)
- Terminals scoped to workspace
- Clean isolation between workspaces

### Process Namespaces
- Each terminal spawns independent PTY process
- Process tree isolation via node-pty

---

## Known Quirks

### Electron DevTools
- DevTools may show higher memory usage than actual
- Always compare relative deltas, not absolute values
- Use "Allocation instrumentation on timeline" for precise tracking

### Windows Process Killing
- `pty.kill()` alone may leave child processes
- Must use `taskkill /pid /f /t` for complete cleanup
- Conhost.exe may linger for 1-2 seconds after kill

### Resize Debouncing
- Rapid resize may cause temporary visual glitches
- This is expected during debounce window
- Final resize must be accurate

### Memory Measurement
- Wait 5-10 seconds after operations before measuring
- GC may not run immediately
- Take multiple snapshots for accurate comparison

---

## Debugging Tips

### Memory Leaks
1. Open Chrome DevTools Memory panel
2. Take heap snapshot before operation
3. Perform operation (e.g., switch workspace 10 times)
4. Take heap snapshot after
5. Compare snapshots, look for retained Terminal/PTY objects

### Process Orphans
1. Open Task Manager or Process Monitor
2. Note baseline process count
3. Spawn terminals, switch workspaces, kill terminals
4. Verify process count returns to baseline
5. Look for conhost.exe, OpenConsole.exe, bash.exe

### Event Listener Leaks
1. Open Chrome DevTools Performance tab
2. Start recording
3. Perform operation (e.g., spawn 20 terminals)
4. Stop recording
5. Check "Event Handlers" section for accumulation

### IPC Issues
1. Enable verbose logging in dev mode
2. Monitor console for IPC call patterns
3. Look for duplicate calls or missing responses
4. Check IPC payload sizes

---

## Validation Checklist

### Pre-Validation
- [ ] App builds successfully (`bun run build`)
- [ ] Dev mode starts without errors (`bun run dev`)
- [ ] Chrome DevTools accessible
- [ ] Task Manager / Process Monitor available

### Memory Leak Validation
- [ ] Workspace switch cleanup verified (VAL-MEM-001)
- [ ] TerminalCell cleanup verified (VAL-MEM-002)
- [ ] IPC listener cleanup verified (VAL-MEM-003)
- [ ] xterm.js disposal verified (VAL-MEM-004)

### Performance Validation
- [ ] Resize debouncing verified (VAL-PERF-001)
- [ ] Scrollback limits verified (VAL-PERF-002)
- [ ] Process tree killing verified (VAL-PERF-003)
- [ ] WebGL renderer verified (VAL-PERF-004)

### State Management Validation
- [ ] Zustand store cleanup verified (VAL-STATE-001)
- [ ] Command history limits verified (VAL-STATE-002)
- [ ] IPC optimization verified (VAL-STATE-003)

### Testing Infrastructure Validation
- [ ] Test coverage >80% (VAL-TEST-001)
- [ ] Memory profiler functional (VAL-TEST-002)
- [ ] Auto-cleanup tests working (VAL-TEST-003)

### Cross-Area Flow Validation
- [ ] Workspace switching stress test (VAL-FLOW-001)
- [ ] Extended session stability (VAL-FLOW-002)
- [ ] Rapid resize stress test (VAL-FLOW-003)

---

## Flow Validator Guidance: Electron Desktop App

### Testing Surface: Electron Terminal Workspace Application

**Application Type:** Desktop Electron app (not web)
**Testing Approach:** Manual verification through app interaction + code inspection + system monitoring

### Isolation Rules for Parallel Testing

1. **Workspace Isolation:**
   - Each flow validator should use a DIFFERENT workspace
   - Create workspaces named: `test-workspace-1`, `test-workspace-2`, etc.
   - Do NOT delete workspaces created by other validators
   - Clean up your own test workspaces after testing

2. **Terminal Isolation:**
   - Each validator spawns its own terminals
   - Terminal count per workspace: 2-4 terminals for testing
   - Kill YOUR terminals only (track terminal IDs)

3. **Process Monitoring:**
   - Use Windows Task Manager for process counts
   - Note baseline PTY process count before testing
   - Verify process count returns to baseline after cleanup

### Testing Boundaries

**DO NOT:**
- Modify production code during testing
- Delete workspaces not created by your test
- Run more than 10 workspace switches (to avoid interfering with other validators)
- Spawn more than 20 terminals in a single test

**DO:**
- Document all observations with screenshots/console logs
- Track memory deltas (before/after operations)
- Note any warnings in console (MaxListenersExceededWarning, etc.)
- Verify cleanup by checking process counts and memory

### Verification Methods

**For Memory Assertions (VAL-MEM-001 to VAL-MEM-004):**
1. Open Chrome DevTools in Electron (Ctrl+Shift+I or F12)
2. Navigate to Memory panel
3. Take heap snapshot before operation
4. Perform test operation (e.g., switch workspace, dispose terminal)
5. Take heap snapshot after
6. Compare: look for retained objects (Terminal, PTY, listeners)

**For Process Cleanup:**
1. Open Windows Task Manager (Ctrl+Shift+Esc)
2. Go to Details tab
3. Filter for: conhost.exe, OpenConsole.exe, pwsh.exe, bash.exe
4. Count before operation
5. Perform operation (spawn/kill terminals)
6. Verify count returns to baseline within 2 seconds

**For Event Listener Cleanup:**
1. Open Chrome DevTools Performance tab
2. Start recording
3. Perform operation (spawn multiple terminals)
4. Stop recording
5. Check Event Handlers section for listener count
6. Verify no MaxListenersExceededWarning in console

### Test Data Setup

**Pre-test Setup:**
```bash
# Start the app in dev mode
bun run dev
```

**Workspace Creation:**
- Use the "+" button in workspace tab bar
- Default layout: 2 terminals per workspace
- Name workspaces: `test-workspace-{n}`

**Terminal Operations:**
- Use "+" button next to workspace tabs to add terminals
- Use "x" button on terminal to dispose
- Use Ctrl+Tab to switch workspaces

---

**Last Updated:** 2026-03-07
**Status:** Ready for Validation
