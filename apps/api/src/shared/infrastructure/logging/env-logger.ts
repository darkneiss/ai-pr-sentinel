const LOG_LEVEL_ENV_VAR = 'LOG_LEVEL';
const NODE_ENV_ENV_VAR = 'NODE_ENV';
const PRODUCTION_NODE_ENV = 'production';
const TEST_NODE_ENV = 'test';

const DEFAULT_PRODUCTION_LOG_LEVEL = 'info';
const DEFAULT_TEST_LOG_LEVEL = 'error';
const DEFAULT_NON_PRODUCTION_LOG_LEVEL = 'debug';
const FALLBACK_LOG_LEVEL = 'info';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

interface LogSink {
  debug: (message?: unknown, ...optionalParams: unknown[]) => void;
  info: (message?: unknown, ...optionalParams: unknown[]) => void;
  warn: (message?: unknown, ...optionalParams: unknown[]) => void;
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
}

export interface Logger {
  debug: (message: string, ...context: unknown[]) => void;
  info: (message: string, ...context: unknown[]) => void;
  warn: (message: string, ...context: unknown[]) => void;
  error: (message: string, ...context: unknown[]) => void;
}

interface CreateEnvLoggerParams {
  level?: string;
  sink?: LogSink;
}

const isLogLevel = (value: string): value is LogLevel => LOG_LEVELS.includes(value as LogLevel);

const normalizeLogLevel = (value: string | undefined): LogLevel | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  return isLogLevel(normalizedValue) ? normalizedValue : undefined;
};

const resolveConfiguredLogLevel = (explicitLevel?: string): LogLevel => {
  const providedLogLevel = normalizeLogLevel(explicitLevel);
  if (providedLogLevel) {
    return providedLogLevel;
  }

  const envLogLevel = normalizeLogLevel(process.env[LOG_LEVEL_ENV_VAR]);
  if (envLogLevel) {
    return envLogLevel;
  }

  const nodeEnv = (process.env[NODE_ENV_ENV_VAR] ?? '').trim().toLowerCase();
  if (nodeEnv === PRODUCTION_NODE_ENV) {
    return DEFAULT_PRODUCTION_LOG_LEVEL;
  }

  if (nodeEnv === TEST_NODE_ENV) {
    return DEFAULT_TEST_LOG_LEVEL;
  }

  return DEFAULT_NON_PRODUCTION_LOG_LEVEL;
};

const shouldLog = (configuredLevel: LogLevel, messageLevel: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[configuredLevel];

export const createEnvLogger = (params: CreateEnvLoggerParams = {}): Logger => {
  const configuredLevel = resolveConfiguredLogLevel(params.level);
  const sink = params.sink ?? console;

  const logWithLevel = (level: LogLevel, message: string, context: unknown[]): void => {
    if (!shouldLog(configuredLevel, level)) {
      return;
    }

    if (context.length === 0) {
      sink[level](message);
      return;
    }

    sink[level](message, ...context);
  };

  return {
    debug: (message: string, ...context: unknown[]) => logWithLevel('debug', message, context),
    info: (message: string, ...context: unknown[]) => logWithLevel('info', message, context),
    warn: (message: string, ...context: unknown[]) => logWithLevel('warn', message, context),
    error: (message: string, ...context: unknown[]) => logWithLevel('error', message, context),
  };
};

export const __internal = {
  normalizeLogLevel,
  resolveConfiguredLogLevel,
  shouldLog,
  FALLBACK_LOG_LEVEL,
};
