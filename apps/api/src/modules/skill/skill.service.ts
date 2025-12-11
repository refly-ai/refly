import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import pLimit from 'p-limit';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Prisma,
  SkillTrigger as SkillTriggerModel,
  ActionResult as ActionResultModel,
  ProviderItem as ProviderItemModel,
} from '@prisma/client';
import { Response } from 'express';
import {
  CreateSkillInstanceRequest,
  CreateSkillTriggerRequest,
  DeleteSkillInstanceRequest,
  DeleteSkillTriggerRequest,
  InvokeSkillRequest,
  ListSkillInstancesData,
  ListSkillTriggersData,
  PinSkillInstanceRequest,
  SkillContext,
  Skill,
  SkillTriggerCreateParam,
  TimerInterval,
  TimerTriggerConfig,
  UnpinSkillInstanceRequest,
  UpdateSkillInstanceRequest,
  UpdateSkillTriggerRequest,
  User,
  ActionResult,
  LLMModelConfig,
  MediaGenerationModelConfig,
  DriveFile,
  GenericToolset,
} from '@refly/openapi-schema';
import { BaseSkill } from '@refly/skill-template';
import { purgeContextForActionResult, purgeToolsets } from '@refly/canvas-common';
import {
  genActionResultID,
  genSkillID,
  genSkillTriggerID,
  genCopilotSessionID,
  safeParseJSON,
  safeStringifyJSON,
  runModuleInitWithTimeoutAndRetry,
  AUTO_MODEL_ID,
} from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import { QUEUE_SKILL, pick, QUEUE_CHECK_STUCK_ACTIONS } from '../../utils';
import { InvokeSkillJobData } from './skill.dto';
import { CreditService } from '../credit/credit.service';
import {
  ModelUsageQuotaExceeded,
  ParamsError,
  ProjectNotFoundError,
  ProviderItemNotFoundError,
  SkillNotFoundError,
} from '@refly/errors';
import { actionResultPO2DTO } from '../action/action.dto';
import { ProviderService } from '../provider/provider.service';
import { providerPO2DTO, providerItemPO2DTO } from '../provider/provider.dto';
import { SkillInvokerService } from './skill-invoker.service';
import { normalizeCreditBilling } from '../../utils/credit-billing';
import { ActionService } from '../action/action.service';
import { ConfigService } from '@nestjs/config';
import { ToolService } from '../tool/tool.service';
import { DriveService } from '../drive/drive.service';
import { AutoModelRouter } from '../provider/auto-model-router.service';

/**
 * Fixed builtin toolsets that are always available for node_agent mode.
 * These toolsets will be automatically appended to user-selected toolsets.
 * Note: IDs must match BuiltinToolsetDefinition.tools[].name for instantiateBuiltinToolsets to work.
 */
const FIXED_BUILTIN_TOOLSETS: GenericToolset[] = [
  { type: 'regular', id: 'execute_code', name: 'execute_code', builtin: true },
  { type: 'regular', id: 'read_file', name: 'read_file', builtin: true },
  { type: 'regular', id: 'get_time', name: 'get_time', builtin: true },
];

function validateSkillTriggerCreateParam(param: SkillTriggerCreateParam) {
  if (param.triggerType === 'simpleEvent') {
    if (!param.simpleEventName) {
      throw new ParamsError('invalid event trigger config');
    }
  } else if (param.triggerType === 'timer') {
    if (!param.timerConfig) {
      throw new ParamsError('invalid timer trigger config');
    }
  }
}

@Injectable()
export class SkillService implements OnModuleInit {
  private readonly logger = new Logger(SkillService.name);
  private readonly INIT_TIMEOUT = 10000; // 10 seconds timeout for initialization
  private skillInventory: BaseSkill[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly credit: CreditService,
    private readonly providerService: ProviderService,
    private readonly toolService: ToolService,
    private readonly driveService: DriveService,
    private readonly skillInvokerService: SkillInvokerService,
    private readonly actionService: ActionService,
    @Optional()
    @InjectQueue(QUEUE_SKILL)
    private skillQueue?: Queue<InvokeSkillJobData>,
    @Optional()
    @InjectQueue(QUEUE_CHECK_STUCK_ACTIONS)
    private checkStuckActionsQueue?: Queue,
  ) {
    this.skillInventory = this.skillInvokerService.getSkillInventory();
    this.logger.log(`Skill inventory initialized: ${this.skillInventory.length}`);
  }

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
        removeOnFail: false,
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

      // Also update related pilot steps if they exist
      const pilotStepUpdates = await Promise.allSettled(
        stuckResults
          .filter((result) => result.pilotStepId)
          .map(async (result) => {
            return this.prisma.pilotStep.updateMany({
              where: {
                stepId: result.pilotStepId,
                status: 'executing',
              },
              data: {
                status: 'failed',
              },
            });
          }),
      );

      const pilotStepsUpdated = pilotStepUpdates.filter(
        (result) => result.status === 'fulfilled',
      ).length;
      if (pilotStepsUpdated > 0) {
        this.logger.log(`Updated ${pilotStepsUpdated} related pilot steps to failed status`);
      }
    } catch (error) {
      this.logger.error(`Error checking stuck actions: ${error?.stack}`);
      throw error;
    }
  }

  listSkills(includeAll = false): Skill[] {
    let skills = this.skillInventory.map((skill) => ({
      name: skill.name,
      icon: skill.icon,
      description: skill.description,
      configSchema: skill.configSchema,
    }));

    if (!includeAll) {
      // TODO: figure out a better way to filter applicable skills
      skills = skills.filter((skill) => !['commonQnA', 'editDoc'].includes(skill.name));
    }

    return skills;
  }

  async listSkillInstances(user: User, param: ListSkillInstancesData['query']) {
    const { skillId, sortByPin, page, pageSize } = param;

    const orderBy: Prisma.SkillInstanceOrderByWithRelationInput[] = [{ updatedAt: 'desc' }];
    if (sortByPin) {
      orderBy.unshift({ pinnedAt: { sort: 'desc', nulls: 'last' } });
    }

    return this.prisma.skillInstance.findMany({
      where: { skillId, uid: user.uid, deletedAt: null },
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  }

  async createSkillInstance(user: User, param: CreateSkillInstanceRequest) {
    const { uid } = user;
    const { instanceList } = param;
    const tplConfigMap = new Map<string, BaseSkill>();

    for (const instance of instanceList) {
      if (!instance.displayName) {
        throw new ParamsError('skill display name is required');
      }
      let tpl = this.skillInventory.find((tpl) => tpl.name === instance.tplName);
      if (!tpl) {
        this.logger.log(`skill ${instance.tplName} not found`);
        tpl = this.skillInventory?.[0];
      }
      tplConfigMap.set(instance.tplName, tpl);
    }

    const instances = await this.prisma.skillInstance.createManyAndReturn({
      data: instanceList.map((instance) => ({
        skillId: genSkillID(),
        uid,
        ...pick(instance, ['tplName', 'displayName', 'description']),
        icon: JSON.stringify(instance.icon ?? tplConfigMap.get(instance.tplName)?.icon),
        ...{
          tplConfig: instance.tplConfig ? JSON.stringify(instance.tplConfig) : undefined,
          configSchema: tplConfigMap.get(instance.tplName)?.configSchema
            ? JSON.stringify(tplConfigMap.get(instance.tplName)?.configSchema)
            : undefined,
        },
      })),
    });

    return instances;
  }

  async updateSkillInstance(user: User, param: UpdateSkillInstanceRequest) {
    const { uid } = user;
    const { skillId } = param;

    if (!skillId) {
      throw new ParamsError('skill id is required');
    }

    return this.prisma.skillInstance.update({
      where: { skillId, uid, deletedAt: null },
      data: {
        ...pick(param, ['displayName', 'description']),
        tplConfig: param.tplConfig ? JSON.stringify(param.tplConfig) : undefined,
      },
    });
  }

  async pinSkillInstance(user: User, param: PinSkillInstanceRequest) {
    const { uid } = user;
    const { skillId } = param;

    if (!skillId) {
      throw new ParamsError('skill id is required');
    }

    return this.prisma.skillInstance.update({
      where: { skillId, uid, deletedAt: null },
      data: { pinnedAt: new Date() },
    });
  }

  async unpinSkillInstance(user: User, param: UnpinSkillInstanceRequest) {
    const { uid } = user;
    const { skillId } = param;

    if (!skillId) {
      throw new ParamsError('skill id is required');
    }

    return this.prisma.skillInstance.update({
      where: { skillId, uid, deletedAt: null },
      data: { pinnedAt: null },
    });
  }

  async deleteSkillInstance(user: User, param: DeleteSkillInstanceRequest) {
    const { skillId } = param;
    if (!skillId) {
      throw new ParamsError('skill id is required');
    }
    const skill = await this.prisma.skillInstance.findUnique({
      where: { skillId, uid: user.uid, deletedAt: null },
    });
    if (!skill) {
      throw new SkillNotFoundError('skill not found');
    }

    // delete skill and triggers
    const deletedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.skillTrigger.updateMany({
        where: { skillId, uid: user.uid },
        data: { deletedAt },
      }),
      this.prisma.skillInstance.update({
        where: { skillId, uid: user.uid },
        data: { deletedAt },
      }),
    ]);
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
      param.projectId ??= existingResult.projectId;
    }

    param.input ||= { query: '' };
    param.skillName ||= 'commonQnA';

    // Auto model routing
    const llmItems = await this.providerService.findProviderItemsByCategory(user, 'llm');
    const routerContext = {
      llmItems,
      userId: user.uid,
    };
    const autoModelRouter = new AutoModelRouter(routerContext);

    const originalModelProviderMap = await this.providerService.prepareModelProviderMap(
      user,
      param.modelItemId,
    );

    const modelProviderMap = Object.fromEntries(
      Object.entries(originalModelProviderMap).map(([scene, providerItem]) => [
        scene,
        autoModelRouter.route(providerItem),
      ]),
    );

    // modelItemId is the routed model for actual execution
    // param.modelItemId should be the surface model (original, not routed) for billing and UI
    let modelItemId: string;
    if (param.modelItemId) {
      modelItemId = modelProviderMap.chat.itemId;
    } else {
      if (param.mode === 'copilot_agent') {
        modelItemId = modelProviderMap.copilot.itemId;
        param.modelItemId = originalModelProviderMap.copilot.itemId;
      } else if (param.mode === 'node_agent') {
        modelItemId = modelProviderMap.agent.itemId;
        param.modelItemId = originalModelProviderMap.agent.itemId;
      } else {
        modelItemId = modelProviderMap.chat.itemId;
        param.modelItemId = originalModelProviderMap.chat.itemId;
      }
    }
    let providerItem = await this.providerService.findProviderItemById(user, modelItemId);

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
        );
        throw new ModelUsageQuotaExceeded(`credit not available: ${creditUsageResult.message}`);
      }
    }

    const modelConfigMap = {
      chat: safeParseJSON(modelProviderMap.chat.config) as LLMModelConfig,
      copilot: modelProviderMap.copilot
        ? (safeParseJSON(modelProviderMap.copilot.config) as LLMModelConfig)
        : undefined,
      agent: safeParseJSON(modelProviderMap.agent.config) as LLMModelConfig,
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
      param.context = await this.populateSkillContext(user, param.context);
    }
    if (param.resultHistory && Array.isArray(param.resultHistory)) {
      param.resultHistory = await this.populateSkillResultHistory(user, param.resultHistory);
    }
    if (param.projectId) {
      const project = await this.prisma.project.findUnique({
        where: {
          projectId: param.projectId,
          uid: user.uid,
          deletedAt: null,
        },
      });
      if (!project) {
        // Create failed action result record before throwing error
        await this.createFailedActionResult(
          resultId,
          uid,
          `Project ${param.projectId} not found`,
          param,
        );
        throw new ProjectNotFoundError(`project ${param.projectId} not found`);
      }
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
        );
        throw new ParamsError(
          `workflow node execution ${workflowNodeExecutionId} does not belong to current user`,
        );
      }
    }

    param.skillName ||= 'commonQnA';
    let skill = this.skillInventory.find((s) => s.name === param.skillName);
    if (!skill) {
      // throw new SkillNotFoundError(`skill ${param.skillName} not found`);
      param.skillName = 'commonQnA';
      skill = this.skillInventory.find((s) => s.name === param.skillName);
    }

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
    const modelConfigMap = data.modelConfigMap ?? {};

    const purgeResultHistory = (resultHistory: ActionResult[] = []) => {
      // remove extra unnecessary fields from result history to save storage
      if (!Array.isArray(resultHistory)) {
        // Handle case where resultHistory might be a stringified array due to double stringify bug
        if (typeof resultHistory === 'string') {
          try {
            const parsed = JSON.parse(resultHistory);
            return Array.isArray(parsed) ? parsed.map((r) => pick(r, ['resultId', 'title'])) : [];
          } catch {
            return [];
          }
        }
        return [];
      }
      return resultHistory?.map((r) => pick(r, ['resultId', 'title']));
    };

    if (existingResult) {
      if (existingResult.pilotStepId) {
        const result = await this.prisma.actionResult.update({
          where: { pk: existingResult.pk },
          data: {
            status: 'executing',
          },
        });
        data.result = actionResultPO2DTO(result);
        if (data.workflowExecutionId && data.workflowNodeExecutionId) {
          data.result.workflowExecutionId = data.workflowExecutionId;
          data.result.workflowNodeExecutionId = data.workflowNodeExecutionId;
        }
      } else {
        const [result] = await this.prisma.$transaction([
          this.prisma.actionResult.create({
            data: {
              resultId,
              uid,
              version: (existingResult.version ?? 0) + 1,
              type: 'skill',
              tier: providerItem?.tier ?? '',
              status: 'executing',
              title: data.title || data.input?.query,
              targetId: data.target?.entityId,
              targetType: data.target?.entityType,
              modelName: modelConfigMap.chat.modelId,
              projectId: data.projectId ?? null,
              errors: JSON.stringify([]),
              input: JSON.stringify(data.input),
              context: JSON.stringify(purgeContextForActionResult(data.context)),
              tplConfig: JSON.stringify(data.tplConfig),
              runtimeConfig: JSON.stringify(data.runtimeConfig),
              history: JSON.stringify(purgeResultHistory(data.resultHistory)),
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
      }
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
          modelName: modelConfigMap.chat.modelId,
          type: 'skill',
          status: 'executing',
          projectId: data.projectId,
          input: JSON.stringify(data.input),
          context: JSON.stringify(purgeContextForActionResult(data.context)),
          tplConfig: JSON.stringify(data.tplConfig),
          runtimeConfig: JSON.stringify(data.runtimeConfig),
          history: JSON.stringify(purgeResultHistory(data.resultHistory)),
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
  }

  /**
   * Create a failed action result record for pre-check failures
   */
  private async createFailedActionResult(
    resultId: string,
    uid: string,
    errorMessage: string,
    param: InvokeSkillRequest,
  ): Promise<void> {
    try {
      // Find the latest version for this resultId
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
          projectId: param.projectId,
          errors: JSON.stringify([errorMessage]),
          input: JSON.stringify(param.input ?? {}),
          context: JSON.stringify(param.context ?? {}),
          tplConfig: JSON.stringify(param.tplConfig ?? {}),
          toolsets: JSON.stringify(param.toolsets ?? {}),
          runtimeConfig: JSON.stringify(param.runtimeConfig ?? {}),
          history: JSON.stringify(Array.isArray(param.resultHistory) ? param.resultHistory : []),
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
    }
  }

  /**
   * Populate skill context with actual resources and documents.
   * These data can be used in skill invocation.
   */
  async populateSkillContext(user: User, context: SkillContext): Promise<SkillContext> {
    if (context.files?.length > 0) {
      const fileIds = [...new Set(context.files.map((item) => item.fileId).filter((id) => id))];
      const limit = pLimit(5);
      const files = (
        await Promise.all(
          fileIds.map((id) =>
            limit(() =>
              this.driveService.getDriveFileDetail(user, id).catch((error) => {
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

      for (const item of context.results) {
        item.result = resultMap.get(item.resultId);
      }
    }

    return context;
  }

  /**
   * Populate skill result history with actual result detail and steps.
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
      Array.from(latestResultsMap.entries()).map(async ([resultId, result]) => {
        const steps = await this.prisma.actionStep.findMany({
          where: { resultId, version: result.version },
          orderBy: { order: 'asc' },
        });
        return actionResultPO2DTO({ ...result, steps });
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
        const job = await this.skillQueue.add('invokeSkill', data);
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

  async listSkillTriggers(user: User, param: ListSkillTriggersData['query']) {
    const { skillId, page = 1, pageSize = 10 } = param;

    return this.prisma.skillTrigger.findMany({
      where: { uid: user.uid, skillId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
  }

  async startTimerTrigger(user: User, trigger: SkillTriggerModel) {
    if (!trigger.timerConfig) {
      this.logger.warn(`No timer config found for trigger: ${trigger.triggerId}, cannot start it`);
      return;
    }

    if (trigger.bullJobId) {
      this.logger.warn(`Trigger already bind to a bull job: ${trigger.triggerId}, skip start it`);
      return;
    }

    if (!this.skillQueue) {
      this.logger.warn(
        `Skill queue not available, cannot start timer trigger: ${trigger.triggerId}`,
      );
      return;
    }

    const timerConfig: TimerTriggerConfig = safeParseJSON(trigger.timerConfig || '{}');
    const { datetime, repeatInterval } = timerConfig;

    const repeatIntervalToMillis: Record<TimerInterval, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const param: InvokeSkillRequest = {
      input: safeParseJSON(trigger.input || '{}'),
      target: {},
      context: safeParseJSON(trigger.context || '{}'),
      tplConfig: safeParseJSON(trigger.tplConfig || '{}'),
      runtimeConfig: {}, // TODO: add runtime config when trigger is ready
      skillId: trigger.skillId,
      triggerId: trigger.triggerId,
    };

    const job = await this.skillQueue.add(
      'invokeSkill',
      {
        ...param,
        uid: user.uid,
        rawParam: JSON.stringify(param),
      },
      {
        delay: new Date(datetime).getTime() - new Date().getTime(),
        repeat: repeatInterval ? { every: repeatIntervalToMillis[repeatInterval] } : undefined,
      },
    );

    return this.prisma.skillTrigger.update({
      where: { triggerId: trigger.triggerId },
      data: { bullJobId: String(job.id) },
    });
  }

  async stopTimerTrigger(_user: User, trigger: SkillTriggerModel) {
    if (!trigger.bullJobId) {
      this.logger.warn(`No bull job found for trigger: ${trigger.triggerId}, cannot stop it`);
      return;
    }

    if (!this.skillQueue) {
      this.logger.warn(
        `Skill queue not available, cannot stop timer trigger: ${trigger.triggerId}`,
      );
      return;
    }

    const jobToRemove = await this.skillQueue.getJob(trigger.bullJobId);
    if (jobToRemove) {
      await jobToRemove.remove();
    }

    await this.prisma.skillTrigger.update({
      where: { triggerId: trigger.triggerId },
      data: { bullJobId: null },
    });
  }

  async createSkillTrigger(user: User, param: CreateSkillTriggerRequest) {
    const { uid } = user;

    if (param.triggerList.length === 0) {
      throw new ParamsError('trigger list is empty');
    }

    for (const trigger of param.triggerList) {
      validateSkillTriggerCreateParam(trigger);
    }

    const triggers = await this.prisma.skillTrigger.createManyAndReturn({
      data: param.triggerList.map((trigger) => ({
        uid,
        triggerId: genSkillTriggerID(),
        displayName: trigger.displayName,
        ...pick(trigger, ['skillId', 'triggerType', 'simpleEventName']),
        ...{
          timerConfig: trigger.timerConfig ? JSON.stringify(trigger.timerConfig) : undefined,
          input: trigger.input ? JSON.stringify(trigger.input) : undefined,
          context: trigger.context ? JSON.stringify(trigger.context) : undefined,
          tplConfig: trigger.tplConfig ? JSON.stringify(trigger.tplConfig) : undefined,
        },
        enabled: !!trigger.enabled,
      })),
    });

    for (const trigger of triggers) {
      if (trigger.triggerType === 'timer' && trigger.enabled) {
        await this.startTimerTrigger(user, trigger);
      }
    }

    return triggers;
  }

  async updateSkillTrigger(user: User, param: UpdateSkillTriggerRequest) {
    const { uid } = user;
    const { triggerId } = param;
    if (!triggerId) {
      throw new ParamsError('trigger id is required');
    }

    const trigger = await this.prisma.skillTrigger.update({
      where: { triggerId, uid, deletedAt: null },
      data: {
        ...pick(param, ['triggerType', 'displayName', 'enabled', 'simpleEventName']),
        ...{
          timerConfig: param.timerConfig ? JSON.stringify(param.timerConfig) : undefined,
          input: param.input ? JSON.stringify(param.input) : undefined,
          context: param.context ? JSON.stringify(param.context) : undefined,
          tplConfig: param.tplConfig ? JSON.stringify(param.tplConfig) : undefined,
        },
      },
    });

    if (trigger.triggerType === 'timer') {
      if (trigger.enabled && !trigger.bullJobId) {
        await this.startTimerTrigger(user, trigger);
      } else if (!trigger.enabled && trigger.bullJobId) {
        await this.stopTimerTrigger(user, trigger);
      }
    }

    return trigger;
  }

  async deleteSkillTrigger(user: User, param: DeleteSkillTriggerRequest) {
    const { uid } = user;
    const { triggerId } = param;
    if (!triggerId) {
      throw new ParamsError('skill id and trigger id are required');
    }
    const trigger = await this.prisma.skillTrigger.findFirst({
      where: { triggerId, uid, deletedAt: null },
    });
    if (!trigger) {
      throw new ParamsError('trigger not found');
    }

    if (trigger.bullJobId) {
      await this.stopTimerTrigger(user, trigger);
    }

    await this.prisma.skillTrigger.update({
      where: { triggerId: trigger.triggerId, uid: user.uid },
      data: { deletedAt: new Date() },
    });
  }
}
