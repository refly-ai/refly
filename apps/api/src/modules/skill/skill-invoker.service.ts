import { Injectable, Logger, Optional } from '@nestjs/common';

import { DirectConnection } from '@hocuspocus/server';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { AIMessageChunk, BaseMessage, MessageContentComplex } from '@langchain/core/dist/messages';
import { CallbackHandler as LangfuseCallbackHandler } from '@langfuse/langchain';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ProjectNotFoundError } from '@refly/errors';
import {
  ActionResult,
  ActionStep,
  Artifact,
  DriveFile,
  LLMModelConfig,
  ProviderItem,
  SkillEvent,
  TokenUsageItem,
  ToolCallMeta,
  User,
} from '@refly/openapi-schema';
import {
  BaseSkill,
  SkillEngine,
  SkillEventMap,
  SkillRunnableConfig,
  SkillRunnableMeta,
  createSkillInventory,
} from '@refly/skill-template';
import { genImageID, getWholeParsedContent, safeParseJSON } from '@refly/utils';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { EventEmitter } from 'node:events';
import * as Y from 'yjs';
import { encode } from 'gpt-tokenizer';
import {
  QUEUE_AUTO_NAME_CANVAS,
  QUEUE_SYNC_PILOT_STEP,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_SYNC_TOKEN_USAGE,
} from '../../utils/const';
import { genBaseRespDataFromError } from '../../utils/exception';
import { extractChunkContent } from '../../utils/llm';
import { writeSSEResponse } from '../../utils/response';
import { ResultAggregator } from '../../utils/result';
import { MessageAggregator } from '../../utils/message-aggregator';
import { ActionService } from '../action/action.service';
import { AutoNameCanvasJobData } from '../canvas/canvas.dto';
import { PrismaService } from '../common/prisma.service';
import { CreditUsageStep, SyncBatchTokenCreditUsageJobData } from '../credit/credit.dto';
import { CreditService } from '../credit/credit.service';
import { MiscService } from '../misc/misc.service';
import { SyncPilotStepJobData } from '../pilot/pilot.processor';
import { projectPO2DTO } from '../project/project.dto';
import { ProviderService } from '../provider/provider.service';
import { SkillEngineService } from '../skill/skill-engine.service';
import { StepService } from '../step/step.service';
import { SyncRequestUsageJobData, SyncTokenUsageJobData } from '../subscription/subscription.dto';
import { ToolCallService, ToolCallStatus } from '../tool-call/tool-call.service';
import { ToolService } from '../tool/tool.service';
import { InvokeSkillJobData } from './skill.dto';
import { DriveService } from '../drive/drive.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { normalizeCreditBilling } from '../../utils/credit-billing';

@Injectable()
export class SkillInvokerService {
  private readonly logger = new Logger(SkillInvokerService.name);

  private skillEngine: SkillEngine;
  private skillInventory: BaseSkill[];

  // Track added files to prevent duplicates (key: storageKey, value: entityId)
  private addedFilesMap: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly miscService: MiscService,
    private readonly providerService: ProviderService,
    private readonly driveService: DriveService,
    private readonly toolService: ToolService,
    private readonly toolCallService: ToolCallService,
    private readonly skillEngineService: SkillEngineService,
    private readonly actionService: ActionService,
    private readonly stepService: StepService,
    private readonly creditService: CreditService,
    private readonly canvasSyncService: CanvasSyncService,
    @Optional()
    @InjectQueue(QUEUE_SYNC_REQUEST_USAGE)
    private requestUsageQueue?: Queue<SyncRequestUsageJobData>,
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

  private async buildLangchainMessages(
    user: User,
    providerItem: ProviderItem,
    result: ActionResult,
    steps: ActionStep[],
  ): Promise<BaseMessage[]> {
    const query = result.input?.query || result.title;

    // Only create content array if images exist
    let messageContent: string | MessageContentComplex[] = query;
    if (result.input?.images?.length > 0 && (providerItem?.config as any)?.capabilities?.vision) {
      const imageUrls = await this.miscService.generateImageUrls(user, result.input.images);
      messageContent = [
        { type: 'text', text: query },
        ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
      ];
    }

    // Build consolidated tool call history by step from DB to avoid duplicating start/stream/end fragments
    const toolCallsByStep = await this.toolCallService.fetchConsolidatedToolUseOutputByStep(
      result.resultId,
      result.version,
    );

    const aiMessages =
      steps?.length > 0
        ? steps.map((step) => {
            const toolCallOutputs: any[] = toolCallsByStep?.get(step?.name ?? '') ?? [];
            const mergedContent = getWholeParsedContent(step.reasoningContent, step.content ?? '');
            return new AIMessage({
              content: mergedContent,
              additional_kwargs: {
                skillMeta: result.actionMeta,
                structuredData: step.structuredData,
                type: result.type,
                tplConfig:
                  typeof result.tplConfig === 'string'
                    ? safeParseJSON(result.tplConfig)
                    : result.tplConfig,
                toolCalls: toolCallOutputs,
              },
            });
          })
        : [];

    return [new HumanMessage({ content: messageContent }), ...aiMessages];
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
      providerItem,
      modelConfigMap,
      provider,
      resultHistory,
      projectId,
      eventListener,
      toolsets,
    } = data;
    const userPo = await this.prisma.user.findUnique({
      select: { uiLocale: true, outputLocale: true },
      where: { uid: user.uid },
    });

    const outputLocale = data?.locale || userPo?.outputLocale;
    // Merge the current context with contexts from result history
    // Current context items have priority, and duplicates are removed

    const config: SkillRunnableConfig = {
      configurable: {
        user,
        context,
        modelConfigMap,
        provider,
        locale: outputLocale,
        uiLocale: userPo.uiLocale,
        tplConfig,
        runtimeConfig,
        mode: data.mode,
        resultId: data.result?.resultId,
        version: data.result?.version,
        canvasId: data.target?.entityType === 'canvas' ? data.target?.entityId : undefined,
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
        resultHistory.map((r) => this.buildLangchainMessages(user, providerItem, r, r.steps)),
      ).then((messages) => messages.flat());
    }

    if (toolsets?.length > 0) {
      const tools = await this.toolService.instantiateToolsets(user, toolsets, this.skillEngine, {
        context,
      });
      config.configurable.selectedTools = tools;
    }

    config.configurable.installedToolsets = await this.toolService.listTools(user, {
      enabled: true,
    });

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

  private categorizeError(err: Error): {
    isGeneralTimeout: boolean;
    isNetworkError: boolean;
    isAbortError: boolean;
    userFriendlyMessage: string;
    logLevel: 'error' | 'warn';
  } {
    const errorMessage = err.message || 'Unknown error';

    // Categorize errors more reliably
    const isTimeoutError =
      err instanceof Error && (err.name === 'TimeoutError' || /timeout/i.test(err.message));
    const isAbortError =
      err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
    const isNetworkError =
      err instanceof Error && (err.name === 'NetworkError' || /network|fetch/i.test(err.message));
    const isGeneralTimeout = isTimeoutError;

    let userFriendlyMessage = errorMessage;
    let logLevel: 'error' | 'warn' = 'error';

    const ERROR_MESSAGES = {
      GENERAL_TIMEOUT: 'Request timeout. Please try again later.',
      NETWORK_ERROR: 'Network connection error. Please check your network status.',
      ABORT_ERROR: 'Operation was aborted.',
    } as const;

    if (isGeneralTimeout) {
      userFriendlyMessage = ERROR_MESSAGES.GENERAL_TIMEOUT;
    } else if (isNetworkError) {
      userFriendlyMessage = ERROR_MESSAGES.NETWORK_ERROR;
    } else if (isAbortError) {
      userFriendlyMessage = ERROR_MESSAGES.ABORT_ERROR;
      logLevel = 'warn';
    }

    return {
      isGeneralTimeout,
      isNetworkError,
      isAbortError,
      userFriendlyMessage,
      logLevel,
    };
  }

  private async _invokeSkill(user: User, data: InvokeSkillJobData, res?: Response) {
    const { input, result, context } = data;
    const { resultId, version, actionMeta, tier } = result;
    this.logger.log(
      `invoke skill with input: ${JSON.stringify(input)}, resultId: ${resultId}, version: ${version}`,
    );

    const imageFiles: DriveFile[] =
      context?.files
        ?.filter((item) => item.file?.category === 'image' || item.file?.type.startsWith('image/'))
        ?.map((item) => item.file) ?? [];
    const hasVisionCapability =
      (data.providerItem?.config as LLMModelConfig)?.capabilities?.vision ?? false;
    const providerWithKey = data.provider as { key?: string } | undefined;
    const providerKey = providerWithKey?.key ?? data.provider?.providerKey ?? '';
    const forceBase64ForImages = providerKey === 'bedrock';

    if (imageFiles.length > 0 && hasVisionCapability) {
      // Bedrock must receive embedded base64 payloads regardless of URL configuration.
      const modeOverride = forceBase64ForImages ? 'base64' : undefined;
      input.images = await this.driveService.generateDriveFileUrls(user, imageFiles, modeOverride);
    } else {
      input.images = [];
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

    // Archive files from previous execution of this result
    const canvasId = data.target?.entityType === 'canvas' ? data.target?.entityId : undefined;
    if (canvasId) {
      this.logger.log(
        `[Archive] Starting archive for resultId: ${resultId}, canvasId: ${canvasId}, uid: ${user.uid}`,
      );
      await this.driveService.archiveFiles(user, canvasId, {
        resultId,
        source: 'agent',
      });
      this.logger.log(`[Archive] Completed archive for resultId: ${resultId}`);
    } else {
      this.logger.log(`[Archive] Skipping archive - no canvasId found for resultId: ${resultId}`);
    }

    // Create abort controller for this action
    const abortController = new AbortController();

    // Delete queued job mapping from Redis (job has started executing)
    await this.actionService.deleteQueuedJob(resultId);

    // Register the abort controller with ActionService
    this.actionService.registerAbortController(resultId, abortController);

    // Set up database polling for cross-pod abort detection
    let abortCheckInterval: NodeJS.Timeout | null = null;
    const startAbortCheck = () => {
      abortCheckInterval = setInterval(
        async () => {
          if (abortController.signal.aborted) {
            clearInterval(abortCheckInterval);
            return;
          }

          try {
            const shouldAbort = await this.actionService.isAbortRequested(resultId, version);
            if (shouldAbort) {
              this.logger.log(`Detected cross-pod abort request for ${resultId}`);
              abortController.abort('Aborted by user');
              clearInterval(abortCheckInterval);
            }
          } catch (error) {
            this.logger.error(`Error checking abort status for ${resultId}: ${error?.message}`);
          }
        },
        3000, // Check every 3 seconds
      );
    };

    const stopAbortCheck = () => {
      if (abortCheckInterval) {
        clearInterval(abortCheckInterval);
        abortCheckInterval = null;
      }
    };

    // Start abort check
    startAbortCheck();

    // Simple timeout tracking without Redis
    let lastOutputTime = Date.now();
    let hasAnyOutput = false;

    // Set up periodic timeout check using Redis data
    let timeoutCheckInterval: NodeJS.Timeout | null = null;
    const streamIdleTimeout = this.config.get('skill.streamIdleTimeout');

    // Skip timeout check if streamIdleTimeout is not a positive number
    if (!streamIdleTimeout || streamIdleTimeout <= 0) {
      this.logger.debug(
        `Stream idle timeout disabled (streamIdleTimeout: ${streamIdleTimeout}). Skipping timeout check.`,
      );
    }

    // Helper function for timeout message generation
    const getTimeoutMessage = () => {
      return hasAnyOutput
        ? `Execution timeout - no output received within ${streamIdleTimeout / 1000} seconds`
        : `Execution timeout - skill failed to produce any output within ${streamIdleTimeout / 1000} seconds`;
    };

    const startTimeoutCheck = () => {
      timeoutCheckInterval = setInterval(
        async () => {
          if (abortController.signal.aborted) {
            return;
          }

          // Capture hasAnyOutput status at the beginning of the callback
          const hasOutputAtCheck = hasAnyOutput;

          // Once we have any output, stop checking for stream idle timeout
          if (hasOutputAtCheck) {
            stopTimeoutCheck();
            return;
          }

          const now = Date.now();
          const timeSinceLastOutput = now - lastOutputTime;
          const isTimeout = streamIdleTimeout > 0 && timeSinceLastOutput > streamIdleTimeout;

          if (isTimeout) {
            this.logger.warn(
              `Stream idle timeout detected for action: ${resultId}, ${timeSinceLastOutput}ms since last output`,
            );

            const timeoutReason = getTimeoutMessage();

            // Use ActionService.abortAction to handle timeout consistently
            try {
              await this.actionService.abortActionFromReq(
                user,
                { resultId, version },
                timeoutReason,
                'systemError',
              );
              this.logger.log(`Successfully aborted action ${resultId} due to stream idle timeout`);
            } catch (error) {
              this.logger.error(
                `Failed to abort action ${resultId} on stream idle timeout: ${error?.message}`,
              );
              // Fallback to direct abort if ActionService fails
              abortController.abort(timeoutReason);
              result.errors.push(timeoutReason);
              result.status = 'failed';
              result.errorType = 'systemError';
            }
            // Stop the timeout check after triggering
            if (timeoutCheckInterval) {
              clearInterval(timeoutCheckInterval);
              timeoutCheckInterval = null;
            }
          }
        },
        this.config.get<number>('skill.streamIdleCheckInterval', 5000),
      ); // Check every N seconds
    };

    const stopTimeoutCheck = () => {
      if (timeoutCheckInterval) {
        clearInterval(timeoutCheckInterval);
        timeoutCheckInterval = null;
      }
    };

    const resultAggregator = new ResultAggregator(this.stepService, resultId, version);
    const messageAggregator = new MessageAggregator(resultId, version, this.prisma);

    // Initialize structuredData with original query if available
    const originalQuery = data.input?.originalQuery;
    if (originalQuery) {
      resultAggregator.addSkillEvent({
        event: 'structured_data',
        resultId,
        step: { name: 'start' },
        structuredData: {
          query: originalQuery, // Store original query in structuredData
          processedQuery: data.input?.query, // Store processed query for reference
        },
      });
    }

    // NOTE: Artifacts include both code artifacts and documents
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

        // Record output event for simple timeout tracking
        lastOutputTime = Date.now();
        hasAnyOutput = true;

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
            this.logger.log(`artifact event received: ${JSON.stringify(artifact)}`);
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

    if (res) {
      writeSSEResponse(res, { event: 'start', resultId, version });
    }

    // Consolidated cleanup function to handle ALL timeout intervals and resources
    let cleanupExecuted = false;
    const performCleanup = () => {
      if (cleanupExecuted) return; // Prevent multiple cleanup executions
      cleanupExecuted = true;

      // Stop abort check interval
      stopAbortCheck();

      // Stop stream idle timeout check interval
      stopTimeoutCheck();

      this.logger.debug(
        `Cleaned up all timeout intervals for action ${resultId} due to abort/completion`,
      );
    };

    // Register cleanup on abort signal
    abortController.signal.addEventListener('abort', performCleanup);

    // Start the timeout check when we begin streaming (only if timeout is enabled)
    if (streamIdleTimeout > 0) {
      startTimeoutCheck();
    }

    // Create Langfuse callback handler if enabled
    // New @langfuse/langchain v4 API: simpler initialization, trace ID via runId parameter
    const langfuseEnabled = this.config.get<boolean>('langfuse.enabled');

    const callbacks = [
      langfuseEnabled &&
        this.createLangfuseHandler({
          sessionId: data.target?.entityId,
          userId: user.uid,
          skillName: data.skillName,
          mode: data.mode,
        }),
    ].filter(Boolean);

    try {
      // Check if already aborted before starting execution (handles queued aborts)
      const isAlreadyAborted = await this.actionService.isAbortRequested(resultId, version);
      if (isAlreadyAborted) {
        this.logger.warn(`Action ${resultId} already marked for abort before execution, skipping`);
        abortController.abort('Action was aborted before execution started');
        result.status = 'failed';
        result.errorType = 'userAbort';
        throw new Error('Action was aborted before execution started');
      }

      // tool callId, now we use first time returned run_id as tool call id
      const startTs = Date.now();
      const toolCallIds: Set<string> = new Set();
      const toolCallStartTimes: Map<string, number> = new Map();

      for await (const event of skill.streamEvents(input, {
        ...config,
        version: 'v2',
        signal: abortController.signal,
        callbacks,
        runName: data.skillName || 'skill-invoke',
      })) {
        runMeta = event.metadata as SkillRunnableMeta;
        const chunk: AIMessageChunk = event.data?.chunk ?? event.data?.output;

        // Record stream output for simple timeout tracking
        lastOutputTime = Date.now();
        hasAnyOutput = true;
        switch (event.event) {
          case 'on_tool_end':
          case 'on_tool_error':
          case 'on_tool_start': {
            // Skip non-tool user-visible helpers like commonQnA, and ensure toolsetKey exists
            const { toolsetKey } = event.metadata ?? {};
            if (!toolsetKey) {
              break;
            }
            const stepName = runMeta?.step?.name;
            const toolsetId = toolsetKey;
            let toolName = String(event.metadata?.name ?? '');
            // If name starts with toolsetId_, extract the part after the prefix and convert to lowercase
            const nameParts = toolName.split('_');
            if (nameParts.length >= 2 && nameParts[0].toLowerCase() === toolsetId.toLowerCase()) {
              // Remove the first element (toolsetId) and join the rest
              toolName = nameParts.slice(1).join('_').toLowerCase();
            }
            const runId = event?.run_id ? String(event.run_id) : undefined;
            const toolCallId = this.toolCallService.getOrCreateToolCallId({
              resultId,
              version,
              toolName,
              toolsetId,
              runId,
            });

            const persistToolCall = async (
              status: ToolCallStatus,
              data: {
                input: string | undefined;
                output: string | undefined;
                errorMessage?: string;
              },
            ) => {
              const input = data.input;
              const output = data.output;
              const errorMessage = String(data.errorMessage ?? '');
              const createdAt = startTs;
              const updatedAt = Date.now();
              await this.toolCallService.persistToolCallResult(
                res,
                user.uid,
                { resultId, version },
                toolsetId,
                toolName,
                input,
                output,
                status,
                toolCallId,
                stepName,
                createdAt,
                updatedAt,
                errorMessage,
              );
            };

            if (event.event === 'on_tool_start') {
              if (!toolCallIds.has(toolCallId)) {
                toolCallIds.add(toolCallId);
                const toolStartTs = Date.now();
                toolCallStartTimes.set(toolCallId, toolStartTs);
                await persistToolCall(ToolCallStatus.EXECUTING, {
                  input: event.data?.input,
                  output: '',
                });

                const toolCallMeta: ToolCallMeta = {
                  toolName,
                  toolsetKey,
                  toolsetId,
                  toolCallId,
                  startTs: toolStartTs,
                  status: 'executing' as const,
                };
                const toolMessageId = messageAggregator.addToolMessage({
                  toolCallId,
                  toolCallMeta,
                });

                // Emit tool_call_start event with toolCallMeta and messageId
                if (res) {
                  writeSSEResponse(res, {
                    event: 'tool_call_start',
                    resultId,
                    step: runMeta?.step,
                    messageId: toolMessageId,
                    toolCallMeta,
                    toolCallResult: {
                      callId: toolCallId,
                      toolsetId,
                      toolName,
                      stepName,
                      input: event.data?.input,
                      status: 'executing',
                      createdAt: startTs,
                      updatedAt: Date.now(),
                    },
                  });
                }
                break;
              }
            }
            if (event.event === 'on_tool_error') {
              const errorMsg = String((event.data as any)?.error ?? 'Tool execution failed');
              await persistToolCall(ToolCallStatus.FAILED, {
                input: undefined,
                output: event.data?.output,
                errorMessage: errorMsg,
              });

              // Add ToolMessage for failed tool execution
              const toolStartTs = toolCallStartTimes.get(toolCallId);
              const toolEndTs = Date.now();
              const toolCallMeta: ToolCallMeta = {
                toolName,
                toolsetKey,
                toolsetId,
                toolCallId,
                startTs: toolStartTs,
                endTs: toolEndTs,
                status: 'failed' as const,
                error: errorMsg,
              };
              const toolMessageId = messageAggregator.addToolMessage({
                toolCallId,
                toolCallMeta,
              });

              // Emit tool_call_error event with toolCallMeta and messageId
              if (res) {
                writeSSEResponse(res, {
                  event: 'tool_call_error',
                  resultId,
                  step: runMeta?.step,
                  messageId: toolMessageId,
                  toolCallMeta,
                  toolCallResult: {
                    callId: toolCallId,
                    toolsetId,
                    toolName,
                    stepName,
                    output: event.data?.output,
                    error: errorMsg,
                    status: 'failed',
                    createdAt: startTs,
                    updatedAt: Date.now(),
                  },
                });
              }

              this.toolCallService.releaseToolCallId({
                resultId,
                version,
                toolName,
                toolsetId,
                runId,
              });
              toolCallIds.delete(toolCallId);
              break;
            }
            if (event.event === 'on_tool_end') {
              const toolOutput = event.data?.output;
              const isErrorStatus = toolOutput?.status === 'error';
              const errorMessage = isErrorStatus
                ? String(toolOutput?.error ?? 'Tool returned error status')
                : undefined;
              const finalStatus = isErrorStatus ? ToolCallStatus.FAILED : ToolCallStatus.COMPLETED;
              await persistToolCall(finalStatus, {
                input: undefined,
                output: toolOutput,
                errorMessage,
              });

              // Add ToolMessage for message persistence
              const toolStartTs = toolCallStartTimes.get(toolCallId);
              const toolEndTs = Date.now();
              const toolCallMeta: ToolCallMeta = {
                toolName,
                toolsetKey,
                toolsetId,
                toolCallId,
                startTs: toolStartTs,
                endTs: toolEndTs,
                status: isErrorStatus ? ('failed' as const) : ('completed' as const),
                ...(isErrorStatus ? { error: errorMessage } : {}),
              };
              const toolMessageId = messageAggregator.addToolMessage({
                toolCallId,
                toolCallMeta,
              });

              // Emit tool_call_end or tool_call_error event with toolCallMeta and messageId
              if (res) {
                writeSSEResponse(res, {
                  event: isErrorStatus ? 'tool_call_error' : 'tool_call_end',
                  resultId,
                  step: runMeta?.step,
                  messageId: toolMessageId,
                  toolCallMeta,
                  toolCallResult: {
                    callId: toolCallId,
                    toolsetId,
                    toolName,
                    stepName,
                    output: toolOutput,
                    ...(isErrorStatus ? { error: errorMessage } : {}),
                    status: isErrorStatus ? 'failed' : 'completed',
                    createdAt: startTs,
                    updatedAt: Date.now(),
                  },
                });
              }

              // Extract tool_call_chunks from AIMessageChunk for successful tool runs
              if (!isErrorStatus && event.metadata?.langgraph_node === 'tools' && toolOutput) {
                if (!toolsetKey) {
                  break;
                }

                // Handle generated files from tools (sandbox, scalebox, etc.)
                // Add them to canvas as image/audio/video/document nodes
                await this.handleToolGeneratedFiles(user, data, toolOutput, resultId).catch(
                  (error) => {
                    this.logger.error(`Failed to handle tool generated files: ${error?.message}`);
                  },
                );
              }
              this.toolCallService.releaseToolCallId({
                resultId,
                version,
                toolName,
                toolsetId,
                runId,
              });
              toolCallIds.delete(toolCallId);
              break;
            }
            break;
          }
          case 'on_chat_model_stream': {
            const { content, reasoningContent } = extractChunkContent(chunk);

            if ((content || reasoningContent) && !runMeta?.suppressOutput) {
              // Start a new AI message if not already started
              if (!messageAggregator.hasCurrentAIMessage()) {
                messageAggregator.startAIMessage();
              }

              // Accumulate content for message persistence
              messageAggregator.appendToAIMessage(content, reasoningContent);

              // Update result content and forward stream events to client
              resultAggregator.handleStreamContent(runMeta, content, reasoningContent);
              if (res) {
                writeSSEResponse(res, {
                  event: 'stream',
                  resultId,
                  content,
                  reasoningContent,
                  step: runMeta?.step,
                  messageId: messageAggregator.getCurrentAIMessageId(),
                });
              }
            }
            break;
          }
          case 'on_chat_model_end':
            if (runMeta && chunk) {
              this.logger.log(`ls_model_name: ${String(runMeta.ls_model_name)}`);
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
                modelLabel: providerItem?.name,
                providerItemId: providerItem?.itemId,
                inputTokens:
                  (chunk.usage_metadata?.input_tokens ?? 0) -
                  (chunk.usage_metadata?.input_token_details?.cache_read ?? 0),
                outputTokens: chunk.usage_metadata?.output_tokens ?? 0,
                cacheReadTokens: chunk.usage_metadata?.input_token_details?.cache_read ?? 0,
              };
              resultAggregator.addUsageItem(runMeta, usage);

              // Get the current AI message ID before finalizing
              const aiMessageId = messageAggregator.getCurrentAIMessageId();

              // Record usage metadata for message persistence
              if (messageAggregator.hasCurrentAIMessage()) {
                messageAggregator.setAIMessageUsage(
                  chunk.usage_metadata?.input_tokens ?? 0,
                  chunk.usage_metadata?.output_tokens ?? 0,
                );

                // Finalize the current AI message
                messageAggregator.finalizeCurrentAIMessage();
              }

              if (res) {
                writeSSEResponse(res, {
                  event: 'token_usage',
                  resultId,
                  tokenUsage: usage,
                  step: runMeta?.step,
                  messageId: aiMessageId,
                });
              }

              if (this.usageReportQueue) {
                const tokenUsage: SyncTokenUsageJobData = {
                  ...basicUsageData,
                  usage,
                  timestamp: new Date(),
                };
                await this.usageReportQueue.add(`usage_report:${resultId}`, tokenUsage);
              }

              // Remove credit billing processing from here - will be handled after skill completion
            }
            break;
        }
      }
    } catch (err) {
      const errorInfo = this.categorizeError(err);
      const errorMessage = err.message || 'Unknown error';
      const errorType = err.name || 'Error';

      // Log error based on categorization
      if (errorInfo.isGeneralTimeout) {
        this.logger.error(`🚨 Network timeout detected for action: ${resultId} - ${errorMessage}`);
      } else if (errorInfo.isNetworkError) {
        this.logger.error(`🌐 Network error for action: ${resultId} - ${errorMessage}`);
      } else if (errorInfo.isAbortError) {
        this.logger.warn(`⏹️  Request aborted for action: ${resultId} - ${errorMessage}`);
      } else {
        this.logger.error(
          `❌ Skill execution error for action: ${resultId} - ${errorType}: ${errorMessage}`,
        );
      }

      this.logger.error(`Full error stack: ${err.stack}`);

      // For user aborts, estimate token usage from generated content
      if (errorInfo.isAbortError && runMeta) {
        try {
          await this.estimateTokenUsageOnAbort(
            user,
            data,
            input,
            resultAggregator,
            runMeta,
            resultId,
          );
        } catch (estimateError) {
          this.logger.error(`Failed to estimate token usage on abort: ${estimateError?.message}`);
        }
      }

      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          error: genBaseRespDataFromError(new Error(errorInfo.userFriendlyMessage)),
          originError: err.message,
        });
      }
      if (errorInfo.isAbortError) {
        result.status = 'failed';
        result.errorType = 'userAbort';
      } else {
        result.status = 'failed';
        result.errorType = result.errorType ?? 'systemError';
      }
      result.errors.push(errorInfo.userFriendlyMessage);
    } finally {
      // Cleanup all timers and resources to prevent memory leaks
      // Note: consolidated abort signal listener handles cleanup for early abort scenarios

      // Perform cleanup for normal completion or exception scenarios
      // (redundant with abort listener but ensures cleanup in all cases)
      if (!cleanupExecuted) {
        performCleanup();
      }

      // Unregister the abort controller
      this.actionService.unregisterAbortController(resultId);

      // Note: @langfuse/langchain v4 CallbackHandler creates OTEL spans via startAndRegisterOtelSpan()
      // These spans are processed by LangfuseSpanProcessor which handles batching and export
      // No manual flush needed - the span processor has its own export interval

      for (const artifact of Object.values(artifactMap)) {
        artifact.connection?.disconnect();
      }

      // Flush all pending messages to the database
      await messageAggregator.flush();

      const steps = await resultAggregator.getSteps({ resultId, version });
      // Get only unpersisted messages (those that failed during auto-save)
      const messages = messageAggregator.getUnpersistedMessagesAsPrismaInput();
      const status = result.errors.length > 0 ? 'failed' : 'finish';

      this.logger.log(
        `Persisting ${steps.length} steps and ${messages.length} unpersisted messages for result ${resultId}`,
      );

      await this.prisma.$transaction([
        this.prisma.actionStep.createMany({ data: steps }),
        // Persist remaining unpersisted messages to action_messages table
        // Use skipDuplicates to handle cases where messages were already auto-saved
        ...(messages.length > 0
          ? [this.prisma.actionMessage.createMany({ data: messages, skipDuplicates: true })]
          : []),
        ...(result.pilotStepId
          ? [
              this.prisma.pilotStep.updateMany({
                where: { stepId: result.pilotStepId },
                data: { status },
              }),
            ]
          : []),
        ...(result.workflowNodeExecutionId
          ? [
              this.prisma.workflowNodeExecution.updateMany({
                where: { nodeExecutionId: result.workflowNodeExecutionId },
                data: { status, endTime: new Date() },
              }),
            ]
          : []),
        this.prisma.actionResult.updateMany({
          where: { resultId, version },
          data: {
            status,
            errorType: status === 'failed' ? (result.errorType ?? 'systemError') : null,
            errors: JSON.stringify(result.errors),
          },
        }),
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
      if (result.pilotStepId && this.pilotStepQueue) {
        this.logger.log(
          `Sync pilot step for result ${resultId}, pilotStepId: ${result.pilotStepId}`,
        );
        await this.pilotStepQueue.add('syncPilotStep', {
          user: { uid: user.uid },
          stepId: result.pilotStepId,
        });
      }

      await resultAggregator.clearCache();

      // Clean up added files map for this result to prevent memory leak
      // Remove all entries for this resultId
      for (const key of this.addedFilesMap.keys()) {
        if (key.startsWith(`${resultId}:`)) {
          this.addedFilesMap.delete(key);
        }
      }

      // Process credit billing for all steps after skill completion
      // Bill credits for successful completions and user aborts (partial usage should be charged)
      const shouldBillCredits = !result.errors.length || result.errorType === 'userAbort';

      if (shouldBillCredits) {
        await this.processCreditUsageReport(user, resultId, version, resultAggregator);
      }

      // Dispose message aggregator to clean up resources (stop auto-save timer)
      messageAggregator.dispose();
    }
  }

  getSkillInventory() {
    return this.skillInventory;
  }

  /**
   * Get programming language from MIME type for codeArtifact
   */
  private getLanguageFromMimeType(mimeType?: string): string | undefined {
    if (!mimeType) return undefined;

    const mimeToLanguageMap: Record<string, string> = {
      'text/csv': 'csv',
      'application/json': 'json',
      'text/xml': 'xml',
      'application/xml': 'xml',
      'text/html': 'html',
      'text/markdown': 'markdown',
      'application/vnd.ms-excel': 'excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
      'text/x-python': 'python',
      'text/javascript': 'javascript',
      'application/javascript': 'javascript',
      'text/typescript': 'typescript',
      'application/typescript': 'typescript',
      'text/plain': 'plain',
    };

    return mimeToLanguageMap[mimeType];
  }

  /**
   * Handle files generated by tools (sandbox, scalebox, etc.)
   * Add them to canvas as image/audio/video/document nodes
   */
  private async handleToolGeneratedFiles(
    user: User,
    data: InvokeSkillJobData,
    toolOutput: any,
    parentResultId: string,
  ): Promise<void> {
    try {
      // Check if tool output contains generated files
      const uploadedFiles = toolOutput?.data?.uploadedFiles || toolOutput?.data?.uploads;
      const hasGeneratedFiles = toolOutput?.data?.hasGeneratedFiles;

      if (
        !hasGeneratedFiles ||
        !uploadedFiles ||
        !Array.isArray(uploadedFiles) ||
        uploadedFiles.length === 0
      ) {
        return;
      }

      this.logger.log(
        `Handling ${uploadedFiles.length} generated files from tool for result ${parentResultId}`,
      );

      const { target } = data;
      const targetType = target?.entityType;
      const targetId = target?.entityId;

      // Only add to canvas if target is a canvas
      if (targetType !== 'canvas' || !targetId) {
        this.logger.warn(
          `Target is not a canvas (type: ${targetType}, id: ${targetId}), skipping canvas node creation`,
        );
        return;
      }

      // Add each generated file as a canvas node
      for (const file of uploadedFiles) {
        try {
          const { type, entityId, storageKey, url, title, name, mimeType, artifactType } = file;

          if (!storageKey || !url) {
            this.logger.warn(`File ${name || title} is missing storageKey or url, skipping`);
            continue;
          }

          // Check if this file has already been added to prevent duplicates
          // Use storageKey as unique identifier
          const dedupeKey = `${parentResultId}:${storageKey}`;
          if (this.addedFilesMap.has(dedupeKey)) {
            this.logger.log(
              `File ${storageKey} already added for result ${parentResultId}, skipping duplicate`,
            );
            continue;
          }

          const nodeType = type || 'image'; // Default to image if type is not specified
          const mediaId = entityId || genImageID();
          const nodeTitle = title || name || `Generated ${nodeType}`;

          // Prepare metadata based on node type
          const metadata: any = {
            resultId: mediaId,
            storageKey,
            parentResultId,
          };

          // Add type-specific URL field
          if (nodeType === 'image') {
            metadata.imageUrl = url;
            metadata.imageType = mimeType?.split('/')?.[1] || 'png';
          } else if (nodeType === 'audio') {
            metadata.audioUrl = url;
          } else if (nodeType === 'video') {
            metadata.videoUrl = url;
          } else if (nodeType === 'document') {
            metadata.documentUrl = url;
          } else if (nodeType === 'codeArtifact') {
            // For codeArtifact, store artifact type and URL
            metadata.artifactType = artifactType || mimeType || 'text/csv';
            metadata.artifactUrl = url;
            metadata.language = this.getLanguageFromMimeType(mimeType);
          }

          // Add node to canvas
          await this.canvasSyncService.addNodesToCanvas(
            user,
            targetId,
            [
              {
                node: {
                  type: nodeType,
                  data: {
                    title: nodeTitle,
                    entityId: mediaId,
                    metadata,
                  },
                },
                connectTo: [{ type: 'skillResponse', entityId: parentResultId }],
              },
            ],
            { autoLayout: true },
          );

          // Mark this file as added
          this.addedFilesMap.set(dedupeKey, mediaId);

          this.logger.log(
            `Successfully added ${nodeType} node to canvas: ${nodeTitle} (${mediaId})`,
          );
        } catch (fileError) {
          this.logger.error(
            `Failed to add file to canvas: ${fileError?.message}`,
            fileError?.stack,
          );
          // Continue processing other files even if one fails
        }
      }
    } catch (error) {
      this.logger.error(`Error in handleToolGeneratedFiles: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  /**
   * Estimate token usage when execution is aborted.
   * Uses local tokenization (gpt-tokenizer) as a best-effort approximation.
   */
  private async estimateTokenUsageOnAbort(
    user: User,
    data: InvokeSkillJobData,
    input: any,
    resultAggregator: ResultAggregator,
    runMeta: SkillRunnableMeta,
    resultId: string,
  ): Promise<void> {
    try {
      // Get the generated content from steps
      const steps = await resultAggregator.getSteps({ resultId, version: data.result.version });
      const generatedContent = steps
        .map((step) => step.content || '')
        .filter(Boolean)
        .join('\n');

      if (!generatedContent) {
        return;
      }
      // Get provider info
      const providerItem = await this.providerService.findLLMProviderItemByModelID(
        user,
        String(runMeta.ls_model_name),
      );

      if (!providerItem) {
        return;
      }

      const inputTokens = encode(input.query || '').length;
      const outputTokens = encode(generatedContent).length;

      const usage: TokenUsageItem = {
        tier: providerItem?.tier,
        modelProvider: providerItem?.provider?.name,
        modelName: String(runMeta.ls_model_name),
        modelLabel: providerItem?.name,
        providerItemId: providerItem?.itemId,
        inputTokens,
        outputTokens,
      };

      resultAggregator.addUsageItem(runMeta, usage);
    } catch (error) {
      this.logger.error(`Error estimating token usage on abort: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  /**
   * Process credit usage report for all steps after skill completion
   * This method extracts token usage from steps and prepares batch credit billing data
   */
  private async processCreditUsageReport(
    user: User,
    resultId: string,
    version: number,
    resultAggregator: ResultAggregator,
  ): Promise<void> {
    const steps = await resultAggregator.getSteps({ resultId, version });

    // Collect all model names used in token usage
    const modelNames = new Set<string>();
    for (const step of steps) {
      if (step.tokenUsage) {
        const tokenUsageArray = safeParseJSON(step.tokenUsage);
        const tokenUsages = Array.isArray(tokenUsageArray) ? tokenUsageArray : [tokenUsageArray];

        for (const tokenUsage of tokenUsages) {
          if (tokenUsage.modelName) {
            modelNames.add(String(tokenUsage.modelName));
          }
        }
      }
    }

    // Batch fetch all provider items for the models used
    const providerItemsMap = new Map<string, any>();
    if (modelNames.size > 0) {
      const providerItems = await this.providerService.findProviderItemsByCategory(user, 'llm');
      for (const item of providerItems) {
        try {
          const config = safeParseJSON(item.config || '{}');
          if (config.modelId && modelNames.has(config.modelId)) {
            providerItemsMap.set(config.modelId, item);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse config for provider item ${item.itemId}: ${error?.message}`,
          );
        }
      }
    }

    // Collect all credit usage steps
    const creditUsageSteps: CreditUsageStep[] = [];

    for (const step of steps) {
      if (step.tokenUsage) {
        const tokenUsageArray = safeParseJSON(step.tokenUsage);

        // Handle both array and single object cases
        const tokenUsages = Array.isArray(tokenUsageArray) ? tokenUsageArray : [tokenUsageArray];

        for (const tokenUsage of tokenUsages) {
          const providerItem = providerItemsMap.get(String(tokenUsage.modelName));

          if (providerItem?.creditBilling) {
            const creditBilling = normalizeCreditBilling(safeParseJSON(providerItem.creditBilling));

            if (!creditBilling) {
              continue;
            }

            const usage: TokenUsageItem = {
              tier: providerItem?.tier,
              modelProvider: providerItem?.provider?.name,
              modelName: providerItem?.name,
              inputTokens: tokenUsage.inputTokens || 0,
              outputTokens: tokenUsage.outputTokens || 0,
            };

            creditUsageSteps.push({
              usage,
              creditBilling,
            });
          }
        }
      }
    }

    // Process credit billing for all usages in one batch
    if (creditUsageSteps.length > 0) {
      const batchTokenCreditUsage: SyncBatchTokenCreditUsageJobData = {
        uid: user.uid,
        resultId,
        version,
        creditUsageSteps,
        timestamp: new Date(),
      };

      await this.creditService.syncBatchTokenCreditUsage(batchTokenCreditUsage);

      this.logger.log(
        `Batch credit billing processed for ${resultId}: ${creditUsageSteps.length} usage items`,
      );
    }
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
      await this._invokeSkill(user, data, res);
    } catch (err) {
      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          content: JSON.stringify(genBaseRespDataFromError(err)),
          originError: err.message,
        });
      }
      this.logger.error(`invoke skill error: ${err.stack}`);

      await this.prisma.actionResult.updateMany({
        where: { resultId, version, status: { notIn: ['finish', 'failed'] } },
        data: {
          status: 'failed',
          errorType: 'systemError',
          errors: JSON.stringify([err.message]),
        },
      });
    } finally {
      if (res) {
        res.end('');
      }
    }
  }

  /**
   * Create Langfuse callback handler for LLM tracing
   */
  private createLangfuseHandler(params: {
    sessionId?: string;
    userId: string;
    skillName?: string;
    mode?: string;
  }): LangfuseCallbackHandler {
    return new LangfuseCallbackHandler({
      sessionId: params.sessionId,
      userId: params.userId,
      tags: [params.skillName || 'skill-invocation', params.mode || 'node_agent'],
      traceMetadata: {
        mode: params.mode || 'node_agent',
        skillName: params.skillName,
      },
    });
  }
}
