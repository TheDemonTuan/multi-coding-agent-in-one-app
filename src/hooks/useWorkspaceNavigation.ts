/**
 * Hook for workspace navigation
 */

import { useCallback } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';

export function useWorkspaceNavigation() {
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const getNextWorkspace = useWorkspaceStore((state) => state.getNextWorkspace);
  const getPreviousWorkspace = useWorkspaceStore((state) => state.getPreviousWorkspace);
  const getWorkspaceByIndex = useWorkspaceStore((state) => state.getWorkspaceByIndex);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);

  /**
   * Cycle to next workspace
   */
  const nextWorkspace = useCallback(() => {
    const next = getNextWorkspace();
    if (next) {
      setCurrentWorkspace(next);
      return next;
    }
    return null;
  }, [getNextWorkspace, setCurrentWorkspace]);

  /**
   * Cycle to previous workspace
   */
  const previousWorkspace = useCallback(() => {
    const prev = getPreviousWorkspace();
    if (prev) {
      setCurrentWorkspace(prev);
      return prev;
    }
    return null;
  }, [getPreviousWorkspace, setCurrentWorkspace]);

  /**
   * Switch to workspace by index
   */
  const switchToWorkspaceByIndex = useCallback((index: number) => {
    if (index < 0 || index >= workspaces.length) {
      return null;
    }
    const workspace = getWorkspaceByIndex(index);
    if (workspace) {
      setCurrentWorkspace(workspace);
      return workspace;
    }
    return null;
  }, [getWorkspaceByIndex, setCurrentWorkspace, workspaces.length]);

  /**
   * Get current workspace index
   */
  const getCurrentWorkspaceIndex = useCallback(() => {
    if (!currentWorkspace) {
      return -1;
    }
    return workspaces.findIndex(ws => ws.id === currentWorkspace.id);
  }, [currentWorkspace, workspaces]);

  return {
    nextWorkspace,
    previousWorkspace,
    switchToWorkspaceByIndex,
    getCurrentWorkspaceIndex,
    workspaceCount: workspaces.length,
    currentWorkspace,
  };
}
