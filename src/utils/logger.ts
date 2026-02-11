/**
 * Production-Safe Structured Logger
 * 
 * Features:
 * - Environment-aware: Debug logs only in development
 * - Structured logging: Context objects for better debugging
 * - Log levels: debug, info, warn, error
 * - Performance tracking: Built-in timing utilities
 * - Error reporting: Integrated with Sentry for production error tracking
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   
 *   // Simple logging
 *   logger.debug('Starting process');
 *   logger.info('User logged in', { userId: '123' });
 *   logger.warn('Deprecated API used');
 *   logger.error('Failed to save', error);
 *   
 *   // Scoped logger for a module
 *   const log = logger.scope('CompanionEvolution');
 *   log.info('Evolution started', { stage: 3 });
 *   
 *   // Performance tracking
 *   const timer = logger.time('fetchData');
 *   await fetchData();
 *   timer.end(); // Logs: "fetchData completed in 123ms"
 */

import * as Sentry from "@sentry/react";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

 
type LogContext = Record<string, any>;

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  scope?: string;
}

// Environment detection
const isDevelopment = import.meta.env.DEV;
const isTest = import.meta.env.MODE === 'test';

// Log level hierarchy (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum level to log in production (warn and above)
const PROD_MIN_LEVEL: LogLevel = 'warn';

/**
 * Check if a log level should be output based on environment
 */
function shouldLog(level: LogLevel): boolean {
  if (isTest) return false; // Silent in tests
  if (isDevelopment) return true; // All logs in dev
  return LOG_LEVELS[level] >= LOG_LEVELS[PROD_MIN_LEVEL];
}

/**
 * Format a log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const prefix = entry.scope ? `[${entry.scope}]` : '';
  return prefix ? `${prefix} ${entry.message}` : entry.message;
}

/**
 * Send error to Sentry for production error tracking
 */
function reportToErrorTracking(entry: LogEntry): void {
  // Only report if Sentry is initialized (has valid DSN in production)
  if (Sentry.isInitialized()) {
    Sentry.captureMessage(entry.message, {
      level: 'error',
      extra: entry.context,
      tags: entry.scope ? { scope: entry.scope } : undefined,
    });
  }
}

/**
 * Core logging function
 */
function logMessage(
  level: LogLevel,
  message: string,
  context?: LogContext,
  scope?: string
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    scope,
  };

  const formattedMessage = formatLogEntry(entry);
  const args: unknown[] = [formattedMessage];
  
  if (context && Object.keys(context).length > 0) {
    args.push(context);
  }

  switch (level) {
    case 'debug':
       
      console.log(...args);
      break;
    case 'info':
       
      console.log(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      // Always report errors to tracking in production
      if (!isDevelopment) {
        reportToErrorTracking(entry);
      }
      break;
  }
}

/**
 * Create a scoped logger for a specific module/component
 */
function createScopedLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) => 
      logMessage('debug', message, context, scope),
    info: (message: string, context?: LogContext) => 
      logMessage('info', message, context, scope),
    warn: (message: string, context?: LogContext) => 
      logMessage('warn', message, context, scope),
    error: (message: string | Error, context?: LogContext) => {
      if (message instanceof Error) {
        logMessage('error', message.message, { 
          ...context, 
          stack: message.stack,
          name: message.name 
        }, scope);
      } else {
        logMessage('error', message, context, scope);
      }
    },
  };
}

/**
 * Performance timer for measuring operation duration
 */
function createTimer(label: string, scope?: string) {
  const start = performance.now();
  
  return {
    end: (context?: LogContext) => {
      const duration = Math.round(performance.now() - start);
      logMessage('debug', `${label} completed in ${duration}ms`, {
        ...context,
        durationMs: duration,
      }, scope);
      return duration;
    },
    
    checkpoint: (checkpointName: string) => {
      const elapsed = Math.round(performance.now() - start);
      logMessage('debug', `${label} checkpoint: ${checkpointName} at ${elapsed}ms`, {
        elapsedMs: elapsed,
      }, scope);
      return elapsed;
    },
  };
}

/**
 * Main logger export
 */
export const logger = {
  // Standard log methods
  debug: (message: string, context?: LogContext) => 
    logMessage('debug', message, context),
  
  info: (message: string, context?: LogContext) => 
    logMessage('info', message, context),
  
  warn: (message: string, context?: LogContext) => 
    logMessage('warn', message, context),
  
  error: (message: string | Error, context?: LogContext) => {
    if (message instanceof Error) {
      logMessage('error', message.message, { 
        ...context, 
        stack: message.stack,
        name: message.name 
      });
    } else {
      logMessage('error', message, context);
    }
  },

  // Legacy compatibility - maps to debug level
  log: (message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
       
      console.log(message, ...args);
    }
  },

  // Create a scoped logger for a module
  scope: (scopeName: string) => createScopedLogger(scopeName),
  
  // Performance timing
  time: (label: string, scope?: string) => createTimer(label, scope),

  // Utility: Log only in development
  dev: (message: string, context?: LogContext) => {
    if (isDevelopment) {
      logMessage('debug', `[DEV] ${message}`, context);
    }
  },

  // Utility: Group related logs
  group: (label: string, fn: () => void) => {
    if (!shouldLog('debug')) return;
     
    console.group(label);
    try {
      fn();
    } finally {
       
      console.groupEnd();
    }
  },

  // Utility: Table display for arrays/objects
  table: (data: unknown) => {
    if (!shouldLog('debug')) return;
     
    console.table(data);
  },
};
