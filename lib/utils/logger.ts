/**
 * Centralized logging utility
 * Supports different log levels and structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLog(entry: LogEntry): string {
    const { level, message, timestamp, context, error } = entry;
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      logMessage += ` | Context: ${JSON.stringify(context)}`;
    }

    if (error) {
      logMessage += ` | Error: ${error.message}`;
      if (error.stack && this.isDevelopment) {
        logMessage += `\nStack: ${error.stack}`;
      }
    }

    return logMessage;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    const formattedLog = this.formatLog(entry);

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedLog);
        }
        break;
      case 'info':
        console.log(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
        console.error(formattedLog);
        // In production, you could send to error tracking service (Sentry, etc.)
        if (!this.isDevelopment && process.env.SENTRY_DSN) {
          // TODO: Integrate with Sentry or similar
        }
        break;
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, context, error);
  }

  // API-specific logging
  apiRequest(method: string, path: string, userId?: string, statusCode?: number) {
    this.info('API Request', {
      method,
      path,
      userId,
      statusCode,
    });
  }

  apiError(method: string, path: string, error: Error, userId?: string, statusCode?: number) {
    this.error('API Error', error, {
      method,
      path,
      userId,
      statusCode,
    });
  }

  databaseQuery(operation: string, table: string, duration?: number) {
    this.debug('Database Query', {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
    });
  }
}

export const logger = new Logger();










