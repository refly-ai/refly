/**
 * Skill storage module - file system operations for skill files.
 *
 * Directory structure:
 * ~/.claude/skills/refly/
 * ├── SKILL.md
 * ├── registry.json
 * ├── references/
 * └── domain-skills/
 *     └── <skill-name>/
 *         └── skill.md
 *
 * Implements:
 * - getSkillDir(name) - Get skill directory path
 * - skillExists(name) - Check if skill directory exists
 * - createSkillDir(name) - Create skill directory
 * - deleteSkillDir(name) - Remove skill directory
 * - writeSkillFile(name, content) - Write skill.md
 * - readSkillFile(name) - Read skill.md content
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getClaudeSkillDir, ensureDir } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import { SkillErrorCode, createSkillError, isValidSkillName } from './types.js';

/**
 * Get the domain-skills directory path.
 */
export function getDomainSkillsDir(): string {
  return path.join(getClaudeSkillDir(), 'domain-skills');
}

/**
 * Get the skill directory path for a given skill name.
 * Returns: ~/.claude/skills/refly/domain-skills/<skill-name>
 */
export function getSkillDir(name: string): string {
  if (!isValidSkillName(name)) {
    throw createSkillError(SkillErrorCode.INVALID_NAME, `Invalid skill name: ${name}`, {
      suggestions: [
        'Skill name must match pattern ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
        'Use lowercase letters, numbers, and hyphens only',
        'Name must be 1-64 characters',
      ],
    });
  }
  return path.join(getDomainSkillsDir(), name);
}

/**
 * Get the skill.md file path for a given skill name.
 * Returns: ~/.claude/skills/refly/domain-skills/<skill-name>/skill.md
 */
export function getSkillFilePath(name: string): string {
  return path.join(getSkillDir(name), 'skill.md');
}

/**
 * Get the relative path for a skill (used in registry).
 * Returns: domain-skills/<skill-name>
 */
export function getSkillRelativePath(name: string): string {
  return `domain-skills/${name}`;
}

/**
 * Check if a skill directory exists.
 */
export function skillExists(name: string): boolean {
  try {
    const skillDir = getSkillDir(name);
    return fs.existsSync(skillDir);
  } catch {
    return false;
  }
}

/**
 * Check if a skill.md file exists.
 */
export function skillFileExists(name: string): boolean {
  try {
    const skillFile = getSkillFilePath(name);
    return fs.existsSync(skillFile);
  } catch {
    return false;
  }
}

/**
 * Create a skill directory.
 * Ensures domain-skills parent directory exists.
 */
export function createSkillDir(name: string): string {
  const skillDir = getSkillDir(name);
  const domainSkillsDir = getDomainSkillsDir();

  // Ensure parent directories exist
  ensureDir(domainSkillsDir);

  // Check if directory already exists
  if (fs.existsSync(skillDir)) {
    throw createSkillError(SkillErrorCode.SKILL_EXISTS, `Skill directory already exists: ${name}`, {
      suggestions: ['Choose a different name or delete the existing skill first'],
    });
  }

  // Create skill directory
  fs.mkdirSync(skillDir, { recursive: true, mode: 0o755 });
  logger.debug(`Created skill directory: ${skillDir}`);

  return skillDir;
}

/**
 * Delete a skill directory and all its contents.
 * Returns true if deleted, false if not found.
 */
export function deleteSkillDir(name: string): boolean {
  const skillDir = getSkillDir(name);

  if (!fs.existsSync(skillDir)) {
    logger.debug(`Skill directory not found: ${skillDir}`);
    return false;
  }

  // Remove directory recursively
  fs.rmSync(skillDir, { recursive: true, force: true });
  logger.info(`Deleted skill directory: ${skillDir}`);

  return true;
}

/**
 * Write skill.md content to a skill directory.
 * Creates the skill directory if it doesn't exist.
 */
export function writeSkillFile(name: string, content: string): string {
  const skillDir = getSkillDir(name);
  const skillFile = getSkillFilePath(name);

  // Ensure skill directory exists
  if (!fs.existsSync(skillDir)) {
    createSkillDir(name);
  }

  // Write skill.md file
  fs.writeFileSync(skillFile, content, { encoding: 'utf-8', mode: 0o644 });
  logger.debug(`Wrote skill file: ${skillFile}`);

  return skillFile;
}

/**
 * Read skill.md content from a skill directory.
 * Throws if file doesn't exist.
 */
export function readSkillFile(name: string): string {
  const skillFile = getSkillFilePath(name);

  if (!fs.existsSync(skillFile)) {
    throw createSkillError(SkillErrorCode.SKILL_DIR_NOT_FOUND, `Skill file not found: ${name}`, {
      details: { path: skillFile },
      suggestions: [
        'Check if the skill exists with `refly skill list`',
        'Create a new skill with `refly skill create`',
      ],
    });
  }

  return fs.readFileSync(skillFile, 'utf-8');
}

/**
 * List all skill directories in domain-skills.
 * Returns array of skill names.
 */
export function listSkillDirectories(): string[] {
  const domainSkillsDir = getDomainSkillsDir();

  if (!fs.existsSync(domainSkillsDir)) {
    return [];
  }

  const entries = fs.readdirSync(domainSkillsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => isValidSkillName(name));
}

/**
 * Find orphan skills (directories without registry entry).
 */
export function findOrphanSkillDirs(registeredNames: Set<string>): string[] {
  const allDirs = listSkillDirectories();
  return allDirs.filter((name) => !registeredNames.has(name));
}

/**
 * Initialize the domain-skills directory.
 * Used during `refly init`.
 */
export function initializeDomainSkillsDir(): boolean {
  const domainSkillsDir = getDomainSkillsDir();

  if (fs.existsSync(domainSkillsDir)) {
    logger.debug('Domain skills directory already exists');
    return false;
  }

  ensureDir(domainSkillsDir);
  logger.info('Initialized domain-skills directory');
  return true;
}

/**
 * Generate skill.md template content.
 */
export function generateSkillTemplate(options: {
  name: string;
  description: string;
  workflowId: string;
  triggers: string[];
  tags?: string[];
  author?: string;
  version?: string;
}): string {
  const { name, description, workflowId, triggers, tags, author, version } = options;

  // Build frontmatter
  const frontmatterLines = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    `workflowId: ${workflowId}`,
    'triggers:',
    ...triggers.map((t) => `  - ${t}`),
  ];

  if (tags && tags.length > 0) {
    frontmatterLines.push('tags:');
    frontmatterLines.push(...tags.map((t) => `  - ${t}`));
  }

  if (author) {
    frontmatterLines.push(`author: ${author}`);
  }

  if (version) {
    frontmatterLines.push(`version: ${version}`);
  }

  frontmatterLines.push('---');

  // Build content
  const titleName = name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const content = `
# ${titleName}

## Overview

${description}

## Quick Start

\`\`\`bash
refly skill run ${name} --input '{}'
\`\`\`

## Workflow

This skill executes workflow \`${workflowId}\`.

## Input

Provide input as JSON:

\`\`\`json
{
  // Add your input parameters here
}
\`\`\`

## Output

The skill returns the workflow execution result.
`;

  return frontmatterLines.join('\n') + content;
}

/**
 * Sync a cloud skill to local domain skill.
 * Creates skill.md file and adds entry to registry.
 *
 * @param options - Cloud skill details
 * @returns Object with created file path and registry entry
 */
export function syncCloudSkillToLocal(options: {
  name: string;
  description: string;
  workflowId: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
  skillId: string;
}): { filePath: string; registryEntry: import('./types.js').SkillEntry } {
  const { name, description, workflowId, triggers = [], tags, version, skillId } = options;

  // Ensure we have at least one trigger
  const finalTriggers = triggers.length > 0 ? triggers : [name];

  // Generate skill.md content
  const content = generateSkillTemplate({
    name,
    description: description || `Skill: ${name}`,
    workflowId,
    triggers: finalTriggers,
    tags,
    version,
  });

  // Write skill.md file (creates directory if needed)
  const filePath = writeSkillFile(name, content);

  // Create registry entry
  const registryEntry: import('./types.js').SkillEntry = {
    name,
    description: description || `Skill: ${name}`,
    workflowId,
    triggers: finalTriggers,
    path: getSkillRelativePath(name),
    createdAt: new Date().toISOString(),
    source: 'refly-cloud',
    tags,
    version,
    skillId,
  };

  logger.info(`Synced cloud skill '${name}' to local: ${filePath}`);

  return { filePath, registryEntry };
}
