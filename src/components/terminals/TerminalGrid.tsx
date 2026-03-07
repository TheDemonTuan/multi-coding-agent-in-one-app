import React, { useRef, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { TerminalCell } from './TerminalCell';
import { WorkspaceLayout } from '../../types/workspace';

export const TerminalGrid = React.memo(() => {
  const { workspaces, currentWorkspace, activeTerminalId, setActiveTerminal, removeTerminal, splitTerminal } = useWorkspaceStore();
  
  // Track which workspaces have been rendered (lazy rendering)
  // Once a workspace is rendered, it stays mounted to preserve terminal state
  const renderedWorkspaceIdsRef = useRef<Set<string>>(new Set());
  
  // Mark current workspace as rendered if not already
  if (currentWorkspace && !renderedWorkspaceIdsRef.current.has(currentWorkspace.id)) {
    renderedWorkspaceIdsRef.current.add(currentWorkspace.id);
  }

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
                {renderWorkspace(workspace, activeTerminalId, setActiveTerminal, removeTerminal, splitTerminal)}
              </div>
            );
          })}
      </div>
    </div>
  );
});

TerminalGrid.displayName = 'TerminalGrid';

// Render a single workspace grid
const renderWorkspace = (
  workspace: WorkspaceLayout,
  activeTerminalId: string | null,
  setActiveTerminal: (id: string) => void,
  removeTerminal: (terminalId: string) => void,
  splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => void
) => {
  const { columns, rows, terminals } = workspace;

  // Single terminal
  if (columns === 1 && rows === 1) {
    const terminal = terminals[0];
    return (
      <div style={styles.simpleContainer}>
        <TerminalCell
          terminal={terminal}
          isActive={terminal.id === activeTerminalId}
          onActivate={() => setActiveTerminal(terminal.id)}
          onSplit={(direction) => splitTerminal(terminal.id, direction)}
          onClose={() => removeTerminal(terminal.id)}
        />
      </div>
    );
  }

  // Multiple rows and columns - use CSS grid instead of nested Groups
  if (columns > 1 && rows > 1) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        height: '100%',
        width: '100%',
        gap: '2px',
      }}>
        {terminals.map((terminal: any, index: number) => (
          <div key={terminal.id} style={{ ...styles.simpleContainer, border: '1px solid #45475a40', borderRadius: '4px' }}>
            <TerminalCell
              terminal={terminal}
              isActive={terminal.id === activeTerminalId}
              onActivate={() => setActiveTerminal(terminal.id)}
              onSplit={(direction) => splitTerminal(terminal.id, direction)}
              onClose={() => removeTerminal(terminal.id)}
            />
          </div>
        ))}
      </div>
    );
  }

  // Single row, multiple columns - horizontal layout
  if (rows === 1 && columns > 1) {
    return (
      <Group orientation="horizontal" style={styles.groupContainer}>
        {terminals.map((terminal: any, index: number) => (
          <React.Fragment key={terminal.id}>
            <Panel defaultSize={100 / columns} minSize={10}>
              <div style={styles.simpleContainer}>
                <TerminalCell
                  terminal={terminal}
                  isActive={terminal.id === activeTerminalId}
                  onActivate={() => setActiveTerminal(terminal.id)}
                  onSplit={(direction) => splitTerminal(terminal.id, direction)}
                  onClose={() => removeTerminal(terminal.id)}
                />
              </div>
            </Panel>
            {index < terminals.length - 1 && (
              <Separator />
            )}
          </React.Fragment>
        ))}
      </Group>
    );
  }

  // Single column, multiple rows - vertical layout
  if (columns === 1 && rows > 1) {
    return (
      <Group orientation="vertical" style={styles.groupContainer}>
        {terminals.map((terminal: any, index: number) => (
          <React.Fragment key={terminal.id}>
            <Panel defaultSize={100 / rows} minSize={10}>
              <div style={styles.simpleContainer}>
                <TerminalCell
                  terminal={terminal}
                  isActive={terminal.id === activeTerminalId}
                  onActivate={() => setActiveTerminal(terminal.id)}
                  onSplit={(direction) => splitTerminal(terminal.id, direction)}
                  onClose={() => removeTerminal(terminal.id)}
                />
              </div>
            </Panel>
            {index < terminals.length - 1 && (
              <Separator />
            )}
          </React.Fragment>
        ))}
      </Group>
    );
  }

  return null;
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
