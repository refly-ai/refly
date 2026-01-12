import type { WorkflowVariable, WorkflowPlan } from '@refly/openapi-schema';

export interface GenerateWorkflowRequest {
  query: string; // User requirement description
  canvasId?: string; // Optional: Specify Canvas ID, create new if not provided
  projectId?: string; // Optional: Project ID
  variables?: WorkflowVariable[]; // Optional: Predefined variables
  locale?: string; // Optional: Output language
  modelItemId?: string; // Optional: Model to use
  skipDefaultNodes?: boolean; // Optional: Skip default nodes when creating canvas
  timeout?: number; // Optional: Timeout in milliseconds for Copilot completion
}

export interface GenerateWorkflowResponse {
  canvasId: string; // Canvas ID
  workflowPlan: WorkflowPlan; // Generated Workflow Plan
  planId: string; // Workflow Plan ID (for future refine operations)
  sessionId: string; // Copilot Session ID
  resultId: string; // Action Result ID
  nodesCount: number; // Number of generated nodes
  edgesCount: number; // Number of generated edges
}
