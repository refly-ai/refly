/**
 * CLI-specific workflow DTOs
 * These work with the canvas-based workflow system
 */

import {
  CanvasNode,
  CanvasEdge,
  WorkflowVariable,
  WorkflowPlan,
  GenericToolset,
} from '@refly/openapi-schema';
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
  sessionId?: string; // Latest copilot session ID for context continuity
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
  unauthorizedTools?: Array<{
    toolset: GenericToolset;
    referencedNodes: Array<{
      id: string;
      entityId: string;
      title: string;
      type: string;
    }>;
  }>;
  installToolsUrl?: string;
}

export interface WorkflowToolsStatusResponse {
  authorized: boolean;
  unauthorizedTools: Array<{
    toolset: GenericToolset;
    referencedNodes: Array<{
      id: string;
      entityId: string;
      title: string;
      type: string;
    }>;
  }>;
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

// Extended node execution detail for run detail endpoint
export interface NodeExecutionDetail extends NodeExecutionStatus {
  nodeExecutionId?: string;
  resultId?: string; // entityId used as resultId for action results, can be used for abort
  query?: string;
  toolCallsCount?: number;
}

export interface WorkflowRunDetail {
  runId: string;
  workflowId: string;
  title: string;
  status: WorkflowExecutionStatus;
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  nodes: NodeExecutionDetail[];
  errors?: Array<{
    nodeId: string;
    nodeTitle: string;
    errorType: string;
    errorMessage: string;
    timestamp: string;
  }>;
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

export interface PatchWorkflowPlanByCanvasRequest {
  canvasId: string;
  operations: WorkflowPatchOperation[];
}

// ============================================================================
// AI Workflow Generation DTOs (CLI)
// ============================================================================

/**
 * Request to generate a workflow using AI from natural language
 */
export interface GenerateWorkflowCliRequest {
  /** Natural language description of the workflow */
  query: string;
  /** Optional project ID */
  projectId?: string;
  /** Optional canvas ID (if updating existing workflow) */
  canvasId?: string;
  /** Optional model to use for generation */
  modelItemId?: string;
  /** Output language locale */
  locale?: string;
  /** Predefined workflow variables */
  variables?: WorkflowVariable[];
  /** Skip default nodes (start + skillResponse) when creating canvas */
  skipDefaultNodes?: boolean;
  /** Timeout in milliseconds for waiting Copilot completion */
  timeout?: number;
  /** Client-provided session ID for recovery/polling */
  sessionId?: string;
  /** If true, start generation asynchronously and return immediately */
  async?: boolean;
}

/**
 * Response from AI workflow generation
 */
export interface GenerateWorkflowCliResponse {
  /** Workflow/Canvas ID */
  workflowId: string;
  /** Canvas ID (same as workflowId) */
  canvasId: string;
  /** Copilot session ID */
  sessionId: string;
  /** Action result ID */
  resultId: string;
  /** Workflow plan ID (for refine operations) */
  planId: string;
  /** The generated workflow plan */
  workflowPlan: WorkflowPlan;
  /** Number of nodes generated */
  nodesCount: number;
  /** Number of edges generated */
  edgesCount: number;
}

// ============================================================================
// Async Generation DTOs (Polling-based streaming simulation)
// ============================================================================

/**
 * Response when starting async workflow generation
 */
export interface GenerateWorkflowAsyncResponse {
  /** Session ID for polling status */
  sessionId: string;
  /** Canvas ID (created or existing) */
  canvasId: string;
  /** Action result ID for tracking */
  resultId: string;
  /** Initial status */
  status: GenerateWorkflowStatus;
}

/**
 * Status of workflow generation
 */
export type GenerateWorkflowStatus = 'pending' | 'executing' | 'completed' | 'failed';

/**
 * Response from generate-status polling endpoint
 */
export interface GenerateStatusResponse {
  /** Current status */
  status: GenerateWorkflowStatus;
  /** Progress message for display */
  progress?: string;
  /** Current step index (1-based) */
  stepIndex?: number;
  /** Total estimated steps */
  totalSteps?: number;
  /** Error message if failed */
  error?: string;
  /** Completed result (only when status === 'completed') */
  result?: GenerateWorkflowCliResponse;
}

// ============================================================================
// Node Output DTOs
// ============================================================================

/**
 * Tool call summary for node output
 */
export interface NodeOutputToolCall {
  callId: string;
  toolName: string;
  status: string;
  output?: unknown;
}

/**
 * Response for node output endpoint
 */
export interface NodeOutputResponse {
  runId: string;
  workflowId: string;
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  status: 'waiting' | 'executing' | 'finish' | 'failed';
  content?: string;
  contentType?: string;
  outputTokens?: number;
  toolCalls?: NodeOutputToolCall[];
  error?: {
    type: string;
    message: string;
  };
  timing?: {
    startTime?: string;
    endTime?: string;
    durationMs?: number;
  };
}

// ============================================================================
// Edit Workflow with Natural Language DTOs
// ============================================================================

/**
 * Request to edit a workflow using natural language
 */
export interface EditWorkflowCliRequest {
  /** Canvas ID (c-xxx) */
  canvasId: string;
  /** Natural language description of the edit */
  query: string;
  /** Output language locale */
  locale?: string;
  /** Optional model to use for generation */
  modelItemId?: string;
  /** Timeout in milliseconds for waiting Copilot completion */
  timeout?: number;
  /** Optional session ID to use for context continuity */
  sessionId?: string;
}

/**
 * Response from natural language workflow editing
 */
export interface EditWorkflowCliResponse {
  /** Canvas ID */
  canvasId: string;
  /** Workflow plan ID */
  planId: string;
  /** Plan version */
  version: number;
  /** Which tool Copilot used: generate_workflow or patch_workflow */
  toolUsed: 'generate_workflow' | 'patch_workflow';
  /** The resulting workflow plan */
  plan: WorkflowPlan;
  /** Copilot session ID for context continuity */
  sessionId?: string;
}

export const CLI_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  NODE_TYPE_NOT_FOUND: 'NODE_TYPE_NOT_FOUND',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;
