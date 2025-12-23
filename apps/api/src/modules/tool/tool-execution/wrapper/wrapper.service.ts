/**
 * Tool Wrapper Factory Service
 *
 * Simple factory for wrapping LangChain tools with post-processing.
 * Provides invoke() method for tool execution with automatic result processing.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { ZodError } from 'zod';
import type {
  ToolType,
  IToolPostHandler,
  PostHandlerContext,
} from '../post-execution/post.interface';
import type { IToolWrapperFactory } from './wrapper.interface';
import { ComposioToolPostHandlerService } from '../post-execution/composio-post.service';
import { RegularToolPostHandlerService } from '../post-execution/regular-post.service';

/**
 * Tool Wrapper Factory Service
 *
 * NestJS injectable service for wrapping LangChain tools with post-processing.
 * Implements invoke interface for tool execution.
 * Selects appropriate post-handler based on tool type.
 */
@Injectable()
export class ToolWrapperFactoryService implements IToolWrapperFactory {
  private readonly logger = new Logger(ToolWrapperFactoryService.name);

  constructor(
    private readonly regularPostHandler: RegularToolPostHandlerService,
    private readonly composioPostHandler: ComposioToolPostHandlerService,
  ) {}

  /**
   * Get the appropriate post-handler based on tool type
   *
   * Tool types from @refly/agent-tools:
   * - composio, external_api, external_oauth: Use Composio post-handler (billing + search compression)
   * - builtin, regular, dynamic, mcp, config_based: Use Regular post-handler
   */
  private getPostHandler(toolType: ToolType): IToolPostHandler {
    switch (toolType) {
      case 'composio':
      case 'external_api':
      case 'external_oauth':
        return this.composioPostHandler;

      default:
        // builtin, regular, dynamic, mcp, config_based
        return this.regularPostHandler;
    }
  }

  /**
   * Execute a tool and apply post-processing to the result.
   * Convenience method that wraps and invokes in one call.
   *
   * @param tool - The tool to execute
   * @param input - Input to pass to the tool
   * @param config - Runnable config containing user, canvasId, resultId, version
   * @returns Processed result with content and status
   */
  async invoke(
    tool: StructuredToolInterface,
    input: unknown,
    config: RunnableConfig,
  ): Promise<{ content: string; status: 'success' | 'error'; creditCost: number }> {
    const toolAny = tool as any;
    const toolsetKey: string = toolAny.toolsetKey ?? 'unknown';
    const toolType: ToolType = toolAny.toolType ?? 'regular';
    const toolName = tool.name;

    let rawResult: unknown;
    try {
      rawResult = await tool.invoke(input, config);
    } catch (error) {
      const message =
        error instanceof ZodError
          ? error.message || 'Invalid tool input'
          : (error as Error)?.message || String(error ?? 'Unknown tool error');
      this.logger.error('Tool invocation failed', {
        toolName,
        toolsetKey,
        error: message,
      });
      return {
        content: JSON.stringify({ status: 'error', error: message, summary: message }, null, 2),
        status: 'error',
        creditCost: 0,
      };
    }

    // Extract creditCost from raw result before post-processing
    const creditCost = (rawResult as any)?.creditCost ?? 0;

    // Build context from config.configurable
    const configurable = config?.configurable as Record<string, unknown> | undefined;
    const context: PostHandlerContext = {
      user: configurable?.user as PostHandlerContext['user'],
      canvasId: configurable?.canvasId as string,
      resultId: configurable?.resultId as string,
      resultVersion: configurable?.version as number,
    };

    const postHandler = this.getPostHandler(toolType);

    try {
      const processed = await postHandler.process({
        toolName,
        toolsetKey,
        rawResult,
        context,
      });

      return {
        content: processed.content,
        status: processed.success ? 'success' : 'error',
        creditCost,
      };
    } catch (error) {
      // Return raw result if post-processing fails
      this.logger.error('Post-handler failed in invoke(), returning raw result', {
        toolName,
        toolsetKey,
        error: (error as Error)?.message,
      });

      return {
        content:
          typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? {}, null, 2),
        status: 'success',
        creditCost,
      };
    }
  }
}
