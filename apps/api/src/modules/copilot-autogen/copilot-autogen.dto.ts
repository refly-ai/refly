import { WorkflowPlan } from '@refly/canvas-common';
import { WorkflowVariable } from '@refly/openapi-schema';

export interface GenerateWorkflowRequest {
  query: string; // User requirement description
  canvasId?: string; // Optional: Specify Canvas ID, create new if not provided
  projectId?: string; // Optional: Project ID
  variables?: WorkflowVariable[]; // Optional: Predefined variables
  locale?: string; // Optional: Output language
  modelItemId?: string; // Optional: Model to use
}

export interface GenerateWorkflowResponse {
  canvasId: string; // Canvas ID
  workflowPlan: WorkflowPlan; // Generated Workflow Plan
  sessionId: string; // Copilot Session ID
  resultId: string; // Action Result ID
  nodesCount: number; // Number of generated nodes
  edgesCount: number; // Number of generated edges
}
