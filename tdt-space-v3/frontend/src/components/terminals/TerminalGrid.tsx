import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { TerminalCell } from './TerminalCell';
import { WorkspaceLayout } from '../../types/workspace';
import { WorkspaceService } from '../../services/workspace.service';

export const TerminalGrid = React.memo(() => {
  // Individual selectors to prevent re-rendering when unrelated state changes
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const activeTerminalId = useWorkspaceStore((s) => s.activeTerminalId);
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const removeTerminal = useWorkspaceStore((s) => s.removeTerminal);
  const splitTerminal = useWorkspaceStore((s) => s.splitTerminal);
  const swapTerminals = useWorkspaceStore((s) => s.swapTerminals);

  // Drag state
  const [draggedTerminalId, setDraggedTerminalId] = useState<string | null>(null);
  const [dragOverTerminalId, setDragOverTerminalId] = useState<string | null>(null);

  // Track which workspaces have been rendered (lazy rendering)
  // Once a workspace is rendered, it stays mounted to preserve terminal state
  const renderedWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const previousWorkspaceIdRef = useRef<string | null>(null);

  // Mark current workspace as rendered if not already
  if (currentWorkspace && !renderedWorkspaceIdsRef.current.has(currentWorkspace.id)) {
    renderedWorkspaceIdsRef.current.add(currentWorkspace.id);
  }

  // Cleanup rendered workspace refs for deleted workspaces to prevent memory leaks
  useEffect(() => {
    const currentIds = new Set(workspaces.map(ws => ws.id));
    renderedWorkspaceIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) {
        renderedWorkspaceIdsRef.current.delete(id);
      }
    });
  }, [workspaces]);

  // Handle workspace switching - set active/inactive state for background optimization (Option C: Hybrid)
  useEffect(() => {
    const currentId = currentWorkspace?.id || null;
    const previousId = previousWorkspaceIdRef.current;

    // When switching workspaces, update active state
    if (previousId && previousId !== currentId) {
      // Mark previous workspace as inactive (background mode)
      WorkspaceService.setWorkspaceActive(previousId, false);
    }

    if (currentId && currentId !== previousId) {
      // Mark new workspace as active
      WorkspaceService.setWorkspaceActive(currentId, true);
    }

    previousWorkspaceIdRef.current = currentId;
  }, [currentWorkspace?.id]);

  // Drag handlers
  const handleDragStart = useCallback((terminalId: string) => {
    setDraggedTerminalId(terminalId);
  }, []);

  const handleDragOver = useCallback((terminalId: string) => {
    if (draggedTerminalId && draggedTerminalId !== terminalId) {
      setDragOverTerminalId(terminalId);
    }
  }, [draggedTerminalId]);

  const handleDragLeave = useCallback(() => {
    setDragOverTerminalId(null);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (draggedTerminalId && draggedTerminalId !== targetId) {
      swapTerminals(draggedTerminalId, targetId);
    }
    setDraggedTerminalId(null);
    setDragOverTerminalId(null);
  }, [draggedTerminalId, swapTerminals]);

  const handleDragEnd = useCallback(() => {
    setDraggedTerminalId(null);
    setDragOverTerminalId(null);
  }, []);

  if (!currentWorkspace) {
    return <div>No workspace selected</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.workspaceContainer}>
        {/* Render only workspaces that have been visited (lazy rendering) */}
        {/* Once rendered, workspace stays mounted to preserve terminal state */}
        {workspaces
          .filter((ws: WorkspaceLayout) => renderedWorkspaceIdsRef.current.has(ws.id))
          .map((workspace: WorkspaceLayout) => {
            const isActive = workspace.id === currentWorkspace.id;
            return (
              <div
                key={workspace.id}
                style={{
                  ...styles.workspaceWrapper,
                  display: isActive ? 'block' : 'none',
                }}
              >
                {renderWorkspace(
                  workspace,
                  activeTerminalId,
                  handleSetActiveTerminal,
                  handleRemoveTerminal,
                  handleSplitTerminal,
                  draggedTerminalId,
                  dragOverTerminalId,
                  handleDragStart,
                  handleDragOver,
                  handleDragLeave,
                  handleDrop,
                  handleDragEnd,
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
});

TerminalGrid.displayName = 'TerminalGrid';

// Memoize callbacks to prevent TerminalCell React.memo from breaking
const handleSetActiveTerminal = (id: string) => {
  useWorkspaceStore.getState().setActiveTerminal(id);
};

const handleRemoveTerminal = (terminalId: string) => {
  useWorkspaceStore.getState().removeTerminal(terminalId);
};

const handleSplitTerminal = (terminalId: string, direction: 'horizontal' | 'vertical') => {
  useWorkspaceStore.getState().splitTerminal(terminalId, direction);
};

// Render a single workspace grid
const renderWorkspace = (
  workspace: WorkspaceLayout,
  activeTerminalId: string | null,
  setActiveTerminal: (id: string) => void,
  removeTerminal: (terminalId: string) => void,
  splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => void,
  draggedTerminalId: string | null,
  dragOverTerminalId: string | null,
  onDragStart: (terminalId: string) => void,
  onDragOver: (terminalId: string) => void,
  onDragLeave: () => void,
  onDrop: (terminalId: string) => void,
  onDragEnd: () => void,
) => {
  const { columns, rows, terminals } = workspace;

  // Always use CSS grid for all layouts to maintain stable React component keys
  // This prevents terminal unmount/remount when splitting (which would restart terminals)
  const useGrid = columns > 1 || rows > 1;

  if (useGrid) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        height: '100%',
        width: '100%',
        gap: '2px',
      }}>
        {terminals.map((terminal: any) => (
          <div
            key={terminal.id}
            style={{
              ...styles.simpleContainer,
              border: dragOverTerminalId === terminal.id
                ? '2px solid #89b4fa'
                : '1px solid #45475a40',
              borderRadius: '4px',
              overflow: 'hidden',
              opacity: draggedTerminalId === terminal.id ? 0.5 : 1,
              boxShadow: dragOverTerminalId === terminal.id
                ? '0 0 10px rgba(137, 180, 250, 0.3)'
                : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <TerminalCell
              terminal={terminal}
              isActive={terminal.id === activeTerminalId}
              isDragging={draggedTerminalId === terminal.id}
              isDragOver={dragOverTerminalId === terminal.id}
              onActivate={() => setActiveTerminal(terminal.id)}
              onSplit={(direction) => splitTerminal(terminal.id, direction)}
              onClose={() => removeTerminal(terminal.id)}
              onDragStart={() => onDragStart(terminal.id)}
              onDragOver={() => onDragOver(terminal.id)}
              onDragLeave={onDragLeave}
              onDrop={() => onDrop(terminal.id)}
              onDragEnd={onDragEnd}
            />
          </div>
        ))}
      </div>
    );
  }

  // Single terminal (1x1 grid)
  const terminal = terminals[0];
  return (
    <div style={styles.simpleContainer}>
      <TerminalCell
        terminal={terminal}
        isActive={terminal.id === activeTerminalId}
        isDragging={draggedTerminalId === terminal.id}
        isDragOver={dragOverTerminalId === terminal.id}
        onActivate={() => setActiveTerminal(terminal.id)}
        onSplit={(direction) => splitTerminal(terminal.id, direction)}
        onClose={() => removeTerminal(terminal.id)}
        onDragStart={() => onDragStart(terminal.id)}
        onDragOver={() => onDragOver(terminal.id)}
        onDragLeave={onDragLeave}
        onDrop={() => onDrop(terminal.id)}
        onDragEnd={onDragEnd}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    width: '100%',
    padding: '0',
    position: 'relative',
    overflow: 'hidden',
  },
  workspaceContainer: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  workspaceWrapper: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  simpleContainer: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  groupContainer: {
    height: '100%',
    width: '100%',
  },
};
