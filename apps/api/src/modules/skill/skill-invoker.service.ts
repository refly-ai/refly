import { Injectable, Logger, Optional } from '@nestjs/common';

import * as Y from 'yjs';
import { EventEmitter } from 'node:events';
import { Response } from 'express';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { AIMessageChunk, BaseMessage, MessageContentComplex } from '@langchain/core/dist/messages';
import {
  User,
  ActionResult,
  ActionStep,
  Artifact,
  SkillEvent,
  TokenUsageItem,
} from '@refly/openapi-schema';
import { InvokeSkillJobData, SkillTimeoutCheckJobData } from './skill.dto';
import { PrismaService } from '@/modules/common/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  detectLanguage,
  incrementalMarkdownUpdate,
  safeParseJSON,
  getArtifactContentAndAttributes,
} from '@refly/utils';
import {
  SkillRunnableConfig,
  SkillEventMap,
  SkillRunnableMeta,
  BaseSkill,
  SkillEngine,
  createSkillInventory,
} from '@refly/skill-template';
import { throttle } from 'lodash';
import { MiscService } from '@/modules/misc/misc.service';
import { ResultAggregator } from '@/utils/result';
import { DirectConnection } from '@hocuspocus/server';
import { getWholeParsedContent } from '@refly/utils';
import { ProjectNotFoundError } from '@refly/errors';
import { projectPO2DTO } from '@/modules/project/project.dto';
import {
  SyncRequestUsageJobData,
  SyncTokenUsageJobData,
} from '@/modules/subscription/subscription.dto';
import {
  QUEUE_AUTO_NAME_CANVAS,
  QUEUE_SKILL_TIMEOUT_CHECK,
  QUEUE_SYNC_PILOT_STEP,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_SYNC_TOKEN_USAGE,
} from '@/utils/const';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { writeSSEResponse } from '@/utils/response';
import { genBaseRespDataFromError } from '@/utils/exception';
import { SyncPilotStepJobData } from '@/modules/pilot/pilot.processor';
import { AutoNameCanvasJobData } from '@/modules/canvas/canvas.dto';
import { ProviderService } from '@/modules/provider/provider.service';
import { CodeArtifactService } from '@/modules/code-artifact/code-artifact.service';
import { CollabContext } from '@/modules/collab/collab.dto';
import { CollabService } from '@/modules/collab/collab.service';
import { SkillEngineService } from '@/modules/skill/skill-engine.service';
import { ActionService } from '@/modules/action/action.service';

@Injectable()
export class SkillInvokerService {
  private readonly logger = new Logger(SkillInvokerService.name);

  private skillEngine: SkillEngine;
  private skillInventory: BaseSkill[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly miscService: MiscService,
    private readonly collabService: CollabService,
    private readonly providerService: ProviderService,
    private readonly codeArtifactService: CodeArtifactService,
    private readonly skillEngineService: SkillEngineService,
    private readonly actionService: ActionService,
    @Optional()
    @InjectQueue(QUEUE_SYNC_REQUEST_USAGE)
    private requestUsageQueue?: Queue<SyncRequestUsageJobData>,
    @Optional()
    @InjectQueue(QUEUE_SKILL_TIMEOUT_CHECK)
    private timeoutCheckQueue?: Queue<SkillTimeoutCheckJobData>,
    @Optional()
    @InjectQueue(QUEUE_SYNC_TOKEN_USAGE)
    private usageReportQueue?: Queue<SyncTokenUsageJobData>,
    @Optional()
    @InjectQueue(QUEUE_AUTO_NAME_CANVAS)
    private autoNameCanvasQueue?: Queue<AutoNameCanvasJobData>,
    @Optional()
    @InjectQueue(QUEUE_SYNC_PILOT_STEP)
    private pilotStepQueue?: Queue<SyncPilotStepJobData>,
  ) {
    this.skillEngine = this.skillEngineService.getEngine();
    this.skillInventory = createSkillInventory(this.skillEngine);
    this.logger.log(`Skill inventory initialized: ${this.skillInventory.length}`);
  }

  async checkSkillTimeout(param: SkillTimeoutCheckJobData) {
    const { uid, resultId, type, version } = param;

    const timeout: number =
      type === 'idle'
        ? this.config.get('skill.idleTimeout')
        : this.config.get('skill.executionTimeout');

    const result = await this.prisma.actionResult.findFirst({
      where: { uid, resultId, version },
      orderBy: { version: 'desc' },
    });
    if (!result) {
      this.logger.warn(`result not found for resultId: ${resultId}`);
      return;
    }

    if (result.status === 'executing' && result.updatedAt < new Date(Date.now() - timeout)) {
      this.logger.warn(`skill invocation ${type} timeout for resultId: ${resultId}`);
      await this.prisma.actionResult.update({
        where: { pk: result.pk, status: 'executing' },
        data: { status: 'failed', errors: JSON.stringify(['Execution timeout']) },
      });
    } else {
      this.logger.log(`skill invocation settled for resultId: ${resultId}`);
    }
  }

  private async buildLangchainMessages(
    user: User,
    result: ActionResult,
    steps: ActionStep[],
  ): Promise<BaseMessage[]> {
    const query = result.input?.query || result.title;

    // Only create content array if images exist
    let messageContent: string | MessageContentComplex[] = query;
    if (result.input?.images?.length > 0) {
      const imageUrls = await this.miscService.generateImageUrls(user, result.input.images);
      messageContent = [
        { type: 'text', text: query },
        ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
      ];
    }

    return [
      new HumanMessage({ content: messageContent }),
      ...(steps?.length > 0
        ? steps.map(
            (step) =>
              new AIMessage({
                content: getWholeParsedContent(step.reasoningContent, step.content),
                additional_kwargs: {
                  skillMeta: result.actionMeta,
                  structuredData: step.structuredData,
                  type: result.type,
                  tplConfig:
                    typeof result.tplConfig === 'string'
                      ? safeParseJSON(result.tplConfig)
                      : result.tplConfig,
                },
              }),
          )
        : []),
    ];
  }

  private async buildInvokeConfig(
    user: User,
    data: InvokeSkillJobData & {
      eventListener?: (data: SkillEvent) => void;
    },
  ): Promise<SkillRunnableConfig> {
    const {
      context,
      tplConfig,
      runtimeConfig,
      modelConfigMap,
      provider,
      resultHistory,
      projectId,
      eventListener,
      selectedMcpServers,
    } = data;
    const userPo = await this.prisma.user.findUnique({
      select: { uiLocale: true, outputLocale: true },
      where: { uid: user.uid },
    });
    const outputLocale = data?.locale || userPo?.outputLocale;

    const displayLocale =
      (outputLocale === 'auto' ? await detectLanguage(data?.input?.query) : outputLocale) ||
      userPo.uiLocale ||
      'en';

    // Merge the current context with contexts from result history
    // Current context items have priority, and duplicates are removed

    const config: SkillRunnableConfig = {
      configurable: {
        ...context,
        user,
        modelConfigMap,
        provider,
        locale: displayLocale,
        uiLocale: userPo.uiLocale,
        tplConfig,
        runtimeConfig,
        resultId: data.result?.resultId,
        selectedMcpServers,
      },
    };

    // Add project info if projectId is provided
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { projectId, uid: user.uid, deletedAt: null },
      });
      if (!project) {
        throw new ProjectNotFoundError(`project ${projectId} not found`);
      }
      config.configurable.project = projectPO2DTO(project);
    }

    if (resultHistory?.length > 0) {
      config.configurable.chatHistory = await Promise.all(
        resultHistory.map((r) => this.buildLangchainMessages(user, r, r.steps)),
      ).then((messages) => messages.flat());
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

  private async _invokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    const { input, result } = data;
    const { resultId, version, actionMeta, tier } = result;

    if (input.images?.length > 0) {
      input.images = await this.miscService.generateImageUrls(user, input.images);
    }

    if (tier) {
      if (this.requestUsageQueue) {
        await this.requestUsageQueue.add('syncRequestUsage', {
          uid: user.uid,
          tier,
          timestamp: new Date(),
        });
      }
      // In desktop mode, we could handle usage tracking differently if needed
    }

    // Create abort controller for this action
    const abortController = new AbortController();

    // Register the abort controller with ActionService
    this.actionService.registerAbortController(resultId, abortController);

    // const job = await this.timeoutCheckQueue.add(
    //   `idle_timeout_check:${resultId}`,
    //   {
    //     uid: user.uid,
    //     resultId,
    //     version,
    //     type: 'idle',
    //   },
    //   { delay: Number.parseInt(this.config.get('skill.idleTimeout')) },
    // );

    // const throttledResetIdleTimeout = throttle(
    //   async () => {
    //     try {
    //       // Get current job state
    //       const jobState = await job.getState();

    //       // Only attempt to change delay if job is in delayed state
    //       if (jobState === 'delayed') {
    //         await job.changeDelay(this.config.get('skill.idleTimeout'));
    //       }
    //     } catch (err) {
    //       this.logger.warn(`Failed to reset idle timeout: ${err.message}`);
    //     }
    //   },
    //   100,
    //   { leading: true, trailing: true },
    // );

    const resultAggregator = new ResultAggregator();

    type ArtifactOutput = Artifact & {
      nodeCreated: boolean; // Whether the canvas node is created
      content: string; // Accumulated content
      connection?: DirectConnection & { document: Y.Doc };
    };
    const artifactMap: Record<string, ArtifactOutput> = {};

    const config = await this.buildInvokeConfig(user, {
      ...data,
      eventListener: async (data: SkillEvent) => {
        if (abortController.signal.aborted) {
          this.logger.warn(`skill invocation aborted, ignore event: ${JSON.stringify(data)}`);
          return;
        }

        // await throttledResetIdleTimeout();

        if (res) {
          writeSSEResponse(res, { ...data, resultId, version });
        }

        const { event, structuredData, artifact, log } = data;
        switch (event) {
          case 'log':
            if (log) {
              resultAggregator.addSkillEvent(data);
            }
            return;
          case 'structured_data':
            if (structuredData) {
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
              if (type === 'document' && !artifactMap[entityId].connection) {
                const doc = await this.prisma.document.findFirst({
                  where: { docId: entityId },
                });
                const collabContext: CollabContext = {
                  user,
                  entity: doc,
                  entityType: 'document',
                };
                const connection = await this.collabService.openDirectConnection(
                  entityId,
                  collabContext,
                );

                this.logger.log(
                  `open direct connection to document ${entityId}, doc: ${JSON.stringify(
                    connection.document?.toJSON(),
                  )}`,
                );
                artifactMap[entityId].connection = connection;
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
      ({ connection, content }: ArtifactOutput) => {
        incrementalMarkdownUpdate(connection.document, content);
      },
      20,
      {
        leading: true,
        trailing: true,
      },
    );

    const throttledCodeArtifactUpdate = throttle(
      async ({ entityId, content }: ArtifactOutput) => {
        // Extract code content and attributes from content string
        const {
          content: codeContent,
          language,
          type,
          title,
        } = getArtifactContentAndAttributes(content);

        await this.codeArtifactService.updateCodeArtifact(user, {
          artifactId: entityId,
          title,
          type,
          language,
          content: codeContent,
          createIfNotExists: true,
        });
      },
      1000,
      { leading: true, trailing: true },
    );

    writeSSEResponse(res, { event: 'start', resultId, version });

    try {
      for await (const event of skill.streamEvents(input, {
        ...config,
        version: 'v2',
        signal: abortController.signal,
      })) {
        if (abortController.signal.aborted) {
          if (runMeta) {
            result.errors.push('AbortError');
          }
          throw new Error('AbortError');
        }

        // reset idle timeout check when events are received
        // await throttledResetIdleTimeout();

        runMeta = event.metadata as SkillRunnableMeta;
        const chunk: AIMessageChunk = event.data?.chunk ?? event.data?.output;

        switch (event.event) {
          case 'on_tool_end':
          case 'on_tool_start': {
            // Extract tool_call_chunks from AIMessageChunk
            if (event.metadata.langgraph_node === 'tools' && event.data?.output) {
              // Update result content and forward stream events to client

              const [, , eventName] = event.name?.split('__') ?? event.name;

              const content = event.data?.output
                ? `
<tool_use>
<name>${`${eventName}`}</name>
<arguments>
${event.data?.input ? JSON.stringify({ params: event.data?.input?.input }) : ''}
</arguments>
<result>
${event.data?.output ? JSON.stringify({ response: event.data?.output?.content ?? '' }) : ''}
</result>
</tool_use>
`
                : `
<tool_use>
<name>${`${eventName}`}</name>
<arguments>
${event.data?.input ? JSON.stringify(event.data?.input?.input) : ''}
</arguments>
</tool_use>
`;
              resultAggregator.handleStreamContent(runMeta, content, '');

              writeSSEResponse(res, {
                event: 'stream',
                resultId,
                content,
                step: runMeta?.step,
                structuredData: {
                  toolCallId: event.run_id,
                  name: event.name,
                },
              });
            }
            break;
          }
          case 'on_chat_model_stream': {
            const content = chunk.content.toString();
            const reasoningContent = chunk?.additional_kwargs?.reasoning_content?.toString() || '';

            if ((content || reasoningContent) && res && !runMeta?.suppressOutput) {
              if (runMeta?.artifact) {
                const { entityId } = runMeta.artifact;
                const artifact = artifactMap[entityId];

                // Send create_node event to client if not created
                if (!artifact.nodeCreated) {
                  writeSSEResponse(res, {
                    event: 'create_node',
                    resultId,
                    node: {
                      type: artifact.type,
                      data: { entityId, title: artifact.title },
                    },
                  });
                  artifact.nodeCreated = true;
                }

                // Update artifact content based on type
                artifact.content += content;

                if (artifact.type === 'document' && artifact.connection) {
                  // For document artifacts, update the yjs document
                  throttledMarkdownUpdate(artifact);
                } else if (artifact.type === 'codeArtifact') {
                  // For code artifacts, save to MinIO and database
                  throttledCodeArtifactUpdate(artifact);

                  // Send stream and stream_artifact event to client
                  resultAggregator.handleStreamContent(runMeta, content, reasoningContent);
                  writeSSEResponse(res, {
                    event: 'stream',
                    resultId,
                    content,
                    reasoningContent: reasoningContent || undefined,
                    step: runMeta?.step,
                    artifact: {
                      entityId: artifact.entityId,
                      type: artifact.type,
                      title: artifact.title,
                      status: 'generating',
                    },
                  });
                }
              } else {
                // Update result content and forward stream events to client
                resultAggregator.handleStreamContent(runMeta, content, reasoningContent);
                writeSSEResponse(res, {
                  event: 'stream',
                  resultId,
                  content,
                  reasoningContent,
                  step: runMeta?.step,
                });
              }
            }
            break;
          }
          case 'on_chat_model_end':
            if (runMeta && chunk) {
              const providerItem = await this.providerService.findLLMProviderItemByModelID(
                user,
                String(runMeta.ls_model_name),
              );
              if (!providerItem) {
                this.logger.error(`model not found: ${String(runMeta.ls_model_name)}`);
              }
              const usage: TokenUsageItem = {
                tier: providerItem?.tier,
                modelProvider: providerItem?.provider?.name,
                modelName: String(runMeta.ls_model_name),
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
              if (this.usageReportQueue) {
                await this.usageReportQueue.add(`usage_report:${resultId}`, tokenUsage);
              }
            }
            break;
        }
      }
    } catch (err) {
      this.logger.error(`invoke skill error: ${err.stack}`);
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          error: genBaseRespDataFromError(err.message),
          originError: err.message,
        });
      }
      result.errors.push(err.message);
    } finally {
      // Unregister the abort controller
      this.actionService.unregisterAbortController(resultId);

      for (const artifact of Object.values(artifactMap)) {
        artifact.connection?.disconnect();
      }

      const steps = resultAggregator.getSteps({ resultId, version });
      const status = result.errors.length > 0 ? 'failed' : 'finish';

      await this.prisma.$transaction([
        this.prisma.actionResult.updateMany({
          where: { resultId, version },
          data: {
            status,
            errors: JSON.stringify(result.errors),
          },
        }),
        this.prisma.actionStep.createMany({ data: steps }),
        ...(result.pilotStepId
          ? [
              this.prisma.pilotStep.updateMany({
                where: { stepId: result.pilotStepId },
                data: { status },
              }),
            ]
          : []),
      ]);

      writeSSEResponse(res, { event: 'end', resultId, version });

      // Check if we need to auto-name the target canvas
      if (data.target?.entityType === 'canvas' && !result.errors.length) {
        const canvas = await this.prisma.canvas.findFirst({
          where: { canvasId: data.target.entityId, uid: user.uid },
        });
        if (canvas && !canvas.title) {
          if (this.autoNameCanvasQueue) {
            await this.autoNameCanvasQueue.add('autoNameCanvas', {
              uid: user.uid,
              canvasId: canvas.canvasId,
            });
          }
          // In desktop mode, we could handle auto-naming differently if needed
        }
      }

      if (tier) {
        if (this.requestUsageQueue) {
          await this.requestUsageQueue.add('syncRequestUsage', {
            uid: user.uid,
            tier,
            timestamp: new Date(),
          });
        }
        // In desktop mode, we could handle usage tracking differently if needed
      }

      // Sync pilot step if needed
      this.logger.log(`Sync pilot step for result ${resultId}, pilotStepId: ${result.pilotStepId}`);
      if (result.pilotStepId && this.pilotStepQueue) {
        await this.pilotStepQueue.add('syncPilotStep', {
          user: { uid: user.uid },
          stepId: result.pilotStepId,
        });
      }
    }
  }

  getSkillInventory() {
    return this.skillInventory;
  }

  async streamInvokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    if (res) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.status(200);
    }

    const { resultId, version } = data.result;

    const defaultModel = await this.providerService.findDefaultProviderItem(user, 'chat');
    this.skillEngine.setOptions({ defaultModel: defaultModel?.name });

    try {
      // await this.timeoutCheckQueue.add(
      //   `execution_timeout_check:${resultId}`,
      //   {
      //     uid: user.uid,
      //     resultId,
      //     version,
      //     type: 'execution',
      //   },
      //   { delay: this.config.get('skill.executionTimeout') },
      // );

      await this._invokeSkill(user, data, res);
    } catch (err) {
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          content: JSON.stringify(genBaseRespDataFromError(err)),
        });
      }
      this.logger.error(`invoke skill error: ${err.stack}`);
    } finally {
      if (res) {
        res.end('');
      }
    }
  }
}
