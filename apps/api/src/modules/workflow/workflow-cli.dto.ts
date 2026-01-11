/**
 * CLI-specific workflow DTOs
 * These work with the canvas-based workflow system
 */

import { CanvasNode, CanvasEdge, WorkflowVariable, WorkflowPlan } from '@refly/openapi-schema';
import { WorkflowPatchOperation } from '@refly/canvas-common';

// ============================================================================
// Workflow CRUD DTOs
// ============================================================================

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  variables?: WorkflowVariable[];
  spec?: {
    nodes?: CanvasNode[];
    edges?: CanvasEdge[];
  };
}

export interface CreateWorkflowResponse {
  workflowId: string;
  name: string;
  createdAt: string;
}

export interface WorkflowInfo {
  workflowId: string;
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  variables: WorkflowVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface ListWorkflowsResponse {
  workflows: WorkflowSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowSummary {
  workflowId: string;
  name: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWorkflowRequest {
  name?: string;
  variables?: WorkflowVariable[];
  operations?: WorkflowOperation[];
}

// Workflow operations for PATCH endpoint
export type WorkflowOperation =
  | { type: 'add_node'; node: CanvasNode }
  | { type: 'remove_node'; nodeId: string }
  | { type: 'update_node'; nodeId: string; data: Partial<CanvasNode> }
  | { type: 'add_edge'; edge: CanvasEdge }
  | { type: 'remove_edge'; edgeId: string };

// ============================================================================
// Workflow Execution DTOs
// ============================================================================

export interface RunWorkflowRequest {
  variables?: WorkflowVariable[];
  startNodes?: string[];
}

export interface RunWorkflowResponse {
  runId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startedAt: string;
}

export type WorkflowExecutionStatus = 'init' | 'executing' | 'finish' | 'failed';

export interface WorkflowRunStatus {
  runId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  title: string;
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  nodeStatuses: NodeExecutionStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface NodeExecutionStatus {
  nodeId: string;
  nodeType: string;
  status: string;
  title: string;
  startTime?: string;
  endTime?: string;
  progress: number;
  errorMessage?: string;
}

// ============================================================================
// Node Types & Debug DTOs
// ============================================================================

export interface RunNodeRequest {
  nodeType: string;
  config: Record<string, unknown>;
  input: {
    query?: string;
    context?: unknown[];
    [key: string]: unknown;
  };
}

export interface RunNodeResponse {
  nodeType: string;
  status: 'completed' | 'failed';
  output?: unknown;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  duration?: number;
  error?: string;
}

export interface NodeTypeInfo {
  type: string;
  name: string;
  description: string;
  category: 'core' | 'builtin' | 'installed';
  authorized?: boolean;
  configSchema?: Record<string, unknown>;
  tools?: Array<{
    name: string;
    description: string;
  }>;
}

export interface ListNodeTypesResponse {
  nodeTypes: NodeTypeInfo[];
  total: number;
}

// ============================================================================
// WorkflowPlan DTOs
// ============================================================================

export interface GenerateWorkflowPlanRequest {
  plan: WorkflowPlan;
  sessionId?: string;
}

export interface PatchWorkflowPlanRequest {
  planId: string;
  operations: WorkflowPatchOperation[];
}

export interface GetWorkflowPlanRequest {
  planId: string;
  version?: number;
}

// ============================================================================
// Error Response DTOs
// ============================================================================

export interface CliErrorResponse {
  ok: false;
  type: 'error';
  version: string;
  error: {
    code: string;
    message: string;
    hint?: string;
  };
}

export const CLI_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  NODE_TYPE_NOT_FOUND: 'NODE_TYPE_NOT_FOUND',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;
