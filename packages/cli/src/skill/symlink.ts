/**
 * Skill symlink management - creates and manages symlinks between
 * ~/.refly/skills/<name> and ~/.claude/skills/<name>
 *
 * Architecture:
 * - Actual skill files stored in: ~/.refly/skills/<name>/SKILL.md
 * - Symlinks created at: ~/.claude/skills/<name> -> ~/.refly/skills/<name>
 * - Base skill: ~/.claude/skills/refly -> ~/.refly/skills/base
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getReflyBaseSkillDir,
  getReflyDomainSkillDir,
  getClaudeSkillsDir,
  getClaudeSkillSymlinkPath,
  ensureReflySkillsDir,
  ensureClaudeSkillsDir,
  ensureDir,
} from '../config/paths.js';
import { logger } from '../utils/logger.js';

export interface SkillSymlinkResult {
  success: boolean;
  skillName: string;
  reflyPath: string;
  claudePath: string;
  error?: string;
}

/**
 * Create a symlink for a skill from Claude skills dir to Refly skill dir
 * ~/.claude/skills/<name> -> ~/.refly/skill/<name>
 */
export function createSkillSymlink(skillName: string): SkillSymlinkResult {
  const reflyPath =
    skillName === 'refly' ? getReflyBaseSkillDir() : getReflyDomainSkillDir(skillName);
  const claudePath = getClaudeSkillSymlinkPath(skillName);

  try {
    // Ensure directories exist
    ensureReflySkillsDir();
    ensureClaudeSkillsDir();

    // Check if source directory exists
    if (!fs.existsSync(reflyPath)) {
      return {
        success: false,
        skillName,
        reflyPath,
        claudePath,
        error: `Source skill directory does not exist: ${reflyPath}`,
      };
    }

    // Remove existing symlink or directory if present
    if (fs.existsSync(claudePath) || fs.lstatSync(claudePath).isSymbolicLink()) {
      const stat = fs.lstatSync(claudePath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(claudePath);
        logger.debug(`Removed existing symlink: ${claudePath}`);
      } else if (stat.isDirectory()) {
        // If it's a real directory (not a symlink), warn and skip
        logger.warn(`Cannot create symlink: ${claudePath} is a directory, not a symlink`);
        return {
          success: false,
          skillName,
          reflyPath,
          claudePath,
          error: `Target path is a directory, not a symlink: ${claudePath}`,
        };
      }
    }

    // Create symlink
    fs.symlinkSync(reflyPath, claudePath, 'dir');
    logger.info(`Created symlink: ${claudePath} -> ${reflyPath}`);

    return {
      success: true,
      skillName,
      reflyPath,
      claudePath,
    };
  } catch (err) {
    // Handle ENOENT for lstat on non-existent path
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        fs.symlinkSync(reflyPath, claudePath, 'dir');
        logger.info(`Created symlink: ${claudePath} -> ${reflyPath}`);
        return {
          success: true,
          skillName,
          reflyPath,
          claudePath,
        };
      } catch (innerErr) {
        return {
          success: false,
          skillName,
          reflyPath,
          claudePath,
          error: (innerErr as Error).message,
        };
      }
    }

    return {
      success: false,
      skillName,
      reflyPath,
      claudePath,
      error: (err as Error).message,
    };
  }
}

/**
 * Remove a skill symlink from Claude skills directory
 */
export function removeSkillSymlink(skillName: string): boolean {
  const claudePath = getClaudeSkillSymlinkPath(skillName);

  try {
    if (!fs.existsSync(claudePath)) {
      logger.debug(`Symlink not found: ${claudePath}`);
      return false;
    }

    const stat = fs.lstatSync(claudePath);
    if (!stat.isSymbolicLink()) {
      logger.warn(`Not a symlink: ${claudePath}`);
      return false;
    }

    fs.unlinkSync(claudePath);
    logger.info(`Removed symlink: ${claudePath}`);
    return true;
  } catch (err) {
    logger.error(`Failed to remove symlink ${claudePath}:`, err);
    return false;
  }
}

/**
 * Check if a skill symlink exists and is valid
 */
export function isSkillSymlinkValid(skillName: string): {
  exists: boolean;
  isSymlink: boolean;
  isValid: boolean;
  target?: string;
} {
  const claudePath = getClaudeSkillSymlinkPath(skillName);
  const expectedTarget =
    skillName === 'refly' ? getReflyBaseSkillDir() : getReflyDomainSkillDir(skillName);

  try {
    if (!fs.existsSync(claudePath)) {
      return { exists: false, isSymlink: false, isValid: false };
    }

    const stat = fs.lstatSync(claudePath);
    if (!stat.isSymbolicLink()) {
      return { exists: true, isSymlink: false, isValid: false };
    }

    const target = fs.readlinkSync(claudePath);
    const resolvedTarget = path.resolve(path.dirname(claudePath), target);
    const isValid = resolvedTarget === expectedTarget && fs.existsSync(resolvedTarget);

    return {
      exists: true,
      isSymlink: true,
      isValid,
      target: resolvedTarget,
    };
  } catch {
    return { exists: false, isSymlink: false, isValid: false };
  }
}

/**
 * Create or ensure the base skill directory and symlink
 */
export function initializeBaseSkillSymlink(): SkillSymlinkResult {
  const baseDir = getReflyBaseSkillDir();

  // Ensure base skill directory exists
  ensureDir(baseDir);
  ensureDir(path.join(baseDir, 'rules'));

  // Create symlink
  return createSkillSymlink('refly');
}

/**
 * Create a Refly skill directory with SKILL.md and symlink
 */
export function createReflySkillWithSymlink(
  skillName: string,
  skillMdContent: string,
  options?: { force?: boolean },
): SkillSymlinkResult {
  const skillDir = getReflyDomainSkillDir(skillName);

  try {
    // Ensure skill directory exists
    ensureReflySkillsDir();

    if (fs.existsSync(skillDir)) {
      if (options?.force) {
        // Force mode: update existing SKILL.md
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        fs.writeFileSync(skillMdPath, skillMdContent, { encoding: 'utf-8', mode: 0o644 });
        logger.debug(`Updated SKILL.md (force): ${skillMdPath}`);
        // Ensure symlink exists
        return createSkillSymlink(skillName);
      }
      return {
        success: false,
        skillName,
        reflyPath: skillDir,
        claudePath: getClaudeSkillSymlinkPath(skillName),
        error: `Skill directory already exists: ${skillDir}`,
      };
    }

    // Create skill directory
    fs.mkdirSync(skillDir, { recursive: true, mode: 0o755 });

    // Write SKILL.md
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillMdPath, skillMdContent, { encoding: 'utf-8', mode: 0o644 });
    logger.debug(`Created SKILL.md: ${skillMdPath}`);

    // Create symlink
    return createSkillSymlink(skillName);
  } catch (err) {
    return {
      success: false,
      skillName,
      reflyPath: skillDir,
      claudePath: getClaudeSkillSymlinkPath(skillName),
      error: (err as Error).message,
    };
  }
}

/**
 * Delete a domain skill directory and its symlink
 */
export function deleteDomainSkillWithSymlink(skillName: string): {
  symlinkRemoved: boolean;
  directoryRemoved: boolean;
} {
  // Remove symlink first
  const symlinkRemoved = removeSkillSymlink(skillName);

  // Remove skill directory
  const skillDir = getReflyDomainSkillDir(skillName);
  let directoryRemoved = false;

  try {
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
      directoryRemoved = true;
      logger.info(`Removed skill directory: ${skillDir}`);
    }
  } catch (err) {
    logger.error(`Failed to remove skill directory ${skillDir}:`, err);
  }

  return { symlinkRemoved, directoryRemoved };
}

/**
 * List all skill symlinks in Claude skills directory
 */
export function listSkillSymlinks(): Array<{
  name: string;
  claudePath: string;
  target: string;
  isValid: boolean;
}> {
  const claudeSkillsDir = getClaudeSkillsDir();
  const results: Array<{
    name: string;
    claudePath: string;
    target: string;
    isValid: boolean;
  }> = [];

  if (!fs.existsSync(claudeSkillsDir)) {
    return results;
  }

  try {
    const entries = fs.readdirSync(claudeSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(claudeSkillsDir, entry.name);

      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
          const target = fs.readlinkSync(fullPath);
          const resolvedTarget = path.resolve(path.dirname(fullPath), target);
          const isValid = fs.existsSync(resolvedTarget);

          results.push({
            name: entry.name,
            claudePath: fullPath,
            target: resolvedTarget,
            isValid,
          });
        }
      } catch {
        // Skip entries that can't be read
      }
    }
  } catch {
    // Return empty results if directory can't be read
  }

  return results;
}

/**
 * Escape a string for safe use as a YAML value.
 * Quotes the string if it contains special characters.
 */
function escapeYamlValue(value: string): string {
  // If the value contains special YAML characters, wrap in quotes and escape inner quotes
  if (
    value.includes(':') ||
    value.includes('#') ||
    value.includes("'") ||
    value.includes('"') ||
    value.includes('\n') ||
    value.startsWith(' ') ||
    value.endsWith(' ') ||
    value.startsWith('[') ||
    value.startsWith('{')
  ) {
    // Use double quotes and escape any double quotes inside
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Generate SKILL.md content for a Refly skill
 */
export function generateReflySkillMd(options: {
  name: string;
  displayName?: string;
  description: string;
  skillId: string;
  workflowId: string;
  installationId?: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}): string {
  const {
    name,
    displayName,
    description,
    skillId,
    workflowId,
    installationId,
    triggers = [],
    tags = [],
    version = '1.0.0',
    inputSchema,
    outputSchema,
  } = options;

  // Build frontmatter - Claude Code compatible format
  // description is the primary trigger mechanism for Claude Code skill discovery
  const frontmatterLines = ['---', `name: ${escapeYamlValue(name)}`];
  frontmatterLines.push(`description: ${escapeYamlValue(description)}`);

  // Standard Claude Code optional fields
  if (tags.length > 0) {
    frontmatterLines.push('tags:');
    frontmatterLines.push(...tags.map((t) => `  - ${escapeYamlValue(t)}`));
  }

  frontmatterLines.push(`version: ${escapeYamlValue(version)}`);

  // Refly-specific metadata (kept for Refly CLI compatibility)
  frontmatterLines.push(`skillId: ${escapeYamlValue(skillId)}`);
  frontmatterLines.push(`workflowId: ${escapeYamlValue(workflowId)}`);

  if (installationId) {
    frontmatterLines.push(`installationId: ${escapeYamlValue(installationId)}`);
  }

  if (triggers.length > 0) {
    frontmatterLines.push('triggers:');
    frontmatterLines.push(...triggers.map((t) => `  - ${escapeYamlValue(t)}`));
  }

  frontmatterLines.push('---');

  // Build content
  const title =
    displayName ||
    name
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  // Format input example
  const inputExample = inputSchema
    ? JSON.stringify(inputSchema, null, 2)
    : `{
  "query": "your input here"
}`;

  const runCommand = installationId
    ? `refly skill run ${installationId} --input '${inputSchema ? JSON.stringify(inputSchema) : '{}'}'`
    : `refly workflow run ${workflowId} --input '${inputSchema ? JSON.stringify(inputSchema) : '{}'}'`;

  // Format output section
  const outputSection = outputSchema
    ? `The skill returns:

\`\`\`json
${JSON.stringify(outputSchema, null, 2)}
\`\`\``
    : 'The skill returns the workflow execution result.';

  const content = `

# ${title}

${description}

## Input

Provide input as JSON:

\`\`\`json
${inputExample}
\`\`\`

## Execution

**Follow this exact 4-step pattern:**

\`\`\`bash
# Step 1: Run and capture RUN_ID (we-xxx format)
RESULT=$(${runCommand})
RUN_ID=$(echo "$RESULT" | jq -r '.payload.workflowExecutions[0].id')
# RUN_ID is we-xxx format, use this for workflow commands below

# Step 2: Wait for completion (use RUN_ID, not installationId)
refly workflow status "$RUN_ID" --watch --interval 30000

# Step 3: Get files from this run (use RUN_ID)
FILES=$(refly workflow toolcalls "$RUN_ID" --files --latest | jq -r '.payload.files[]')

# Step 4: Download and open each file
echo "$FILES" | jq -c '.' | while read -r file; do
  FILE_ID=$(echo "$file" | jq -r '.fileId')
  FILE_NAME=$(echo "$file" | jq -r '.name')
  if [ -n "$FILE_ID" ] && [ "$FILE_ID" != "null" ]; then
    OUTPUT_PATH="$HOME/Desktop/$FILE_NAME"
    refly file download "$FILE_ID" -o "$OUTPUT_PATH"
    open "$OUTPUT_PATH"
  fi
done
\`\`\`

## Output

${outputSection}

## Rules

For workflow operations, refer to the base skill:
- Base skill: \`~/.claude/skills/refly/SKILL.md\`
`;

  return frontmatterLines.join('\n') + content;
}

/**
 * Metadata parsed from SKILL.md frontmatter
 */
export interface ReflySkillMeta {
  name: string;
  displayName?: string;
  description: string;
  skillId: string;
  workflowId: string;
  installationId?: string;
  triggers?: string[];
  tags?: string[];
  version?: string;
}

/**
 * Parse SKILL.md content and extract metadata and body
 */
export function parseReflySkillMd(content: string): {
  meta: ReflySkillMeta;
  body: string;
  raw: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid SKILL.md format: missing frontmatter');
  }

  const [, frontmatterStr, body] = match;
  const meta: Partial<ReflySkillMeta> = {};

  // Parse YAML-like frontmatter
  const lines = frontmatterStr.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for array item (starts with "  - ")
    if (trimmed.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(trimmed.slice(2).trim());
      }
      continue;
    }

    // If we were collecting an array, save it
    if (currentKey && currentArray.length > 0) {
      (meta as Record<string, unknown>)[currentKey] = currentArray;
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
        (meta as Record<string, unknown>)[key] = value;
      }
    }
  }

  // Save any remaining array
  if (currentKey && currentArray.length > 0) {
    (meta as Record<string, unknown>)[currentKey] = currentArray;
  }

  // Validate required fields
  if (!meta.name) {
    throw new Error('Invalid SKILL.md: missing required field "name"');
  }
  if (!meta.description) {
    throw new Error('Invalid SKILL.md: missing required field "description"');
  }
  if (!meta.skillId) {
    throw new Error('Invalid SKILL.md: missing required field "skillId"');
  }
  if (!meta.workflowId) {
    throw new Error('Invalid SKILL.md: missing required field "workflowId"');
  }

  return {
    meta: meta as ReflySkillMeta,
    body: body.trim(),
    raw: content,
  };
}

// ============================================================================
// Multi-Platform Support
// ============================================================================

import type { AgentType } from '../platform/registry.js';
import type { MultiPlatformDeployResult, MultiPlatformRemoveResult } from '../platform/adapter.js';
import {
  deploySkillToAllPlatforms,
  removeSkillFromAllPlatforms,
  listAllDeployedSkills,
} from '../platform/manager.js';

/**
 * Create a skill in Refly directory and deploy to all enabled platforms
 */
export async function createMultiPlatformSkill(
  skillName: string,
  skillMdContent: string,
  options?: { force?: boolean; agents?: AgentType[] },
): Promise<MultiPlatformDeployResult> {
  const skillDir = getReflyDomainSkillDir(skillName);

  // Ensure skill directory exists
  ensureReflySkillsDir();

  if (fs.existsSync(skillDir)) {
    if (options?.force) {
      // Force mode: update existing SKILL.md
      const skillMdPath = path.join(skillDir, 'SKILL.md');
      fs.writeFileSync(skillMdPath, skillMdContent, { encoding: 'utf-8', mode: 0o644 });
      logger.debug(`Updated SKILL.md (force): ${skillMdPath}`);
    } else {
      // Return error result
      return {
        skillName,
        sourcePath: skillDir,
        results: new Map(),
        successCount: 0,
        failureCount: 1,
      };
    }
  } else {
    // Create skill directory and SKILL.md
    fs.mkdirSync(skillDir, { recursive: true, mode: 0o755 });
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillMdPath, skillMdContent, { encoding: 'utf-8', mode: 0o644 });
    logger.debug(`Created SKILL.md: ${skillMdPath}`);
  }

  // Deploy to all platforms
  return deploySkillToAllPlatforms(skillName, {
    force: options?.force,
    agents: options?.agents,
  });
}

/**
 * Remove a skill from all platforms and delete Refly directory
 */
export async function removeMultiPlatformSkill(
  skillName: string,
  options?: { agents?: AgentType[]; keepLocal?: boolean },
): Promise<{
  platformResults: MultiPlatformRemoveResult;
  directoryRemoved: boolean;
}> {
  // Remove from all platforms first
  const platformResults = await removeSkillFromAllPlatforms(skillName, {
    agents: options?.agents,
  });

  // Remove skill directory unless keepLocal is true
  let directoryRemoved = false;
  if (!options?.keepLocal) {
    const skillDir = getReflyDomainSkillDir(skillName);
    try {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
        directoryRemoved = true;
        logger.info(`Removed skill directory: ${skillDir}`);
      }
    } catch (err) {
      logger.error(`Failed to remove skill directory ${skillDir}:`, err);
    }
  }

  return { platformResults, directoryRemoved };
}

/**
 * List skills deployed across all platforms
 */
export async function listMultiPlatformSkills(options?: {
  agents?: AgentType[];
}): Promise<
  Map<AgentType, Array<{ name: string; path: string; isValid: boolean; isSymlink: boolean }>>
> {
  const allDeployed = await listAllDeployedSkills({ agents: options?.agents });

  // Transform to simplified format
  const result = new Map<
    AgentType,
    Array<{ name: string; path: string; isValid: boolean; isSymlink: boolean }>
  >();

  for (const [agent, skills] of allDeployed) {
    result.set(
      agent,
      skills.map((s) => ({
        name: s.name,
        path: s.path,
        isValid: s.isValid,
        isSymlink: s.isSymlink,
      })),
    );
  }

  return result;
}
