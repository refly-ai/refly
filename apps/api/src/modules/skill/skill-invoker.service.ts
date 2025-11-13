import { Injectable, Logger, Optional } from '@nestjs/common';

import { DirectConnection } from '@hocuspocus/server';
import { AIMessageChunk, BaseMessage, MessageContentComplex } from '@langchain/core/dist/messages';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ProjectNotFoundError } from '@refly/errors';
import {
  ActionResult,
  ActionStep,
  Artifact,
  CreditBilling,
  DriveFile,
  ProviderItem,
  SkillEvent,
  TokenUsageItem,
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
import { getWholeParsedContent, safeParseJSON } from '@refly/utils';
import { Queue } from 'bullmq';
import { Response } from 'express';
import { EventEmitter } from 'node:events';
import * as Y from 'yjs';
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
import { ToolCallResult } from '../../generated/client';
import { DriveService } from '../drive/drive.service';

@Injectable()
export class SkillInvokerService {
  private readonly logger = new Logger(SkillInvokerService.name);

  private skillEngine: SkillEngine;
  private skillInventory: BaseSkill[];

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
            const toolCallOutputs: ToolCallResult[] = toolCallsByStep?.get(step?.name ?? '') ?? [];
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
      modelConfigMap,
      provider,
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

    if (toolsets?.length > 0) {
      const tools = await this.toolService.instantiateToolsets(user, toolsets, this.skillEngine);
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
    isNetworkTimeout: boolean;
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
    const isNetworkTimeout =
      errorMessage.includes('AI model network timeout') ||
      (isTimeoutError && errorMessage.includes('network'));
    const isGeneralTimeout = isTimeoutError && !isNetworkTimeout;

    let userFriendlyMessage = errorMessage;
    let logLevel: 'error' | 'warn' = 'error';

    const ERROR_MESSAGES = {
      NETWORK_TIMEOUT:
        'AI provider network request timeout. Please check provider configuration or network connection.',
      GENERAL_TIMEOUT: 'Request timeout. Please try again later.',
      NETWORK_ERROR: 'Network connection error. Please check your network status.',
      ABORT_ERROR: 'Operation was aborted.',
    } as const;

    if (isNetworkTimeout) {
      userFriendlyMessage = ERROR_MESSAGES.NETWORK_TIMEOUT;
    } else if (isGeneralTimeout) {
      userFriendlyMessage = ERROR_MESSAGES.GENERAL_TIMEOUT;
    } else if (isNetworkError) {
      userFriendlyMessage = ERROR_MESSAGES.NETWORK_ERROR;
    } else if (isAbortError) {
      userFriendlyMessage = ERROR_MESSAGES.ABORT_ERROR;
      logLevel = 'warn';
    }

    return {
      isNetworkTimeout,
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

    const imageFiles: DriveFile[] = context?.files
      ?.filter((item) => item.file?.category === 'image' || item.file?.type.startsWith('image/'))
      ?.map((item) => item.file);

    if (imageFiles.length > 0 && (data.providerItem?.config as any)?.capabilities?.vision) {
      input.images = await this.driveService.generateDriveFileUrls(user, imageFiles);
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

    // Create abort controller for this action
    const abortController = new AbortController();

    // Network timeout tracking for AI model requests
    let networkTimeoutId: NodeJS.Timeout | null = null;

    // Register the abort controller with ActionService
    this.actionService.registerAbortController(resultId, abortController);

    // Simple timeout tracking without Redis
    let lastOutputTime = Date.now();
    let hasAnyOutput = false;

    // Set up periodic timeout check using Redis data
    let timeoutCheckInterval: NodeJS.Timeout | null = null;
    const streamIdleTimeout = this.config.get('skill.streamIdleTimeout');

    // Validate streamIdleTimeout to ensure it's a positive number
    if (!streamIdleTimeout || streamIdleTimeout <= 0) {
      this.logger.error(
        `Invalid streamIdleTimeout: ${streamIdleTimeout}. Must be a positive number.`,
      );
      throw new Error(`Invalid streamIdleTimeout configuration: ${streamIdleTimeout}`);
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
          const isTimeout = timeSinceLastOutput > streamIdleTimeout;

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
              );
              this.logger.log(`Successfully aborted action ${resultId} due to stream idle timeout`);
            } catch (error) {
              this.logger.error(
                `Failed to abort action ${resultId} on stream idle timeout: ${error?.message}`,
              );
              // Fallback to direct abort if ActionService fails
              abortController.abort(timeoutReason);
              result.errors.push(timeoutReason);
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

      // Stop stream idle timeout check interval
      stopTimeoutCheck();

      // Clear AI model network timeout
      if (networkTimeoutId) {
        clearTimeout(networkTimeoutId);
        networkTimeoutId = null;
      }

      this.logger.debug(
        `Cleaned up all timeout intervals for action ${resultId} due to abort/completion`,
      );
    };

    // Register cleanup on abort signal
    abortController.signal.addEventListener('abort', performCleanup);

    // Start the timeout check when we begin streaming
    startTimeoutCheck();

    try {
      // AI model provider network timeout (30 seconds)
      const aiModelNetworkTimeout = this.config.get<number>('skill.aiModelNetworkTimeout', 30000);

      // Validate aiModelNetworkTimeout to ensure it's a positive number
      if (aiModelNetworkTimeout <= 0) {
        this.logger.error(
          `Invalid aiModelNetworkTimeout: ${aiModelNetworkTimeout}. Must be a positive number.`,
        );
        throw new Error(`Invalid aiModelNetworkTimeout configuration: ${aiModelNetworkTimeout}`);
      }

      this.logger.log(
        `🌐 Starting AI model network request (model timeout: ${aiModelNetworkTimeout}ms) for action: ${resultId}`,
      );

      // Create dedicated timeout for AI model network requests
      const createNetworkTimeout = () => {
        if (abortController.signal.aborted) {
          return;
        }
        if (networkTimeoutId) {
          clearTimeout(networkTimeoutId);
        }
        networkTimeoutId = setTimeout(() => {
          if (abortController.signal.aborted) {
            return;
          }

          this.logger.error(
            `🚨 AI model network timeout (${aiModelNetworkTimeout}ms) for action: ${resultId}`,
          );
          abortController.abort('AI model network timeout');
        }, aiModelNetworkTimeout);
      };

      // Reset network timeout on each network activity
      const resetNetworkTimeout = () => {
        createNetworkTimeout();
      };

      // Start initial network timeout
      createNetworkTimeout();

      // tool callId, now we use first time returned run_id as tool call id
      const startTs = Date.now();

      const toolCallIds: Set<string> = new Set();
      for await (const event of skill.streamEvents(input, {
        ...config,
        version: 'v2',
        signal: abortController.signal,
      })) {
        // Reset network timeout on receiving data from AI model
        resetNetworkTimeout();

        if (abortController.signal.aborted) {
          const abortReason = abortController.signal.reason?.toString() ?? 'Request aborted';
          this.logger.warn(`🚨 Request aborted for action: ${resultId}, reason: ${abortReason}`);
          if (runMeta) {
            result.errors.push(abortReason);
          }
          throw new Error(`Request aborted: ${abortReason}`);
        }

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
            const buildToolUseXML = (includeResult: boolean, errorMsg: string, updatedTs: number) =>
              this.toolCallService.generateToolUseXML({
                toolCallId,
                includeResult,
                errorMsg,
                metadata: {
                  name: toolName,
                  type: event.metadata?.type as string | undefined,
                  toolsetKey: toolsetId,
                  toolsetName: event.metadata?.toolsetName,
                },
                input: event.data?.input,
                output: event.data?.output,
                startTs: startTs,
                updatedTs: updatedTs,
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
                await persistToolCall(ToolCallStatus.EXECUTING, {
                  input: event.data?.input,
                  output: '',
                });
                // Send XML for executing state
                const xmlContent = buildToolUseXML(false, '', Date.now());
                if (xmlContent && res) {
                  resultAggregator.handleStreamContent(runMeta, xmlContent, '');
                  this.toolCallService.emitToolUseStream(res, {
                    resultId,
                    step: runMeta?.step,
                    xmlContent,
                    toolCallId,
                    toolName,
                    event_name: 'stream',
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
              // Send XML for failed state
              const xmlContent = buildToolUseXML(false, errorMsg, Date.now());
              if (xmlContent && res) {
                resultAggregator.handleStreamContent(runMeta, xmlContent, '');
                this.toolCallService.emitToolUseStream(res, {
                  resultId,
                  step: runMeta?.step,
                  xmlContent,
                  toolCallId,
                  toolName,
                  event_name: 'stream',
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
              await persistToolCall(ToolCallStatus.COMPLETED, {
                input: undefined,
                output: event.data?.output,
              });
              // Extract tool_call_chunks from AIMessageChunk
              if (event.metadata.langgraph_node === 'tools' && event.data?.output) {
                const { toolsetKey } = event.metadata ?? {};
                // Skip non-tool user-visible helpers like commonQnA, and ensure toolsetKey exists
                if (!toolsetKey) {
                  break;
                }

                const xmlContent = buildToolUseXML(true, '', Date.now());
                if (xmlContent && res) {
                  resultAggregator.handleStreamContent(runMeta, xmlContent, '');
                  this.toolCallService.emitToolUseStream(res, {
                    resultId,
                    step: runMeta?.step,
                    xmlContent,
                    toolCallId,
                    toolName,
                    event_name: 'stream',
                  });
                }
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
            // Suppress streaming content when inside tool execution to avoid duplicate outputs
            // Tools like generateDoc stream to their own targets (e.g., documents) and should not
            // also stream to the skill response channel.
            // if (event?.metadata?.langgraph_node === 'tools') {
            //   break;
            // }

            const { content, reasoningContent } = extractChunkContent(chunk);

            if ((content || reasoningContent) && !runMeta?.suppressOutput) {
              // Update result content and forward stream events to client
              resultAggregator.handleStreamContent(runMeta, content, reasoningContent);
              if (res) {
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
      // throw new Error('test-failure');
    } catch (err) {
      const errorInfo = this.categorizeError(err);
      const errorMessage = err.message || 'Unknown error';
      const errorType = err.name || 'Error';

      // Log error based on categorization
      if (errorInfo.isNetworkTimeout) {
        this.logger.error(`🚨 AI model network timeout for action: ${resultId} - ${errorMessage}`);
      } else if (errorInfo.isGeneralTimeout) {
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

      if (res) {
        writeSSEResponse(res, {
          event: 'error',
          resultId,
          version,
          error: genBaseRespDataFromError(new Error(errorInfo.userFriendlyMessage)),
          originError: err.message,
        });
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

      for (const artifact of Object.values(artifactMap)) {
        artifact.connection?.disconnect();
      }

      const steps = await resultAggregator.getSteps({ resultId, version });
      const status = result.errors.length > 0 ? 'failed' : 'finish';

      await this.prisma.$transaction([
        this.prisma.actionStep.createMany({ data: steps }),
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

      // Process credit billing for all steps after skill completion
      if (!result.errors.length) {
        await this.processCreditUsageReport(user, resultId, version, resultAggregator);
      }
    }
  }

  getSkillInventory() {
    return this.skillInventory;
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
            const creditBilling: CreditBilling = safeParseJSON(providerItem.creditBilling);

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
        where: { resultId, version },
        data: {
          status: 'failed',
          errors: JSON.stringify([err.message]),
        },
      });
    } finally {
      if (res) {
        res.end('');
      }
    }
  }
}
