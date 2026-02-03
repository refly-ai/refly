/**
 * Error codes for skill execution.
 */

const SKILL_EXECUTION_ERROR_CODES = {
  // Execution lifecycle errors
  EXECUTION_NOT_FOUND: 'EXECUTION_NOT_FOUND',
  EXECUTION_ALREADY_RUNNING: 'EXECUTION_ALREADY_RUNNING',
  EXECUTION_CANCELLED: 'EXECUTION_CANCELLED',

  // Skill state errors
  SKILL_NOT_READY: 'SKILL_NOT_READY',
  SKILL_NOT_INSTALLED: 'SKILL_NOT_INSTALLED',
  WORKFLOW_NOT_CLONED: 'WORKFLOW_NOT_CLONED',

  // Execution errors
  WORKFLOW_TIMEOUT: 'WORKFLOW_TIMEOUT',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  ALL_WORKFLOWS_FAILED: 'ALL_WORKFLOWS_FAILED',

  // DAG errors
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  DEPENDENCY_BLOCKED: 'DEPENDENCY_BLOCKED',

  // Data mapping errors
  MAPPING_FAILED: 'MAPPING_FAILED',
  OUTPUT_SELECTOR_FAILED: 'OUTPUT_SELECTOR_FAILED',
  MERGE_STRATEGY_FAILED: 'MERGE_STRATEGY_FAILED',

  // Condition errors
  CONDITION_EVAL_FAILED: 'CONDITION_EVAL_FAILED',
  INVALID_CONDITION_EXPRESSION: 'INVALID_CONDITION_EXPRESSION',

  // Resource errors
  CONCURRENT_LIMIT_EXCEEDED: 'CONCURRENT_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const;

export type SkillExecutionErrorCode =
  (typeof SKILL_EXECUTION_ERROR_CODES)[keyof typeof SKILL_EXECUTION_ERROR_CODES];

/**
 * Error class for skill execution errors with error codes.
 */
export class SkillExecutionError extends Error {
  constructor(
    public readonly code: SkillExecutionErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SkillExecutionError';
  }

  static executionNotFound(executionId: string): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.EXECUTION_NOT_FOUND,
      `Execution not found: ${executionId}`,
      { executionId },
    );
  }

  static skillNotReady(skillId: string, status: string): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.SKILL_NOT_READY,
      `Skill is not ready for execution. Current status: ${status}`,
      { skillId, status },
    );
  }

  static workflowNotCloned(skillWorkflowId: string): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.WORKFLOW_NOT_CLONED,
      `Workflow has not been cloned: ${skillWorkflowId}`,
      { skillWorkflowId },
    );
  }

  static workflowTimeout(workflowId: string, timeoutMs: number): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.WORKFLOW_TIMEOUT,
      `Workflow execution timed out after ${timeoutMs}ms`,
      { workflowId, timeoutMs },
    );
  }

  static circularDependency(workflowIds: string[]): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.CIRCULAR_DEPENDENCY,
      'Circular dependency detected in workflows',
      { workflowIds },
    );
  }

  static mappingFailed(source: string, target: string, reason: string): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.MAPPING_FAILED,
      `Data mapping failed from ${source} to ${target}: ${reason}`,
      { source, target, reason },
    );
  }

  static conditionEvalFailed(condition: string, reason: string): SkillExecutionError {
    return new SkillExecutionError(
      SKILL_EXECUTION_ERROR_CODES.CONDITION_EVAL_FAILED,
      `Condition evaluation failed: ${reason}`,
      { condition, reason },
    );
  }
}
