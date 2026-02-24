export interface EvalRunRequest {
  input: string;
  modelItemId?: string;
  ptcEnabled?: boolean;
  skillName?: string; // default "commonQnA"
  mode?: 'node_agent' | 'copilot_agent';
  /** Toolsets to mount for this run (matching ActionResult.toolsets format) */
  toolsets?: Array<{ type: string; id: string; name: string; builtin?: boolean }>;
  toolBehaviors?: Record<string, { enabled: boolean; mock?: boolean; mockResponse?: unknown }>;
  evalRunId?: string;
  evalTags?: string[];
  baselineTraceId?: string;
  timeout?: number;
  config?: Record<string, unknown>;
  /** Canvas ID to restore as target for this eval run */
  canvasId?: string;
  /** Canvas version to restore; if omitted, inferred by timestamp */
  canvasVersion?: string;
  /** Replace entire system prompt for this eval run */
  systemPromptOverride?: string;
  /** Append to the default system prompt */
  systemPromptAppend?: string;
  /** Override specific tool descriptions by tool name (key = tool short name or full name) */
  toolDescriptionOverrides?: Record<string, string>;
}

export interface EvalRunResponse {
  traceId: string;
  resultId: string;
  metrics: EvalMetrics;
  output: string;
  status: 'completed' | 'failed' | 'timeout';
  error?: string;
}

export interface EvalMetrics {
  turns: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
  toolCalls: Array<{
    name: string;
    count: number;
    totalTimeMs: number;
    mocked: boolean;
    successCount: number;
    failureCount: number;
  }>;
}

export interface EvalContext {
  isEval: true;
  evalRunId?: string;
  evalTags?: string[];
  baselineTraceId?: string;
  toolBehaviors?: Record<string, { enabled: boolean; mock?: boolean; mockResponse?: unknown }>;
  /** Replace entire system prompt for this eval run */
  systemPromptOverride?: string;
  /** Append to the default system prompt */
  systemPromptAppend?: string;
  /** Override specific tool descriptions by tool name */
  toolDescriptionOverrides?: Record<string, string>;
}
