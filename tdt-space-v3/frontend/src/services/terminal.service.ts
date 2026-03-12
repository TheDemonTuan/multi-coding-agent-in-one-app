/**
 * Terminal Service
 * Handles terminal lifecycle management using the Wails backend via backendAPI.
 */

import { logger } from '../lib/logger';
import type { TerminalPane, TerminalStatus } from '../types/terminal';
import type { AgentConfig } from '../types/agent';
import { backendAPI } from './wails-bridge';

interface TerminalServiceState {
  terminals: Map<string, TerminalPane>;
  activeTerminalId: string | null;
}

class TerminalServiceClass {
  private state: TerminalServiceState;
  private log = logger.child('[TerminalService]');

  constructor() {
    this.state = {
      terminals: new Map(),
      activeTerminalId: null,
    };
  }

  /**
   * Spawn a new terminal
   */
  async spawnTerminal(
    id: string,
    cwd: string,
    workspaceId?: string
  ): Promise<{ success: boolean; pid?: number; error?: string }> {
    this.log.info('Spawning terminal', { id, cwd, workspaceId });

    try {
      // Pass 0 for cols/rows - backend will use defaults (80x24) via clampSize
      const result = await backendAPI.spawnTerminal(id, cwd, workspaceId || '', 0, 0);

      if (result.success) {
        this.updateTerminalStatus(id, 'running');
        this.log.info('Terminal spawned successfully', { id, pid: result.pid });
      } else {
        this.log.error('Failed to spawn terminal', { id, error: result.error });
      }

      return result;
    } catch (error: any) {
      this.log.error('Error spawning terminal', { id, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Spawn terminal with agent
   */
  async spawnTerminalWithAgent(
    id: string,
    cwd: string,
    agentConfig: AgentConfig,
    workspaceId?: string
  ): Promise<{ success: boolean; pid?: number; error?: string }> {
    this.log.info('Spawning terminal with agent', { id, cwd, agentConfig, workspaceId });

    try {
      // Pass 0 for cols/rows - backend will use defaults (80x24) via clampSize
      const result = await backendAPI.spawnTerminalWithAgent(id, cwd, agentConfig, workspaceId || '', 0, 0);

      if (result.success) {
        this.updateTerminalStatus(id, 'running');
        this.log.info('Terminal with agent spawned successfully', { id, pid: result.pid });
      } else {
        this.log.error('Failed to spawn terminal with agent', { id, error: result.error });
      }

      return result;
    } catch (error: any) {
      this.log.error('Error spawning terminal with agent', { id, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Write data to terminal
   */
  async writeToTerminal(id: string, data: string): Promise<boolean> {
    try {
      const result = await backendAPI.terminalWrite(id, data);
      return result.success;
    } catch (error: any) {
      this.log.error('Error writing to terminal', { id, error: error.message });
      return false;
    }
  }

  /**
   * Kill terminal process
   */
  async killTerminal(id: string): Promise<boolean> {
    this.log.info('Killing terminal', { id });

    try {
      const result = await backendAPI.terminalKill(id);

      if (result.success) {
        this.updateTerminalStatus(id, 'killed');
        this.log.info('Terminal killed successfully', { id });
      } else {
        this.log.error('Failed to kill terminal', { id, error: result.error });
      }

      return result.success;
    } catch (error: any) {
      this.log.error('Error killing terminal', { id, error: error.message });
      return false;
    }
  }

  /**
   * Resize terminal
   */
  async resizeTerminal(id: string, cols: number, rows: number): Promise<void> {
    try {
      await backendAPI.terminalResize(id, cols, rows);
      this.log.debug('Terminal resized', { id, cols, rows });
    } catch (error: any) {
      this.log.error('Error resizing terminal', { id, error: error.message });
    }
  }

  /**
   * Restart terminal
   */
  async restartTerminal(
    id: string,
    cwd: string,
    agentConfig?: AgentConfig,
    workspaceId?: string
  ): Promise<boolean> {
    this.log.info('Restarting terminal', { id });

    // Kill existing terminal
    await this.killTerminal(id);

    // Small delay to ensure process is fully killed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Spawn new terminal
    if (agentConfig?.enabled && agentConfig.type !== 'none') {
      const result = await this.spawnTerminalWithAgent(id, cwd, agentConfig, workspaceId);
      return result.success;
    } else {
      const result = await this.spawnTerminal(id, cwd, workspaceId);
      return result.success;
    }
  }

  /**
   * Update terminal status (local state only)
   */
  updateTerminalStatus(id: string, status: TerminalStatus): void {
    const terminal = this.state.terminals.get(id);
    if (terminal) {
      terminal.status = status;
      this.state.terminals.set(id, terminal);
    }
  }

  /**
   * Set active terminal
   */
  setActiveTerminal(id: string | null): void {
    this.state.activeTerminalId = id;
  }

  /**
   * Get active terminal ID
   */
  getActiveTerminalId(): string | null {
    return this.state.activeTerminalId;
  }

  /**
   * Register terminal in local state
   */
  registerTerminal(terminal: TerminalPane): void {
    this.state.terminals.set(terminal.id, terminal);
  }

  /**
   * Unregister terminal from local state
   */
  unregisterTerminal(id: string): void {
    this.state.terminals.delete(id);
    if (this.state.activeTerminalId === id) {
      this.state.activeTerminalId = null;
    }
  }
}

// Singleton instance
export const TerminalService = new TerminalServiceClass();
