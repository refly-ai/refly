/**
 * Path utilities for CLI configuration and data storage.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Get CLI version from package.json
 */
export function getCliVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

/**
 * Get the Refly configuration directory (~/.refly)
 */
export function getReflyDir(): string {
  const dir = path.join(os.homedir(), '.refly');
  ensureDir(dir);
  return dir;
}

/**
 * Get the legacy builder data directory (~/.refly/builder)
 * @deprecated Builder functionality has been removed. This is only used for cleanup.
 */
export function getLegacyBuilderDir(): string {
  return path.join(getReflyDir(), 'builder');
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
 * Get the skills directory (~/.refly/skills)
 * @deprecated Use getReflySkillDir() instead
 */
export function getSkillsDir(): string {
  return path.join(getReflyDir(), 'skills');
}

/**
 * Ensure the skills directory exists
 * @deprecated Use ensureReflySkillDir() instead
 */
export async function ensureSkillsDir(): Promise<void> {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

// ============================================================================
// New Symlink-based Skill Architecture
// ============================================================================

/**
 * Get the Refly skills storage directory (~/.refly/skills)
 * This is where actual skill files are stored.
 */
export function getReflySkillsDir(): string {
  return path.join(getReflyDir(), 'skills');
}

/**
 * Get the base skill directory (~/.refly/skills/base)
 * Contains the main SKILL.md and rules for CLI routing.
 */
export function getReflyBaseSkillDir(): string {
  return path.join(getReflySkillsDir(), 'base');
}

/**
 * Get a domain skill directory (~/.refly/skills/<name>)
 */
export function getReflyDomainSkillDir(skillName: string): string {
  return path.join(getReflySkillsDir(), skillName);
}

/**
 * Get the Claude skills directory (~/.claude/skills)
 * Symlinks are created here pointing to ~/.refly/skill/<name>
 */
export function getClaudeSkillsDir(): string {
  return path.join(os.homedir(), '.claude', 'skills');
}

/**
 * Get a Claude skill symlink path (~/.claude/skills/<name>)
 */
export function getClaudeSkillSymlinkPath(skillName: string): string {
  return path.join(getClaudeSkillsDir(), skillName);
}

/**
 * Ensure the Refly skills directory exists
 */
export function ensureReflySkillsDir(): void {
  const dir = getReflySkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Ensure the Claude skills directory exists
 */
export function ensureClaudeSkillsDir(): void {
  const dir = getClaudeSkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}
