# Fix Terminal Blank Screen — Wails v3 Event Payload Mismatch

## Problem

Terminal shows **"running"** status but the xterm.js UI is **blank** (white screen with only a cursor). No input is possible.

## Root Cause

> [!CAUTION]
> **Wails v3 event callback signature mismatch.**

In Wails v3, `Events.On(name, callback)` passes a **[WailsEvent](file:///e:/tdt-clone/tdt-space-v3/frontend/node_modules/@wailsio/runtime/types/events.d.ts#30-47)** object to the callback:

```typescript
// WailsEvent structure (from @wailsio/runtime)
class WailsEvent {
  name: string;    // e.g. "terminal-data"
  data: any;       // The actual payload: { terminalId, data }
  sender?: string;
}
```

But the current [wails-bridge.ts](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts) passes the callback **directly** without unwrapping:

```typescript
// wails-bridge.ts line 146-148
const onEvent = (eventName: string, callback: (...args: any[]) => void) => {
    const unsub = Events.On(eventName, callback);  // ❌ callback receives WailsEvent, NOT the payload
    return () => unsub();
};
```

When [TerminalCell.tsx](file:///e:/tdt-clone/tdt-space-v3/frontend/src/components/terminals/TerminalCell.tsx) registers:
```typescript
backendAPI.onTerminalData((event: { terminalId: string; data: string }) => {
    if (event.terminalId === terminal.id) {  // ❌ event.terminalId is UNDEFINED
        terminalRef.current.write(event.data);  // Never reached
    }
});
```

The callback receives `WailsEvent { name: "terminal-data", data: { terminalId: "xxx", data: "..." } }`, so:
- `event.terminalId` → **`undefined`** (it's at `event.data.terminalId`)
- `event.data` → **`{ terminalId, data }`** (the map, not the terminal output string)
- The `if (event.terminalId === terminal.id)` check **always fails**
- **No data ever reaches xterm.js** → blank screen

This affects **ALL** event handlers: `terminal-data`, `terminal-started`, `terminal-exit`, `terminal-error`, `ime-patch-applied`.

## Proposed Changes

### Frontend Bridge

#### [MODIFY] [wails-bridge.ts](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts)

Fix the [onEvent](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#146-150) helper to unwrap `WailsEvent.data` before passing to the callback:

```diff
-const onEvent = (eventName: string, callback: (...args: any[]) => void): (() => void) => {
-    const unsub = Events.On(eventName, callback);
+const onEvent = (eventName: string, callback: (...args: any[]) => void): (() => void) => {
+    const unsub = Events.On(eventName, (wailsEvent: any) => {
+        // Wails v3 wraps payload in WailsEvent { name, data }.
+        // Unwrap .data so downstream callbacks receive the raw payload.
+        callback(wailsEvent?.data ?? wailsEvent);
+    });
     return () => unsub();
 };
```

This is a **single-point fix** — all event handlers ([onTerminalData](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#296-297), [onTerminalStarted](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#297-298), [onTerminalExit](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#298-299), [onTerminalError](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#299-300), [onVietnameseImePatchApplied](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#347-348), menu events) flow through [onEvent](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#146-150) and will be fixed automatically.

## Verification Plan

### Manual Verification
1. Run `wails3 dev` in the `tdt-space-v3` directory
2. Create a workspace and open a terminal
3. **Verify:** Terminal should display shell prompt (e.g. PowerShell prompt) — not blank
4. **Verify:** Typing characters should echo in the terminal
5. **Verify:** Running a command (e.g. `dir` or [ls](file:///e:/tdt-clone/tdt-space-v3/frontend/node_modules/@wailsio/runtime/types/events.d.ts#30-47)) should show output
6. **Verify:** Terminal status in the UI should show "running"
7. **Verify:** Closing the terminal should show exit message and update status to "stopped"
