/**
 * Logger utility that NEVER outputs tokens or sensitive data.
 * Used for internal debugging only - not for user output.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getReflyDir } from '../config/paths.js';

const LOG_FILE = 'cli.log';
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Sensitive patterns to redact
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
  /[A-Za-z0-9]{32,}/g, // API keys
  /"(access_?token|refresh_?token|api_?key|secret|password)":\s*"[^"]+"/gi,
];

function redact(message: string): string {
  let result = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

class Logger {
  private level: LogLevel = 'info';
  private logToFile = false;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  enableFileLogging(): void {
    this.logToFile = true;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const safeMessage = redact(message);
    return `[${timestamp}] [${level.toUpperCase()}] ${safeMessage}`;
  }

  private writeToFile(formatted: string): void {
    if (!this.logToFile) return;

    try {
      const logPath = path.join(getReflyDir(), LOG_FILE);

      // Rotate if too large
      try {
        const stats = fs.statSync(logPath);
        if (stats.size > MAX_LOG_SIZE) {
          fs.renameSync(logPath, `${logPath}.old`);
        }
      } catch {
        // File doesn't exist yet
      }

      fs.appendFileSync(logPath, `${formatted}\n`);
    } catch {
      // Silently fail - logging should never break the CLI
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatMessage('debug', this.interpolate(message, args));
    this.writeToFile(formatted);
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatMessage('info', this.interpolate(message, args));
    this.writeToFile(formatted);
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatMessage('warn', this.interpolate(message, args));
    this.writeToFile(formatted);
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('error')) return;
    const formatted = this.formatMessage('error', this.interpolate(message, args));
    this.writeToFile(formatted);
  }

  private interpolate(message: string, args: unknown[]): string {
    if (args.length === 0) return message;
    return `${message} ${args.map((a) => JSON.stringify(a)).join(' ')}`;
  }
}

export const logger = new Logger();
