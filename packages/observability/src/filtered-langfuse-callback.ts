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
    return super.handleChainStart(
      chain,
      inputs,
      runId,
      parentRunId,
      tags,
      filterMetadata(metadata),
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
    return super.handleToolStart(
      tool,
      input,
      runId,
      parentRunId,
      tags,
      filterMetadata(metadata),
      name,
    );
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
