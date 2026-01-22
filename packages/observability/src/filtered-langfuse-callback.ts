/**
 * Filtered Langfuse CallbackHandler that removes internal LangGraph/LangChain metadata
 *
 * These internal fields are automatically injected by LangGraph/LangChain SDK and
 * duplicate information already available in Langfuse's top-level fields or are
 * not useful for trace analysis.
 */

import { CallbackHandler } from '@langfuse/langchain';
import type { Serialized } from '@langchain/core/load/serializable';
import type { ChainValues } from '@langchain/core/utils/types';
import type { BaseMessage } from '@langchain/core/messages';

// Metadata keys to filter out
const FILTERED_METADATA_KEYS = new Set([
  // LangGraph internal state (not useful for trace analysis)
  'langgraph_step',
  'langgraph_node',
  'langgraph_triggers',
  'langgraph_path',
  'langgraph_checkpoint_ns',
  '__pregel_resuming',
  '__pregel_task_id',
  'checkpoint_ns',
  // LangChain/LangSmith auto-injected (duplicates top-level fields)
  'ls_provider',
  'ls_model_name',
  'ls_model_type',
  'ls_temperature',
  'ls_max_tokens',
]);

/**
 * Filter internal metadata keys from LangChain/LangGraph
 */
function filterMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!FILTERED_METADATA_KEYS.has(key)) {
      filtered[key] = value;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function compactMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      compact[key] = value;
    }
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function mergeMetadata(
  base?: Record<string, unknown>,
  extra?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!base && !extra) return undefined;

  const merged: Record<string, unknown> = {};
  if (base) {
    for (const [key, value] of Object.entries(base)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function safeJsonParse(input: string): unknown | undefined {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function extractToolInput(input?: string): { toolInput?: string; toolParameters?: unknown } {
  const toolInput = input?.trim() ? input : undefined;
  if (!toolInput) {
    return {};
  }

  const trimmed = toolInput.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = safeJsonParse(trimmed);
    if (parsed !== undefined) {
      return { toolInput, toolParameters: parsed };
    }
  }

  return { toolInput };
}

function buildChainMetadata(
  inputs: ChainValues,
  runId: string,
  parentRunId?: string,
  metadata?: Record<string, unknown>,
  runType?: string,
): Record<string, unknown> {
  const meta = metadata ?? {};
  const inputRecord = inputs as Record<string, unknown>;
  const queryFromInputs = (inputRecord as any)?.query ?? (inputRecord as any)?.input?.query;
  const originalQueryFromInputs =
    (inputRecord as any)?.originalQuery ?? (inputRecord as any)?.input?.originalQuery;

  return (
    compactMetadata({
      runId,
      parentRunId,
      runType: runType ?? (meta as any).runType ?? (meta as any).run_type,
      query: queryFromInputs ?? (meta as any).query,
      originalQuery: originalQueryFromInputs ?? (meta as any).originalQuery,
    }) ?? {}
  );
}

function buildToolMetadata(
  tool: Serialized,
  input: string,
  runId: string,
  parentRunId?: string,
  metadata?: Record<string, unknown>,
  name?: string,
): Record<string, unknown> {
  const toolRecord = tool as unknown as Record<string, unknown>;
  const meta = metadata ?? {};
  const { toolInput, toolParameters } = extractToolInput(input);

  const toolName = (meta as any).toolName ?? (meta as any).name ?? (toolRecord as any).name ?? name;
  const toolsetKey =
    (meta as any).toolsetKey ?? (meta as any).toolsetId ?? (meta as any).toolset?.key;
  const toolsetName = (meta as any).toolsetName ?? (meta as any).toolset?.name;
  const skillName =
    (meta as any).skillName ?? (meta as any).currentSkill?.name ?? (meta as any).skill?.name;
  const nodeType = (meta as any).nodeType ?? (meta as any).node_type;
  const workflowType = (meta as any).workflowType ?? (meta as any).workflow_type;
  const query = (meta as any).query;
  const originalQuery = (meta as any).originalQuery ?? (meta as any).original_query;
  const locale = (meta as any).locale ?? (meta as any).uiLocale;
  const modelName =
    (meta as any).modelName ??
    (meta as any).model?.name ??
    (meta as any).model ??
    (meta as any).modelInfo?.name;
  const modelItemId =
    (meta as any).modelItemId ??
    (meta as any).providerItemId ??
    (meta as any).modelInfo?.providerItemId;
  const providerKey =
    (meta as any).providerKey ?? (meta as any).provider ?? (meta as any).modelInfo?.provider;
  const providerId = (meta as any).providerId;
  const promptVersion = (meta as any).promptVersion ?? (meta as any).prompt_version;
  const schemaVersion =
    (meta as any).schemaVersion ??
    (meta as any).schema_version ??
    (toolRecord as any).schemaVersion ??
    (toolRecord as any).schema?.version;
  const traceId = (meta as any).traceId ?? (meta as any).trace_id;
  const runType = 'tool';
  const status = (meta as any).status;
  const errorType = (meta as any).errorType ?? (meta as any).error_type;
  const retryCount = (meta as any).retryCount ?? (meta as any).retry_count;
  const startTime = new Date().toISOString();

  const resultId = (meta as any).resultId ?? (meta as any).result_id;
  const resultVersion =
    (meta as any).resultVersion ?? (meta as any).version ?? (meta as any).result_version;
  const callId = (meta as any).callId ?? (meta as any).toolCallId ?? runId;
  const toolCallId = (meta as any).toolCallId ?? callId;

  return (
    compactMetadata({
      callId,
      toolCallId,
      runId,
      parentRunId,
      runType,
      traceId,
      toolName,
      toolsetKey,
      toolsetName,
      skillName,
      nodeType,
      workflowType,
      query,
      originalQuery,
      locale,
      modelName,
      modelItemId,
      providerKey,
      providerId,
      promptVersion,
      schemaVersion,
      resultId,
      resultVersion,
      status,
      errorType,
      retryCount,
      startTime,
      toolInput,
      toolParameters,
    }) ?? {}
  );
}

/**
 * Langfuse CallbackHandler with filtered metadata
 *
 * Extends the official @langfuse/langchain CallbackHandler to filter out
 * internal LangGraph/LangChain metadata fields before they are sent to Langfuse.
 */
export class FilteredLangfuseCallbackHandler extends CallbackHandler {
  // Override handleChainStart to filter metadata
  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runType?: string,
    name?: string,
  ): Promise<void> {
    const filteredMetadata = filterMetadata(metadata);
    const enrichedMetadata = mergeMetadata(
      filteredMetadata,
      buildChainMetadata(inputs, runId, parentRunId, filteredMetadata, runType),
    );

    return super.handleChainStart(
      chain,
      inputs,
      runId,
      parentRunId,
      tags,
      enrichedMetadata,
      runType,
      name,
    );
  }

  // Override handleGenerationStart to filter metadata
  async handleGenerationStart(
    llm: Serialized,
    messages: any[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    return super.handleGenerationStart(
      llm,
      messages,
      runId,
      parentRunId,
      extraParams,
      tags,
      filterMetadata(metadata),
      name,
    );
  }

  // Override handleChatModelStart to filter metadata
  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    return super.handleChatModelStart(
      llm,
      messages,
      runId,
      parentRunId,
      extraParams,
      tags,
      filterMetadata(metadata),
      name,
    );
  }

  // Override handleLLMStart to filter metadata
  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    return super.handleLLMStart(
      llm,
      prompts,
      runId,
      parentRunId,
      extraParams,
      tags,
      filterMetadata(metadata),
      name,
    );
  }

  // Override handleToolStart to filter metadata
  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    const filteredMetadata = filterMetadata(metadata);
    const enrichedMetadata = mergeMetadata(
      filteredMetadata,
      buildToolMetadata(tool, input, runId, parentRunId, filteredMetadata, name),
    );

    return super.handleToolStart(tool, input, runId, parentRunId, tags, enrichedMetadata, name);
  }

  // Override handleRetrieverStart to filter metadata
  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string,
  ): Promise<void> {
    return super.handleRetrieverStart(
      retriever,
      query,
      runId,
      parentRunId,
      tags,
      filterMetadata(metadata),
      name,
    );
  }
}
