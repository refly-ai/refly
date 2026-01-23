/**
 * Skill installer - copies SKILL.md and references to Claude Code directories.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getClaudeSkillDir, getClaudeCommandsDir, ensureDir } from '../config/paths.js';
import { updateSkillInfo } from '../config/config.js';
import { logger } from '../utils/logger.js';

// Get the skill files from the package
function getPackageSkillDir(): string {
  // When installed globally, skill files are in the package's skill directory
  // During development, they're relative to the source
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'skill'), // Built package: dist/bin/../../skill
    path.join(__dirname, '..', '..', '..', 'skill'), // Development: dist/bin/../../../skill
    path.join(__dirname, '..', 'skill'), // Alternative: dist/../skill
  ];

  logger.debug('Looking for skill files, __dirname:', __dirname);

  for (const p of possiblePaths) {
    const resolved = path.resolve(p);
    const exists = fs.existsSync(resolved);
    logger.debug(`  Checking path: ${resolved} - exists: ${exists}`);
    if (exists) {
      return resolved;
    }
  }

  throw new Error(`Skill files not found in package. Searched paths from __dirname=${__dirname}`);
}

export interface InstallResult {
  skillInstalled: boolean;
  skillPath: string | null;
  commandsInstalled: boolean;
  commandsPath: string | null;
  version: string;
}

/**
 * Install skill files to Claude Code directories
 */
export function installSkill(): InstallResult {
  const result: InstallResult = {
    skillInstalled: false,
    skillPath: null,
    commandsInstalled: false,
    commandsPath: null,
    version: getSkillVersion(),
  };

  const sourceDir = getPackageSkillDir();
  logger.debug('Source skill directory:', sourceDir);

  // Install SKILL.md and references
  // Always try to create skills directory
  const targetDir = getClaudeSkillDir();
  logger.debug('Target skill directory:', targetDir);

  try {
    ensureDir(targetDir);
    ensureDir(path.join(targetDir, 'references'));
    logger.debug('Created target directories');
  } catch (err) {
    logger.error('Failed to create target directories:', err);
    throw err;
  }

  // Copy SKILL.md
  const skillSource = path.join(sourceDir, 'SKILL.md');
  const skillTarget = path.join(targetDir, 'SKILL.md');
  logger.debug(`Copying SKILL.md: ${skillSource} -> ${skillTarget}`);
  if (fs.existsSync(skillSource)) {
    fs.copyFileSync(skillSource, skillTarget);
    result.skillInstalled = true;
    result.skillPath = targetDir;
    logger.debug('SKILL.md copied successfully');
  } else {
    logger.warn('SKILL.md source not found:', skillSource);
  }

  // Copy references
  const refsSource = path.join(sourceDir, 'references');
  const refsTarget = path.join(targetDir, 'references');
  if (fs.existsSync(refsSource)) {
    const files = fs.readdirSync(refsSource);
    logger.debug(`Copying ${files.length} reference files`);
    for (const file of files) {
      fs.copyFileSync(path.join(refsSource, file), path.join(refsTarget, file));
    }
  }

  // Install slash commands
  // Always try to create commands directory (same as skills directory)
  const commandsDir = getClaudeCommandsDir();
  logger.debug('Commands directory:', commandsDir);
  ensureDir(commandsDir);
  result.commandsInstalled = installSlashCommands(sourceDir, commandsDir);
  if (result.commandsInstalled) {
    result.commandsPath = commandsDir;
  }
  logger.debug('Commands installed:', result.commandsInstalled);

  // Update config with installation info
  updateSkillInfo(result.version);

  logger.info('Skill installation complete:', {
    skillInstalled: result.skillInstalled,
    commandsInstalled: result.commandsInstalled,
  });

  return result;
}

/**
 * Install slash command files
 */
function installSlashCommands(sourceDir: string, targetDir: string): boolean {
  const commandsSource = path.join(sourceDir, '..', 'commands');
  if (!fs.existsSync(commandsSource)) {
    return false;
  }

  try {
    const files = fs.readdirSync(commandsSource);
    for (const file of files) {
      if (file.endsWith('.md')) {
        fs.copyFileSync(path.join(commandsSource, file), path.join(targetDir, file));
      }
    }
    return files.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get skill version from SKILL.md
 */
function getSkillVersion(): string {
  try {
    const skillPath = path.join(getPackageSkillDir(), 'SKILL.md');
    const content = fs.readFileSync(skillPath, 'utf-8');
    // Extract version from frontmatter if present, otherwise use package version
    const versionMatch = content.match(/version:\s*(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return versionMatch[1];
    }
  } catch {
    // Fall through to package version
  }

  // Use CLI package version
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.1.0';
  }
}

/**
 * Check if skill is installed and up to date
 */
export function isSkillInstalled(): {
  installed: boolean;
  upToDate: boolean;
  currentVersion?: string;
} {
  const skillPath = path.join(getClaudeSkillDir(), 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    return { installed: false, upToDate: false };
  }

  const currentVersion = getSkillVersion();
  // For now, consider it up to date if it exists
  // Future: parse version from installed SKILL.md and compare

  return {
    installed: true,
    upToDate: true,
    currentVersion,
  };
}
