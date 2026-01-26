import { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ToolCallMeta } from '@refly/openapi-schema';
import { SkillRunnableMeta } from '@refly/skill-template';
import { safeParseJSON } from '@refly/utils';
import { writeSSEResponse } from '../../utils/response';
import { MessageAggregator } from '../../utils/message-aggregator';
import { ToolCallService } from '../tool-call/tool-call.service';

/**
 * Context required for PTC polling operations.
 * Contains all dependencies needed to send SSE events and persist messages.
 */
export interface PtcPollerContext {
  /** HTTP Response object for SSE streaming (undefined if no streaming) */
  res: Response | undefined;
  /** Action result ID */
  resultId: string;
  /** Action result version */
  version: number;
  /** Message aggregator for persistence */
  messageAggregator: MessageAggregator;
  /** Getter for current run metadata (dynamic, updated during event loop) */
  getRunMeta: () => SkillRunnableMeta | null;
}

interface PollerState {
  interval: NodeJS.Timeout;
  sentCallIds: Set<string>;
}

/**
 * Manages PTC (Programmatic Tool Call) polling for execute_code tool executions.
 *
 * During execute_code execution, this manager polls the database to discover
 * internal tool calls made from the sandbox, then forwards them as SSE events
 * to provide real-time progress to the user.
 *
 * Lifecycle:
 * 1. Create instance at the start of skill invocation
 * 2. Call start() when execute_code tool starts
 * 3. Call stop() when execute_code tool ends (or errors)
 * 4. Call cleanup() in finally block to ensure all pollers are stopped
 */
export class PtcPollerManager {
  private pollers: Map<string, PollerState> = new Map();
  private readonly pollIntervalMs = 1500;

  constructor(
    private readonly context: PtcPollerContext,
    private readonly toolCallService: ToolCallService,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Start polling for PTC tool calls for a specific execute_code invocation.
   * @param toolCallId - The callId of the execute_code tool
   */
  start(toolCallId: string): void {
    if (this.pollers.has(toolCallId)) {
      return; // Already polling
    }

    const sentCallIds = new Set<string>();
    const interval = setInterval(async () => {
      try {
        const ptcCalls = await this.toolCallService.fetchPtcToolCalls(toolCallId);
        for (const ptcCall of ptcCalls) {
          // Only send completed/failed calls that haven't been sent yet
          if (
            !sentCallIds.has(ptcCall.callId) &&
            (ptcCall.status === 'completed' || ptcCall.status === 'failed')
          ) {
            sentCallIds.add(ptcCall.callId);
            this.sendEvent(ptcCall);
          }
        }
      } catch (error) {
        this.logger.error(`PTC polling error for ${toolCallId}: ${error?.message}`);
      }
    }, this.pollIntervalMs);

    this.pollers.set(toolCallId, { interval, sentCallIds });
    this.logger.debug(`Started PTC polling for execute_code ${toolCallId}`);
  }

  /**
   * Stop polling for a specific execute_code invocation and send any remaining events.
   * @param toolCallId - The callId of the execute_code tool
   */
  async stop(toolCallId: string): Promise<void> {
    const poller = this.pollers.get(toolCallId);
    if (!poller) {
      return;
    }

    clearInterval(poller.interval);
    this.pollers.delete(toolCallId);

    // Final check: send any remaining PTC calls
    try {
      const ptcCalls = await this.toolCallService.fetchPtcToolCalls(toolCallId);
      let newCount = 0;
      for (const ptcCall of ptcCalls) {
        if (
          !poller.sentCallIds.has(ptcCall.callId) &&
          (ptcCall.status === 'completed' || ptcCall.status === 'failed')
        ) {
          poller.sentCallIds.add(ptcCall.callId);
          this.sendEvent(ptcCall);
          newCount++;
        }
      }
      if (newCount > 0) {
        this.logger.debug(`Sent ${newCount} remaining PTC events for execute_code ${toolCallId}`);
      }
    } catch (error) {
      this.logger.error(`Final PTC fetch error for ${toolCallId}: ${error?.message}`);
    }

    this.logger.debug(`Stopped PTC polling for execute_code ${toolCallId}`);
  }

  /**
   * Cleanup all active pollers. Call this in the finally block to ensure
   * no intervals are left running after skill invocation completes.
   */
  cleanup(): void {
    for (const [toolCallId, poller] of this.pollers) {
      clearInterval(poller.interval);
      this.logger.debug(`Cleaned up PTC poller for ${toolCallId} in cleanup()`);
    }
    this.pollers.clear();
  }

  /**
   * Send a PTC tool call event via SSE.
   */
  private sendEvent(
    ptcCall: Awaited<ReturnType<typeof this.toolCallService.fetchPtcToolCalls>>[number],
  ): void {
    const { res, resultId, version, messageAggregator, getRunMeta } = this.context;

    if (!res) {
      return;
    }

    const parsedInput = safeParseJSON(ptcCall.input || '{}') ?? {};
    const parsedOutput = safeParseJSON(ptcCall.output || '{}') ?? {};

    const ptcToolCallMeta: ToolCallMeta = {
      toolName: ptcCall.toolName,
      toolsetId: ptcCall.toolsetId,
      toolsetKey: ptcCall.toolsetId,
      toolCallId: ptcCall.callId,
      status: ptcCall.status === 'failed' ? 'failed' : 'completed',
      startTs: ptcCall.createdAt.getTime(),
      endTs: ptcCall.updatedAt.getTime(),
    };

    const ptcMessageId = messageAggregator.addToolMessage({
      toolCallId: ptcCall.callId,
      toolCallMeta: ptcToolCallMeta,
    });

    const runMeta = getRunMeta();
    const ssePayload = {
      event: ptcCall.status === 'failed' ? 'tool_call_error' : 'tool_call_end',
      isPtc: true,
      resultId,
      version,
      step: runMeta?.step,
      messageId: ptcMessageId,
      toolCallMeta: ptcToolCallMeta,
      toolCallResult: {
        callId: ptcCall.callId,
        toolsetId: ptcCall.toolsetId,
        toolName: ptcCall.toolName,
        stepName: ptcCall.stepName,
        input: parsedInput,
        output: parsedOutput,
        status: ptcCall.status === 'failed' ? 'failed' : 'completed',
        ...(ptcCall.error ? { error: ptcCall.error } : {}),
        createdAt: ptcCall.createdAt.getTime(),
        updatedAt: ptcCall.updatedAt.getTime(),
      },
    };

    writeSSEResponse(res, ssePayload as Parameters<typeof writeSSEResponse>[1]);
  }
}
