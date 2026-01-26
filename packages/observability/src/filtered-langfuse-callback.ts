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

type Metadata = Record<string, unknown>;

type ToolInputData = {
  toolInput?: string;
  toolParameters?: unknown;
};

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

function isRecord(value: unknown): value is Metadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Metadata | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumberLike(record: Metadata | undefined, key: string): number | undefined {
  const value = record?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readRecord(record: Metadata | undefined, key: string): Metadata | undefined {
  const value = record?.[key];
  return isRecord(value) ? value : undefined;
}

function pickFirstString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

function compactMetadata(metadata?: Metadata): Metadata | undefined {
  if (!metadata) return undefined;

  const compact: Metadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      compact[key] = value;
    }
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function mergeMetadata(base?: Metadata, extra?: Metadata): Metadata | undefined {
  if (!base && !extra) return undefined;

  const merged: Metadata = {};
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

function extractToolInput(input?: string): ToolInputData {
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

/**
 * Filter internal metadata keys from LangChain/LangGraph
 */
function filterMetadata(metadata?: Metadata): Metadata | undefined {
  if (!metadata) return undefined;

  const filtered: Metadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!FILTERED_METADATA_KEYS.has(key)) {
      filtered[key] = value;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function buildChainMetadata(
  inputs: ChainValues,
  runId: string,
  parentRunId?: string,
  metadata?: Metadata,
  runType?: string,
): Metadata {
  const meta = metadata ?? {};
  const inputRecord = isRecord(inputs) ? inputs : undefined;
  const inputNested = readRecord(inputRecord, 'input');
  const queryFromInputs = pickFirstString(
    readString(inputRecord, 'query'),
    readString(inputNested, 'query'),
  );
  const originalQueryFromInputs = pickFirstString(
    readString(inputRecord, 'originalQuery'),
    readString(inputNested, 'originalQuery'),
  );

  return (
    compactMetadata({
      runId,
      parentRunId,
      runType: pickFirstString(runType, readString(meta, 'runType'), readString(meta, 'run_type')),
      query: pickFirstString(queryFromInputs, readString(meta, 'query')),
      originalQuery: pickFirstString(originalQueryFromInputs, readString(meta, 'originalQuery')),
    }) ?? {}
  );
}

function buildToolMetadata(
  tool: Serialized,
  input: string,
  runId: string,
  parentRunId?: string,
  metadata?: Metadata,
  name?: string,
): Metadata {
  const toolRecord = isRecord(tool) ? tool : undefined;
  const meta = metadata ?? {};
  const { toolInput, toolParameters } = extractToolInput(input);

  const toolsetMeta = readRecord(meta, 'toolset');
  const currentSkillMeta = readRecord(meta, 'currentSkill');
  const skillMeta = readRecord(meta, 'skill');
  const modelInfoMeta = readRecord(meta, 'modelInfo');
  const modelMeta = readRecord(meta, 'model');

  const toolName = pickFirstString(
    readString(meta, 'toolName'),
    readString(meta, 'name'),
    readString(toolRecord, 'name'),
    name,
  );
  const toolsetKey = pickFirstString(
    readString(meta, 'toolsetKey'),
    readString(meta, 'toolsetId'),
    readString(toolsetMeta, 'key'),
  );
  const toolsetName = pickFirstString(
    readString(meta, 'toolsetName'),
    readString(toolsetMeta, 'name'),
  );
  const skillName = pickFirstString(
    readString(meta, 'skillName'),
    readString(currentSkillMeta, 'name'),
    readString(skillMeta, 'name'),
  );
  const nodeType = pickFirstString(readString(meta, 'nodeType'), readString(meta, 'node_type'));
  const workflowType = pickFirstString(
    readString(meta, 'workflowType'),
    readString(meta, 'workflow_type'),
  );
  const query = pickFirstString(readString(meta, 'query'));
  const originalQuery = pickFirstString(
    readString(meta, 'originalQuery'),
    readString(meta, 'original_query'),
  );
  const locale = pickFirstString(readString(meta, 'locale'), readString(meta, 'uiLocale'));

  const modelName = pickFirstString(
    readString(meta, 'modelName'),
    readString(modelMeta, 'name'),
    readString(meta, 'model'),
    readString(modelInfoMeta, 'name'),
  );
  const modelItemId = pickFirstString(
    readString(meta, 'modelItemId'),
    readString(meta, 'providerItemId'),
    readString(modelInfoMeta, 'providerItemId'),
  );
  const providerKey = pickFirstString(
    readString(meta, 'providerKey'),
    readString(meta, 'provider'),
    readString(modelInfoMeta, 'provider'),
  );
  const providerId = pickFirstString(readString(meta, 'providerId'));
  const promptVersion = pickFirstString(
    readString(meta, 'promptVersion'),
    readString(meta, 'prompt_version'),
  );
  const schemaVersion = pickFirstString(
    readString(meta, 'schemaVersion'),
    readString(meta, 'schema_version'),
    readString(toolRecord, 'schemaVersion'),
    readString(readRecord(toolRecord, 'schema'), 'version'),
  );
  const traceId = pickFirstString(readString(meta, 'traceId'), readString(meta, 'trace_id'));
  const runType = 'tool';
  const status = pickFirstString(readString(meta, 'status'));
  const errorType = pickFirstString(readString(meta, 'errorType'), readString(meta, 'error_type'));
  const retryCount = pickFirstString(
    readNumberLike(meta, 'retryCount')?.toString(),
    readNumberLike(meta, 'retry_count')?.toString(),
  );
  const startTime = new Date().toISOString();

  const resultId = pickFirstString(readString(meta, 'resultId'), readString(meta, 'result_id'));
  const resultVersion = pickFirstString(
    readString(meta, 'resultVersion'),
    readString(meta, 'version'),
    readString(meta, 'result_version'),
  );
  const callId = pickFirstString(readString(meta, 'callId'), readString(meta, 'toolCallId'), runId);
  const toolCallId = pickFirstString(readString(meta, 'toolCallId'), callId);

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
    metadata?: Metadata,
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
    extraParams?: Metadata,
    tags?: string[],
    metadata?: Metadata,
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
    extraParams?: Metadata,
    tags?: string[],
    metadata?: Metadata,
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
    extraParams?: Metadata,
    tags?: string[],
    metadata?: Metadata,
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
    metadata?: Metadata,
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
    metadata?: Metadata,
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
