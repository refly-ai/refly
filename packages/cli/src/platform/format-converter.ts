/**
 * Format converter - converts SKILL.md to different formats for agents that
 * don't use the standard SKILL.md format.
 *
 * Supported conversions:
 * - Cursor: SKILL.md -> .mdc format (with globs, alwaysApply)
 * - Continue: SKILL.md -> rules .md format
 * - Trae: SKILL.md -> rules .md format
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentConfig } from './registry.js';
import type { PlatformAdapter, DeployResult, RemoveResult, DeployedSkillInfo } from './adapter.js';
import { logger } from '../utils/logger.js';
import { ensureDir } from '../config/paths.js';

/**
 * Parsed skill data for conversion (lenient - doesn't require skillId/workflowId)
 */
interface ParsedSkillLenient {
  name: string;
  displayName?: string;
  description: string;
  skillId?: string;
  workflowId?: string;
  installationId?: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
  body: string;
}

/**
 * Convert SKILL.md to Cursor .mdc format
 *
 * Cursor rules format:
 * ---
 * description: "..."
 * globs:
 * alwaysApply: false
 * ---
 * Content...
 */
function convertToMdc(skill: ParsedSkillLenient): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`description: "${skill.description.replace(/"/g, '\\"')}"`);
  lines.push('globs:'); // Empty globs - apply to all files
  lines.push('alwaysApply: false');
  lines.push('---');
  lines.push('');
  lines.push(`# ${skill.displayName || formatSkillName(skill.name)}`);
  lines.push('');
  lines.push(skill.description);
  lines.push('');
  lines.push(skill.body);

  // Only add Refly section if we have skill metadata
  if (skill.skillId || skill.workflowId) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Refly Skill');
    lines.push('');
    if (skill.skillId) {
      lines.push(`- **Skill ID**: ${skill.skillId}`);
    }
    if (skill.workflowId) {
      lines.push(`- **Workflow ID**: ${skill.workflowId}`);
    }
    if (skill.installationId) {
      lines.push(`- **Installation ID**: ${skill.installationId}`);
    }
    const runId = skill.installationId || skill.workflowId || skill.name;
    lines.push(`- **Run**: \`refly skill run ${runId}\``);
  }

  return lines.join('\n');
}

/**
 * Convert SKILL.md to Continue/Trae rules format
 *
 * Rules are simple markdown files with skill content
 */
function convertToRules(skill: ParsedSkillLenient): string {
  const lines: string[] = [];

  lines.push(`# ${skill.displayName || formatSkillName(skill.name)}`);
  lines.push('');
  lines.push(`> ${skill.description}`);
  lines.push('');

  if (skill.triggers && skill.triggers.length > 0) {
    lines.push('## Triggers');
    lines.push('');
    for (const trigger of skill.triggers) {
      lines.push(`- ${trigger}`);
    }
    lines.push('');
  }

  lines.push(skill.body);

  // Only add Refly section if we have skill metadata
  if (skill.skillId || skill.workflowId) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Refly Skill');
    lines.push('');
    if (skill.skillId) {
      lines.push(`- **Skill ID**: ${skill.skillId}`);
    }
    if (skill.workflowId) {
      lines.push(`- **Workflow ID**: ${skill.workflowId}`);
    }
    if (skill.installationId) {
      lines.push(`- **Installation ID**: ${skill.installationId}`);
    }
    const runId = skill.installationId || skill.workflowId || skill.name;
    lines.push(`- **Run**: \`refly skill run ${runId}\``);
  }

  return lines.join('\n');
}

/**
 * Format skill name to display name
 * e.g., "my-skill" -> "My Skill"
 */
function formatSkillName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Parse SKILL.md content leniently (doesn't require skillId/workflowId)
 */
function parseSkillMdLenient(content: string): ParsedSkillLenient | null {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const [, frontmatterStr, body] = match;
  const meta: Record<string, unknown> = {};

  // Parse YAML-like frontmatter
  const lines = frontmatterStr.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for array item (starts with "- ")
    if (trimmed.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(trimmed.slice(2).trim());
      }
      continue;
    }

    // If we were collecting an array, save it
    if (currentKey && currentArray.length > 0) {
      meta[currentKey] = currentArray;
      currentArray = [];
      currentKey = null;
    }

    // Parse key: value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value === '') {
        // This is an array key
        currentKey = key;
        currentArray = [];
      } else {
        meta[key] = value;
      }
    }
  }

  // Save any remaining array
  if (currentKey && currentArray.length > 0) {
    meta[currentKey] = currentArray;
  }

  // Only require name and description
  if (!meta.name || !meta.description) {
    return null;
  }

  return {
    name: meta.name as string,
    displayName: meta.displayName as string | undefined,
    description: meta.description as string,
    skillId: meta.skillId as string | undefined,
    workflowId: meta.workflowId as string | undefined,
    installationId: meta.installationId as string | undefined,
    triggers: meta.triggers as string[] | undefined,
    tags: meta.tags as string[] | undefined,
    version: meta.version as string | undefined,
    body: body.trim(),
  };
}

/**
 * Read and parse SKILL.md from source directory (lenient parsing)
 */
function readSkillMd(sourcePath: string): ParsedSkillLenient | null {
  const skillMdPath = path.join(sourcePath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    return parseSkillMdLenient(content);
  } catch {
    return null;
  }
}

/**
 * Format converter adapter for agents using different formats
 */
export class FormatConverterAdapter implements PlatformAdapter {
  async deploy(
    skillName: string,
    sourcePath: string,
    agent: AgentConfig,
    options?: { force?: boolean; projectPath?: string },
  ): Promise<DeployResult> {
    const result: DeployResult = {
      success: false,
      agent: agent.name,
      skillName,
      deployedPath: null,
      sourcePath,
      isSymlink: false, // We generate files, not symlinks
    };

    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    // If no target directory (e.g., Cursor has no global rules), skip gracefully
    if (!targetDir) {
      result.success = true; // Not an error, just not applicable
      logger.debug(`Skipping ${skillName} for ${agent.displayName}: no global skills directory`);
      return result;
    }

    // Read source SKILL.md
    const skill = readSkillMd(sourcePath);
    if (!skill) {
      result.error = `Failed to read SKILL.md from ${sourcePath}`;
      return result;
    }

    // Determine file path
    const extension = agent.fileExtension || '.md';
    const filePath = path.join(targetDir, `${skillName}${extension}`);
    result.deployedPath = filePath;

    // Check if already exists
    if (fs.existsSync(filePath) && !options?.force) {
      result.error = `Skill already exists at ${filePath}. Use --force to overwrite.`;
      return result;
    }

    // Convert to appropriate format
    let content: string;
    switch (agent.format) {
      case 'cursor-mdc':
        content = convertToMdc(skill);
        break;
      case 'rules-md':
        content = convertToRules(skill);
        break;
      default:
        result.error = `Unsupported format: ${agent.format}`;
        return result;
    }

    // Write the converted file
    try {
      ensureDir(targetDir);
      fs.writeFileSync(filePath, content, { encoding: 'utf-8', mode: 0o644 });
      result.success = true;
      logger.info(`Deployed ${skillName} to ${agent.displayName}: ${filePath}`);
    } catch (err) {
      result.error = (err as Error).message;
    }

    return result;
  }

  async remove(
    skillName: string,
    agent: AgentConfig,
    options?: { projectPath?: string },
  ): Promise<RemoveResult> {
    const result: RemoveResult = {
      success: false,
      agent: agent.name,
      skillName,
      removedPath: null,
    };

    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    // If no target directory (e.g., Cursor has no global rules), skip gracefully
    if (!targetDir) {
      result.success = true; // Not an error, just not applicable
      logger.debug(
        `Skipping ${skillName} removal for ${agent.displayName}: no global skills directory`,
      );
      return result;
    }

    const extension = agent.fileExtension || '.md';
    const filePath = path.join(targetDir, `${skillName}${extension}`);
    result.removedPath = filePath;

    try {
      if (!fs.existsSync(filePath)) {
        // Not an error - file just doesn't exist
        result.success = true;
        return result;
      }

      fs.unlinkSync(filePath);
      result.success = true;
      logger.info(`Removed ${skillName} from ${agent.displayName}: ${filePath}`);
    } catch (err) {
      result.error = (err as Error).message;
    }

    return result;
  }

  async list(agent: AgentConfig, options?: { projectPath?: string }): Promise<DeployedSkillInfo[]> {
    const results: DeployedSkillInfo[] = [];

    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    if (!targetDir || !fs.existsSync(targetDir)) {
      return results;
    }

    const extension = agent.fileExtension || '.md';

    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(extension)) {
          const fullPath = path.join(targetDir, entry.name);
          const skillName = entry.name.slice(0, -extension.length);

          // Check if file contains Refly skill marker
          let isReflySkill = false;
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            isReflySkill = content.includes('## Refly Skill') || content.includes('Skill ID:');
          } catch {
            // Ignore read errors
          }

          results.push({
            name: skillName,
            agent: agent.name,
            path: fullPath,
            isValid: isReflySkill,
            isSymlink: false,
          });
        }
      }
    } catch {
      // Return empty results if directory can't be read
    }

    return results;
  }

  async isDeployed(
    skillName: string,
    agent: AgentConfig,
    options?: { projectPath?: string },
  ): Promise<{ deployed: boolean; valid: boolean; path?: string }> {
    // Determine target directory
    let targetDir: string | null = null;
    if (options?.projectPath && agent.skillsDir) {
      targetDir = path.join(options.projectPath, agent.skillsDir);
    } else {
      targetDir = agent.globalSkillsDir;
    }

    if (!targetDir) {
      return { deployed: false, valid: false };
    }

    const extension = agent.fileExtension || '.md';
    const filePath = path.join(targetDir, `${skillName}${extension}`);

    if (!fs.existsSync(filePath)) {
      return { deployed: false, valid: false };
    }

    // Check if file contains Refly skill marker
    let isValid = false;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      isValid = content.includes('## Refly Skill') || content.includes('Skill ID:');
    } catch {
      // Treat read errors as invalid
    }

    return {
      deployed: true,
      valid: isValid,
      path: filePath,
    };
  }
}

/**
 * Singleton instance
 */
export const formatConverterAdapter = new FormatConverterAdapter();

/**
 * Export conversion functions for testing
 */
export { convertToMdc, convertToRules };
