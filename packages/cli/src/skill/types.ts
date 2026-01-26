/**
 * Skill system TypeScript types for Refly CLI.
 *
 * Based on:
 * - execution-plan.md (Step 1.1)
 * - techinique_plan/04-typescript-interfaces.md
 */

// ============================================================================
// Skill Types
// ============================================================================

/**
 * Skill source type
 */
export type SkillSource = 'local' | 'refly-cloud';

/**
 * Skill entry for listing and searching.
 *
 * Field requirements:
 * - name: Required, format: ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ (1-64 chars)
 * - description: Required, max 200 chars
 * - workflowId: Required, bound workflow ID
 * - triggers: Required, 1-10 intent matching phrases
 * - reflyPath: Required, path to ~/.refly/skills/<name>/
 * - claudePath: Required, symlink path ~/.claude/skills/<name>
 * - createdAt: Required, ISO 8601 timestamp
 * - source: Required, 'local' or 'refly-cloud'
 * - tags: Optional, categorization tags
 * - author: Optional, skill author
 * - version: Optional, semver version
 * - updatedAt: Optional, last update timestamp
 */
export interface SkillEntry {
  /** Unique identifier (format: ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$, 1-64 chars) */
  name: string;

  /** One-line description (max 200 chars) */
  description: string;

  /** Bound workflow ID */
  workflowId: string;

  /** Keywords/phrases that activate this skill (1-10 items) */
  triggers: string[];

  /** Path to skill directory in ~/.refly/skills/<name>/ */
  reflyPath?: string;

  /** Symlink path in ~/.claude/skills/<name> */
  claudePath?: string;

  /**
   * @deprecated Use reflyPath instead
   * Relative path to skill directory (legacy)
   */
  path?: string;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Skill source */
  source: SkillSource;

  // Optional fields

  /** Categorization tags */
  tags?: string[];

  /** Skill author */
  author?: string;

  /** Semantic version (x.y.z) */
  version?: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt?: string;

  /** Cloud skill ID (for refly-cloud source) */
  skillId?: string;

  /** Installation ID (for installed skills) */
  installationId?: string;
}

/**
 * Skill registry root structure.
 * @deprecated Registry is no longer used. Skills are discovered via symlinks.
 */
export interface SkillRegistry {
  /** Registry schema version (currently 1) */
  version: number;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Registered skills */
  skills: SkillEntry[];
}

// ============================================================================
// Frontmatter Types
// ============================================================================

/**
 * Skill frontmatter parsed from skill.md YAML header.
 *
 * Example:
 * ```markdown
 * ---
 * name: my-skill
 * description: Does something useful
 * workflowId: wf_xxx
 * triggers:
 *   - do something
 *   - process data
 * ---
 * ```
 */
export interface SkillFrontmatter {
  /** Skill name (required) */
  name: string;

  /** Description (required) */
  description: string;

  /** Bound workflow ID (required) */
  workflowId: string;

  /** Trigger phrases (required, 1-10 items) */
  triggers: string[];

  // Optional fields

  /** Categorization tags */
  tags?: string[];

  /** Skill author */
  author?: string;

  /** Semantic version */
  version?: string;
}

/**
 * Loaded skill with frontmatter and content.
 */
export interface LoadedSkill {
  /** Parsed frontmatter */
  frontmatter: SkillFrontmatter;

  /** Markdown content after frontmatter */
  content: string;

  /** File path of the skill.md */
  filePath: string;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Match type for skill search results.
 */
export type SkillMatchType =
  | 'exact' // Exact name match (100 points)
  | 'trigger' // Full trigger match (80 points)
  | 'partial' // Partial trigger match (64 points)
  | 'description' // Description contains (60 points)
  | 'tag'; // Tag contains (40 points)

/**
 * Skill search result with scoring.
 */
export interface SkillSearchResult {
  /** Matched skill entry */
  skill: SkillEntry;

  /** Match score (0-100) */
  score: number;

  /** How the skill was matched */
  matchType: SkillMatchType;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Skill error codes for CLI commands.
 */
export enum SkillErrorCode {
  /** Skill not found in registry */
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',

  /** Skill name already exists in registry */
  SKILL_EXISTS = 'SKILL_EXISTS',

  /** Bound workflow not found */
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',

  /** Invalid input JSON or format */
  INVALID_INPUT = 'INVALID_INPUT',

  /** Registry file corrupted or unparseable */
  REGISTRY_CORRUPTED = 'REGISTRY_CORRUPTED',

  /** skill.md frontmatter parse failed */
  INVALID_FRONTMATTER = 'INVALID_FRONTMATTER',

  /** Skill name format invalid */
  INVALID_NAME = 'INVALID_NAME',

  /** Skill directory not found */
  SKILL_DIR_NOT_FOUND = 'SKILL_DIR_NOT_FOUND',

  /** General validation error */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** File system operation failed */
  FILE_ERROR = 'FILE_ERROR',

  /** Unknown error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Skill error with code and suggestions.
 */
export interface SkillError {
  /** Error code */
  code: SkillErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional error details */
  details?: Record<string, unknown>;

  /** Suggestions for resolving the error */
  suggestions?: string[];
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation issue found during skill validation.
 */
export interface ValidationIssue {
  /** Field or path with issue */
  path: string;

  /** Issue description */
  message: string;

  /** Current value (if applicable) */
  value?: unknown;

  /** Expected value or format (if applicable) */
  expected?: unknown;
}

/**
 * Validation result from `refly skill validate`.
 */
export interface ValidationResult {
  /** Overall validity */
  valid: boolean;

  /** Critical errors that must be fixed */
  errors: ValidationIssue[];

  /** Warnings that should be addressed */
  warnings: ValidationIssue[];

  /** Issues that were auto-fixed (when --fix is used) */
  fixed: ValidationIssue[];
}

// ============================================================================
// CLI Command Types
// ============================================================================

/**
 * Skill list filter options.
 */
export interface SkillListFilter {
  /** Filter by tags */
  tags?: string[];

  /** Filter by source */
  source?: SkillSource;
}

/**
 * Create skill input options.
 */
export interface CreateSkillInput {
  /** Skill name (required if not auto-generated) */
  name?: string;

  /** Workflow ID to bind (required) */
  workflowId: string;

  /** Description (optional, can be auto-generated) */
  description?: string;

  /** Trigger phrases (optional, can be auto-generated) */
  triggers?: string[];

  /** Categorization tags */
  tags?: string[];

  /** Skill author */
  author?: string;

  /** Semantic version */
  version?: string;
}

/**
 * Skill run input.
 */
export interface SkillRunInput {
  /** Skill name */
  skillName: string;

  /** JSON input for the workflow */
  input: Record<string, unknown>;

  /** Run asynchronously */
  async?: boolean;

  /** Execution timeout in milliseconds */
  timeout?: number;
}

/**
 * Skill run result.
 */
export interface SkillRunResult {
  /** Skill name */
  skillName: string;

  /** Workflow run ID */
  runId: string;

  /** Execution status */
  status: 'running' | 'finish' | 'failed';

  /** Result data (if completed) */
  result?: unknown;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Skill name validation regex.
 * Allows: lowercase letters, numbers, hyphens (not at start/end).
 * Supports single character names like "a".
 */
export const SKILL_NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Maximum skill name length.
 */
export const SKILL_NAME_MAX_LENGTH = 64;

/**
 * Maximum description length.
 */
export const SKILL_DESCRIPTION_MAX_LENGTH = 200;

/**
 * Minimum triggers count.
 */
export const SKILL_TRIGGERS_MIN = 1;

/**
 * Maximum triggers count.
 */
export const SKILL_TRIGGERS_MAX = 10;

/**
 * Current registry schema version.
 */
export const REGISTRY_VERSION = 1;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for SkillEntry.
 */
export function isSkillEntry(obj: unknown): obj is SkillEntry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as SkillEntry).name === 'string' &&
    typeof (obj as SkillEntry).description === 'string' &&
    typeof (obj as SkillEntry).workflowId === 'string' &&
    Array.isArray((obj as SkillEntry).triggers) &&
    typeof (obj as SkillEntry).createdAt === 'string' &&
    typeof (obj as SkillEntry).source === 'string'
  );
}

/**
 * Type guard for SkillRegistry.
 */
export function isSkillRegistry(obj: unknown): obj is SkillRegistry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as SkillRegistry).version === 'number' &&
    typeof (obj as SkillRegistry).updatedAt === 'string' &&
    Array.isArray((obj as SkillRegistry).skills)
  );
}

/**
 * Type guard for SkillFrontmatter.
 */
export function isSkillFrontmatter(obj: unknown): obj is SkillFrontmatter {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as SkillFrontmatter).name === 'string' &&
    typeof (obj as SkillFrontmatter).description === 'string' &&
    typeof (obj as SkillFrontmatter).workflowId === 'string' &&
    Array.isArray((obj as SkillFrontmatter).triggers)
  );
}

/**
 * Type guard for SkillError.
 */
export function isSkillError(obj: unknown): obj is SkillError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as SkillError).code === 'string' &&
    typeof (obj as SkillError).message === 'string'
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate skill name format.
 */
export function isValidSkillName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length >= 1 &&
    name.length <= SKILL_NAME_MAX_LENGTH &&
    SKILL_NAME_REGEX.test(name)
  );
}

/**
 * Create a SkillError object.
 */
export function createSkillError(
  code: SkillErrorCode,
  message: string,
  options?: { details?: Record<string, unknown>; suggestions?: string[] },
): SkillError {
  return {
    code,
    message,
    details: options?.details,
    suggestions: options?.suggestions,
  };
}

// ============================================================================
// Shared Validation Helpers
// ============================================================================

/**
 * Validate common skill fields (name, description, workflowId, triggers).
 * Used by both loader and registry validation.
 */
export function validateCommonSkillFields(
  data: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  // Required: name
  if (typeof data.name !== 'string') {
    issues.push({ path: 'name', message: 'Name is required', value: data.name });
  } else if (!isValidSkillName(data.name)) {
    issues.push({
      path: 'name',
      message: `Name must match pattern ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ and be 1-${SKILL_NAME_MAX_LENGTH} chars`,
      value: data.name,
    });
  }

  // Required: description
  if (typeof data.description !== 'string') {
    issues.push({
      path: 'description',
      message: 'Description is required',
      value: data.description,
    });
  } else if (data.description.length > SKILL_DESCRIPTION_MAX_LENGTH) {
    issues.push({
      path: 'description',
      message: `Description must be <= ${SKILL_DESCRIPTION_MAX_LENGTH} chars`,
      value: data.description.length,
    });
  }

  // Required: workflowId
  if (typeof data.workflowId !== 'string' || data.workflowId.trim() === '') {
    issues.push({ path: 'workflowId', message: 'WorkflowId is required', value: data.workflowId });
  }

  // Required: triggers (array of 1-10 strings)
  validateTriggers(data.triggers, issues);
}

/**
 * Validate triggers array.
 */
export function validateTriggers(triggers: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(triggers)) {
    issues.push({ path: 'triggers', message: 'Triggers must be an array', value: triggers });
    return;
  }

  if (triggers.length < SKILL_TRIGGERS_MIN || triggers.length > SKILL_TRIGGERS_MAX) {
    issues.push({
      path: 'triggers',
      message: `Triggers must have ${SKILL_TRIGGERS_MIN}-${SKILL_TRIGGERS_MAX} items`,
      value: triggers.length,
    });
  }

  for (let i = 0; i < triggers.length; i++) {
    if (typeof triggers[i] !== 'string' || (triggers[i] as string).trim() === '') {
      issues.push({
        path: `triggers[${i}]`,
        message: 'Each trigger must be a non-empty string',
        value: triggers[i],
      });
    }
  }
}

/**
 * Validate optional skill fields (tags, author, version).
 */
export function validateOptionalSkillFields(
  data: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  // Optional: tags (array of strings if present)
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      issues.push({ path: 'tags', message: 'Tags must be an array if provided', value: data.tags });
    } else {
      for (let i = 0; i < data.tags.length; i++) {
        if (typeof data.tags[i] !== 'string') {
          issues.push({
            path: `tags[${i}]`,
            message: 'Each tag must be a string',
            value: data.tags[i],
          });
        }
      }
    }
  }

  // Optional: author (string if present)
  if (data.author !== undefined && typeof data.author !== 'string') {
    issues.push({
      path: 'author',
      message: 'Author must be a string if provided',
      value: data.author,
    });
  }

  // Optional: version (string if present)
  if (data.version !== undefined && typeof data.version !== 'string') {
    issues.push({
      path: 'version',
      message: 'Version must be a string if provided',
      value: data.version,
    });
  }
}
