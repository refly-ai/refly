/**
 * Skill registry module - manages ~/.claude/skills/refly/registry.json
 *
 * Implements:
 * - readRegistry() - Load registry with validation
 * - writeRegistry() - Save with atomic write (temp + rename)
 * - findSkill(name) - Get skill by exact name
 * - addSkill(entry) - Add with uniqueness check
 * - removeSkill(name) - Remove by name
 * - updateSkill(name, updates) - Partial update
 * - validateRegistry() - Schema integrity check
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getClaudeSkillDir, ensureDir } from '../config/paths.js';
import { logger } from '../utils/logger.js';
import {
  type SkillEntry,
  type SkillRegistry,
  type ValidationIssue,
  SkillErrorCode,
  REGISTRY_VERSION,
  isSkillRegistry,
  createSkillError,
  validateCommonSkillFields,
  validateOptionalSkillFields,
} from './types.js';

/**
 * Get the registry file path.
 */
export function getRegistryPath(): string {
  return path.join(getClaudeSkillDir(), 'registry.json');
}

/**
 * Create an empty registry structure.
 */
export function createEmptyRegistry(): SkillRegistry {
  return {
    version: REGISTRY_VERSION,
    updatedAt: new Date().toISOString(),
    skills: [],
  };
}

/**
 * Read the registry from disk.
 * Returns an empty registry if file doesn't exist.
 * Throws if file exists but is corrupted.
 */
export function readRegistry(): SkillRegistry {
  const registryPath = getRegistryPath();

  if (!fs.existsSync(registryPath)) {
    logger.debug('Registry file not found, returning empty registry');
    return createEmptyRegistry();
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    const data = JSON.parse(content);

    if (!isSkillRegistry(data)) {
      throw createSkillError(SkillErrorCode.REGISTRY_CORRUPTED, 'Registry structure is invalid', {
        suggestions: ['Run `refly skill validate --fix` to repair the registry'],
      });
    }

    logger.debug(`Registry loaded with ${data.skills.length} skills`);
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw createSkillError(SkillErrorCode.REGISTRY_CORRUPTED, 'Registry JSON is malformed', {
        details: { error: err.message },
        suggestions: ['Run `refly skill validate --fix` to repair the registry'],
      });
    }
    throw err;
  }
}

/**
 * Write the registry to disk using atomic write (temp + rename).
 * This prevents corruption if write is interrupted.
 */
export function writeRegistry(registry: SkillRegistry): void {
  const registryPath = getRegistryPath();
  const registryDir = path.dirname(registryPath);

  // Ensure directory exists
  ensureDir(registryDir);

  // Update timestamp
  registry.updatedAt = new Date().toISOString();

  // Serialize with pretty printing
  const content = JSON.stringify(registry, null, 2);

  // Atomic write: write to temp file, then rename
  const tempPath = path.join(registryDir, `.registry-${crypto.randomUUID()}.tmp`);

  try {
    // Write to temporary file
    fs.writeFileSync(tempPath, content, { encoding: 'utf-8', mode: 0o600 });

    // Atomic rename
    fs.renameSync(tempPath, registryPath);

    logger.debug(`Registry saved with ${registry.skills.length} skills`);
  } catch (err) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Find a skill by exact name.
 * Returns null if not found.
 */
export function findSkill(name: string): SkillEntry | null {
  const registry = readRegistry();
  return registry.skills.find((s) => s.name === name) ?? null;
}

/**
 * Add a skill to the registry.
 * Throws if skill name already exists.
 */
export function addSkill(entry: SkillEntry): void {
  const registry = readRegistry();

  // Check for duplicate name
  if (registry.skills.some((s) => s.name === entry.name)) {
    throw createSkillError(SkillErrorCode.SKILL_EXISTS, `Skill '${entry.name}' already exists`, {
      suggestions: ['Choose a different name or use `refly skill delete` first'],
    });
  }

  // Validate entry
  const validationErrors = validateSkillEntry(entry);
  if (validationErrors.length > 0) {
    throw createSkillError(SkillErrorCode.VALIDATION_ERROR, 'Invalid skill entry', {
      details: { errors: validationErrors },
      suggestions: validationErrors.map((e) => e.message),
    });
  }

  // Add skill
  registry.skills.push(entry);
  writeRegistry(registry);

  logger.info(`Skill '${entry.name}' added to registry`);
}

/**
 * Remove a skill from the registry by name.
 * Returns true if removed, false if not found.
 */
export function removeSkill(name: string): boolean {
  const registry = readRegistry();
  const initialLength = registry.skills.length;

  registry.skills = registry.skills.filter((s) => s.name !== name);

  if (registry.skills.length === initialLength) {
    return false;
  }

  writeRegistry(registry);
  logger.info(`Skill '${name}' removed from registry`);
  return true;
}

/**
 * Update a skill in the registry.
 * Throws if skill not found.
 */
export function updateSkill(name: string, updates: Partial<Omit<SkillEntry, 'name'>>): SkillEntry {
  const registry = readRegistry();
  const index = registry.skills.findIndex((s) => s.name === name);

  if (index === -1) {
    throw createSkillError(SkillErrorCode.SKILL_NOT_FOUND, `Skill '${name}' not found`, {
      suggestions: ['Use `refly skill list` to see available skills'],
    });
  }

  // Merge updates
  const updatedEntry: SkillEntry = {
    ...registry.skills[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate updated entry
  const validationErrors = validateSkillEntry(updatedEntry);
  if (validationErrors.length > 0) {
    throw createSkillError(SkillErrorCode.VALIDATION_ERROR, 'Invalid skill update', {
      details: { errors: validationErrors },
      suggestions: validationErrors.map((e) => e.message),
    });
  }

  registry.skills[index] = updatedEntry;
  writeRegistry(registry);

  logger.info(`Skill '${name}' updated`);
  return updatedEntry;
}

/**
 * Validate a single skill entry.
 * Returns array of validation issues.
 */
export function validateSkillEntry(entry: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!entry || typeof entry !== 'object') {
    issues.push({ path: '', message: 'Entry must be an object', value: entry });
    return issues;
  }

  const e = entry as Record<string, unknown>;

  // Validate common fields (name, description, workflowId, triggers)
  validateCommonSkillFields(e, issues);

  // Registry-specific required fields
  if (typeof e.path !== 'string' || e.path.trim() === '') {
    issues.push({ path: 'path', message: 'Path is required', value: e.path });
  }

  if (typeof e.createdAt !== 'string') {
    issues.push({ path: 'createdAt', message: 'CreatedAt is required', value: e.createdAt });
  }

  if (e.source !== 'local' && e.source !== 'refly-cloud') {
    issues.push({
      path: 'source',
      message: "Source must be 'local' or 'refly-cloud'",
      value: e.source,
    });
  }

  // Validate optional fields (tags, author, version)
  validateOptionalSkillFields(e, issues);

  return issues;
}

/**
 * Validate the entire registry.
 * Returns validation result with errors, warnings, and fixes.
 */
export function validateRegistry(): {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let registry: SkillRegistry;
  try {
    registry = readRegistry();
  } catch (err) {
    if ((err as { code?: string }).code === SkillErrorCode.REGISTRY_CORRUPTED) {
      errors.push({ path: '', message: 'Registry file is corrupted', value: err });
      return { valid: false, errors, warnings };
    }
    throw err;
  }

  // Check version
  if (registry.version !== REGISTRY_VERSION) {
    warnings.push({
      path: 'version',
      message: `Registry version ${registry.version} may be outdated`,
      expected: REGISTRY_VERSION,
    });
  }

  // Validate each skill
  const seenNames = new Set<string>();
  for (let i = 0; i < registry.skills.length; i++) {
    const skill = registry.skills[i];
    const skillIssues = validateSkillEntry(skill);

    for (const issue of skillIssues) {
      errors.push({
        ...issue,
        path: `skills[${i}].${issue.path}`,
      });
    }

    // Check for duplicate names
    if (typeof skill.name === 'string') {
      if (seenNames.has(skill.name)) {
        errors.push({
          path: `skills[${i}].name`,
          message: `Duplicate skill name: ${skill.name}`,
          value: skill.name,
        });
      }
      seenNames.add(skill.name);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Initialize an empty registry if it doesn't exist.
 * Used during `refly init`.
 */
export function initializeRegistry(): boolean {
  const registryPath = getRegistryPath();

  if (fs.existsSync(registryPath)) {
    logger.debug('Registry already exists');
    return false;
  }

  writeRegistry(createEmptyRegistry());
  logger.info('Initialized empty skill registry');
  return true;
}

/**
 * Get all skills from the registry.
 */
export function getAllSkills(): SkillEntry[] {
  return readRegistry().skills;
}

/**
 * Get skills filtered by criteria.
 */
export function getFilteredSkills(filter?: {
  tags?: string[];
  source?: 'local' | 'refly-cloud';
}): SkillEntry[] {
  let skills = getAllSkills();

  if (filter?.source) {
    skills = skills.filter((s) => s.source === filter.source);
  }

  if (filter?.tags && filter.tags.length > 0) {
    const filterTags = new Set(filter.tags.map((t) => t.toLowerCase()));
    skills = skills.filter((s) => s.tags?.some((t) => filterTags.has(t.toLowerCase())));
  }

  return skills;
}
