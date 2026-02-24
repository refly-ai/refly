import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { SkillService } from '../skill/skill.service';
import { SkillInvokerService } from '../skill/skill-invoker.service';
import { EvalRunRequest, EvalRunResponse, EvalMetrics, EvalContext } from './eval.types';
import { safeParseJSON, genCanvasID, genCanvasVersionId } from '@refly/utils';
import { Readable } from 'node:stream';

@Injectable()
export class EvalService {
  private readonly logger = new Logger(EvalService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(OSS_INTERNAL) private readonly oss: ObjectStorageService,
    private readonly skillService: SkillService,
    private readonly skillInvokerService: SkillInvokerService,
  ) {}

  async run(request: EvalRunRequest): Promise<EvalRunResponse> {
    const startTime = Date.now();

    // 1. Look up the eval user
    const evalUserId = this.configService.get<string>('eval.userId');
    if (!evalUserId) {
      throw new Error('EVAL_USER_ID not configured');
    }

    const evalUser = await this.prisma.user.findUnique({
      where: { uid: evalUserId },
    });
    if (!evalUser) {
      throw new NotFoundException(`Eval user not found: ${evalUserId}`);
    }

    const user: User = {
      uid: evalUser.uid,
      email: evalUser.email,
    };

    // 2. Set up eval canvas if canvasId provided
    let evalCanvasId: string | undefined;
    if (request.canvasId) {
      evalCanvasId = await this.setupEvalCanvas(request, user);
      if (evalCanvasId) {
        this.logger.log(`Eval canvas created: ${evalCanvasId} (from ${request.canvasId})`);
      } else {
        this.logger.warn(
          `Failed to set up eval canvas for ${request.canvasId}, proceeding without canvas`,
        );
      }
    }

    // 3. Build InvokeSkillRequest
    const skillRequest = {
      input: { query: request.input },
      skillName: request.skillName || 'commonQnA',
      mode: request.mode || 'node_agent',
      modelItemId: request.modelItemId,
      ...(request.toolsets ? { toolsets: request.toolsets } : {}),
      ...(evalCanvasId ? { target: { entityType: 'canvas', entityId: evalCanvasId } } : {}),
    } as any;

    // 4. Build eval context to attach to job data
    const evalContext: EvalContext = {
      isEval: true,
      evalRunId: request.evalRunId,
      evalTags: request.evalTags,
      baselineTraceId: request.baselineTraceId,
      toolBehaviors: request.toolBehaviors,
      systemPromptOverride: request.systemPromptOverride,
      systemPromptAppend: request.systemPromptAppend,
      toolDescriptionOverrides: request.toolDescriptionOverrides,
    };

    try {
      // 5. Pre-check: creates ActionResult, resolves model routing
      const jobData = await this.skillService.skillInvokePreCheck(user, skillRequest);

      // 6. Attach __evalContext as hidden property
      (jobData as any).__evalContext = evalContext;

      // 7. Override PTC if specified
      if (request.ptcEnabled !== undefined) {
        (jobData as any).__ptcOverride = request.ptcEnabled;
      }

      // 8. Execute skill (non-streaming: no `res` parameter)
      const timeoutMs = request.timeout || 5 * 60 * 1000; // default 5 minutes
      await Promise.race([
        this.skillInvokerService.streamInvokeSkill(user, jobData),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('EVAL_TIMEOUT')), timeoutMs),
        ),
      ]);

      // 9. Read results from DB
      const { resultId, version } = jobData.result;
      const actionResult = await this.prisma.actionResult.findFirst({
        where: { resultId, version },
      });

      if (!actionResult) {
        return {
          traceId: '',
          resultId,
          metrics: this.emptyMetrics(Date.now() - startTime),
          output: '',
          status: 'failed',
          error: 'ActionResult not found after execution',
        };
      }

      // 10. Read action steps for metrics
      const actionSteps = await this.prisma.actionStep.findMany({
        where: { resultId, version },
        orderBy: { order: 'asc' },
      });

      // 11. Read action messages for output and token usage
      const actionMessages = await this.prisma.actionMessage.findMany({
        where: { resultId, version },
        orderBy: { createdAt: 'asc' },
      });

      // 12. Build metrics
      const metrics = this.buildMetrics(actionSteps, actionMessages, Date.now() - startTime);

      // 13. Extract final output
      const output = this.extractOutput(actionSteps, actionMessages);

      const status = actionResult.status === 'finish' ? 'completed' : 'failed';

      return {
        traceId: resultId, // traceId from Langfuse is correlated via resultId
        resultId,
        metrics,
        output,
        status,
        error:
          status === 'failed'
            ? safeParseJSON(actionResult.errors)?.[0] || actionResult.errorType || 'unknown error'
            : undefined,
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;

      if (err.message === 'EVAL_TIMEOUT') {
        this.logger.warn(`Eval run timed out after ${executionTimeMs}ms`);
        return {
          traceId: '',
          resultId: '',
          metrics: this.emptyMetrics(executionTimeMs),
          output: '',
          status: 'timeout',
          error: `Eval timed out after ${request.timeout || 300000}ms`,
        };
      }

      this.logger.error(`Eval run failed: ${err.stack}`);
      return {
        traceId: '',
        resultId: '',
        metrics: this.emptyMetrics(executionTimeMs),
        output: '',
        status: 'failed',
        error: err.message,
      };
    }
  }

  private buildMetrics(steps: any[], messages: any[], executionTimeMs: number): EvalMetrics {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Collect token usage from messages
    for (const msg of messages) {
      const usage = safeParseJSON(msg.usageMeta);
      if (usage) {
        totalInputTokens += usage.inputTokens || usage.promptTokens || 0;
        totalOutputTokens += usage.outputTokens || usage.completionTokens || 0;
      }
    }

    // Collect token usage from steps
    for (const step of steps) {
      const tokenUsage = safeParseJSON(step.tokenUsage);
      if (Array.isArray(tokenUsage)) {
        for (const item of tokenUsage) {
          totalInputTokens += item.inputTokens || 0;
          totalOutputTokens += item.outputTokens || 0;
        }
      }
    }

    // Count tool calls from messages
    const toolCallMap = new Map<
      string,
      {
        count: number;
        totalTimeMs: number;
        mocked: boolean;
        successCount: number;
        failureCount: number;
      }
    >();
    for (const msg of messages) {
      if (msg.type === 'tool') {
        const toolName = msg.toolCallMeta
          ? safeParseJSON(msg.toolCallMeta)?.toolName || 'unknown'
          : 'unknown';
        const existing = toolCallMap.get(toolName) || {
          count: 0,
          totalTimeMs: 0,
          mocked: false,
          successCount: 0,
          failureCount: 0,
        };
        existing.count++;

        // Parse tool message content to extract status
        const content = safeParseJSON(msg.content);
        if (content?.status === 'success') {
          existing.successCount++;
        } else if (content?.status === 'error') {
          existing.failureCount++;
        }

        toolCallMap.set(toolName, existing);
      }
    }

    return {
      turns: steps.length,
      totalTokens: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      executionTimeMs,
      toolCalls: Array.from(toolCallMap.entries()).map(([name, data]) => ({
        name,
        ...data,
      })),
    };
  }

  private extractOutput(steps: any[], messages: any[]): string {
    // Get the last AI message content as the output
    const aiMessages = messages.filter((m) => m.type === 'ai');
    if (aiMessages.length > 0) {
      return aiMessages[aiMessages.length - 1].content || '';
    }

    // Fallback: last step content
    if (steps.length > 0) {
      return steps[steps.length - 1].content || '';
    }

    return '';
  }

  private emptyMetrics(executionTimeMs: number): EvalMetrics {
    return {
      turns: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      executionTimeMs,
      toolCalls: [],
    };
  }

  /**
   * Create a temporary eval canvas by cloning the state of an original canvas version.
   * Returns the new eval canvas ID, or undefined if canvas restoration fails.
   */
  private async setupEvalCanvas(request: EvalRunRequest, user: User): Promise<string | undefined> {
    const { canvasId } = request;
    if (!canvasId) return undefined;

    try {
      // 1. Resolve canvas version
      let version = request.canvasVersion;
      if (!version) {
        // Fallback: use the current version of the original canvas
        const canvas = await this.prisma.canvas.findFirst({
          where: { canvasId },
          select: { version: true },
        });
        version = canvas?.version;
        this.logger.log(`Canvas version not specified, using current: ${version}`);
      }

      if (!version) {
        this.logger.warn(`No canvas version found for ${canvasId}`);
        return undefined;
      }

      // 2. Find the canvas version record to get the S3 storage key
      const canvasVersion = await this.prisma.canvasVersion.findFirst({
        where: { canvasId, version },
        select: { stateStorageKey: true },
      });

      if (!canvasVersion?.stateStorageKey) {
        this.logger.warn(`Canvas version record not found: ${canvasId}@${version}`);
        return undefined;
      }

      // 3. Load state from S3
      const readable = await this.oss.getObject(canvasVersion.stateStorageKey);
      if (!readable) {
        this.logger.warn(`Canvas state not found in S3: ${canvasVersion.stateStorageKey}`);
        return undefined;
      }
      const stateStr = await this.streamToString(readable);
      const state = JSON.parse(stateStr);

      // 4. Create eval canvas for the eval user
      const evalCanvasId = genCanvasID();
      const evalVersion = genCanvasVersionId();

      // Update state with new version
      state.version = evalVersion;
      state.updatedAt = Date.now();

      // 5. Save cloned state to S3
      const evalStorageKey = `canvas-state/${evalCanvasId}/${evalVersion}`;
      await this.oss.putObject(evalStorageKey, JSON.stringify(state));

      // 6. Create DB records in transaction
      await this.prisma.$transaction([
        this.prisma.canvas.create({
          data: {
            canvasId: evalCanvasId,
            uid: user.uid,
            title: `[Eval] ${canvasId}`,
            version: evalVersion,
            stateStorageKey: evalStorageKey,
            status: 'ready',
          },
        }),
        this.prisma.canvasVersion.create({
          data: {
            canvasId: evalCanvasId,
            version: evalVersion,
            hash: '',
            stateStorageKey: evalStorageKey,
          },
        }),
      ]);

      return evalCanvasId;
    } catch (err) {
      this.logger.error(`Failed to set up eval canvas: ${err.message}`, err.stack);
      return undefined;
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
