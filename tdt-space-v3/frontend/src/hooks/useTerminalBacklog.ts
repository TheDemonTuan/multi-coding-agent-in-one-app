import { useEffect, useRef } from 'react';
import { WorkspaceService } from '../services/workspace.service';
import { backendAPI } from '../services/wails-bridge';

/**
 * Hook for handling terminal backlog when workspace becomes active
 * Part of Option C: Hybrid background optimization
 */
export function useTerminalBacklog(terminalId: string, isActive: boolean) {
  const hasFetchedBacklogRef = useRef(false);
  const terminalRef = useRef<any>(null);

  // Store reference to terminal write function
  useEffect(() => {
    // This will be set by the parent component
  }, []);

  // Fetch backlog when workspace becomes active
  useEffect(() => {
    if (isActive && !hasFetchedBacklogRef.current) {
      hasFetchedBacklogRef.current = true;

      // Fetch and display backlog
      WorkspaceService.getTerminalBacklog(terminalId).then((backlog) => {
        if (backlog && backlog.length > 0) {
          // Write backlog to terminal
          // Parent component should handle actually writing to terminal
          window.dispatchEvent(new CustomEvent('terminal-backlog', {
            detail: { terminalId, backlog }
          }));

          // Clear backlog after retrieving
          WorkspaceService.clearTerminalBacklog(terminalId);
        }
      }).catch((err) => {
        console.error('[useTerminalBacklog] Error fetching backlog:', err);
      });
    } else if (!isActive) {
      // Reset flag when becoming inactive
      hasFetchedBacklogRef.current = false;
    }
  }, [isActive, terminalId]);

  return { hasFetchedBacklog: hasFetchedBacklogRef.current };
}
