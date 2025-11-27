import { Injectable, Logger } from '@nestjs/common';
import type { ActionStepMeta } from '@refly/openapi-schema';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { writeSSEResponse } from '../../utils/response';
import { PrismaService } from '../common/prisma.service';
import { ActionStep, ToolCallResult } from '@prisma/client';
export type ToolEventPayload = {
  run_id?: string;
  metadata?: { toolsetKey?: string; name?: string };
  data?: { input?: unknown; output?: unknown; error?: unknown };
};

// Tool call status
export enum ToolCallStatus {
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Injectable()
export class ToolCallService {
  private readonly logger = new Logger(ToolCallService.name);
  private readonly toolCallIdMap = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  private buildToolCallKey(params: {
    resultId: string;
    version: number;
    runId?: string;
    toolsetId: string;
    toolName: string;
  }): string {
    const { resultId, version, runId, toolsetId, toolName } = params;
    if (runId) {
      return `${resultId}:${version}:${runId}`;
    }
    return `${resultId}:${version}:${toolsetId}:${toolName}`;
  }

  getOrCreateToolCallId(params: {
    resultId: string;
    version: number;
    toolName: string;
    toolsetId: string;
    runId?: string;
  }): string {
    const key = this.buildToolCallKey(params);
    const existing = this.toolCallIdMap.get(key);
    if (existing) {
      return existing;
    }
    const generated = this.generateToolCallId(params);
    this.toolCallIdMap.set(key, generated);
    return generated;
  }

  releaseToolCallId(params: {
    resultId: string;
    version: number;
    toolName: string;
    toolsetId: string;
    runId?: string;
  }): void {
    const key = this.buildToolCallKey(params);
    this.toolCallIdMap.delete(key);
  }

  // Generate tool use XML for tool call for frontend rendering and SSE streaming
  generateToolUseXML(params: {
    toolCallId: string;
    includeResult: boolean;
    errorMsg?: string;
    metadata?: { name?: string; type?: string; toolsetKey?: string; toolsetName?: string };
    input?: unknown;
    output?: unknown;
    startTs: number;
    updatedTs: number;
  }): string | null {
    const { toolCallId, includeResult, errorMsg, metadata, input, output, startTs, updatedTs } =
      params;
    const { name, type, toolsetKey, toolsetName } = metadata ?? {};
    if (!toolsetKey) return null;

    const codeBlockWrapper = (content: string) => {
      const body = content.endsWith('\n') ? content : `${content}\n`;
      return `\n\n\`\`\`tool_use\n${body}\`\`\`\n\n`;
    };

    const lines: string[] = [];
    lines.push('<tool_use>');
    lines.push(`<callId>${toolCallId}</callId>`);
    lines.push(`<name>${name ?? ''}</name>`);
    lines.push(`<type>${type ?? ''}</type>`);
    lines.push(`<toolsetKey>${toolsetKey}</toolsetKey>`);
    lines.push(`<toolsetName>${toolsetName ?? ''}</toolsetName>`);
    lines.push('<arguments>');
    lines.push(input ? (typeof input === 'string' ? input : JSON.stringify(input)) : '');
    lines.push('</arguments>');
    lines.push(`<createdAt>${startTs}</createdAt>`);

    if (errorMsg) {
      lines.push(
        `<result>${output ? (typeof output === 'string' ? output : JSON.stringify(output)) : ''}</result>`,
      );
      lines.push(
        `<error>${errorMsg ? (typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)) : ''}</error>`,
      );
      lines.push(`<status>${ToolCallStatus.FAILED}</status>`);
      lines.push(`<updatedAt>${updatedTs}</updatedAt>`);
    } else if (includeResult) {
      lines.push(
        `<result>${output ? (typeof output === 'string' ? output : JSON.stringify(output)) : ''}</result>`,
      );
      lines.push(`<status>${ToolCallStatus.COMPLETED}</status>`);
      lines.push(`<updatedAt>${updatedTs}</updatedAt>`);
    } else {
      lines.push(`<status>${ToolCallStatus.EXECUTING}</status>`);
    }

    lines.push('</tool_use>');
    return codeBlockWrapper(lines.join('\n'));
  }

  // Emit tool use stream to the client
  emitToolUseStream(
    res: Response | undefined,
    args: {
      resultId: string;
      step?: ActionStepMeta;
      xmlContent: string;
      toolCallId: string;
      toolName?: string;
      event_name: 'stream';
    },
  ): void {
    if (!res) {
      return;
    }
    const { resultId, step, xmlContent, toolCallId, toolName } = args;
    writeSSEResponse(res, {
      event: args.event_name,
      resultId,
      content: xmlContent,
      step,
      structuredData: {
        toolCallId,
        name: toolName ?? '',
      },
    });
  }

  // Persist and emit tool call event to the database and SSE streaming
  async persistToolCallResult(
    _res: Response | undefined,
    userUid: string,
    ids: { resultId: string; version: number },
    toolsetId: string,
    toolName: string,
    input: string | undefined,
    output: string | undefined,
    status: ToolCallStatus,
    callId: string,
    stepName: string,
    createdAt: number,
    updatedAt: number,
    errorMessage: string,
  ): Promise<void> {
    await this.persistToolCall(ids, {
      callId,
      uid: userUid,
      toolsetId,
      toolName,
      stepName,
      input: input,
      output: output,
      error: errorMessage,
      status,
      createdAt: createdAt,
      updatedAt: updatedAt,
    });
  }

  async fetchToolCalls(resultId: string, version: number) {
    return this.prisma.toolCallResult.findMany({
      where: {
        resultId,
        version,
        deletedAt: null,
      },
      orderBy: { pk: 'asc' },
    });
  }

  /**
   * Build consolidated tool call history entries grouped by step name for a given result.
   * Only final tool call results are returned to avoid duplicating streaming fragments.
   */
  async fetchConsolidatedToolUseOutputByStep(
    resultId: string,
    version: number,
  ): Promise<Map<string, ToolCallResult[]>> {
    const toolCalls = await this.fetchToolCalls(resultId, version);

    const byStep = new Map<string, ToolCallResult[]>();

    for (const call of toolCalls ?? []) {
      const stepName = call?.stepName ?? '';
      if (!stepName) {
        continue;
      }

      if (call?.status === ToolCallStatus.EXECUTING) {
        continue;
      }
      const list = byStep.get(stepName) ?? [];
      list.push(call);
      byStep.set(stepName, list);
    }

    return byStep;
  }

  /**
   * Attach tool calls to steps and merge XML content
   * This method combines grouping and content merging in one operation:
   * 1. Groups tool calls by step name (with fallback to last step)
   * 2. Generates XML content for each tool call
   * 3. Merges XML content into step.content
   *
   * @param steps - Array of steps with name and optional content
   * @param toolCalls - Array of tool calls with optional stepName
   * @returns Steps with attached tool calls and merged XML content
   */
  attachToolCallsToSteps(steps: ActionStep[], toolCalls: ToolCallResult[]): Array<ActionStep> {
    if (!steps || steps.length === 0) {
      return [];
    }

    // Step 1: Group tool calls by step name
    const existingStepNames = new Set(steps.map((s) => s.name));
    const fallbackStepName = steps.length > 0 ? steps[steps.length - 1].name : undefined;

    const toolCallsByStep = toolCalls.reduce<Map<string, ToolCallResult[]>>((acc, call) => {
      let key = call.stepName;
      if (!key || !existingStepNames.has(key)) {
        key = fallbackStepName;
      }
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key)!.push(call);
      return acc;
    }, new Map());

    // Step 2: Attach tool calls to each step and merge XML content
    return steps.map((step) => {
      const toolCalls = toolCallsByStep.get(step.name);
      const calls = Array.isArray(toolCalls) ? toolCalls : [];

      // Generate XML content for all tool calls
      const xmlContents = calls
        .map((call) => {
          if (!call || typeof call !== 'object' || !call?.callId) {
            return null;
          }
          return this.generateToolUseXML({
            toolCallId: call.callId,
            includeResult: call?.status !== ToolCallStatus.EXECUTING,
            errorMsg: call.error,
            metadata: {
              name: call.toolName,
              type: call.toolsetId,
              toolsetKey: call.toolsetId,
              // Note: toolsetName is not stored in ToolCallResult DB table
              // Using toolsetId as fallback. For accurate toolset names, consider:
              // 1. Adding toolsetName column to ToolCallResult table, OR
              // 2. Fetching from Toolset table using toolsetId
              toolsetName: call.toolsetId,
            },
            input: call.input,
            output: call.output,
            startTs: call.createdAt.getTime(),
            updatedTs: call.updatedAt.getTime() ?? call.createdAt.getTime(),
          });
        })
        .filter((xml) => xml !== null);

      // Merge XML content into step.content
      const stepContent = step.content ?? '';
      const toolCallContent = xmlContents.length > 0 ? xmlContents.join('\n') : '';
      const mergedContent =
        stepContent && toolCallContent
          ? `${toolCallContent}\n${stepContent}`
          : toolCallContent || stepContent || '';

      return {
        ...step,
        toolCalls: calls,
        content: mergedContent,
      };
    });
  }

  generateToolCallId(params: {
    resultId: string;
    version: number;
    toolName: string;
    toolsetId: string;
  }): string {
    const prefix = `${params.resultId}:${params.version}:${params.toolsetId ?? 'toolset'}:${params.toolName ?? 'tool'}`;
    return `${prefix}:${randomUUID()}`;
  }

  private async persistToolCall(
    ids: { resultId: string; version: number },
    data: {
      callId: string;
      uid?: string;
      toolsetId: string;
      toolName: string;
      stepName?: string;
      input?: string;
      output?: string;
      error?: string;
      status: ToolCallStatus;
      createdAt: number;
      updatedAt: number;
      deletedAt?: number;
    },
  ): Promise<void> {
    const toJSONStr = (value: unknown): string => {
      if (value === undefined || value === null) return undefined;
      try {
        return typeof value === 'string' ? value : JSON.stringify(value);
      } catch {
        return '';
      }
    };

    const toDateOrNull = (ts?: number): Date | null => {
      return typeof ts === 'number' ? new Date(ts) : null;
    };

    await this.prisma.toolCallResult.upsert({
      where: { callId: data.callId },
      create: {
        resultId: ids.resultId,
        version: ids.version,
        callId: data.callId,
        uid: data.uid ?? '',
        toolsetId: data.toolsetId ?? '',
        toolName: data.toolName ?? '',
        stepName: data.stepName ?? undefined,
        // ensure non-null columns always receive a string
        input: data.input !== undefined ? toJSONStr(data.input) : '',
        output: data.output !== undefined ? toJSONStr(data.output) : '',
        status: data.status ?? ToolCallStatus.EXECUTING,
        error: data.error ?? undefined,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        deletedAt: toDateOrNull(data.deletedAt),
      },
      update: {
        resultId: ids.resultId,
        version: ids.version,
        uid: data.uid ?? '',
        toolsetId: data.toolsetId ?? '',
        toolName: data.toolName ?? '',
        stepName: data.stepName ?? undefined,
        // only overwrite when a new value is provided
        ...(data.input !== undefined ? { input: toJSONStr(data.input) } : {}),
        ...(data.output !== undefined ? { output: toJSONStr(data.output) } : {}),
        status: data.status ?? ToolCallStatus.EXECUTING,
        error: data.error ?? undefined,
        updatedAt: new Date(data.updatedAt),
        deletedAt: toDateOrNull(data.deletedAt),
      },
    });
  }
}
