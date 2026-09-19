import { EXTENSION_LOG_PREFIX } from '../config/site';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  context: Record<string, unknown> | undefined;
  timestamp: string;
}

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

function getDefaultMinLevel(): LogLevel {
  return import.meta.env.DEV ? 'debug' : 'warn';
}

function callConsole(level: LogLevel, prefix: string, entry: LogEntry): void {
  if (level === 'debug') {
    console.debug(prefix, entry);
  } else if (level === 'info') {
    console.info(prefix, entry);
  } else if (level === 'warn') {
    console.warn(prefix, entry);
  } else {
    console.error(prefix, entry);
  }
}

export function createLogger(scope: string, minLevel?: LogLevel): Logger {
  const effectiveMinLevel: LogLevel = minLevel ?? getDefaultMinLevel();

  function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[effectiveMinLevel]) {
      return;
    }
    const entry: LogEntry = {
      level,
      scope,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    callConsole(level, EXTENSION_LOG_PREFIX, entry);
  }

  return {
    debug(message: string, context?: Record<string, unknown>): void {
      log('debug', message, context);
    },
    info(message: string, context?: Record<string, unknown>): void {
      log('info', message, context);
    },
    warn(message: string, context?: Record<string, unknown>): void {
      log('warn', message, context);
    },
    error(message: string, context?: Record<string, unknown>): void {
      log('error', message, context);
    },
  };
}
