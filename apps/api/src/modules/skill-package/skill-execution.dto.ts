/**
 * DTOs for skill execution API.
 */

/**
 * Request to start a skill execution.
 */
export interface StartSkillExecutionDto {
  input?: Record<string, unknown>;
}

/**
 * Workflow execution status in response.
 */
export interface WorkflowExecutionStatus {
  executionWorkflowId: string;
  skillWorkflowId: string;
  workflowId: string;
  executionLevel: number;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Skill execution response.
 */
export interface SkillExecutionResponse {
  executionId: string;
  installationId: string;
  skillId: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  workflowExecutions?: WorkflowExecutionStatus[];
}

/**
 * Start execution response.
 */
export interface StartExecutionResponse {
  executionId: string;
  status: string;
  createdAt: string;
}

/**
 * Paginated list of executions.
 */
export interface ListExecutionsResponse {
  items: SkillExecutionResponse[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Query parameters for listing executions.
 */
export interface ListExecutionsQueryDto {
  status?: string;
  page?: string;
  pageSize?: string;
}
