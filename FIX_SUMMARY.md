# Fix: Terminal State Preservation Across Workspace Switches

## Problem
After switching to a different workspace and then switching back, the terminal was disappearing (becoming blank) and the agent process was being restarted from scratch.

## Root Cause
When switching workspaces, React unmounts the `TerminalCell` components for the old workspace and mounts new components for the new workspace. This caused:
1. Terminal UI (xterm.js instance) to be disposed, losing all content
2. Terminal process to be orphaned (still running in background but no UI connected)
3. New terminal process to be spawned when switching back (restarting the agent)

## Solution
**Lazy-render workspaces, but NEVER unmount them once rendered.**

1. Only render the active workspace on first load
2. When switching to a new workspace, render it (lazy loading)
3. Once a workspace is rendered, keep it in DOM with `display: none` when not active
4. Terminals are never unmounted during workspace switches

### Changes Made

**File: `src/components/TerminalGrid.tsx`**

Added lazy-rendering with `renderedWorkspaceIds` state:

```typescript
// Track which workspaces have been rendered (lazy rendering)
const [renderedWorkspaceIds, setRenderedWorkspaceIds] = useState<Set<string>>(() => {
  const initial = new Set<string>();
  if (currentWorkspace) {
    initial.add(currentWorkspace.id);
  }
  return initial;
});

// When switching workspace, add it to rendered set
useMemo(() => {
  if (currentWorkspace && !renderedWorkspaceIds.has(currentWorkspace.id)) {
    setRenderedWorkspaceIds(prev => new Set(prev).add(currentWorkspace.id));
  }
}, [currentWorkspace, renderedWorkspaceIds]);
```

Each workspace container:
- First time: Not rendered (returns null)
- When activated: Rendered and added to DOM
- When hidden: `display: none` (stays in DOM)

**File: `src/components/TerminalCell.tsx`**

Simplified to:
1. Use `hasInitializedRef` to ensure terminal only initializes ONCE
2. Terminal cleanup only happens when component is truly unmounted (app close)

### Workspace Layout

```
Initial load (Workspace 1 active):
┌─────────────────────────────────────┐
│  [Workspace 1*] [Workspace 2] [+]   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  Workspace 1 (display: flex)    │ │ <- Rendered
│ └─────────────────────────────────┘ │
│                                     │ <- Workspace 2 NOT rendered yet
└─────────────────────────────────────┘

After switching to Workspace 2:
┌─────────────────────────────────────┐
│  [Workspace 1] [Workspace 2*] [+]   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  Workspace 1 (display: none)    │ │ <- Hidden but in DOM
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │  Workspace 2 (display: flex)    │ │ <- Now rendered
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Behavior After Fix

| Event | Terminal UI | Process | Content | Memory |
|-------|-------------|---------|---------|--------|
| First load | Render active only | Started | Fresh | 1 workspace |
| Switch to new workspace | Render new | Started | Fresh | +1 workspace |
| Switch back | Shown (flex) | Running | ✅ Preserved | Same |
| Switch away | Hidden (none) | Running | ✅ Preserved | Same |
| App quits | All cleaned up | All killed | N/A | Freed |

## Testing
1. Run `bun run dev`
2. Run some commands in a terminal (e.g., `echo hello`, start an agent)
3. Click on a different workspace tab
4. Click back to the original workspace
5. **Expected Result**:
   - Terminal shows all previous output (no blank screen)
   - Agent is still running (not restarted)
   - Scroll position is preserved

## Benefits
- **Memory efficient**: Only render workspaces when first accessed
- **State preserved**: Once rendered, terminals never lose state
- **Fast switching**: No re-initialization when switching back
- **Clean**: Simple lazy-loading pattern

## Trade-offs
- **Memory usage**: Grows with number of visited workspaces (acceptable for typical use)
- **First switch**: Slight delay when switching to a new workspace for the first time (needs to render)

## Notes
- Workspaces are lazily rendered on first access
- Once rendered, workspaces stay in memory for the session
- This is the same pattern used by VS Code for editor tabs
- Memory is freed when app closes
