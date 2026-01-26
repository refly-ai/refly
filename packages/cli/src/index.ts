/**
 * @refly/cli - Refly CLI for workflow orchestration
 *
 * This package provides:
 * - CLI commands for workflow management
 * - Skill files for Claude Code integration
 */

// Re-export types
export type {
  SuccessResponse,
  ErrorResponse,
  ErrorDetail,
  CLIResponse,
} from './utils/output.js';

// Re-export utilities
export { ErrorCodes } from './utils/output.js';
export { CLIError, AuthError, ValidationError } from './utils/errors.js';

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
