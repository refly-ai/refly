/**
 * Helpers for creating structured failure documents that are easy for both
 * humans and LLMs to read. Output includes a JSON-friendly object plus a
 * Markdown string for quick perusal.
 */

export interface ToolFailureDocument {
  error: string;
  timestamp: string;
  toolName?: string;
  inputSnapshot?: unknown;
  context?: Record<string, unknown>;
  runId?: string;
  requestId?: string;
  /**
   * Human-friendly plain text summary (non-technical friendly)
   */
  plainTextSummary: string;
  /**
   * Markdown version for UI/LLM display (includes JSON blocks)
   */
  markdown: string;
}

export interface ToolFailureDocumentOptions {
  toolName?: string;
  error: string;
  input?: unknown;
  context?: Record<string, unknown>;
  runId?: string;
  requestId?: string;
  timestamp?: string;
}

/**
 * Build a failure document with both structured data and a Markdown summary.
 * Avoids throwing; best-effort stringifies inputs.
 */
export function buildToolFailureDocument(options: ToolFailureDocumentOptions): ToolFailureDocument {
  const {
    toolName,
    error,
    input,
    context,
    runId,
    requestId,
    timestamp = new Date().toISOString(),
  } = options;

  const markdownLines = [
    '# Tool Failure',
    '',
    `- tool: ${toolName ?? 'unknown'}`,
    `- error: ${error}`,
    `- timestamp: ${timestamp}`,
    runId ? `- runId: ${runId}` : null,
    requestId ? `- requestId: ${requestId}` : null,
    '',
    '## Input',
    formatAsCodeBlock(input),
    '',
    '## Context',
    formatAsCodeBlock(context),
    '',
    '## JSON (for dev/LLM)',
    formatAsCodeBlock({
      error,
      timestamp,
      toolName,
      inputSnapshot: input,
      context,
      runId,
      requestId,
    }),
  ].filter((line) => line !== null) as string[];

  const plainTextSummary = [
    'Tool Failure',
    `- 工具: ${toolName ?? 'unknown'}`,
    `- 错误: ${error}`,
    `- 时间: ${formatDisplayTime(timestamp)}`,
    runId ? `- Run ID: ${runId}` : null,
    requestId ? `- 请求ID: ${requestId}` : null,
    '',
    '输入:',
    indentLines(safeStringify(input)),
    '',
    '上下文:',
    indentLines(safeStringify(context)),
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    error,
    timestamp,
    toolName,
    inputSnapshot: input,
    context,
    runId,
    requestId,
    plainTextSummary,
    markdown: markdownLines.join('\n'),
  };
}

function formatAsCodeBlock(value: unknown): string {
  return ['```json', safeStringify(value), '```'].join('\n');
}

function safeStringify(value: unknown): string {
  try {
    if (value === undefined) return 'null';
    return JSON.stringify(value, null, 2);
  } catch {
    return '"<unstringifiable>"';
  }
}

function formatDisplayTime(timestamp: string): string {
  try {
    return new Date(timestamp).toISOString().replace('T', ' ').replace('Z', ' UTC');
  } catch {
    return timestamp;
  }
}

function indentLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length ? `  ${line}` : line))
    .join('\n');
}
