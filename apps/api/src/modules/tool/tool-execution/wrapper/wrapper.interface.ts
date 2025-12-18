/**
 * Tool Wrapper Factory Interface
 *
 * Simple interface for wrapping LangChain tools with post-processing.
 */

import type { StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Tool Wrapper Factory Interface
 *
 * Provides invoke method to execute a tool with post-processing applied to result.
 */
export interface IToolWrapperFactory {
  /**
   * Execute a tool and apply post-processing to the result.
   *
   * @param tool - The tool to execute
   * @param input - Input to pass to the tool
   * @param config - Optional runnable config
   * @returns Processed result with content and status
   */
  invoke(
    tool: StructuredToolInterface,
    input: unknown,
    config?: RunnableConfig,
  ): Promise<{ content: string; status: 'success' | 'error'; creditCost: number }>;
}
