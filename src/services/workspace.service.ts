/**
 * Workspace Service
 * Handles workspace business logic
 */

import { logger } from '../lib/logger';
import { STORAGE_KEYS } from '../config/constants';
import { backendAPI, isWailsAvailable } from './wails-bridge';
import type { WorkspaceLayout, WorkspaceCreationConfig } from '../types/workspace';

class WorkspaceServiceClass {
  private log = logger.child('[WorkspaceService]');

  /**
   * Load all workspaces from storage
   */
  async loadWorkspaces(): Promise<WorkspaceLayout[]> {
    this.log.info('Loading workspaces from storage');

    if (!isWailsAvailable()) {
      this.log.warn('backendAPI not available');
      return [];
    }

    try {
      const workspaces = await backendAPI.getStoreValue(STORAGE_KEYS.WORKSPACES);

      if (workspaces && Array.isArray(workspaces)) {
        this.log.info('Loaded workspaces', { count: workspaces.length });
        return workspaces as WorkspaceLayout[];
      }

      this.log.info('No workspaces found in storage');
      return [];
    } catch (error: any) {
      this.log.error('Failed to load workspaces', { error: error.message });
      return [];
    }
  }

  /**
   * Save workspaces to storage
   */
  async saveWorkspaces(workspaces: WorkspaceLayout[]): Promise<boolean> {
    this.log.info('Saving workspaces to storage', { count: workspaces.length });

    if (!isWailsAvailable()) {
      return false;
    }

    try {
      const result = await backendAPI.setStoreValue(STORAGE_KEYS.WORKSPACES, workspaces);

      if (result.success) {
        this.log.info('Workspaces saved successfully');
      } else {
        this.log.error('Failed to save workspaces', { error: result.error });
      }

      return result.success;
    } catch (error: any) {
      this.log.error('Error saving workspaces', { error: error.message });
      return false;
    }
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(config: WorkspaceCreationConfig): Promise<WorkspaceLayout | null> {
    this.log.info('Creating workspace', { name: config.name, columns: config.columns, rows: config.rows });

    if (!isWailsAvailable()) {
      return null;
    }

    try {
      const workspace = await backendAPI.createWorkspace(config);

      if (workspace) {
        this.log.info('Workspace created', { id: workspace.id, name: workspace.name });
      } else {
        this.log.error('Failed to create workspace');
      }

      return workspace;
    } catch (error: any) {
      this.log.error('Error creating workspace', { error: error.message });
      return null;
    }
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(id: string): Promise<boolean> {
    this.log.info('Deleting workspace', { id });

    if (!isWailsAvailable()) {
      return false;
    }

    try {
      const result = await backendAPI.deleteWorkspace(id);

      if (result.success) {
        this.log.info('Workspace deleted', { id });
      } else {
        this.log.error('Failed to delete workspace', { id, error: result.error });
      }

      return result.success;
    } catch (error: any) {
      this.log.error('Error deleting workspace', { id, error: error.message });
      return false;
    }
  }

  /**
   * Switch to a workspace
   */
  async switchWorkspace(id: string): Promise<WorkspaceLayout | null> {
    this.log.info('Switching to workspace', { id });

    if (!isWailsAvailable()) {
      return null;
    }

    try {
      const workspace = await backendAPI.switchWorkspace(id);

      if (workspace) {
        this.log.info('Switched to workspace', { name: workspace.name });
      } else {
        this.log.warn('Workspace not found', { id });
      }

      return workspace;
    } catch (error: any) {
      this.log.error('Error switching workspace', { id, error: error.message });
      return null;
    }
  }

  /**
   * Cleanup terminals for a workspace (when switching)
   */
  async cleanupWorkspaceTerminals(workspaceId: string): Promise<{ success: boolean; cleaned: number }> {
    this.log.info('Cleaning up workspace terminals', { workspaceId });

    if (!isWailsAvailable()) {
      return { success: false, cleaned: 0 };
    }

    try {
      const result = await backendAPI.cleanupWorkspaceTerminals(workspaceId);

      const cleaned = result.cleaned ?? 0;
      this.log.info('Cleanup complete', { cleaned });
      return { success: result.success, cleaned };
    } catch (error: any) {
      this.log.error('Error cleaning up workspace terminals', { workspaceId, error: error.message });
      return { success: false, cleaned: 0 };
    }
  }
}

// Singleton instance
export const WorkspaceService = new WorkspaceServiceClass();
