import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import pLimit from 'p-limit';
import { Queue } from 'bull';
import * as Y from 'yjs';
import { InjectQueue } from '@nestjs/bull';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { Prisma, SkillTrigger as SkillTriggerModel } from '@prisma/client';
import { Response } from 'express';
import { AIMessageChunk, BaseMessage } from '@langchain/core/dist/messages';
import {
  CreateSkillInstanceRequest,
  CreateSkillTriggerRequest,
  DeleteSkillInstanceRequest,
  DeleteSkillTriggerRequest,
  InvokeSkillRequest,
  ListSkillInstancesData,
  ListSkillJobsData,
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
  TokenUsageItem,
  ActionResult,
  ActionStep,
  Artifact,
  ActionMeta,
} from '@refly-packages/openapi-schema';
import {
  BaseSkill,
  ReflyService,
  SkillEngine,
  SkillEventMap,
  SkillRunnableConfig,
  SkillRunnableMeta,
  createSkillInventory,
} from '@refly-packages/skill-template';
import {
  detectLanguage,
  genActionResultID,
  genSkillID,
  genSkillTriggerID,
  incrementalMarkdownUpdate,
} from '@refly-packages/utils';
import { PrismaService } from '@/common/prisma.service';
import {
  CHANNEL_INVOKE_SKILL,
  QUEUE_SKILL,
  buildSuccessResponse,
  writeSSEResponse,
  pick,
  QUEUE_SYNC_TOKEN_USAGE,
} from '@/utils';
import { InvokeSkillJobData } from './skill.dto';
import { KnowledgeService } from '@/knowledge/knowledge.service';
import {
  projectPO2DTO,
  documentPO2DTO,
  resourcePO2DTO,
  referencePO2DTO,
} from '@/knowledge/knowledge.dto';
import { ConversationService } from '@/conversation/conversation.service';
import { SkillEvent } from '@refly-packages/common-types';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '@/search/search.service';
import { RAGService } from '@/rag/rag.service';
import { LabelService } from '@/label/label.service';
import { labelClassPO2DTO, labelPO2DTO } from '@/label/label.dto';
import { SyncTokenUsageJobData } from '@/subscription/subscription.dto';
import { SubscriptionService } from '@/subscription/subscription.service';
import { ElasticsearchService } from '@/common/elasticsearch.service';
import {
  ModelNotSupportedError,
  ModelUsageQuotaExceeded,
  ParamsError,
  SkillNotFoundError,
} from '@refly-packages/errors';
import { genBaseRespDataFromError } from '@/utils/exception';
import { CanvasService } from '@/canvas/canvas.service';
import { canvasPO2DTO } from '@/canvas/canvas.dto';
import { actionResultPO2DTO, actionStepPO2DTO } from '@/action/action.dto';
import { CollabService } from '@/collab/collab.service';
import { throttle } from 'lodash';
import { ResultAggregator } from '@/utils/result';

export function createLangchainMessage(result: ActionResult, steps: ActionStep[]): BaseMessage[] {
  const query = result.title;

  return [
    new HumanMessage({ content: query }),
    ...steps.map(
      (step) =>
        new AIMessage({
          content: step.content, // TODO: dump artifact content to message
          additional_kwargs: {
            skillMeta: result.actionMeta,
            structuredData: step.structuredData,
            type: result.type,
          },
        }),
    ),
  ];
}

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
  private skillEngine: SkillEngine;
  private skillInventory: BaseSkill[];

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private elasticsearch: ElasticsearchService,
    private label: LabelService,
    private search: SearchService,
    private knowledge: KnowledgeService,
    private rag: RAGService,
    private canvas: CanvasService,
    private conversation: ConversationService,
    private subscription: SubscriptionService,
    private collabService: CollabService,
    @InjectQueue(QUEUE_SKILL) private skillQueue: Queue<InvokeSkillJobData>,
    @InjectQueue(QUEUE_SYNC_TOKEN_USAGE) private usageReportQueue: Queue<SyncTokenUsageJobData>,
  ) {
    this.skillEngine = new SkillEngine(this.logger, this.buildReflyService(), {
      defaultModel: this.config.get('skill.defaultModel'),
    });
    this.skillInventory = createSkillInventory(this.skillEngine);
  }

  buildReflyService = (): ReflyService => {
    return {
      createCanvas: async (user, req) => {
        const canvas = await this.canvas.createCanvas(user, req);
        return buildSuccessResponse(canvasPO2DTO(canvas));
      },
      listCanvases: async (user, param) => {
        const canvasList = await this.canvas.listCanvases(user, param);
        return buildSuccessResponse(canvasList.map((canvas) => canvasPO2DTO(canvas)));
      },
      deleteCanvas: async (user, param) => {
        await this.canvas.deleteCanvas(user, param);
        return buildSuccessResponse({});
      },
      getDocumentDetail: async (user, param) => {
        const canvas = await this.knowledge.getDocumentDetail(user, param);
        return buildSuccessResponse(documentPO2DTO(canvas));
      },
      createDocument: async (user, req) => {
        const canvas = await this.knowledge.createDocument(user, req);
        return buildSuccessResponse(documentPO2DTO(canvas));
      },
      listDocuments: async (user, param) => {
        const canvasList = await this.knowledge.listDocuments(user, param);
        return buildSuccessResponse(canvasList.map((canvas) => documentPO2DTO(canvas)));
      },
      deleteDocument: async (user, param) => {
        await this.knowledge.deleteDocument(user, param);
        return buildSuccessResponse({});
      },
      getResourceDetail: async (user, req) => {
        const resource = await this.knowledge.getResourceDetail(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createResource: async (user, req) => {
        const resource = await this.knowledge.createResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      batchCreateResource: async (user, req) => {
        const resources = await this.knowledge.batchCreateResource(user, req);
        return buildSuccessResponse(resources.map(resourcePO2DTO));
      },
      updateResource: async (user, req) => {
        const resource = await this.knowledge.updateResource(user, req);
        return buildSuccessResponse(resourcePO2DTO(resource));
      },
      createProject: async (user, req) => {
        const project = await this.knowledge.upsertProject(user, req);
        return buildSuccessResponse(projectPO2DTO(project));
      },
      updateProject: async (user, req) => {
        const project = await this.knowledge.upsertProject(user, req);
        return buildSuccessResponse(projectPO2DTO(project));
      },
      getProjectDetail: async (user, req) => {
        const project = await this.knowledge.getProjectDetail(user, req);
        return buildSuccessResponse(projectPO2DTO(project));
      },
      createLabelClass: async (user, req) => {
        const labelClass = await this.label.createLabelClass(user, req);
        return buildSuccessResponse(labelClassPO2DTO(labelClass));
      },
      createLabelInstance: async (user, req) => {
        const labels = await this.label.createLabelInstance(user, req);
        return buildSuccessResponse(labels.map((label) => labelPO2DTO(label)));
      },
      webSearch: async (user, req) => {
        const result = await this.search.webSearch(user, req);
        return buildSuccessResponse(result);
      },
      rerank: async (query, results, options) => {
        const result = await this.rag.rerank(query, results, options);
        return buildSuccessResponse(result);
      },
      search: async (user, req, options) => {
        const result = await this.search.search(user, req, options);
        return buildSuccessResponse(result);
      },
      addReferences: async (user, req) => {
        const references = await this.knowledge.addReferences(user, req);
        return buildSuccessResponse(references.map(referencePO2DTO));
      },
      deleteReferences: async (user, req) => {
        await this.knowledge.deleteReferences(user, req);
        return buildSuccessResponse({});
      },
      inMemorySearchWithIndexing: async (user, options) => {
        const result = await this.rag.inMemorySearchWithIndexing(user, options);
        return buildSuccessResponse(result);
      },
    };
  };

  listSkills(): Skill[] {
    const skills = this.skillInventory.map((skill) => ({
      name: skill.name,
      icon: skill.icon,
      description: skill.description,
      configSchema: skill.configSchema,
    }));

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

    instanceList.forEach((instance) => {
      if (!instance.displayName) {
        throw new ParamsError('skill display name is required');
      }
      const tpl = this.skillInventory.find((tpl) => tpl.name === instance.tplName);
      if (!tpl) {
        throw new ParamsError(`skill ${instance.tplName} not found`);
      }
      tplConfigMap.set(instance.tplName, tpl);
    });

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

    await Promise.all(
      instances.map((instance) => {
        this.elasticsearch.upsertSkill({
          id: instance.skillId,
          createdAt: instance.createdAt.toJSON(),
          updatedAt: instance.updatedAt.toJSON(),
          ...pick(instance, ['uid', 'tplName', 'displayName', 'description']),
        });
      }),
    );

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

    await this.elasticsearch.deleteSkill(skillId);
  }

  async skillInvokePreCheck(user: User, param: InvokeSkillRequest): Promise<InvokeSkillJobData> {
    const { uid } = user;

    // Check for token quota
    const usageResult = await this.subscription.checkTokenUsage(user);

    const modelName = param.modelName || this.config.get('skill.defaultModel');
    const modelInfo = await this.prisma.modelInfo.findUnique({ where: { name: modelName } });

    if (!modelInfo) {
      throw new ModelNotSupportedError(`model ${modelName} not supported`);
    }

    if (!usageResult[modelInfo.tier]) {
      throw new ModelUsageQuotaExceeded(
        `model ${modelName} (${modelInfo.tier}) not available for current plan`,
      );
    }

    const resultId = param.resultId || genActionResultID();

    const existingResult = await this.prisma.actionResult.findFirst({ where: { resultId, uid } });
    if (existingResult) {
      throw new ParamsError('action result already exists');
    }

    param.input ??= { query: '' };

    if (param.context) {
      param.context = await this.populateSkillContext(user, param.context);
    }
    if (param.resultHistory) {
      param.resultHistory = await this.populateSkillResultHistory(user, param.resultHistory);
    }

    param.skillName ||= 'commonQnA';
    const skill = this.skillInventory.find((s) => s.name === param.skillName);
    if (!skill) {
      throw new SkillNotFoundError(`skill ${param.skillName} not found`);
    }

    const purgeContext = (context: SkillContext) => {
      // remove actual content from context to save storage
      const contextCopy: SkillContext = JSON.parse(JSON.stringify(context ?? {}));
      contextCopy.resources?.forEach(({ resource }) => (resource.content = ''));
      contextCopy.documents?.forEach(({ document }) => (document.content = ''));
      return contextCopy;
    };

    const purgeResultHistory = (resultHistory: ActionResult[]) => {
      // remove extra unnecessary fields from result history to save storage
      return resultHistory.map((r) => pick(r, ['resultId', 'title', 'steps']));
    };

    const result = await this.prisma.actionResult.create({
      data: {
        resultId,
        uid,
        targetId: param.target?.entityId,
        targetType: param.target?.entityType,
        title: param.input?.query,
        type: 'skill',
        status: 'executing',
        actionMeta: JSON.stringify({
          type: 'skill',
          name: param.skillName,
          icon: skill.icon,
        } as ActionMeta),
        context: JSON.stringify(purgeContext(param.context)),
        history: JSON.stringify(purgeResultHistory(param.resultHistory)),
      },
    });

    const data: InvokeSkillJobData = {
      ...param,
      uid,
      result: actionResultPO2DTO(result),
      rawParam: JSON.stringify(param),
    };

    return data;
  }

  /**
   * Populate skill context with actual resources and documents.
   * These data can be used in skill invocation.
   */
  async populateSkillContext(user: User, context: SkillContext): Promise<SkillContext> {
    // Populate resources
    if (context.resources?.length > 0) {
      // Query resources which are not populated
      const resourceIds = [
        ...new Set(
          context.resources
            .filter((item) => !item.resource)
            .map((item) => item.resourceId)
            .filter((id) => id),
        ),
      ];
      const limit = pLimit(5);
      const resources = await Promise.all(
        resourceIds.map((id) =>
          limit(() => this.knowledge.getResourceDetail(user, { resourceId: id })),
        ),
      );
      const resourceMap = new Map<string, Resource>();
      resources.forEach((r) => resourceMap.set(r.resourceId, resourcePO2DTO(r)));

      context.resources.forEach((item) => {
        if (item.resource) return;
        item.resource = resourceMap.get(item.resourceId);
      });
    }

    // Populate documents
    if (context.documents?.length > 0) {
      const docIds = [
        ...new Set(
          context.documents
            .filter((item) => !item.document)
            .map((item) => item.docId)
            .filter((id) => id),
        ),
      ];
      const limit = pLimit(5);
      const docs = await Promise.all(
        docIds.map((id) => limit(() => this.knowledge.getDocumentDetail(user, { docId: id }))),
      );
      const docMap = new Map<string, Document>();
      docs.forEach((d) => docMap.set(d.docId, documentPO2DTO(d)));

      context.documents.forEach((item) => {
        if (item.document) return;
        item.document = docMap.get(item.docId);
      });
    }

    return context;
  }

  /**
   * Populate skill result history with actual result detail and steps.
   */
  async populateSkillResultHistory(user: User, resultHistory: ActionResult[]) {
    // Get all results
    const results = await this.prisma.actionResult.findMany({
      where: { resultId: { in: resultHistory.map((r) => r.resultId) }, uid: user.uid },
    });

    // Get all steps for these results in a single query
    const steps = await this.prisma.actionStep.findMany({
      where: { resultId: { in: results.map((r) => r.resultId) } },
    });

    // Create maps for efficient lookups
    const resultMap = new Map<string, ActionResult>();
    const stepsMap = new Map<string, ActionStep[]>();

    // Group steps by resultId
    steps.forEach((step) => {
      const resultSteps = stepsMap.get(step.resultId) ?? [];
      resultSteps.push(actionStepPO2DTO(step));
      stepsMap.set(step.resultId, resultSteps);
    });

    // Convert results and add steps
    results.forEach((r) => {
      const resultDTO = actionResultPO2DTO(r);
      resultDTO.steps = stepsMap.get(r.resultId);
      resultMap.set(r.resultId, resultDTO);
    });

    return resultHistory
      .map((r) => resultMap.get(r.resultId))
      .filter(Boolean) // Remove any undefined results
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async sendInvokeSkillTask(user: User, param: InvokeSkillRequest) {
    const data = await this.skillInvokePreCheck(user, param);
    await this.skillQueue.add(CHANNEL_INVOKE_SKILL, data);

    return data.result;
  }

  async invokeSkillFromQueue(jobData: InvokeSkillJobData) {
    const { uid } = jobData;
    const user = await this.prisma.user.findFirst({ where: { uid } });
    if (!user) {
      this.logger.warn(`user not found for uid ${uid} when invoking skill: ${uid}`);
      return;
    }

    await this.streamInvokeSkill(user, jobData);
  }

  async invokeSkillFromApi(user: User, param: InvokeSkillRequest, res: Response) {
    const jobData = await this.skillInvokePreCheck(user, param);

    return this.streamInvokeSkill(user, jobData, res);
  }

  async buildInvokeConfig(
    user: User,
    data: InvokeSkillJobData & {
      eventListener?: (data: SkillEvent) => void;
    },
  ): Promise<SkillRunnableConfig> {
    const { context, tplConfig, modelName, resultHistory, eventListener } = data;

    const displayLocale =
      (data?.locale === 'auto' ? await detectLanguage(data?.input?.query) : data?.locale) ||
      user?.uiLocale ||
      'en';

    const config: SkillRunnableConfig = {
      configurable: {
        ...context,
        user: pick(user, ['uid', 'uiLocale', 'outputLocale']),
        modelName,
        locale: displayLocale,
        uiLocale: user.uiLocale,
        tplConfig,
        resultId: data.result?.resultId,
      },
    };

    if (resultHistory?.length > 0) {
      config.configurable.chatHistory = resultHistory.flatMap((r) =>
        createLangchainMessage(r, r.steps),
      );
    }

    if (eventListener) {
      const emitter = new EventEmitter<SkillEventMap>();

      emitter.on('start', eventListener);
      emitter.on('end', eventListener);
      emitter.on('log', eventListener);
      emitter.on('error', eventListener);
      emitter.on('create_node', eventListener);
      emitter.on('artifact', eventListener);
      emitter.on('structured_data', eventListener);

      config.configurable.emitter = emitter;
    }

    return config;
  }

  async streamInvokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    if (res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(200);
    }

    try {
      await this._invokeSkill(user, data, res);
    } catch (err) {
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          content: JSON.stringify(genBaseRespDataFromError(err)),
        });
      }
      this.logger.error(`invoke skill error: ${err.stack}`);
    } finally {
      if (res) {
        res.end(``);
      }
    }
  }

  private async _invokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    const { input, result } = data;
    const { resultId, actionMeta } = result;

    let aborted = false;

    if (res) {
      res.on('close', () => {
        this.logger.log('skill invocation aborted due to client disconnect');
        aborted = true;
      });
    }

    const resultAggregator = new ResultAggregator();

    type ArtifactOutput = Artifact & {
      nodeCreated: boolean; // Whether the canvas node is created
      content: string; // Accumulated content
      document?: Y.Doc; // Yjs document
    };
    const artifactMap: Record<string, ArtifactOutput> = {};

    const config = await this.buildInvokeConfig(user, {
      ...data,
      eventListener: async (data: SkillEvent) => {
        if (aborted) {
          this.logger.warn(`skill invocation aborted, ignore event: ${JSON.stringify(data)}`);
          return;
        }

        if (res) {
          writeSSEResponse(res, data);
        }

        const { event, content, structuredDataKey, artifact } = data;
        switch (event) {
          case 'log':
            result.logs.push(content);
            return;
          case 'structured_data':
            if (structuredDataKey) {
              resultAggregator.addSkillEvent(data);
            }
            return;
          case 'artifact':
            if (artifact) {
              resultAggregator.addSkillEvent(data);

              const { entityId, type, status } = artifact;
              if (!artifactMap[entityId]) {
                artifactMap[entityId] = { ...artifact, content: '', nodeCreated: false };
              } else {
                // Only update artifact status
                artifactMap[entityId].status = status;
              }

              // Open direct connection to yjs doc if artifact type is document
              if (type === 'document' && !artifactMap[entityId].document) {
                this.logger.log(`open direct connection to document ${entityId}`);
                const doc = await this.prisma.document.findFirst({
                  where: { docId: entityId },
                });
                const { document } = await this.collabService.openDirectConnection(entityId, {
                  user,
                  entity: doc,
                  entityType: 'document',
                });
                artifactMap[entityId].document = document;
              }
            }
            return;
          case 'error':
            result.errors.push(data.content);
            return;
        }
      },
    });

    const skill = this.skillInventory.find((s) => s.name === data.skillName);

    let runMeta: SkillRunnableMeta | null = null;
    const basicUsageData = {
      uid: user.uid,
      resultId,
      actionMeta,
    };

    const throttledMarkdownUpdate = throttle(
      (doc: Y.Doc, content: string) => incrementalMarkdownUpdate(doc, content),
      20,
      {
        leading: true,
        trailing: true,
      },
    );

    try {
      for await (const event of skill.streamEvents(input, { ...config, version: 'v2' })) {
        if (aborted) {
          if (runMeta) {
            result.errors.push('AbortError');
          }
          throw new Error('AbortError');
        }

        runMeta = event.metadata as SkillRunnableMeta;
        const chunk: AIMessageChunk = event.data?.chunk ?? event.data?.output;

        switch (event.event) {
          case 'on_chat_model_stream':
            const content = chunk.content.toString();
            if (content && res && !runMeta?.suppressOutput) {
              if (runMeta?.artifact) {
                const { entityId } = runMeta.artifact;
                const artifact = artifactMap[entityId];

                // Send create_node event to client if not created
                if (!artifact.nodeCreated) {
                  writeSSEResponse(res, {
                    event: 'create_node',
                    resultId,
                    node: {
                      type: 'document',
                      data: { entityId, title: artifact.title },
                    },
                  });
                  artifact.nodeCreated = true;
                }

                // Update artifact content and yjs doc
                artifact.content += content;
                throttledMarkdownUpdate(artifact.document, artifact.content);
              } else {
                // Update result content and forward stream events to client
                resultAggregator.handleStreamContent(runMeta, content);
                writeSSEResponse(res, {
                  event: 'stream',
                  resultId,
                  content,
                  step: runMeta?.step,
                });
              }
            }
            break;
          case 'on_chat_model_end':
            if (runMeta && chunk) {
              const modelInfo = await this.subscription.getModelInfo(String(runMeta.ls_model_name));
              if (!modelInfo) {
                this.logger.error(`model not found: ${String(runMeta.ls_model_name)}`);
              }
              const usage: TokenUsageItem = {
                tier: modelInfo?.tier,
                modelProvider: modelInfo?.provider,
                modelName: modelInfo?.name,
                inputTokens: chunk.usage_metadata?.input_tokens ?? 0,
                outputTokens: chunk.usage_metadata?.output_tokens ?? 0,
              };
              resultAggregator.addUsageItem(runMeta, usage);

              if (res) {
                writeSSEResponse(res, {
                  event: 'token_usage',
                  resultId,
                  tokenUsage: usage,
                  step: runMeta?.step,
                });
              }

              const tokenUsage: SyncTokenUsageJobData = {
                ...basicUsageData,
                usage,
                timestamp: new Date(),
              };
              await this.usageReportQueue.add(tokenUsage);
            }
            break;
        }
      }
    } catch (err) {
      this.logger.error(`invoke skill error: ${err.stack}`);
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          content: JSON.stringify(genBaseRespDataFromError(err)),
        });
      }
      result.errors.push(err.message);
    } finally {
      const steps = resultAggregator.getSteps({ resultId });

      await this.prisma.$transaction([
        this.prisma.actionResult.update({
          where: { resultId },
          data: {
            status: result.errors.length > 0 ? 'failed' : 'finish',
            logs: JSON.stringify(result.logs),
            errors: JSON.stringify(result.errors),
          },
        }),
        this.prisma.actionStep.createMany({ data: steps }),
      ]);
    }
  }

  async listSkillTriggers(user: User, param: ListSkillTriggersData['query']) {
    const { skillId, page = 1, pageSize = 10 } = param!;

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

    const timerConfig: TimerTriggerConfig = JSON.parse(trigger.timerConfig || '{}');
    const { datetime, repeatInterval } = timerConfig;

    const repeatIntervalToMillis: Record<TimerInterval, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const param: InvokeSkillRequest = {
      input: JSON.parse(trigger.input || '{}'),
      target: {},
      context: JSON.parse(trigger.context || '{}'),
      tplConfig: JSON.parse(trigger.tplConfig || '{}'),
      skillId: trigger.skillId,
      triggerId: trigger.triggerId,
    };

    const job = await this.skillQueue.add(
      CHANNEL_INVOKE_SKILL,
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

  async stopTimerTrigger(user: User, trigger: SkillTriggerModel) {
    if (!trigger.bullJobId) {
      this.logger.warn(`No bull job found for trigger: ${trigger.triggerId}, cannot stop it`);
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

    param.triggerList.forEach((trigger) => validateSkillTriggerCreateParam(trigger));

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

    triggers.forEach(async (trigger) => {
      if (trigger.triggerType === 'timer' && trigger.enabled) {
        await this.startTimerTrigger(user, trigger);
      }
    });

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

  async listSkillJobs(user: User, param: ListSkillJobsData['query']) {
    const { skillId, jobStatus, page, pageSize } = param ?? {};
    const jobs = await this.prisma.skillJob.findMany({
      where: { uid: user.uid, skillId, status: jobStatus },
      orderBy: { updatedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    const triggerIds = [...new Set(jobs.map((job) => job.triggerId).filter(Boolean))];
    const convIds = [...new Set(jobs.map((job) => job.convId).filter(Boolean))];

    const [triggers, convs] = await Promise.all([
      this.prisma.skillTrigger.findMany({
        where: { triggerId: { in: triggerIds }, uid: user.uid, deletedAt: null },
      }),
      this.prisma.conversation.findMany({
        where: { convId: { in: convIds }, uid: user.uid },
      }),
    ]);

    const triggerMap = new Map(triggers.map((trigger) => [trigger.triggerId, trigger]));
    const convMap = new Map(convs.map((conv) => [conv.convId, conv]));

    return jobs.map((job) => ({
      ...job,
      trigger: triggerMap.get(job.triggerId),
      conversation: convMap.get(job.convId),
    }));
  }

  async getSkillJobDetail(user: User, jobId: string) {
    if (!jobId) {
      throw new ParamsError('job id is required');
    }

    const { uid } = user;
    const [job, messages] = await Promise.all([
      this.prisma.skillJob.findUnique({
        where: { uid, jobId },
      }),
      this.prisma.chatMessage.findMany({
        where: { uid, jobId },
        orderBy: { pk: 'asc' },
      }),
    ]);

    return { ...job, messages };
  }
}
