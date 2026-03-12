/**
 * Memory Monitor - VAL-PERF-007
 * Track memory usage and detect potential leaks in development
 */

import { logger } from './logger';

const log = logger.child('[MemoryMonitor]');

export interface MemoryStats {
  timestamp: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  terminalCount: number;
  eventListenerCount: number;
}

export type MemoryWarningLevel = 'info' | 'warning' | 'critical';

interface MemoryThresholds {
  warningPercent: number;
  criticalPercent: number;
}

const DEFAULT_THRESHOLDS: MemoryThresholds = {
  warningPercent: 70,
  criticalPercent: 85,
};

class MemoryMonitorClass {
  private stats: MemoryStats | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private thresholds: MemoryThresholds = DEFAULT_THRESHOLDS;
  private terminalRegistry = new Map<string, { createdAt: number; pid?: number }>();
  private eventListenerRegistry = new Map<string, Set<Function>>();

  /**
   * Initialize memory monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringInterval) {
      log.warn('Monitoring already started, stopping first');
      this.stopMonitoring();
    }

    log.info('Starting memory monitoring', { intervalMs });

    this.monitoringInterval = setInterval(() => {
      this.collectStats();
    }, intervalMs);

    // Collect initial stats immediately
    this.collectStats();
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      log.info('Memory monitoring stopped');
    }
  }

  /**
   * Collect memory stats
   */
  collectStats(): MemoryStats | null {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      // Performance.memory not available in this context
      return null;
    }

    const perfMemory = (performance as any).memory;

    this.stats = {
      timestamp: Date.now(),
      jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
      totalJSHeapSize: perfMemory.totalJSHeapSize,
      usedJSHeapSize: perfMemory.usedJSHeapSize,
      terminalCount: this.terminalRegistry.size,
      eventListenerCount: this.getEventListenerCount(),
    };

    const usagePercent = (this.stats.usedJSHeapSize / this.stats.jsHeapSizeLimit) * 100;
    const level = this.getWarningLevel(usagePercent);

    if (level === 'critical') {
      log.error('CRITICAL: Memory usage critical!', {
        usagePercent: usagePercent.toFixed(2),
        usedMB: (this.stats.usedJSHeapSize / 1024 / 1024).toFixed(2),
        limitMB: (this.stats.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
      });
    } else if (level === 'warning') {
      log.warn('WARNING: Memory usage elevated', {
        usagePercent: usagePercent.toFixed(2),
        usedMB: (this.stats.usedJSHeapSize / 1024 / 1024).toFixed(2),
      });
    } else {
      log.debug('Memory stats', {
        usagePercent: usagePercent.toFixed(2),
        usedMB: (this.stats.usedJSHeapSize / 1024 / 1024).toFixed(2),
        terminalCount: this.stats.terminalCount,
        eventListenerCount: this.stats.eventListenerCount,
      });
    }

    return this.stats;
  }

  /**
   * Get current memory stats
   */
  getStats(): MemoryStats | null {
    return this.stats;
  }

  /**
   * Register a terminal for tracking
   */
  registerTerminal(id: string, pid?: number): void {
    this.terminalRegistry.set(id, { createdAt: Date.now(), pid });
    log.debug('Terminal registered', { id, pid });
  }

  /**
   * Unregister a terminal
   */
  unregisterTerminal(id: string): void {
    const terminal = this.terminalRegistry.get(id);
    if (terminal) {
      const age = Date.now() - terminal.createdAt;
      log.debug('Terminal unregistered', { id, age: `${age}ms` });
      this.terminalRegistry.delete(id);
    } else {
      log.warn('Terminal not found for unregister', { id });
    }
  }

  /**
   * Get terminal count
   */
  getTerminalCount(): number {
    return this.terminalRegistry.size;
  }

  /**
   * Register an event listener for tracking
   */
  registerEventListener(category: string, listener: Function): void {
    if (!this.eventListenerRegistry.has(category)) {
      this.eventListenerRegistry.set(category, new Set());
    }
    this.eventListenerRegistry.get(category)!.add(listener);
  }

  /**
   * Unregister an event listener
   */
  unregisterEventListener(category: string, listener: Function): void {
    const listeners = this.eventListenerRegistry.get(category);
    if (listeners) {
      const removed = listeners.delete(listener);
      if (!removed) {
        log.warn('Listener not found for unregister', { category });
      }
      if (listeners.size === 0) {
        this.eventListenerRegistry.delete(category);
      }
    }
  }

  /**
   * Get total event listener count
   */
  getEventListenerCount(): number {
    let count = 0;
    this.eventListenerRegistry.forEach((listeners) => {
      count += listeners.size;
    });
    return count;
  }

  /**
   * Get event listener breakdown by category
   */
  getEventListenerBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    this.eventListenerRegistry.forEach((listeners, category) => {
      breakdown[category] = listeners.size;
    });
    return breakdown;
  }

  /**
   * Get warning level based on memory usage
   */
  private getWarningLevel(usagePercent: number): MemoryWarningLevel {
    if (usagePercent >= this.thresholds.criticalPercent) {
      return 'critical';
    }
    if (usagePercent >= this.thresholds.warningPercent) {
      return 'warning';
    }
    return 'info';
  }

  /**
   * Force garbage collection (only works in Node with --expose-gc)
   */
  forceGC(): void {
    if (typeof global !== 'undefined' && (global as any).gc) {
      log.info('Forcing garbage collection');
      (global as any).gc();
    } else {
      log.debug('GC not exposed, use --expose-gc flag');
    }
  }

  /**
   * Get memory leak report
   */
  getLeakReport(): {
    potentialLeaks: Array<{ type: string; count: number; details?: any }>;
    recommendations: string[];
  } {
    const leaks: Array<{ type: string; count: number; details?: any }> = [];
    const recommendations: string[] = [];

    // Check for potential terminal leaks (terminals registered but not cleaned up)
    if (this.terminalRegistry.size > 0) {
      const oldTerminals: Array<{ id: string; age: number }> = [];
      this.terminalRegistry.forEach((info, id) => {
        const age = Date.now() - info.createdAt;
        if (age > 60000) { // Older than 1 minute
          oldTerminals.push({ id, age });
        }
      });

      if (oldTerminals.length > 0) {
        leaks.push({
          type: 'potential_terminal_leak',
          count: oldTerminals.length,
          details: oldTerminals.map(t => ({
            id: t.id,
            age: `${(t.age / 1000).toFixed(1)}s`,
          })),
        });
        recommendations.push(
          `Found ${oldTerminals.length} terminals older than 1 minute. Ensure terminals are cleaned up on unmount.`
        );
      }
    }

    // Check for high event listener count
    const listenerCount = this.getEventListenerCount();
    if (listenerCount > 100) {
      leaks.push({
        type: 'high_listener_count',
        count: listenerCount,
      });
      recommendations.push(
        `High event listener count (${listenerCount}). Review listener cleanup in components.`
      );
    }

    // Check memory usage trend
    if (this.stats) {
      const usagePercent = (this.stats.usedJSHeapSize / this.stats.jsHeapSizeLimit) * 100;
      if (usagePercent > this.thresholds.warningPercent) {
        leaks.push({
          type: 'high_memory_usage',
          count: Math.round(usagePercent),
        });
        recommendations.push(
          `Memory usage at ${usagePercent.toFixed(1)}%. Consider optimizing memory-heavy operations.`
        );
      }
    }

    return { potentialLeaks: leaks, recommendations };
  }
}

// Singleton instance
export const MemoryMonitor = new MemoryMonitorClass();
