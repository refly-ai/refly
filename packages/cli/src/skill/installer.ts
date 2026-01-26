/**
 * Skill installer - copies SKILL.md and rules to Refly skill directory,
 * then creates symlink from Claude Code directory.
 *
 * Target structure:
 * ~/.refly/skills/base/
 * ├── SKILL.md
 * └── rules/
 *     ├── workflow.md
 *     ├── node.md
 *     ├── file.md
 *     └── skill.md
 *
 * Symlink:
 * ~/.claude/skills/refly → ~/.refly/skills/base/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getReflyBaseSkillDir,
  getClaudeCommandsDir,
  getClaudeSkillSymlinkPath,
  ensureDir,
  ensureReflySkillsDir,
} from '../config/paths.js';
import { updateSkillInfo } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { createSkillSymlink } from './symlink.js';

/**
 * Remove old skill directory if it exists (not a symlink)
 */
function removeOldSkillDirectory(): void {
  const claudeSkillPath = getClaudeSkillSymlinkPath('refly');

  if (!fs.existsSync(claudeSkillPath)) {
    return;
  }

  try {
    const stat = fs.lstatSync(claudeSkillPath);
    if (stat.isSymbolicLink()) {
      // Already a symlink, remove it so we can recreate
      fs.unlinkSync(claudeSkillPath);
    } else if (stat.isDirectory()) {
      // Old directory structure, remove it
      fs.rmSync(claudeSkillPath, { recursive: true, force: true });
      logger.info('Removed old skill directory');
    }
  } catch (err) {
    logger.warn('Failed to remove old directory:', err);
  }
}

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
  symlinkPath: string | null;
  commandsInstalled: boolean;
  commandsPath: string | null;
  version: string;
}

/**
 * Install skill files to Refly directory and create symlink to Claude Code
 */
export function installSkill(): InstallResult {
  const result: InstallResult = {
    skillInstalled: false,
    skillPath: null,
    symlinkPath: null,
    commandsInstalled: false,
    commandsPath: null,
    version: getSkillVersion(),
  };

  const sourceDir = getPackageSkillDir();
  logger.debug('Source skill directory:', sourceDir);

  // Install SKILL.md and rules to ~/.refly/skills/base/
  ensureReflySkillsDir();
  const targetDir = getReflyBaseSkillDir();
  logger.debug('Target skill directory:', targetDir);

  try {
    ensureDir(targetDir);
    ensureDir(path.join(targetDir, 'rules'));
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

  // Copy references to rules folder
  const refsSource = path.join(sourceDir, 'references');
  const rulesTarget = path.join(targetDir, 'rules');
  if (fs.existsSync(refsSource)) {
    const files = fs.readdirSync(refsSource);
    logger.debug(`Copying ${files.length} rule files`);
    for (const file of files) {
      fs.copyFileSync(path.join(refsSource, file), path.join(rulesTarget, file));
    }
  }

  // Remove old directory if exists, then create symlink
  removeOldSkillDirectory();
  const symlinkResult = createSkillSymlink('refly');
  if (symlinkResult.success) {
    result.symlinkPath = symlinkResult.claudePath;
    logger.info(`Created symlink: ${symlinkResult.claudePath} -> ${symlinkResult.reflyPath}`);
  } else {
    logger.warn(`Failed to create symlink: ${symlinkResult.error}`);
  }

  // Install slash commands
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
    symlinkPath: result.symlinkPath,
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
  symlinkValid?: boolean;
} {
  const skillPath = path.join(getReflyBaseSkillDir(), 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    return { installed: false, upToDate: false };
  }

  const currentVersion = getSkillVersion();

  // Check if symlink is valid
  const { isSkillSymlinkValid } = require('./symlink.js');
  const symlinkStatus = isSkillSymlinkValid('refly');

  return {
    installed: true,
    upToDate: true,
    currentVersion,
    symlinkValid: symlinkStatus.isValid,
  };
}
