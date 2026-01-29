import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import pLimit from 'p-limit';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ActionResult as ActionResultModel,
  ProviderItem as ProviderItemModel,
} from '@prisma/client';
import { Response } from 'express';
import {
  InvokeSkillRequest,
  SkillContext,
  User,
  ActionResult,
  LLMModelConfig,
  MediaGenerationModelConfig,
  DriveFile,
  GenericToolset,
} from '@refly/openapi-schema';
import {
  purgeContextForActionResult,
  purgeToolsets,
  purgeHistoryForActionResult,
} from '@refly/canvas-common';
import {
  genActionResultID,
  genCopilotSessionID,
  safeParseJSON,
  safeStringifyJSON,
  runModuleInitWithTimeoutAndRetry,
  AUTO_MODEL_ID,
  getModelSceneFromMode,
  isKnownVisionModel,
} from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import { RedisService, LockReleaseFn } from '../common/redis.service';
import { QUEUE_SKILL, QUEUE_CHECK_STUCK_ACTIONS } from '../../utils';
import { InvokeSkillJobData, ModelConfigMap } from './skill.dto';
import { CreditService } from '../credit/credit.service';
import { ModelUsageQuotaExceeded, ParamsError, ProviderItemNotFoundError } from '@refly/errors';
import { actionResultPO2DTO } from '../action/action.dto';
import { ProviderService } from '../provider/provider.service';
import { providerPO2DTO, providerItemPO2DTO } from '../provider/provider.dto';
import { SkillInvokerService } from './skill-invoker.service';
import { normalizeCreditBilling } from '../../utils/credit-billing';
import { ActionService } from '../action/action.service';
import { ConfigService } from '@nestjs/config';
import { ToolService } from '../tool/tool.service';
import { DriveService } from '../drive/drive.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { AutoModelRoutingService, RoutingContext } from '../provider/auto-model-router.service';
import { AutoModelTrialService } from '../provider/auto-model-trial.service';
import { getTracer } from '@refly/observability';
import { propagation, context, trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Fixed builtin toolsets that are always available for node_agent mode.
 * These toolsets will be automatically appended to user-selected toolsets.
 * Internal tools (read_file, list_files) are system-level tools hidden from mentionList.
 * Note: IDs must match BuiltinToolsetDefinition.tools[].name for instantiateBuiltinToolsets to work.
 */
const FIXED_BUILTIN_TOOLSETS: GenericToolset[] = [
  { type: 'regular', id: 'execute_code', name: 'execute_code', builtin: true },
  { type: 'regular', id: 'read_file', name: 'read_file', builtin: true },
  { type: 'regular', id: 'list_files', name: 'list_files', builtin: true },
  { type: 'regular', id: 'get_time', name: 'get_time', builtin: true },
  { type: 'regular', id: 'read_agent_result', name: 'read_agent_result', builtin: true },
  { type: 'regular', id: 'read_tool_result', name: 'read_tool_result', builtin: true },
];

/**
 * Ensures vision capability is set for known vision-capable models.
 * If the model is known to support vision but capabilities.vision is not set,
 * this function will add it automatically.
 */
function ensureVisionCapability(config: LLMModelConfig | undefined): LLMModelConfig | undefined {
  if (!config) return undefined;

  // If already has vision capability or not a known vision model, return as-is
  if (config.capabilities?.vision || !isKnownVisionModel(config.modelId)) {
    return config;
  }

  // Auto-enable vision for known vision-capable models
  return {
    ...config,
    capabilities: {
      ...config.capabilities,
      vision: true,
    },
  };
}

@Injectable()
export class SkillService implements OnModuleInit {
  private readonly logger = new Logger(SkillService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout for initialization

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly credit: CreditService,
    private readonly providerService: ProviderService,
    private readonly toolService: ToolService,
    private readonly driveService: DriveService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly skillInvokerService: SkillInvokerService,
    private readonly actionService: ActionService,
    private readonly autoModelRoutingService: AutoModelRoutingService,
    private readonly autoModelTrialService: AutoModelTrialService,
    @Optional()
    @InjectQueue(QUEUE_SKILL)
    private skillQueue?: Queue<InvokeSkillJobData>,
    @Optional()
    @InjectQueue(QUEUE_CHECK_STUCK_ACTIONS)
    private checkStuckActionsQueue?: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await runModuleInitWithTimeoutAndRetry(
      async () => {
        if (!this.checkStuckActionsQueue) {
          this.logger.log('Stuck actions check queue not available, skipping cronjob setup');
          return;
        }

        try {
          await this.setupStuckActionsCheckJobs();
          this.logger.log('Stuck actions check cronjob scheduled successfully');
        } catch (error) {
          this.logger.error(`Failed to schedule stuck actions check cronjob: ${error}`);
          throw error;
        }
      },
      {
        logger: this.logger,
        label: 'SkillService.onModuleInit',
        timeoutMs: this.INIT_TIMEOUT,
      },
    );
  }

  private async setupStuckActionsCheckJobs() {
    if (!this.checkStuckActionsQueue) return;

    // Remove any existing recurring jobs
    const existingJobs = await this.checkStuckActionsQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.checkStuckActionsQueue!.removeJobScheduler(job.id)),
    );

    // Add the new recurring job
    const stuckCheckInterval = this.config.get<number>('skill.stuckCheckInterval');

    if (!stuckCheckInterval || stuckCheckInterval <= 0) {
      this.logger.log(
        'Stuck actions check disabled: stuckCheckInterval is not set or is not a positive number',
      );
      return;
    }

    const intervalMinutes = Math.max(1, Math.ceil(stuckCheckInterval / (1000 * 60))); // Convert to minutes, minimum 1 minute

    await this.checkStuckActionsQueue.add(
      'check-stuck-actions',
      {},
      {
        repeat: {
          pattern: `*/${intervalMinutes} * * * *`, // Run every N minutes
        },
        removeOnComplete: true,
        removeOnFail: true,
        jobId: 'check-stuck-actions', // Unique job ID to prevent duplicates
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(`Stuck actions check job scheduled to run every ${intervalMinutes} minutes`);
  }

  async checkStuckActions() {
    const stuckTimeoutThreshold = this.config.get<number>('skill.stuckTimeoutThreshold');

    // Validate the threshold to ensure it's a positive number
    if (!stuckTimeoutThreshold || stuckTimeoutThreshold <= 0) {
      return;
    }

    const cutoffTime = new Date(Date.now() - stuckTimeoutThreshold);

    try {
      // Find all ActionResults that are stuck in executing status
      const stuckResults = await this.prisma.actionResult.findMany({
        where: {
          status: 'executing',
          updatedAt: {
            lt: cutoffTime,
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
        take: 100, // Limit to avoid overwhelming the system
      });

      if (stuckResults.length === 0) {
        return;
      }

      this.logger.log(
        `Found stuck actions ${stuckResults.map((r) => r.resultId).join(', ')}, marking them as failed`,
      );

      // Use ActionService.abortAction to handle stuck actions consistently
      const timeoutDuration = Math.ceil(stuckTimeoutThreshold / 1000 / 60); // Convert to minutes
      const timeoutError = `Skill execution timeout after ${timeoutDuration} minutes of inactivity`;

      const updateResults = await Promise.allSettled(
        stuckResults.map(async (result) => {
          // Create a user object for the ActionService.abortAction call
          const user = { uid: result.uid } as User;

          try {
            await this.actionService.abortAction(user, result, timeoutError);
            return { success: true, resultId: result.resultId };
          } catch (error) {
            this.logger.error(`Failed to abort stuck action ${result.resultId}: ${error?.message}`);
            // Fallback to direct database update if ActionService fails
            try {
              const existingErrors = safeParseJSON(result.errors || '[]') as string[];
              const updatedErrors = [...existingErrors, timeoutError];

              await this.prisma.actionResult.update({
                where: {
                  pk: result.pk,
                  status: 'executing', // Only update if still executing to avoid race conditions
                },
                data: {
                  status: 'failed',
                  errors: JSON.stringify(updatedErrors),
                  updatedAt: new Date(),
                },
              });
              return { success: true, resultId: result.resultId };
            } catch (dbError) {
              this.logger.error(
                `Failed to update stuck action ${result.resultId} directly: ${dbError?.message}`,
              );
              throw dbError;
            }
          }
        }),
      );

      const successful = updateResults.filter((result) => result.status === 'fulfilled').length;
      const failed = updateResults.filter((result) => result.status === 'rejected').length;

      this.logger.log(`Updated ${successful} stuck actions to failed status`);
      if (failed > 0) {
        this.logger.warn(`Failed to update ${failed} stuck actions`);
      }
    } catch (error) {
      this.logger.error(`Error checking stuck actions: ${error?.stack}`);
      throw error;
    }
  }

  /**
   * Append fixed builtin toolsets to user-selected toolsets.
   * Deduplicates based on toolset id.
   */
  private appendFixedToolset(toolsets?: GenericToolset[]): GenericToolset[] {
    const userToolsets = toolsets ?? [];
    const existingIds = new Set(userToolsets.map((t) => t.id));

    const toolsetsToAppend = FIXED_BUILTIN_TOOLSETS.filter((t) => !existingIds.has(t.id));

    return [...userToolsets, ...toolsetsToAppend];
  }

  private async prepareInvokeSkillJobData(
    user: User,
    param: InvokeSkillRequest,
  ): Promise<{
    data: InvokeSkillJobData;
    existingResult: ActionResultModel;
    providerItem: ProviderItemModel;
  }> {
    const { uid } = user;
    const resultId = param.resultId || genActionResultID();

    // Check if the result already exists
    const existingResult = await this.prisma.actionResult.findFirst({
      where: { resultId },
      orderBy: { version: 'desc' },
    });
    if (existingResult) {
      if (existingResult.uid !== uid) {
        throw new ParamsError(`action result ${resultId} already exists for another user`);
      }

      param.input ??= existingResult.input
        ? safeParseJSON(existingResult.input)
        : { query: existingResult.title };

      param.title ??= existingResult.title;
      param.modelName ??= existingResult.modelName;
      param.modelItemId ??= existingResult.providerItemId;
      param.context ??= safeParseJSON(existingResult.context);
      param.resultHistory ??= safeParseJSON(existingResult.history);
      param.tplConfig ??= safeParseJSON(existingResult.tplConfig);
      param.runtimeConfig ??= safeParseJSON(existingResult.runtimeConfig);
    }

    param.input ||= { query: '' };
    param.skillName ||= 'commonQnA';

    // Calculate action result version for routing result association
    const actionResultVersion = existingResult ? (existingResult.version ?? 0) + 1 : 0;

    // Auto model routing
    const llmItems = await this.providerService.findProviderItemsByCategory(user, 'llm');

    // Check if user is in auto model trial period
    const trialStatus = await this.autoModelTrialService.checkAndUpdateTrialStatus(user.uid);

    // Build RoutingContext with rich context information for rule-based routing
    const routingContext: RoutingContext = {
      llmItems,
      userId: user.uid,
      actionResultId: resultId,
      actionResultVersion,
      mode: param.mode,
      inputPrompt: param.input?.query,
      toolsets: param.toolsets,
      inAutoModelTrial: trialStatus.inTrial,
    };

    // Use rule-based router service for routing decisions
    const originalModelProviderMap = await this.providerService.prepareModelProviderMap(
      user,
      param.modelItemId,
    );

    // The primary scene is 'copilot' for copilot_agent mode, 'agent' for node_agent mode.
    // The default model for copilot scene is determined by DEFAULT_MODEL_COPILOT.
    // The default model for agent scene is determined by DEFAULT_MODEL_AGENT.
    const primaryScene = getModelSceneFromMode(param.mode);

    // param.modelItemId: surface model (original, not routed) for billing and UI
    // Fill param.modelItemId with the primary scene model if not provided
    let originalProviderItem: ProviderItemModel;
    if (param.modelItemId) {
      originalProviderItem = await this.providerService.findProviderItemById(
        user,
        param.modelItemId,
      );
    } else {
      originalProviderItem = originalModelProviderMap[primaryScene];
      param.modelItemId = originalProviderItem?.itemId;
    }

    // Route only the primary model through the AutoModelRoutingService
    // Keep all other auxiliary models (titleGeneration, queryAnalysis, image, video, audio) unchanged
    const routedProviderItem = await this.autoModelRoutingService.route(
      originalProviderItem,
      routingContext,
    );
    const modelProviderMap = { ...originalModelProviderMap };
    if (originalModelProviderMap[primaryScene]) {
      modelProviderMap[primaryScene] = routedProviderItem;
    }

    // providerItem: routed provider item for actual execution
    let providerItem = await this.providerService.findProviderItemById(
      user,
      routedProviderItem.itemId,
    );

    if (!providerItem || providerItem.category !== 'llm' || !providerItem.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${param.modelItemId} not valid`);
    }

    // Inject routedData into config if this was an Auto model routing
    if (providerItem.itemId !== param.modelItemId) {
      const config = safeParseJSON(providerItem.config || '{}');
      config.routedData = {
        isRouted: true,
        originalItemId: param.modelItemId,
        originalModelId: AUTO_MODEL_ID,
      };
      providerItem = {
        ...providerItem,
        config: safeStringifyJSON(config),
      };
    }

    const actualProviderItemId = providerItem?.itemId ?? null;
    const isAutoModelRouted =
      !!actualProviderItemId && !!param.modelItemId && actualProviderItemId !== param.modelItemId;

    const tiers = [];
    for (const providerItem of Object.values(modelProviderMap)) {
      if (providerItem?.tier) {
        tiers.push(providerItem.tier);
      }
    }

    const creditBilling = normalizeCreditBilling(
      providerItem?.creditBilling ? safeParseJSON(providerItem?.creditBilling) : undefined,
    );

    if (creditBilling) {
      const creditUsageResult = await this.credit.checkRequestCreditUsage(user, creditBilling);
      this.logger.log(`checkRequestCreditUsage result: ${JSON.stringify(creditUsageResult)}`);

      if (!creditUsageResult.canUse) {
        // Create failed action result record before throwing error
        await this.createFailedActionResult(
          resultId,
          uid,
          `Credit not available: ${creditUsageResult.message}`,
          param,
          { actualProviderItemId, isAutoModelRouted },
        );
        throw new ModelUsageQuotaExceeded(`credit not available: ${creditUsageResult.message}`);
      }
    }

    const modelConfigMap = {
      chat: ensureVisionCapability(safeParseJSON(modelProviderMap.chat.config) as LLMModelConfig),
      copilot: ensureVisionCapability(
        modelProviderMap.copilot
          ? (safeParseJSON(modelProviderMap.copilot.config) as LLMModelConfig)
          : undefined,
      ),
      agent: ensureVisionCapability(safeParseJSON(modelProviderMap.agent.config) as LLMModelConfig),
      titleGeneration: safeParseJSON(modelProviderMap.titleGeneration.config) as LLMModelConfig,
      queryAnalysis: safeParseJSON(modelProviderMap.queryAnalysis.config) as LLMModelConfig,
      image: modelProviderMap.image
        ? (safeParseJSON(modelProviderMap.image.config) as MediaGenerationModelConfig)
        : undefined,
      video: modelProviderMap.video
        ? (safeParseJSON(modelProviderMap.video.config) as MediaGenerationModelConfig)
        : undefined,
      audio: modelProviderMap.audio
        ? (safeParseJSON(modelProviderMap.audio.config) as MediaGenerationModelConfig)
        : undefined,
    };

    if (param.context) {
      const query = param.input?.query ?? '';
      const needsAgentTitleLookup = /@agent:(?!ar-[a-z0-9])/i.test(query);
      param.context = await this.populateSkillContext(user, param.context, {
        resolveAgentTitles: needsAgentTitleLookup,
      });
    }
    if (param.resultHistory && Array.isArray(param.resultHistory)) {
      param.resultHistory = await this.populateSkillResultHistory(user, param.resultHistory);
    }

    // Validate toolsets if provided
    if (param.toolsets && param.toolsets.length > 0) {
      await this.toolService.validateSelectedToolsets(user, param.toolsets);
    }

    // Handle copilot session logic
    if (param.mode === 'copilot_agent') {
      param.toolsets = [
        {
          type: 'regular',
          id: 'copilot',
          name: 'Copilot',
        },
      ];
      param.copilotSessionId = await this.prepareCopilotSession(user, param);

      // Get history messages for the copilot session
      const historyResults = await this.prisma.actionResult.findMany({
        where: {
          uid,
          copilotSessionId: param.copilotSessionId,
          resultId: { not: resultId },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      param.resultHistory = (
        await this.actionService.batchProcessActionResults(user, historyResults)
      ).map((r) => actionResultPO2DTO(r));
    } else {
      // Append fixed builtin toolsets for non-copilot mode
      param.toolsets = this.appendFixedToolset(param.toolsets);
    }

    // Validate workflowExecutionId and workflowNodeExecutionId if provided
    const workflowExecutionId = param.workflowExecutionId;
    const workflowNodeExecutionId = param.workflowNodeExecutionId;

    if (workflowExecutionId) {
      // Validate workflowExecutionId exists and belongs to the current user
      const workflowExecution = await this.prisma.workflowExecution.findUnique({
        where: { executionId: workflowExecutionId },
      });

      if (!workflowExecution) {
        // Create failed action result record before throwing error
        await this.createFailedActionResult(
          resultId,
          uid,
          `Workflow execution ${workflowExecutionId} not found`,
          param,
          { actualProviderItemId, isAutoModelRouted },
        );
        throw new ParamsError(`workflow execution ${workflowExecutionId} not found`);
      }

      if (workflowExecution.uid !== uid) {
        // Create failed action result record before throwing error
        await this.createFailedActionResult(
          resultId,
          uid,
          `Workflow execution ${workflowExecutionId} does not belong to current user`,
          param,
          { actualProviderItemId, isAutoModelRouted },
        );
        throw new ParamsError(
          `workflow execution ${workflowExecutionId} does not belong to current user`,
        );
      }
    }

    if (workflowNodeExecutionId) {
      // Validate workflowNodeExecutionId exists and belongs to the current user
      const workflowNodeExecution = await this.prisma.workflowNodeExecution.findUnique({
        where: { nodeExecutionId: workflowNodeExecutionId },
      });

      if (!workflowNodeExecution) {
        // Create failed action result record before throwing error
        await this.createFailedActionResult(
          resultId,
          uid,
          `Workflow node execution ${workflowNodeExecutionId} not found`,
          param,
          { actualProviderItemId, isAutoModelRouted },
        );
        throw new ParamsError(`workflow node execution ${workflowNodeExecutionId} not found`);
      }

      // Check if the associated workflow execution belongs to the current user
      const associatedWorkflowExecution = await this.prisma.workflowExecution.findUnique({
        where: { executionId: workflowNodeExecution.executionId },
      });

      if (!associatedWorkflowExecution || associatedWorkflowExecution.uid !== uid) {
        // Create failed action result record before throwing error
        await this.createFailedActionResult(
          resultId,
          uid,
          `Workflow node execution ${workflowNodeExecutionId} does not belong to current user`,
          param,
          { actualProviderItemId, isAutoModelRouted },
        );
        throw new ParamsError(
          `workflow node execution ${workflowNodeExecutionId} does not belong to current user`,
        );
      }
    }

    param.skillName ||= 'commonQnA';

    const data: InvokeSkillJobData = {
      ...param,
      resultId,
      uid,
      rawParam: JSON.stringify(param),
      modelConfigMap,
      provider: {
        ...providerPO2DTO(providerItem?.provider),
        apiKey: providerItem?.provider?.apiKey,
      },
      providerItem: providerItemPO2DTO(providerItem),
    };

    return { data, existingResult, providerItem };
  }

  async prepareCopilotSession(user: User, param: InvokeSkillRequest): Promise<string> {
    const { uid } = user;
    const { copilotSessionId } = param;
    const sessionTitle = param.input.query || param.input.originalQuery || 'New Copilot Session';

    if (!copilotSessionId) {
      // Create new copilot session
      const sessionId = genCopilotSessionID();
      const canvasId = param.target?.entityId || 'default';
      const session = await this.prisma.copilotSession.create({
        data: {
          sessionId,
          uid,
          title: sessionTitle,
          canvasId,
        },
      });
      this.logger.log(`Created new copilot session: ${sessionId} for user: ${uid}`);
      return session.sessionId;
    }

    // Check if the copilot session exists
    const existingSession = await this.prisma.copilotSession.findFirst({
      where: {
        sessionId: copilotSessionId,
      },
    });
    if (!existingSession) {
      // Create new copilot session if not exists
      const session = await this.prisma.copilotSession.create({
        data: {
          sessionId: copilotSessionId,
          uid,
          title: sessionTitle,
          canvasId: param.target?.entityId,
        },
      });

      this.logger.log(`Created new copilot session: ${copilotSessionId} for user: ${uid}`);
      return session.sessionId;
    }

    // Check if the session belongs to the current user
    if (existingSession.uid !== uid) {
      throw new ParamsError(`Copilot session ${copilotSessionId} does not belong to user ${uid}`);
    }

    this.logger.log(`Reusing existing copilot session: ${copilotSessionId} for user: ${uid}`);
    return existingSession.sessionId;
  }

  async skillInvokePreCheck(user: User, param: InvokeSkillRequest): Promise<InvokeSkillJobData> {
    const { uid } = user;

    const { data, existingResult, providerItem } = await this.prepareInvokeSkillJobData(
      user,
      param,
    );
    const resultId = data.resultId;
    const modelConfigMap: ModelConfigMap = data.modelConfigMap ?? {};

    // Select model name based on mode to correctly record in action_results
    const getModelNameForMode = (): string => {
      const scene = getModelSceneFromMode(data.mode);
      return modelConfigMap?.[scene]?.modelId ?? 'unknown';
    };
    const modelName = getModelNameForMode();

    const actualProviderItemId = providerItem?.itemId ?? null;
    const isAutoModelRouted =
      !!actualProviderItemId && !!param.modelItemId && actualProviderItemId !== param.modelItemId;

    // Acquire distributed lock to prevent concurrent actionResult creation with same resultId+version
    // This prevents unique constraint violation on (result_id, version)
    const lockKey = `skill:precheck:${resultId}`;
    let releaseLock: LockReleaseFn | null = null;

    try {
      releaseLock = await this.redis.waitLock(lockKey, {
        maxRetries: 10,
        initialDelay: 50,
        ttlSeconds: 30,
        noThrow: true,
      });

      if (!releaseLock) {
        this.logger.warn(`Failed to acquire lock for skillInvokePreCheck: resultId=${resultId}`);
        // If we can't acquire the lock, we should still try to proceed
        // but re-fetch the latest version to minimize conflict risk
      }

      // Re-fetch the latest version under lock to ensure we have the most recent state
      const latestResult = await this.prisma.actionResult.findFirst({
        where: { resultId },
        orderBy: { version: 'desc' },
      });

      // Use the latest version from DB if available, otherwise use existingResult
      const effectiveExistingResult = latestResult || existingResult;

      if (effectiveExistingResult) {
        const [result] = await this.prisma.$transaction([
          this.prisma.actionResult.create({
            data: {
              resultId,
              uid,
              version: (effectiveExistingResult.version ?? 0) + 1,
              type: 'skill',
              tier: providerItem?.tier ?? '',
              status: 'executing',
              title: data.title || data.input?.query,
              targetId: data.target?.entityId,
              targetType: data.target?.entityType,
              modelName,
              actualProviderItemId,
              isAutoModelRouted,
              errors: JSON.stringify([]),
              input: JSON.stringify(data.input),
              context: JSON.stringify(purgeContextForActionResult(data.context)),
              tplConfig: JSON.stringify(data.tplConfig),
              runtimeConfig: JSON.stringify(data.runtimeConfig),
              history: JSON.stringify(purgeHistoryForActionResult(data.resultHistory)),
              toolsets: JSON.stringify(purgeToolsets(data.toolsets)),
              providerItemId: param.modelItemId,
              copilotSessionId: data.copilotSessionId,
              workflowExecutionId: data.workflowExecutionId,
              workflowNodeExecutionId: data.workflowNodeExecutionId,
            },
          }),
          // Delete existing step data
          this.prisma.actionStep.updateMany({
            where: { resultId },
            data: { deletedAt: new Date() },
          }),
        ]);
        data.result = actionResultPO2DTO(result);
      } else {
        const result = await this.prisma.actionResult.create({
          data: {
            resultId,
            uid,
            version: 0,
            tier: providerItem?.tier ?? '',
            targetId: data.target?.entityId,
            targetType: data.target?.entityType,
            title: data.title || data.input?.query,
            modelName,
            actualProviderItemId,
            isAutoModelRouted,
            type: 'skill',
            status: 'executing',
            input: JSON.stringify(data.input),
            context: JSON.stringify(purgeContextForActionResult(data.context)),
            tplConfig: JSON.stringify(data.tplConfig),
            runtimeConfig: JSON.stringify(data.runtimeConfig),
            history: JSON.stringify(purgeHistoryForActionResult(data.resultHistory)),
            toolsets: JSON.stringify(purgeToolsets(data.toolsets)),
            providerItemId: param.modelItemId,
            copilotSessionId: data.copilotSessionId,
            workflowExecutionId: data.workflowExecutionId,
            workflowNodeExecutionId: data.workflowNodeExecutionId,
          },
        });
        data.result = actionResultPO2DTO(result);
      }

      return data;
    } finally {
      // Always release the lock
      if (releaseLock) {
        try {
          await releaseLock();
        } catch (lockError) {
          this.logger.warn(
            `Error releasing lock for skillInvokePreCheck: resultId=${resultId}, error=${lockError}`,
          );
        }
      }
    }
  }

  /**
   * Create a failed action result record for pre-check failures
   * Uses distributed lock to prevent concurrent creation with same resultId+version
   */
  private async createFailedActionResult(
    resultId: string,
    uid: string,
    errorMessage: string,
    param: InvokeSkillRequest,
    routing?: { actualProviderItemId?: string | null; isAutoModelRouted?: boolean },
  ): Promise<void> {
    // Acquire distributed lock to prevent concurrent actionResult creation
    const lockKey = `skill:failed-result:${resultId}`;
    let releaseLock: LockReleaseFn | null = null;

    try {
      releaseLock = await this.redis.acquireLock(lockKey, 10);

      // Find the latest version for this resultId under lock
      const latestResult = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
          uid,
        },
        orderBy: {
          version: 'desc',
        },
      });

      const nextVersion = latestResult ? latestResult.version + 1 : 0;

      // Check if a failed record with the same version already exists
      const existingFailedResult = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
          uid,
          version: nextVersion,
          status: 'failed',
        },
      });

      if (existingFailedResult) {
        this.logger.warn(
          `Failed action result already exists for resultId: ${resultId}, version: ${nextVersion}, skipping creation`,
        );
        return;
      }

      // Create a failed action result record
      await this.prisma.actionResult.create({
        data: {
          resultId,
          uid,
          version: nextVersion,
          type: 'skill',
          status: 'failed',
          title: param.input?.query ?? 'Skill execution failed',
          targetId: param.target?.entityId,
          targetType: param.target?.entityType,
          modelName: param.modelName ?? 'unknown',
          actualProviderItemId: routing?.actualProviderItemId ?? null,
          isAutoModelRouted: routing?.isAutoModelRouted ?? false,
          errors: JSON.stringify([errorMessage]),
          input: JSON.stringify(param.input ?? {}),
          context: JSON.stringify(purgeContextForActionResult(param.context as SkillContext)),
          tplConfig: JSON.stringify(param.tplConfig ?? {}),
          toolsets: JSON.stringify(purgeToolsets(param.toolsets ?? [])),
          runtimeConfig: JSON.stringify(param.runtimeConfig ?? {}),
          history: JSON.stringify(purgeHistoryForActionResult(param.resultHistory ?? [])),
          providerItemId: param.modelItemId,
        },
      });

      this.logger.log(
        `Successfully created failed action result for resultId: ${resultId}, version: ${nextVersion} with error: ${errorMessage}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create failed action result for resultId ${resultId}: ${error?.message}`,
      );
      // Don't throw error here to avoid masking the original error
    } finally {
      // Always release the lock
      if (releaseLock) {
        try {
          await releaseLock();
        } catch (lockError) {
          this.logger.warn(
            `Error releasing lock for createFailedActionResult: resultId=${resultId}, error=${lockError}`,
          );
        }
      }
    }
  }

  /**
   * Populate skill context with actual resources and documents.
   * These data can be used in skill invocation.
   */
  async populateSkillContext(
    user: User,
    context: SkillContext,
    options?: { resolveAgentTitles?: boolean },
  ): Promise<SkillContext> {
    if (context.files?.length > 0) {
      const fileIds = [...new Set(context.files.map((item) => item.fileId).filter((id) => id))];
      const limit = pLimit(10);
      // Only fetch metadata, not content - LLM uses read_file tool when needed
      const files = (
        await Promise.all(
          fileIds.map((id) =>
            limit(() =>
              this.driveService
                .getDriveFileDetail(user, id, { includeContent: false })
                .catch((error) => {
                  this.logger.error(
                    `Failed to get drive file detail for fileId ${id}: ${error?.message}`,
                  );
                  return null;
                }),
            ),
          ),
        )
      )?.filter(Boolean);

      const fileMap = new Map<string, DriveFile>();
      for (const f of files) {
        fileMap.set(f.fileId, f);
      }

      for (const item of context.files) {
        item.file = fileMap.get(item.fileId);
      }
    }

    if (context.results?.length > 0) {
      const resultIds = [
        ...new Set(context.results.map((item) => item.resultId).filter((id) => id)),
      ];
      const limit = pLimit(5);
      const results = (
        await Promise.all(
          resultIds.map((id) =>
            limit(() =>
              this.actionService
                .getActionResult(user, { resultId: id, includeFiles: true })
                .catch((error) => {
                  this.logger.error(
                    `Failed to get action result detail for resultId ${id}: ${error?.message}`,
                  );
                  return null;
                }),
            ),
          ),
        )
      )?.filter(Boolean);

      const resultMap = new Map<string, ActionResult>();
      for (const r of results) {
        resultMap.set(r.resultId, actionResultPO2DTO(r));
      }

      if (options?.resolveAgentTitles) {
        const resultsByCanvas = new Map<string, ActionResult[]>();
        for (const result of resultMap.values()) {
          if (result?.targetType !== 'canvas') continue;
          const canvasId = result?.targetId;
          if (!canvasId) continue;
          const list = resultsByCanvas.get(canvasId) ?? [];
          list.push(result);
          resultsByCanvas.set(canvasId, list);
        }

        if (resultsByCanvas.size > 0) {
          const limitCanvas = pLimit(3);
          const canvasNodes = (
            await Promise.all(
              Array.from(resultsByCanvas.entries()).map(([canvasId, list]) =>
                limitCanvas(async () => {
                  try {
                    const { nodes } = await this.canvasSyncService.getCanvasData(user, {
                      canvasId,
                    });
                    return { canvasId, list, nodes: nodes ?? [] };
                  } catch (error) {
                    this.logger.error(
                      `Failed to get canvas data for canvasId ${canvasId}: ${error?.message}`,
                    );
                    return null;
                  }
                }),
              ),
            )
          )?.filter(Boolean);

          for (const entry of canvasNodes ?? []) {
            const nodeTitleMap = new Map<string, string>();
            for (const node of entry.nodes ?? []) {
              const entityId = node?.data?.entityId;
              const title = node?.data?.title;
              if (entityId && title) {
                nodeTitleMap.set(entityId, title);
              }
            }

            for (const result of entry.list ?? []) {
              const nodeTitle = nodeTitleMap.get(result.resultId);
              if (nodeTitle) {
                result.title = nodeTitle;
              }
            }
          }
        }
      }

      for (const item of context.results) {
        item.result = resultMap.get(item.resultId);
      }
    }

    return context;
  }

  /**
   * Populate skill result history with actual result detail and steps.
   * Now includes messages from action_messages table for proper history reconstruction.
   */
  async populateSkillResultHistory(user: User, resultHistory: { resultId: string }[] = []) {
    if (!Array.isArray(resultHistory) || resultHistory.length === 0) {
      return [];
    }

    // Fetch all results for the given resultIds
    const results = await this.prisma.actionResult.findMany({
      where: { resultId: { in: resultHistory.map((r) => r.resultId) }, uid: user.uid },
    });

    // Group results by resultId and pick the one with the highest version
    const latestResultsMap = new Map<string, ActionResultModel>();
    for (const r of results) {
      const latestResult = latestResultsMap.get(r.resultId);
      if (!latestResult || r.version > latestResult.version) {
        latestResultsMap.set(r.resultId, r);
      }
    }

    const finalResults: ActionResult[] = await Promise.all(
      Array.from(latestResultsMap.keys()).map(async (resultId) => {
        const resultDetail = await this.actionService.getActionResult(user, { resultId });
        return actionResultPO2DTO(resultDetail);
      }),
    );

    // Sort the results by createdAt ascending
    finalResults.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return finalResults;
  }

  async sendInvokeSkillTask(user: User, param: InvokeSkillRequest) {
    try {
      const data = await this.skillInvokePreCheck(user, param);
      if (this.skillQueue) {
        // Inject trace context for cross-pod propagation
        const tracer = getTracer();
        const span = tracer.startSpan('skill.enqueue', {
          attributes: {
            'skill.resultId': data.result.resultId,
            'skill.name': data.skillName || 'unknown',
            'user.uid': user.uid,
          },
        });
        const traceCarrier: Record<string, string> = {};
        propagation.inject(trace.setSpan(context.active(), span), traceCarrier);

        let job: Awaited<ReturnType<typeof this.skillQueue.add>>;
        try {
          job = await this.skillQueue.add('invokeSkill', { ...data, traceCarrier });
        } catch (err) {
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
          throw err;
        } finally {
          span.end();
        }

        // Register the job in Redis for abortion support
        await this.actionService.registerQueuedJob(data.result.resultId, job.id);
        this.logger.debug(`Registered queued job: ${data.result.resultId} -> ${job.id}`);
      } else {
        // In desktop mode or when queue is not available, invoke directly
        await this.invokeSkillFromQueue(data);
      }
      return data.result;
    } catch (error) {
      this.logger.error(
        `Failed to send invoke skill task for resultId: ${param.resultId}, error: ${error?.stack}`,
      );
      await this.createFailedActionResult(
        param.resultId || genActionResultID(),
        user.uid,
        error?.message,
        param,
      );
      throw error;
    }
  }

  async invokeSkillFromQueue(jobData: InvokeSkillJobData) {
    const { uid } = jobData;
    const user = await this.prisma.user.findFirst({ where: { uid } });
    if (!user) {
      this.logger.warn(`user not found for uid ${uid} when invoking skill: ${uid}`);
      return;
    }

    await this.skillInvokerService.streamInvokeSkill(user, jobData);
  }

  async invokeSkillFromApi(user: User, param: InvokeSkillRequest, res: Response) {
    try {
      const jobData = await this.skillInvokePreCheck(user, param);
      return this.skillInvokerService.streamInvokeSkill(user, jobData, res);
    } catch (error) {
      this.logger.error(
        `Failed to invoke skill from api for resultId: ${param.resultId}, error: ${error?.stack}`,
      );
      await this.createFailedActionResult(
        param.resultId || genActionResultID(),
        user.uid,
        error?.message,
        param,
      );
      throw error;
    }
  }
}
