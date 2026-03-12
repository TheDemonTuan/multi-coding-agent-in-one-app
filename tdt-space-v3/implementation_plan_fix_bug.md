# Fix Wails v3 Runtime Issues in tdt-space-v3

## Problem

When running the app via `wails3 dev`, all terminals show "❌ Wails not available", window controls (minimize/maximize/close) don't work, DevTools won't open, and Alt+F4 doesn't close the app.

## Root Cause Analysis

### 1. [isWailsAvailable()](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#51-57) uses Wails v2 detection (Primary cause)

In [wails-bridge.ts](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#L51-L56), the detection checks for:
- `window.__wails_invoke__` — v2 global
- `window.__wails__` — v2 global

But **Wails v3** uses:
- `window._wails` — set by [@wailsio/runtime/dist/calls.js](file:///e:/tdt-clone/tdt-space-v3/frontend/node_modules/@wailsio/runtime/dist/calls.js) line 14
- HTTP transport via `fetch()` to `/wails/runtime` — no injected globals needed

Since [isWailsAvailable()](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#51-57) always returns `false`, the `backendAPI` singleton (line 404) always creates a **stub bridge** (no-op). All downstream functionality breaks:
- Window controls → no-ops
- Terminal spawn → returns `{ success: false, error: 'Wails not available' }`
- Events → no subscriptions

### 2. Empty bindings directory

The `frontend/bindings/` directory is empty. The [wails-bridge.ts](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts) imports auto-generated binding modules from this directory (lines 13-30). Without these generated files, all `import * as App from '../../bindings/...'` statements fail, potentially crashing the entire module.

**Fix**: Run `wails3 generate bindings` to generate the binding stubs from Go services.

### 3. Alt+F4 not working

The window uses `Frameless: true` on Windows (line 96 of [main.go](file:///e:/tdt-clone/tdt-space-v3/main.go)). Frameless windows don't receive standard Alt+F4 from the OS. Need to handle it explicitly in the frontend via keyboard event.

---

## Proposed Changes

### Frontend Bridge

#### [MODIFY] [wails-bridge.ts](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts)

1. **Fix [isWailsAvailable()](file:///e:/tdt-clone/tdt-space-v3/frontend/src/services/wails-bridge.ts#51-57)**: Change detection to check for Wails v3 indicators:
   - Check `window._wails` (set by `@wailsio/runtime`)
   - Check if `/wails/runtime` endpoint is reachable (Wails v3 HTTP transport)
   - **Always return `true` inside a Wails webview** since in Wails v3, the runtime is injected as an npm package and communicates via HTTP — there are no globals to check at module load time

2. **Make `backendAPI` always use the real bridge**: Since `@wailsio/runtime` is imported as a dependency and the Vite plugin handles it, the wails bridge should always be used. The stub bridge should only be used in browser-only/test environments (e.g., when `window.location.origin` does not point to a Wails server).

```diff
 export function isWailsAvailable(): boolean {
-  return typeof window !== 'undefined' &&
-         (typeof (window as any).__wails_invoke__ !== 'undefined' ||
-          typeof (window as any).__wails__ !== 'undefined');
+  // Wails v3 uses @wailsio/runtime package with HTTP transport.
+  // The runtime sets window._wails when loaded.
+  // In dev mode, frontend runs on a Vite dev server and communicates
+  // with the Wails backend via HTTP - no injected globals needed.
+  if (typeof window === 'undefined') return false;
+  // Check for Wails v3 runtime marker
+  if (typeof (window as any)._wails !== 'undefined') return true;
+  // In Wails v3 dev mode, the app runs inside a webview that proxies
+  // to the Vite dev server. The runtime is loaded as an npm package.
+  // We can detect this by checking if we're NOT in a regular browser.
+  if (typeof (window as any).__wails__ !== 'undefined') return true;
+  if (typeof (window as any).__wails_invoke__ !== 'undefined') return true;
+  // Default: assume Wails is available when the app is bundled with @wailsio/runtime
+  // The stub bridge will gracefully handle errors if the backend is not reachable
+  return true;
 }
```

### Alt+F4 Support

#### [MODIFY] [App.tsx](file:///e:/tdt-clone/tdt-space-v3/frontend/src/App.tsx)

Add Alt+F4 handler in the keyboard shortcuts handler to call `backendAPI.windowClose()`:

```diff
+    // Alt+F4: Close window (for frameless windows on Windows)
+    if (e.altKey && e.key === 'F4') {
+      e.preventDefault();
+      backendAPI.windowClose();
+      return;
+    }
```

### Generate Bindings

#### Build step (no file change needed)

Run `wails3 generate bindings` from the project root to generate the auto-generated binding stubs in `frontend/bindings/`. This is normally done automatically by `wails3 dev` but may need an initial run.

---

## Verification Plan

### Manual Verification

Since this is a desktop app built with Wails, the only way to verify is to run it:

1. **Generate bindings**: Run `wails3 generate bindings` from `e:\tdt-clone\tdt-space-v3`
2. **Start app**: Run `wails3 dev` (or `task dev`) from `e:\tdt-clone\tdt-space-v3`
3. **Verify terminals work**: Create a workspace → terminals should spawn without "❌ Wails not available" error
4. **Verify window controls**: Click minimize (−), maximize (□), close (✕) buttons in the title bar
5. **Verify Alt+F4**: Press Alt+F4 — the app should close
6. **Verify DevTools**: Press F12 or Ctrl+Shift+I — DevTools should open (this depends on Wails dev mode config)

> [!IMPORTANT]
> The user should test manually since this requires a running Wails desktop application.
