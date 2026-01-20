/**
 * Path utilities for CLI configuration and data storage.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Get the Refly configuration directory (~/.refly)
 */
export function getReflyDir(): string {
  const dir = path.join(os.homedir(), '.refly');
  ensureDir(dir);
  return dir;
}

/**
 * Get the builder data directory (~/.refly/builder)
 */
export function getBuilderDir(): string {
  const dir = path.join(getReflyDir(), 'builder');
  ensureDir(dir);
  return dir;
}

/**
 * Get the cache directory (~/.refly/cache)
 */
export function getCacheDir(): string {
  const dir = path.join(getReflyDir(), 'cache');
  ensureDir(dir);
  return dir;
}

/**
 * Get the Claude skills directory (~/.claude/skills/refly)
 */
export function getClaudeSkillDir(): string {
  return path.join(os.homedir(), '.claude', 'skills', 'refly');
}

/**
 * Get the Claude commands directory (~/.claude/commands)
 */
export function getClaudeCommandsDir(): string {
  return path.join(os.homedir(), '.claude', 'commands');
}

/**
 * Check if Claude directories exist
 */
export function claudeDirectoriesExist(): { skills: boolean; commands: boolean } {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  const commandsDir = getClaudeCommandsDir();

  return {
    skills: fs.existsSync(skillsDir),
    commands: fs.existsSync(commandsDir),
  };
}

/**
 * Ensure a directory exists with proper permissions
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
  return path.join(getReflyDir(), 'config.json');
}

/**
 * Get the current builder session path
 */
export function getCurrentSessionPath(): string {
  return path.join(getBuilderDir(), 'current');
}

/**
 * Get a session file path by ID
 */
export function getSessionPath(sessionId: string): string {
  return path.join(getBuilderDir(), `session-${sessionId}.json`);
}
