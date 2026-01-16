/**
 * @refly/cli - Refly CLI for workflow orchestration
 *
 * This package provides:
 * - CLI commands for workflow management
 * - Builder state machine for incremental workflow construction
 * - Skill files for Claude Code integration
 */

// Re-export types
export type {
  BuilderSession,
  WorkflowNode,
  WorkflowDraft,
  ValidationResult,
  BuilderStateType,
  Diff,
} from './builder/schema.js';

export type {
  SuccessResponse,
  ErrorResponse,
  ErrorDetail,
  CLIResponse,
} from './utils/output.js';

// Re-export utilities
export { ErrorCodes } from './utils/output.js';
export { CLIError, AuthError, BuilderError, ValidationError } from './utils/errors.js';

// Re-export builder functions
export {
  createSession,
  loadSession,
  saveSession,
  getCurrentSession,
} from './builder/store.js';

export { validateDraft } from './builder/validate.js';
export { generateGraph } from './builder/graph.js';

// Re-export config functions
export {
  loadConfig,
  saveConfig,
  getApiEndpoint,
  isAuthenticated,
} from './config/config.js';

// Re-export API client
export { apiRequest, verifyConnection } from './api/client.js';

// Re-export skill installer
export { installSkill, isSkillInstalled } from './skill/installer.js';
