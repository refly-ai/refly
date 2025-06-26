import { Injectable, Logger, Optional } from '@nestjs/common';
import pLimit from 'p-limit';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Prisma,
  SkillTrigger as SkillTriggerModel,
  ActionResult as ActionResultModel,
} from '../../generated/client';
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
  Resource,
  SkillContext,
  Skill,
  SkillTriggerCreateParam,
  TimerInterval,
  TimerTriggerConfig,
  UnpinSkillInstanceRequest,
  UpdateSkillInstanceRequest,
  UpdateSkillTriggerRequest,
  User,
  Document,
  ActionResult,
  ActionMeta,
  ModelScene,
  LLMModelConfig,
  CodeArtifact,
} from '@refly/openapi-schema';
import { BaseSkill } from '@refly/skill-template';
import { genActionResultID, genSkillID, genSkillTriggerID, safeParseJSON } from '@refly/utils';
import { PrismaService } from '../common/prisma.service';
import { QUEUE_SKILL, pick } from '../../utils';
import { InvokeSkillJobData } from './skill.dto';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { documentPO2DTO, resourcePO2DTO } from '../knowledge/knowledge.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  ModelUsageQuotaExceeded,
  ParamsError,
  ProjectNotFoundError,
  ProviderItemNotFoundError,
  SkillNotFoundError,
} from '@refly/errors';
import { actionResultPO2DTO } from '../action/action.dto';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { ProviderService } from '../provider/provider.service';
import { providerPO2DTO } from '../provider/provider.dto';
import { codeArtifactPO2DTO } from '../code-artifact/code-artifact.dto';
import { SkillInvokerService } from './skill-invoker.service';

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
export class SkillService {
  private logger = new Logger(SkillService.name);
  private skillInventory: BaseSkill[];

  constructor(
    private prisma: PrismaService,
    private knowledge: KnowledgeService,
    private subscription: SubscriptionService,
    private codeArtifact: CodeArtifactService,
    private providerService: ProviderService,
    private skillInvokerService: SkillInvokerService,
    @Optional() @InjectQueue(QUEUE_SKILL) private skillQueue?: Queue<InvokeSkillJobData>,
  ) {
    this.skillInventory = this.skillInvokerService.getSkillInventory();
    this.logger.log(`Skill inventory initialized: ${this.skillInventory.length}`);
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
        console.log(`skill ${instance.tplName} not found`);
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
          invocationConfig: tplConfigMap.get(instance.tplName)?.invocationConfig
            ? JSON.stringify(tplConfigMap.get(instance.tplName)?.invocationConfig)
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

  async skillInvokePreCheck(user: User, param: InvokeSkillRequest): Promise<InvokeSkillJobData> {
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

      param.modelName ??= existingResult.modelName;
      param.modelItemId ??= existingResult.providerItemId;
      param.skillName ??= safeParseJSON(existingResult.actionMeta).name;
      param.context ??= safeParseJSON(existingResult.context);
      param.resultHistory ??= safeParseJSON(existingResult.history);
      param.tplConfig ??= safeParseJSON(existingResult.tplConfig);
      param.runtimeConfig ??= safeParseJSON(existingResult.runtimeConfig);
      param.projectId ??= existingResult.projectId;
    }

    param.input ||= { query: '' };
    param.skillName ||= 'commonQnA';

    const defaultModel = await this.providerService.findDefaultProviderItem(user, 'chat');
    param.modelItemId ||= defaultModel?.itemId;

    const modelItemId = param.modelItemId;
    const providerItem = await this.providerService.findProviderItemById(user, modelItemId);

    if (!providerItem || providerItem.category !== 'llm' || !providerItem.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${modelItemId} not valid`);
    }

    const modelProviderMap = await this.providerService.prepareModelProviderMap(user, modelItemId);
    param.modelItemId = modelProviderMap.chat.itemId;

    const tiers = [];
    for (const providerItem of Object.values(modelProviderMap)) {
      if (providerItem.tier) {
        tiers.push(providerItem.tier);
      }
    }

    if (tiers.length > 0) {
      // Check for usage quota
      const usageResult = await this.subscription.checkRequestUsage(user);

      for (const tier of tiers) {
        if (!usageResult[tier]) {
          throw new ModelUsageQuotaExceeded(
            `model provider (${tier}) not available for current plan`,
          );
        }
      }
    }

    const modelConfigMap: Record<ModelScene, LLMModelConfig> = {
      chat: JSON.parse(modelProviderMap.chat.config) as LLMModelConfig,
      agent: JSON.parse(modelProviderMap.agent.config) as LLMModelConfig,
      titleGeneration: JSON.parse(modelProviderMap.titleGeneration.config) as LLMModelConfig,
      queryAnalysis: JSON.parse(modelProviderMap.queryAnalysis.config) as LLMModelConfig,
    };

    if (param.context) {
      param.context = await this.populateSkillContext(user, param.context);
    }
    if (param.resultHistory) {
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
        throw new ProjectNotFoundError(`project ${param.projectId} not found`);
      }
    }

    param.skillName ||= 'commonQnA';
    let skill = this.skillInventory.find((s) => s.name === param.skillName);
    if (!skill) {
      // throw new SkillNotFoundError(`skill ${param.skillName} not found`);
      param.skillName = 'commonQnA';
      skill = this.skillInventory.find((s) => s.name === param.skillName);
    }

    const purgeContext = (context: SkillContext) => {
      // remove actual content from context to save storage
      const contextCopy: SkillContext = safeParseJSON(JSON.stringify(context ?? {}));
      if (contextCopy.resources) {
        for (const { resource } of contextCopy.resources) {
          resource.content = '';
        }
      }
      if (contextCopy.documents) {
        for (const { document } of contextCopy.documents) {
          document.content = '';
        }
      }

      if (contextCopy.codeArtifacts) {
        for (const { codeArtifact } of contextCopy.codeArtifacts) {
          codeArtifact.content = '';
        }
      }

      return contextCopy;
    };

    const purgeResultHistory = (resultHistory: ActionResult[] = []) => {
      // remove extra unnecessary fields from result history to save storage
      return resultHistory?.map((r) => pick(r, ['resultId', 'title']));
    };

    const data: InvokeSkillJobData = {
      ...param,
      uid,
      rawParam: JSON.stringify(param),
      modelConfigMap,
      provider: {
        ...providerPO2DTO(providerItem?.provider),
        apiKey: providerItem?.provider?.apiKey,
      },
    };

    if (existingResult) {
      if (existingResult.pilotStepId) {
        const result = await this.prisma.actionResult.update({
          where: { pk: existingResult.pk },
          data: { status: 'executing' },
        });
        data.result = actionResultPO2DTO(result);
      } else {
        const [result] = await this.prisma.$transaction([
          this.prisma.actionResult.create({
            data: {
              resultId,
              uid,
              version: (existingResult.version ?? 0) + 1,
              type: 'skill',
              tier: providerItem.tier ?? '',
              status: 'executing',
              title: param.input.query,
              targetId: param.target?.entityId,
              targetType: param.target?.entityType,
              modelName: modelConfigMap.chat.modelId,
              projectId: param.projectId ?? null,
              actionMeta: JSON.stringify({
                type: 'skill',
                name: param.skillName,
                icon: skill.icon,
              } as ActionMeta),
              errors: JSON.stringify([]),
              input: JSON.stringify(param.input),
              context: JSON.stringify(purgeContext(param.context)),
              tplConfig: JSON.stringify(param.tplConfig),
              runtimeConfig: JSON.stringify(param.runtimeConfig),
              history: JSON.stringify(purgeResultHistory(param.resultHistory)),
              providerItemId: providerItem.itemId,
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
          tier: providerItem.tier,
          targetId: param.target?.entityId,
          targetType: param.target?.entityType,
          title: param.input?.query,
          modelName: modelConfigMap.chat.modelId,
          type: 'skill',
          status: 'executing',
          actionMeta: JSON.stringify({
            type: 'skill',
            name: param.skillName,
            icon: skill.icon,
          } as ActionMeta),
          projectId: param.projectId,
          input: JSON.stringify(param.input),
          context: JSON.stringify(purgeContext(param.context)),
          tplConfig: JSON.stringify(param.tplConfig),
          runtimeConfig: JSON.stringify(param.runtimeConfig),
          history: JSON.stringify(purgeResultHistory(param.resultHistory)),
          providerItemId: providerItem.itemId,
        },
      });
      data.result = actionResultPO2DTO(result);
    }

    return data;
  }

  /**
   * Populate skill context with actual resources and documents.
   * These data can be used in skill invocation.
   */
  async populateSkillContext(user: User, context: SkillContext): Promise<SkillContext> {
    // Populate resources
    if (context.resources?.length > 0) {
      const resourceIds = [
        ...new Set(context.resources.map((item) => item.resourceId).filter((id) => id)),
      ];
      const limit = pLimit(5);
      const resources = await Promise.all(
        resourceIds.map((id) =>
          limit(() => this.knowledge.getResourceDetail(user, { resourceId: id })),
        ),
      );
      const resourceMap = new Map<string, Resource>();
      for (const r of resources) {
        resourceMap.set(r.resourceId, resourcePO2DTO(r));
      }

      for (const item of context.resources) {
        item.resource = resourceMap.get(item.resourceId);
      }
    }

    // Populate documents
    if (context.documents?.length > 0) {
      const docIds = [...new Set(context.documents.map((item) => item.docId).filter((id) => id))];
      const limit = pLimit(5);
      const docs = await Promise.all(
        docIds.map((id) => limit(() => this.knowledge.getDocumentDetail(user, { docId: id }))),
      );
      const docMap = new Map<string, Document>();
      for (const d of docs) {
        docMap.set(d.docId, documentPO2DTO(d));
      }

      for (const item of context.documents) {
        item.document = docMap.get(item.docId);
      }
    }

    // Populate code artifacts
    if (context.codeArtifacts?.length > 0) {
      const artifactIds = [
        ...new Set(context.codeArtifacts.map((item) => item.artifactId).filter((id) => id)),
      ];
      const limit = pLimit(5);
      const artifacts = await Promise.all(
        artifactIds.map((id) => limit(() => this.codeArtifact.getCodeArtifactDetail(user, id))),
      );
      const artifactMap = new Map<string, CodeArtifact>();
      for (const a of artifacts) {
        artifactMap.set(a.artifactId, codeArtifactPO2DTO(a));
      }

      for (const item of context.codeArtifacts) {
        item.codeArtifact = artifactMap.get(item.artifactId);
      }

      // Process code artifacts and add them to contentList
      if (!context.contentList) {
        context.contentList = [];
      }

      const codeArtifactContentList = context.codeArtifacts
        .filter((item) => item.codeArtifact?.content)
        .map((item) => {
          const codeArtifact = item.codeArtifact;
          // For long code content, preserve beginning and end
          const MAX_CONTENT_LENGTH = 10000;
          const PRESERVED_SECTION_LENGTH = 2000;

          let processedContent = codeArtifact.content;

          if (codeArtifact.content.length > MAX_CONTENT_LENGTH) {
            const startContent = codeArtifact.content.substring(0, PRESERVED_SECTION_LENGTH);
            const endContent = codeArtifact.content.substring(
              codeArtifact.content.length - PRESERVED_SECTION_LENGTH,
              codeArtifact.content.length,
            );
            processedContent = `${startContent}\n\n... (content truncated) ...\n\n${endContent}`;
          }

          return {
            title: codeArtifact.title ?? 'Code',
            content: processedContent,
            metadata: {
              domain: 'codeArtifact',
              entityId: item.artifactId,
              title: codeArtifact.title ?? 'Code',
              language: codeArtifact.language,
              artifactType: codeArtifact.type,
            },
          };
        });

      context.contentList.push(...codeArtifactContentList);
    }

    return context;
  }

  /**
   * Populate skill result history with actual result detail and steps.
   */
  async populateSkillResultHistory(user: User, resultHistory: ActionResult[]) {
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
    const data = await this.skillInvokePreCheck(user, param);

    if (this.skillQueue) {
      await this.skillQueue.add('invokeSkill', data);
    } else {
      // In desktop mode or when queue is not available, invoke directly
      await this.invokeSkillFromQueue(data);
    }

    return data.result;
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
    const jobData = await this.skillInvokePreCheck(user, param);

    return this.skillInvokerService.streamInvokeSkill(user, jobData, res);
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
