type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private logLevel: LogLevel = 'info';
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor() {
    // Set log level from environment or default to info
    const envLogLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    if (envLogLevel && this.isValidLogLevel(envLogLevel)) {
      this.logLevel = envLogLevel;
    }
  }

  /**
   * Check if a log level is valid
   */
  private isValidLogLevel(level: string): level is LogLevel {
    return ['debug', 'info', 'warn', 'error'].includes(level);
  }

  /**
   * Get current timestamp in ISO format
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get log level priority (higher number = more important)
   */
  private getLogLevelPriority(level: LogLevel): number {
    const priorities: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return priorities[level];
  }

  /**
   * Check if log should be displayed
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getLogLevelPriority(level) >= this.getLogLevelPriority(this.logLevel);
  }

  /**
   * Format log message with color for console
   */
  private formatConsoleMessage(level: LogLevel, message: string): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    return `${colors[level]}[${level.toUpperCase()}]${reset} ${message}`;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = this.getTimestamp();
    const logEntry: LogEntry = { timestamp, level, message, data };

    // Store log
    this.logs.push(logEntry);
    this.trimLogs();

    // Console output
    if (this.isDevelopment || level === 'error') {
      const formattedMessage = this.formatConsoleMessage(level, message);
      const timestamp2 = `\x1b[90m${timestamp}\x1b[0m`;
      
      if (data) {
        console.log(`${timestamp2} ${formattedMessage}`, data);
      } else {
        console.log(`${timestamp2} ${formattedMessage}`);
      }
    }
  }

  /**
   * Keep logs under 1000 entries to prevent memory issues
   */
  private trimLogs(): void {
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }
  }

  /**
   * Get all stored logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    if (this.isValidLogLevel(level)) {
      this.logLevel = level;
      this.info(`Log level changed to: ${level}`);
    }
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}

// Export singleton instance
export const logger = new Logger();
