/**
 * Centralized logging utility for TDT Space
 * Provides consistent logging across the application with levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  level?: LogLevel;
}

class Logger {
  private prefix: string;
  private level: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '[App]';
    this.level = options.level || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return `${this.prefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    // No-op: debug logging disabled
  }

  info(message: string, ...args: any[]): void {
    // No-op: info logging disabled
  }

  warn(message: string, ...args: any[]): void {
    // No-op: warn logging disabled
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  // Create a child logger with additional prefix
  child(prefix: string): Logger {
    return new Logger({
      prefix: `${this.prefix} ${prefix}`,
      level: this.level,
    });
  }
}

// Default logger instance
export const logger = new Logger({ prefix: '[TDT Space]' });

// Export factory function for creating custom loggers
export const createLogger = (prefix: string, level?: LogLevel) => {
  return new Logger({ prefix, level });
};
