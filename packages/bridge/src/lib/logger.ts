import pino from 'pino';

export const logger = pino({
  name: '@refly/bridge',
  level: 'info', // Fixed to 'info'
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: ['*.password', '*.token', '*.apiKey', '*.secret'],
    censor: '[REDACTED]',
  },
});

export function createLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
