/**
 * Skill loader module - parsing and loading skill.md files.
 *
 * Uses gray-matter for frontmatter extraction.
 *
 * Implements:
 * - parseFrontmatter(content) - Extract YAML frontmatter
 * - loadSkill(name) - Load and parse skill.md
 * - validateSkillFrontmatter(frontmatter) - Validate required fields
 * - getSkillWithWorkflow(name) - Load skill with workflow details
 */

import matter from 'gray-matter';
import { logger } from '../utils/logger.js';
import {
  type SkillFrontmatter,
  type LoadedSkill,
  type ValidationIssue,
  SkillErrorCode,
  createSkillError,
  validateCommonSkillFields,
  validateOptionalSkillFields,
} from './types.js';
import { readSkillFile, getSkillFilePath, skillFileExists } from './storage.js';
import { findSkill } from './registry.js';

/**
 * Parse frontmatter from skill.md content.
 * Returns the parsed frontmatter data and markdown content.
 */
export function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  content: string;
} {
  try {
    const result = matter(content);
    return {
      data: result.data as Record<string, unknown>,
      content: result.content,
    };
  } catch (err) {
    throw createSkillError(SkillErrorCode.INVALID_FRONTMATTER, 'Failed to parse frontmatter', {
      details: { error: (err as Error).message },
      suggestions: [
        'Ensure frontmatter is valid YAML',
        'Check that frontmatter is enclosed in --- delimiters',
      ],
    });
  }
}

/**
 * Validate skill frontmatter fields.
 * Returns array of validation issues.
 */
export function validateSkillFrontmatter(data: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  validateCommonSkillFields(data, issues);
  validateOptionalSkillFields(data, issues);

  return issues;
}

/**
 * Convert raw frontmatter data to typed SkillFrontmatter.
 * Throws if validation fails.
 */
export function toSkillFrontmatter(data: Record<string, unknown>): SkillFrontmatter {
  const issues = validateSkillFrontmatter(data);

  if (issues.length > 0) {
    throw createSkillError(SkillErrorCode.INVALID_FRONTMATTER, 'Invalid skill frontmatter', {
      details: { errors: issues },
      suggestions: issues.map((i) => i.message),
    });
  }

  return {
    name: data.name as string,
    description: data.description as string,
    workflowId: data.workflowId as string,
    triggers: data.triggers as string[],
    tags: data.tags as string[] | undefined,
    author: data.author as string | undefined,
    version: data.version as string | undefined,
  };
}

/**
 * Load a skill by name.
 * Reads skill.md file and parses frontmatter.
 */
export function loadSkill(name: string): LoadedSkill {
  logger.debug(`Loading skill: ${name}`);

  // Read skill file
  const content = readSkillFile(name);
  const filePath = getSkillFilePath(name);

  // Parse frontmatter
  const parsed = parseFrontmatter(content);
  const frontmatter = toSkillFrontmatter(parsed.data);

  // Verify name matches
  if (frontmatter.name !== name) {
    logger.warn(
      `Skill name mismatch: file path says '${name}', frontmatter says '${frontmatter.name}'`,
    );
  }

  return {
    frontmatter,
    content: parsed.content,
    filePath,
  };
}

/**
 * Load a skill by name, with validation that it exists in registry.
 * Returns skill with registry entry information.
 */
export function loadSkillWithRegistry(
  name: string,
): LoadedSkill & { registryEntry: ReturnType<typeof findSkill> } {
  const registryEntry = findSkill(name);

  if (!registryEntry) {
    throw createSkillError(
      SkillErrorCode.SKILL_NOT_FOUND,
      `Skill '${name}' not found in registry`,
      {
        suggestions: [
          'Use `refly skill list` to see available skills',
          'Use `refly skill create` to create a new skill',
        ],
      },
    );
  }

  // Check if skill file exists
  if (!skillFileExists(name)) {
    throw createSkillError(
      SkillErrorCode.SKILL_DIR_NOT_FOUND,
      `Skill '${name}' is in registry but skill.md file is missing`,
      {
        suggestions: [
          'Run `refly skill validate --fix` to repair the registry',
          'Recreate the skill with `refly skill create`',
        ],
      },
    );
  }

  const loadedSkill = loadSkill(name);

  return {
    ...loadedSkill,
    registryEntry,
  };
}

/**
 * Try to load a skill, returning null if it doesn't exist.
 */
export function tryLoadSkill(name: string): LoadedSkill | null {
  try {
    return loadSkill(name);
  } catch (err) {
    if (
      (err as { code?: string }).code === SkillErrorCode.SKILL_DIR_NOT_FOUND ||
      (err as { code?: string }).code === SkillErrorCode.SKILL_NOT_FOUND
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Extract skill metadata from skill.md content without loading from disk.
 * Useful for validation and preview.
 */
export function extractSkillMetadata(content: string): {
  frontmatter: SkillFrontmatter | null;
  issues: ValidationIssue[];
  content: string;
} {
  try {
    const parsed = parseFrontmatter(content);
    const issues = validateSkillFrontmatter(parsed.data);

    if (issues.length > 0) {
      return {
        frontmatter: null,
        issues,
        content: parsed.content,
      };
    }

    return {
      frontmatter: toSkillFrontmatter(parsed.data),
      issues: [],
      content: parsed.content,
    };
  } catch (err) {
    return {
      frontmatter: null,
      issues: [
        {
          path: '',
          message: (err as Error).message,
        },
      ],
      content: '',
    };
  }
}

/**
 * Validate that a skill's workflow exists (placeholder for API integration).
 * Phase 1: Just validates the workflowId is not empty.
 * Phase 2: Will call API to verify workflow exists.
 */
export function validateWorkflowExists(workflowId: string): boolean {
  // Phase 1: Basic validation only
  return typeof workflowId === 'string' && workflowId.trim().length > 0;
}

/**
 * Get skill with workflow details (placeholder for API integration).
 * Phase 1: Returns skill only, workflow field is null.
 * Phase 2: Will fetch workflow details from API.
 */
export function getSkillWithWorkflow(name: string): LoadedSkill & { workflow: null } {
  const skill = loadSkill(name);

  // Phase 1: workflow details not implemented yet
  // Phase 2: will fetch workflow from API
  return {
    ...skill,
    workflow: null,
  };
}
