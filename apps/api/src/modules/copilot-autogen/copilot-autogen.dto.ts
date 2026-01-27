import type { WorkflowVariable, WorkflowPlan } from '@refly/openapi-schema';

/**
 * Request for generating workflow (original web/frontend API)
 */
export interface GenerateWorkflowRequest {
  query: string; // User requirement description
  canvasId?: string; // Optional: Specify Canvas ID, create new if not provided
  variables?: WorkflowVariable[]; // Optional: Predefined variables
  locale?: string; // Optional: Output language
  modelItemId?: string; // Optional: Model to use
}

/**
 * Response for generating workflow (original web/frontend API)
 * Note: planId is NOT included here - use CLI response for planId
 */
export interface GenerateWorkflowResponse {
  canvasId: string; // Canvas ID
  workflowPlan: WorkflowPlan; // Generated Workflow Plan
  sessionId: string; // Copilot Session ID
  resultId: string; // Action Result ID
  nodesCount: number; // Number of generated nodes
  edgesCount: number; // Number of generated edges
}

/**
 * Request for CLI workflow generation (with additional CLI-specific options)
 */
export interface GenerateWorkflowCliRequest {
  query: string; // User requirement description
  canvasId?: string; // Optional: Specify Canvas ID, create new if not provided
  variables?: WorkflowVariable[]; // Optional: Predefined variables
  locale?: string; // Optional: Output language
  modelItemId?: string; // Optional: Model to use
  skipDefaultNodes?: boolean; // Optional: Skip default nodes when creating canvas
  timeout?: number; // Optional: Timeout in milliseconds for Copilot completion
}

/**
 * Response for CLI workflow generation (with planId for subsequent operations)
 */
export interface GenerateWorkflowCliResponse {
  canvasId: string; // Canvas ID
  workflowPlan: WorkflowPlan; // Generated Workflow Plan (full details for display)
  planId: string; // Workflow Plan ID (for future refine/patch operations)
  sessionId: string; // Copilot Session ID
  resultId: string; // Action Result ID
  nodesCount: number; // Number of generated nodes
  edgesCount: number; // Number of generated edges
}

/**
 * Request for CLI workflow editing (natural language)
 */
export interface EditWorkflowCliRequest {
  canvasId: string; // Canvas ID (c-xxx)
  query: string; // Natural language edit instruction
  locale?: string; // Output language
  modelItemId?: string; // Model to use
  timeout?: number; // Timeout in milliseconds
  sessionId?: string; // Optional: Explicit session ID to use for context continuity
}

/**
 * Response for CLI workflow editing
 */
export interface EditWorkflowCliResponse {
  canvasId: string; // Canvas ID
  planId: string; // Workflow Plan ID
  version: number; // Plan version
  toolUsed: 'generate_workflow' | 'patch_workflow'; // Which tool Copilot used
  plan: WorkflowPlan; // The resulting workflow plan
  sessionId?: string; // Copilot session ID for context continuity
}
