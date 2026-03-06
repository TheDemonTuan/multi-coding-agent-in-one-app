import React, { useState, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { TerminalCell } from './TerminalCell';
import { WorkspaceLayout } from '../types/workspace';

export const TerminalGrid = React.memo(() => {
  const { workspaces, currentWorkspace, activeTerminalId, setActiveTerminal, removeTerminal, splitTerminal } = useWorkspaceStore();

  // Track which workspaces have been rendered (lazy rendering)
  // Once a workspace is rendered, it stays in the DOM (never unmounted)
  const [renderedWorkspaceIds, setRenderedWorkspaceIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (currentWorkspace) {
      initial.add(currentWorkspace.id);
    }
    return initial;
  });

  // Update rendered workspaces when currentWorkspace changes
  useMemo(() => {
    if (currentWorkspace && !renderedWorkspaceIds.has(currentWorkspace.id)) {
      setRenderedWorkspaceIds(prev => new Set(prev).add(currentWorkspace.id));
    }
  }, [currentWorkspace, renderedWorkspaceIds]);

  if (!currentWorkspace || workspaces.length === 0) {
    return <div>No workspace selected</div>;
  }

  return (
    <div style={styles.container}>
      {workspaces.map((workspace) => {
        const isActive = workspace.id === currentWorkspace.id;
        const hasBeenRendered = renderedWorkspaceIds.has(workspace.id);

        // Only render workspace if it's active OR has been rendered before
        if (!hasBeenRendered) {
          return null;
        }

        return (
          <div
            key={workspace.id}
            style={{
              ...styles.workspaceContainer,
              display: isActive ? 'flex' : 'none',
            }}
          >
            {renderWorkspace(workspace, activeTerminalId, setActiveTerminal, removeTerminal, splitTerminal)}
          </div>
        );
      })}
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
      <Group orientation="horizontal" style={styles.groupContainer}>
        <Panel defaultSize={100} minSize={100}>
          <div style={styles.terminalWrapper}>
            <TerminalCell
              terminal={terminal}
              isActive={terminal.id === activeTerminalId}
              onActivate={() => setActiveTerminal(terminal.id)}
              onSplit={(direction) => splitTerminal(terminal.id, direction)}
              onClose={() => removeTerminal(terminal.id)}
            />
          </div>
        </Panel>
      </Group>
    );
  }

  // Multiple rows and columns - grid layout
  if (columns > 1 && rows > 1) {
    const gridRows = [];

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowTerminals = terminals.slice(
        rowIndex * columns,
        (rowIndex + 1) * columns
      );
      const rowPanelSize = 100 / rows;

      gridRows.push(
        <Panel key={`row-${rowIndex}-${workspace.id}`} defaultSize={rowPanelSize} minSize={10}>
          <Group orientation="horizontal">
            {rowTerminals.map((terminal: any, colIndex: number) => (
              <React.Fragment key={terminal.id}>
                <Panel defaultSize={100 / columns} minSize={10}>
                  <div style={styles.terminalWrapper}>
                    <TerminalCell
                      terminal={terminal}
                      isActive={terminal.id === activeTerminalId}
                      onActivate={() => setActiveTerminal(terminal.id)}
                      onSplit={(direction) => splitTerminal(terminal.id, direction)}
                      onClose={() => removeTerminal(terminal.id)}
                    />
                  </div>
                </Panel>
                {colIndex < rowTerminals.length - 1 && (
                  <Separator />
                )}
              </React.Fragment>
            ))}
          </Group>
        </Panel>
      );

      if (rowIndex < rows - 1) {
        gridRows.push(<Separator key={`handle-${rowIndex}-${workspace.id}`} />);
      }
    }

    return (
      <Group orientation="vertical" style={styles.groupContainer}>
        {gridRows}
      </Group>
    );
  }

  // Single row, multiple columns - horizontal layout
  if (rows === 1 && columns > 1) {
    const panelSize = 100 / columns;
    return (
      <Group orientation="horizontal" style={styles.groupContainer}>
        {terminals.map((terminal: any, index: number) => (
          <React.Fragment key={terminal.id}>
            <Panel defaultSize={panelSize} minSize={10}>
              <div style={styles.terminalWrapper}>
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
    const panelSize = 100 / rows;
    return (
      <Group orientation="vertical" style={styles.groupContainer}>
        {terminals.map((terminal: any, index: number) => (
          <React.Fragment key={terminal.id}>
            <Panel defaultSize={panelSize} minSize={10}>
              <div style={styles.terminalWrapper}>
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
  groupContainer: {
    height: '100%',
    width: '100%',
  },
  terminalWrapper: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
};
