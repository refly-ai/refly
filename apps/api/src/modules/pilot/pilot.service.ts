import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  ActionResult,
  SkillContext,
  User,
  CreatePilotSessionRequest,
  UpdatePilotSessionRequest,
  EntityType,
} from '@refly/openapi-schema';
import {
  convertContextItemsToNodeFilters,
  convertResultContextToItems,
} from '@refly/canvas-common';
import { PilotSession } from '../../generated/client';
import { SkillService } from '../skill/skill.service';
import {
  detectLanguage,
  genActionResultID,
  genPilotSessionID,
  genPilotStepID,
  genTransactionId,
  safeParseJSON,
} from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { ProviderService } from '../provider/provider.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_RUN_PILOT } from '../../utils/const';
import { RunPilotJobData } from './pilot.processor';
import { ProviderItemNotFoundError } from '@refly/errors';
import { buildSubtaskSkillInput } from './prompt/subtask';
import { findBestMatch } from '../../utils/similarity';
import { ToolService } from '../tool/tool.service';
import { PilotEngineService } from './pilot-engine.service';

export const MAX_STEPS_PER_EPOCH = 10;
export const MAX_SUMMARY_STEPS_PER_EPOCH = 1;

export const MAX_EPOCH = 10;

@Injectable()
export class PilotService {
  private logger = new Logger(PilotService.name);

  constructor(
    private prisma: PrismaService,
    private skillService: SkillService,
    private providerService: ProviderService,
    private toolService: ToolService,
    private canvasService: CanvasService,
    private canvasSyncService: CanvasSyncService,
    private variableExtractionService: VariableExtractionService,
    private pilotEngineService: PilotEngineService,
    @InjectQueue(QUEUE_RUN_PILOT) private runPilotQueue: Queue<RunPilotJobData>,
  ) {}

  /**
   * Create a new pilot session
   * @param user - The user to create the session for
   * @param request - The create request
   * @returns The created session
   */
  async createPilotSession(user: User, request: CreatePilotSessionRequest) {
    const sessionId = genPilotSessionID();
    const providerItem = await this.providerService.findDefaultProviderItem(user, 'agent');

    if (!providerItem) {
      throw new ProviderItemNotFoundError(`provider item ${request.providerItemId} not valid`);
    }

    const session = await this.prisma.pilotSession.create({
      data: {
        sessionId,
        uid: user.uid,
        maxEpoch: MAX_EPOCH ?? request.maxEpoch,
        title: request.title || request.input?.query || 'New Pilot Session',
        input: JSON.stringify(request.input),
        targetType: request.targetType,
        targetId: request.targetId,
        providerItemId: providerItem.itemId,
        status: 'executing',
      },
    });

    // Queue the pilot process instead of running it directly
    await this.runPilotQueue.add(
      `run-pilot-${sessionId}`,
      { user, sessionId, mode: 'subtask' },
      { removeOnComplete: true, removeOnFail: 100 },
    );

    return session;
  }

  /**
   * Update a pilot session
   * @param user - The user updating the session
   * @param request - The update requestf
   * @returns The updated session
   */
  async updatePilotSession(user: User, request: UpdatePilotSessionRequest) {
    const session = await this.prisma.pilotSession.findUnique({
      where: {
        sessionId: request.sessionId,
        uid: user.uid,
      },
    });

    if (!session) {
      throw new Error('Pilot session not found');
    }

    const updatedSession = await this.prisma.pilotSession.update({
      where: {
        sessionId: request.sessionId,
      },
      data: {
        ...(request.maxEpoch ? { maxEpoch: request.maxEpoch } : {}),
        ...(request.input ? { input: JSON.stringify(request.input) } : {}),
      },
    });

    return updatedSession;
  }

  /**
   * List pilot sessions for a user
   * @param user - The user to list sessions for
   * @param targetId - Optional target ID filter
   * @param targetType - Optional target type filter
   * @param page - Page number
   * @param pageSize - Page size
   * @returns List of matched sessions
   */
  async listPilotSessions(
    user: User,
    targetId?: string,
    targetType?: EntityType,
    page = 1,
    pageSize = 10,
  ) {
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const sessions = await this.prisma.pilotSession.findMany({
      where: {
        uid: user.uid,
        ...(targetId ? { targetId } : {}),
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return sessions;
  }

  /**
   * Get details of a pilot session including steps
   * @param user - The user to get the session for
   * @param sessionId - The ID of the session to retrieve
   * @returns The session with steps
   */
  async getPilotSessionDetail(user: User, sessionId: string) {
    const session = await this.prisma.pilotSession.findUnique({
      where: {
        sessionId,
        uid: user.uid,
      },
    });

    if (!session) {
      throw new Error('Pilot session not found');
    }

    // Get all steps for the session
    const steps = await this.prisma.pilotStep.findMany({
      where: {
        sessionId,
      },
      orderBy: [{ epoch: 'asc' }, { createdAt: 'asc' }],
    });

    // Get all action results for the session's steps in a single query
    const actionResults = await this.prisma.actionResult.findMany({
      where: {
        pilotStepId: {
          in: steps.map((step) => step.stepId).filter((id): id is string => Boolean(id)),
        },
      },
      orderBy: { version: 'desc' },
    });

    // Create a map of stepId to action result for efficient lookup
    const actionResultMap = actionResults.reduce((map, result) => {
      // Group action results by pilotStepId, keeping only the one with the highest version
      if (!map[result.pilotStepId] || result.version > map[result.pilotStepId].version) {
        map[result.pilotStepId] = result;
      }
      return map;
    }, {});

    // Combine steps with their corresponding action results
    const stepsWithResults = steps.map((step) => ({
      step,
      actionResult: actionResultMap[step.stepId] ?? null,
    }));

    return { session, steps: stepsWithResults };
  }

  /**
   * Find downstream nodes for latest summary steps based on canvas edges
   * @param user - The user
   * @param targetId - The canvas ID
   * @param latestSummarySteps - The latest summary steps
   * @returns Object containing downstream node IDs, nodes, and edges
   */
  private async findDownstreamNodes(
    user: User,
    targetId: string,
    latestSummarySteps: Array<{ step: { entityId?: string } }>,
  ) {
    try {
      // Get canvas state data
      const canvasState = await this.canvasSyncService.getCanvasData(user, { canvasId: targetId });

      // Extract summary step entity IDs
      const summaryStepEntityIds = latestSummarySteps
        .map(({ step }) => step.entityId)
        .filter(Boolean);

      if (summaryStepEntityIds.length === 0) {
        this.logger.log('No summary step entity IDs found');
        return { downstreamEntityIds: [], downstreamNodes: [], downstreamEdges: [] };
      }

      // Create a mapping from entityId to nodeId for summary steps
      const entityIdToNodeIdMap = new Map<string, string>();
      for (const node of canvasState.nodes || []) {
        if (node.data?.entityId && summaryStepEntityIds.includes(node.data.entityId)) {
          entityIdToNodeIdMap.set(node.data.entityId, node.id);
        }
      }

      // Find canvas node IDs that correspond to summary step entity IDs
      const summaryStepNodeIds = Array.from(entityIdToNodeIdMap.values());

      if (summaryStepNodeIds.length === 0) {
        this.logger.log('No matching canvas nodes found for summary step entity IDs');
        return { downstreamEntityIds: [], downstreamNodes: [], downstreamEdges: [] };
      }

      // Find all leaf nodes (most downstream nodes) starting from summary step nodes
      const leafNodeIds = this.findLeafNodes(summaryStepNodeIds, canvasState.edges || []);

      // Get complete leaf node information and extract their entity IDs
      const leafNodes = canvasState.nodes?.filter((node) => leafNodeIds.includes(node.id)) || [];

      // Extract entity IDs from leaf nodes
      const leafEntityIds = leafNodes.map((node) => node.data?.entityId).filter(Boolean);

      // Find all edges that lead to these leaf nodes
      const leafEdges =
        canvasState.edges?.filter((edge) => leafNodeIds.includes(edge.target)) || [];

      this.logger.log(
        `Found ${leafEntityIds.length} leaf entity IDs for ${summaryStepEntityIds.length} summary steps`,
      );

      return {
        downstreamEntityIds: leafEntityIds,
        downstreamNodes: leafNodes,
        downstreamEdges: leafEdges,
      };
    } catch (error) {
      this.logger.error(`Error finding downstream nodes: ${error?.message}`, error?.stack);
      return { downstreamEntityIds: [], downstreamNodes: [], downstreamEdges: [] };
    }
  }

  /**
   * Find leaf nodes (most downstream nodes) starting from given node IDs
   * @param startNodeIds - The starting node IDs
   * @param edges - The canvas edges
   * @returns Array of leaf node IDs
   */
  private findLeafNodes(
    startNodeIds: string[],
    edges: Array<{ source: string; target: string }>,
  ): string[] {
    const visited = new Set<string>();
    const leafNodes = new Set<string>();

    const findLeavesRecursive = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);

      // Find all outgoing edges from this node
      const outgoingEdges = edges.filter((edge) => edge.source === nodeId);

      if (outgoingEdges.length === 0) {
        // This is a leaf node (no outgoing edges)
        leafNodes.add(nodeId);
      } else {
        // Recursively process all target nodes
        for (const edge of outgoingEdges) {
          findLeavesRecursive(edge.target);
        }
      }
    };

    // Start from all summary step nodes
    for (const nodeId of startNodeIds) {
      findLeavesRecursive(nodeId);
    }

    return Array.from(leafNodes);
  }

  /**
   * Build CanvasContentItems from downstream entity IDs for document and codeArtifact types
   * @param user - The user
   * @param targetId - The canvas ID
   * @param downstreamEntityIds - The downstream entity IDs
   * @returns Array of CanvasContentItems
   */
  private async buildDownstreamContentItems(
    user: User,
    canvasId: string,
    downstreamEntityIds: string[],
  ): Promise<CanvasContentItem[]> {
    if (downstreamEntityIds.length === 0) {
      return [];
    }

    try {
      const contentItems: CanvasContentItem[] = [];

      // Get documents for downstream entity IDs
      const documents = await this.prisma.document.findMany({
        select: { docId: true, title: true, contentPreview: true },
        where: {
          docId: { in: downstreamEntityIds },
          canvasId,
          uid: user.uid,
          deletedAt: null,
        },
      });

      // Get code artifacts for downstream entity IDs
      const codeArtifacts = await this.prisma.codeArtifact.findMany({
        select: { artifactId: true, title: true, type: true },
        where: {
          artifactId: { in: downstreamEntityIds },
          canvasId,
          uid: user.uid,
          deletedAt: null,
        },
      });

      // Build content items from documents
      for (const doc of documents) {
        contentItems.push({
          id: doc.docId,
          title: doc.title,
          contentPreview: doc.contentPreview,
          content: doc.contentPreview, // TODO: check if we need to get the whole content
          type: 'document',
        });
      }

      // Build content items from code artifacts
      for (const artifact of codeArtifacts) {
        contentItems.push({
          id: artifact.artifactId,
          title: artifact.title,
          contentPreview: `Code artifact: ${artifact.type}`,
          content: `Code artifact: ${artifact.type}`, // TODO: get actual content if needed
          type: 'codeArtifact',
        });
      }

      this.logger.log(
        `Built ${contentItems.length} downstream content items (${documents.length} documents, ${codeArtifacts.length} code artifacts)`,
      );

      return contentItems;
    } catch (error) {
      this.logger.error(`Error building downstream content items: ${error?.message}`, error?.stack);
      return [];
    }
  }

  private async buildContextAndHistory(
    contentItems: CanvasContentItem[],
    contextItemIds: string[],
  ): Promise<{ context: SkillContext; history: ActionResult[] }> {
    // Create an empty context structure
    const context: SkillContext = {
      resources: [],
      documents: [],
      codeArtifacts: [],
    };
    const history: ActionResult[] = [];

    // If either array is empty, return the empty context
    if (!contentItems?.length || !contextItemIds?.length) {
      return { context, history };
    }

    // For each contextItemId, find the closest matching contentItem using edit distance
    const matchedItems: CanvasContentItem[] = [];

    const contentItemIds = contentItems.map((item) => item.id);

    // Create a map of contentItemId to contentItem for efficient lookup
    const contentItemMap = new Map<string, CanvasContentItem>();
    for (const item of contentItems) {
      contentItemMap.set(item.id, item);
    }

    for (const contextItemId of contextItemIds) {
      // Find the best match with a similarity threshold of 3 from the contentItemIds
      const bestMatch = findBestMatch(contextItemId, contentItemIds, { threshold: 3 });

      // If a match was found and it's reasonably close, add it to the matched items
      // (Using a threshold to avoid completely unrelated matches)
      if (bestMatch) {
        const matchedItem = contentItemMap.get(bestMatch);
        if (matchedItem) {
          matchedItems.push(matchedItem);
        }
      }
    }

    // Process the matched items and add them to the appropriate context arrays
    for (const item of matchedItems) {
      switch (item?.type) {
        case 'resource':
          context.resources.push({
            resourceId: item.id,
            resource: {
              resourceId: item.id,
              title: item.title ?? '',
              resourceType: 'text', // Default to text if not specified
              content: item.content ?? item.contentPreview ?? '',
              contentPreview: item.contentPreview ?? '',
            },
            isCurrent: true,
          });
          break;
        case 'document':
          context.documents.push({
            docId: item.id,
            document: {
              docId: item.id,
              title: item.title ?? '',
              content: item.content ?? item.contentPreview ?? '',
              contentPreview: item.contentPreview ?? '',
            },
            isCurrent: true,
          });
          break;
        case 'codeArtifact':
          context.codeArtifacts.push({
            artifactId: item.id,
            codeArtifact: {
              artifactId: item.id,
              title: item.title ?? '',
              content: item.content ?? '',
              type: 'text/markdown', // Default type if not specified
            },
            isCurrent: true,
          });
          break;
        case 'skillResponse':
          history.push({
            resultId: item.id,
            title: item.title ?? '',
          });
          break;
        default:
          // For other types, add them as contentList items
          if (item.content || item.contentPreview) {
            context.contentList = context.contentList || [];
            context.contentList.push({
              content: item.content ?? item.contentPreview ?? '',
              metadata: {
                title: item.title,
                id: item.id,
                type: item.type,
              },
            });
          }
          break;
      }
    }

    return { context, history };
  }

  /**
   * Run the pilot for a given session
   * @param user - The user to run the pilot for
   * @param sessionId - The ID of the session to run the pilot for
   * @param options - Options for running the pilot
   */
  async runPilot(
    user: User,
    sessionId: string,
    options: {
      session?: PilotSession;
      mode?: 'subtask' | 'summary';
    } = {},
  ) {
    try {
      const { session, mode } = options;

      const pilotSession =
        session ??
        (await this.prisma.pilotSession.findUnique({
          where: {
            sessionId,
            uid: user.uid,
          },
        }));

      if (!pilotSession) {
        throw new Error('Pilot session not found');
      }

      const { targetId, targetType, currentEpoch, maxEpoch } = pilotSession;

      // Find all steps in the same epoch
      const epochSteps = await this.prisma.pilotStep.findMany({
        where: {
          sessionId: sessionId,
          epoch: currentEpoch,
        },
      });

      const epochSubtaskSteps = epochSteps.filter((step) => step.mode === 'subtask');
      const epochSummarySteps = epochSteps.filter((step) => step.mode === 'summary');

      if (mode === 'subtask') {
        if (epochSubtaskSteps.length !== 0 || epochSummarySteps.length !== 0) {
          return;
        }
      }

      this.logger.log(`Epoch (${currentEpoch}/${maxEpoch}) for session ${sessionId} started`);

      // Get common resources needed for execution
      const sessionInputObj = safeParseJSON(pilotSession.input ?? '{}');
      const userQuestion = sessionInputObj?.query ?? '';
      const canvasContentItems: CanvasContentItem[] =
        await this.canvasService.getCanvasContentItems(user, targetId, true);
      const toolsets = await this.toolService.listTools(user, { enabled: true });

      // Get user's output locale preference
      const userPo = await this.prisma.user.findUnique({
        select: { outputLocale: true, uiLocale: true },
        where: { uid: user.uid },
      });

      const locale =
        userPo?.outputLocale !== 'auto' ? userPo?.outputLocale : await detectLanguage(userQuestion);

      const agentPi = await this.providerService.findProviderItemById(
        user,
        pilotSession.providerItemId,
      );
      if (!agentPi || agentPi.category !== 'llm' || !agentPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid for agent`,
        );
      }
      const agentModel = await this.providerService.prepareChatModel(user, agentPi.itemId);

      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid`,
        );
      }
      const chatModelId = safeParseJSON(chatPi.config).modelId;

      // Use PilotEngineService to handle all planning and execution logic
      const progressPlan = await this.pilotEngineService.runPilot(
        agentModel,
        sessionId,
        userQuestion,
        toolsets,
        canvasContentItems,
        locale,
      );

      const currentStage = progressPlan?.stages[currentEpoch];
      const rawSteps = currentStage?.subtasks || [];

      if (rawSteps.length === 0) {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'finish' },
        });
        this.logger.log(`Pilot session ${sessionId} finished due to no steps`);
        return;
      }

      // Get session details for context building
      const { steps } = await this.getPilotSessionDetail(user, sessionId);
      const latestSummarySteps = steps?.filter(({ step }) => step.epoch === currentEpoch - 1) || [];

      // Get canvas state data and find downstream nodes
      let downstreamContentItems: CanvasContentItem[] = [];
      let downstreamEntityIds: string[] = [];
      if (targetType === 'canvas' && latestSummarySteps.length > 0) {
        const downstreamData = await this.findDownstreamNodes(user, targetId, latestSummarySteps);
        downstreamEntityIds = downstreamData.downstreamEntityIds;

        // Build content items for downstream entities (documents and codeArtifacts)
        downstreamContentItems = await this.buildDownstreamContentItems(
          user,
          targetId,
          downstreamEntityIds,
        );

        this.logger.log(
          `Found ${downstreamEntityIds.length} downstream entity IDs and built ${downstreamContentItems.length} content items`,
        );
      }

      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems.concat(downstreamContentItems),
        downstreamEntityIds,
      );

      // Process all steps in parallel instead of sequentially
      for (const rawStep of rawSteps) {
        const stepId = genPilotStepID();

        // *** NEW: Variable extraction logic (only for updating Canvas variables, does not affect actor agents) ***
        if (targetType === 'canvas') {
          this.variableExtractionService
            .extractVariables(
              user,
              rawStep.query, // Original query
              targetId, // Canvas ID
              {
                mode: 'direct',
                triggerType: 'pilot',
              },
            )
            .then(() => {
              this.logger.log(`Variable extraction for step ${rawStep.name} completed`);
            })
            .catch((error) => {
              this.logger.warn(`Variable extraction failed for step ${rawStep.name}:`, error);
            });
        }

        // const recommendedContext = await this.buildContextAndHistory(
        //   canvasContentItems,
        //   rawStep.contextItemIds,
        // );

        const resultId = genActionResultID();

        const actionResult = await this.prisma.actionResult.create({
          data: {
            uid: user.uid,
            resultId,
            title: rawStep.name,
            input: JSON.stringify(
              buildSubtaskSkillInput({
                stage: currentStage,
                query: rawStep?.query,
                context: rawStep?.context,
                scope: rawStep?.scope,
                outputRequirements: rawStep?.outputRequirements,
                locale,
              }),
            ),
            status: 'waiting',
            targetId,
            targetType,
            context: JSON.stringify(context),
            history: JSON.stringify(history),
            modelName: chatModelId,
            tier: chatPi.tier,
            errors: '[]',
            pilotStepId: stepId,
            pilotSessionId: sessionId,
            runtimeConfig: '{}',
            providerItemId: chatPi.itemId,
          },
        });
        await this.prisma.pilotStep.create({
          data: {
            stepId,
            name: rawStep.name,
            sessionId,
            epoch: currentEpoch,
            entityId: actionResult.resultId,
            entityType: 'skillResponse',
            rawOutput: JSON.stringify(rawStep),
            status: 'executing',
            mode: 'subtask',
          },
        });

        const contextItems = convertResultContextToItems(context, history);

        if (targetType === 'canvas') {
          await this.canvasSyncService.addNodeToCanvas(
            user,
            targetId,
            {
              type: 'skillResponse',
              data: {
                title: rawStep.name,
                entityId: resultId,
                metadata: {
                  status: 'executing',
                  contextItems,
                  tplConfig: '{}',
                  runtimeConfig: '{}',
                  modelInfo: {
                    modelId: chatModelId,
                  },
                },
              },
            },
            convertContextItemsToNodeFilters(contextItems),
            { autoLayout: true }, // Enable auto layout for Agent mode
          );
        }

        await this.skillService.sendInvokeSkillTask(user, {
          resultId,
          input: buildSubtaskSkillInput({
            stage: currentStage,
            query: rawStep?.query,
            context: rawStep?.context,
            scope: rawStep?.scope,
            outputRequirements: rawStep?.outputRequirements,
            locale,
          }),
          target: {
            entityId: targetId,
            entityType: targetType as EntityType,
          },
          modelName: chatModelId,
          modelItemId: chatPi.itemId,
          context: context,
          resultHistory: history,
          toolsets,
        });
      }

      // Rotate the session status to waiting
      await this.prisma.pilotSession.update({
        where: { sessionId },
        data: {
          status: 'waiting',
        },
      });
    } catch (error) {
      this.logger.error(`Error running pilot for session ${sessionId}:`, error);

      // Update session status to failed when an error occurs
      try {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'failed' },
        });
        this.logger.log(`Pilot session ${sessionId} status set to failed due to error`);
      } catch (updateError) {
        this.logger.error(`Failed to update session ${sessionId} status to failed:`, updateError);
      }

      // Re-throw the original error to maintain the error handling chain
      throw error;
    }
  }

  /**
   * Recover a failed pilot session by retrying failed steps
   * @param user - The user to recover the session for
   * @param sessionId - The ID of the session to recover
   * @param stepIds - Optional array of specific step IDs to recover. If not provided, recovers all failed steps
   */
  async recoverPilotSession(user: User, sessionId: string, stepIds?: string[]) {
    try {
      const session = await this.prisma.pilotSession.findUnique({
        where: {
          sessionId,
          uid: user.uid,
        },
      });

      if (!session) {
        throw new Error('Pilot session not found');
      }

      if (session.status !== 'failed') {
        throw new Error('Only failed sessions can be recovered');
      }

      // Find failed steps to recover
      const whereCondition: {
        sessionId: string;
        status: string;
        stepId?: { in: string[] };
      } = {
        sessionId,
        status: 'failed',
      };

      // If specific stepIds are provided, filter by them
      if (stepIds && stepIds.length > 0) {
        whereCondition.stepId = {
          in: stepIds,
        };
      }

      const failedSteps = await this.prisma.pilotStep.findMany({
        where: whereCondition,
      });

      if (failedSteps.length === 0) {
        if (stepIds && stepIds.length > 0) {
          throw new Error(`No failed steps found with the specified IDs: ${stepIds.join(', ')}`);
        } else {
          throw new Error('No failed steps found to recover');
        }
      }

      // Get necessary context for step execution
      const { targetId, targetType } = session;
      const sessionInputObj = safeParseJSON(session.input ?? '{}');
      const canvasContentItems: CanvasContentItem[] =
        await this.canvasService.getCanvasContentItems(user, targetId, true);
      const toolsets = await this.toolService.listTools(user, { enabled: true });

      // Get user's output locale preference
      const userPo = await this.prisma.user.findUnique({
        select: { outputLocale: true, uiLocale: true },
        where: { uid: user.uid },
      });

      const locale =
        userPo?.outputLocale !== 'auto'
          ? userPo?.outputLocale
          : await detectLanguage(sessionInputObj?.query ?? '');

      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new ProviderItemNotFoundError('provider item not valid for chat');
      }
      const chatModelId = safeParseJSON(chatPi.config).modelId;

      // Update session status to executing only if recovering all failed steps
      // If only recovering specific steps, keep session status as failed until all steps are recovered
      if (!stepIds || stepIds.length === 0) {
        // Recovering all failed steps - change session status to executing
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'executing' },
        });
      } else {
        // Recovering specific steps - keep session status as failed for now
        // Session status will be updated via syncPilotStep when all steps are completed
        this.logger.log('Recovering specific steps, keeping session status as failed for now');
      }

      // Get session details for context building
      const { steps } = await this.getPilotSessionDetail(user, sessionId);

      // Process each failed step
      for (const failedStep of failedSteps) {
        const latestSummarySteps =
          steps?.filter(({ step }) => step.epoch === failedStep.epoch - 1) || [];

        // Get canvas state data and find downstream nodes
        let downstreamContentItems: CanvasContentItem[] = [];
        let downstreamEntityIds: string[] = [];
        if (targetType === 'canvas' && latestSummarySteps.length > 0) {
          const downstreamData = await this.findDownstreamNodes(user, targetId, latestSummarySteps);
          downstreamEntityIds = downstreamData.downstreamEntityIds;

          // Build content items for downstream entities
          downstreamContentItems = await this.buildDownstreamContentItems(
            user,
            targetId,
            downstreamEntityIds,
          );
        }

        const { context, history } = await this.buildContextAndHistory(
          canvasContentItems.concat(downstreamContentItems),
          downstreamEntityIds,
        );

        const originalRawStep = safeParseJSON(failedStep.rawOutput);

        // Use existing ActionResult ID but create new version for retry
        const existingResultId = failedStep.entityId;

        // Find the latest version of the existing ActionResult
        const latestResult = await this.prisma.actionResult.findFirst({
          where: {
            resultId: existingResultId,
            uid: user.uid,
          },
          orderBy: { version: 'desc' },
        });

        if (!latestResult) {
          this.logger.error(`No existing ActionResult found for failed step: ${failedStep.stepId}`);
          continue;
        }

        const newVersion = (latestResult.version ?? 0) + 1;

        // Create new version of ActionResult for retry with 'waiting' status
        // This preserves the resultId but creates a new version for the retry attempt
        await this.prisma.actionResult.create({
          data: {
            uid: user.uid,
            resultId: existingResultId, // Keep the same resultId
            version: newVersion, // Increment version for retry
            title: failedStep.name,
            input: JSON.stringify(
              buildSubtaskSkillInput({
                stage: originalRawStep.stage,
                query: originalRawStep?.query,
                context: originalRawStep?.context,
                scope: originalRawStep?.scope,
                outputRequirements: originalRawStep?.outputRequirements,
                locale,
              }),
            ),
            status: 'waiting',
            targetId,
            targetType,
            context: JSON.stringify(context),
            history: JSON.stringify(history),
            modelName: chatModelId,
            tier: chatPi.tier,
            errors: '[]',
            pilotStepId: failedStep.stepId, // Keep original stepId for sync
            pilotSessionId: sessionId,
            runtimeConfig: '{}',
            providerItemId: chatPi.itemId,
          },
        });

        // Update PilotStep status to executing (entityId remains the same)
        await this.prisma.pilotStep.update({
          where: { stepId: failedStep.stepId },
          data: {
            status: 'executing',
            // entityId stays the same, only version changes for ActionResult
          },
        });

        // Reset canvas node state for recovery (only for canvas targets)
        if (targetType === 'canvas') {
          try {
            // Get current canvas state to find the existing node
            const canvasState = await this.canvasSyncService.getCanvasData(user, {
              canvasId: targetId,
            });

            // Find the node that corresponds to this failed step
            const existingNode = canvasState.nodes?.find(
              (node) => node.data?.entityId === existingResultId,
            );

            if (existingNode) {
              // Reset the node status from 'failed' to 'waiting' to show retry attempt
              await this.canvasSyncService.syncState(user, {
                canvasId: targetId,
                transactions: [
                  {
                    txId: genTransactionId(),
                    createdAt: Date.now(),
                    syncedAt: Date.now(),
                    nodeDiffs: [
                      {
                        type: 'update',
                        id: existingNode.id,
                        from: existingNode,
                        to: {
                          ...existingNode,
                          data: {
                            ...existingNode.data,
                            // Reset content preview to empty state
                            contentPreview: '',
                            // Reset createdAt to current time to show fresh start
                            createdAt: new Date().toISOString(),
                            metadata: {
                              ...existingNode.data?.metadata,
                              status: 'waiting', // Reset from failed to waiting state
                              version: newVersion, // Update to new version for correct polling
                              // Clear all execution-related metadata to reset to initial state
                              errors: undefined,
                              tokenUsage: [],
                              artifacts: undefined,
                              structuredData: undefined,
                              reasoningContent: undefined,
                              currentLog: undefined,
                              // Keep essential metadata like selectedSkill, contextItems, etc.
                              // actionMeta: preserved
                              // modelInfo: preserved
                              // selectedSkill: preserved
                              // contextItems: preserved
                            },
                          } as any, // Type assertion to handle createdAt field
                        },
                      },
                    ],
                    edgeDiffs: [],
                  },
                ],
              });

              this.logger.log(
                `Reset canvas node ${existingNode.id} status to 'waiting' for recovery of ${existingResultId}`,
              );
            } else {
              this.logger.warn(
                `Canvas node with entityId ${existingResultId} not found for status reset`,
              );
            }
          } catch (canvasError) {
            this.logger.warn(
              `Failed to reset canvas node status during recovery: ${canvasError?.message}`,
            );
            // Don't throw - continue with skill execution even if canvas update fails
          }
        }

        // The useUpdateActionResult hook will then handle automatic status updates as the new version progresses
        this.logger.log(`Created new version ${newVersion} for ActionResult: ${existingResultId}`);

        // Re-trigger skill execution with existing resultId but new version
        await this.skillService.sendInvokeSkillTask(user, {
          resultId: existingResultId, // Use existing resultId, skill service will use new version
          input: buildSubtaskSkillInput({
            stage: originalRawStep.stage,
            query: originalRawStep?.query,
            context: originalRawStep?.context,
            scope: originalRawStep?.scope,
            outputRequirements: originalRawStep?.outputRequirements,
            locale,
          }),
          target: {
            entityId: targetId,
            entityType: targetType as EntityType,
          },
          modelName: chatModelId,
          modelItemId: chatPi.itemId,
          context: context,
          resultHistory: history,
          toolsets,
        });

        this.logger.log(
          `Retrying failed step: ${failedStep.name} with resultId: ${existingResultId}, version: ${newVersion}`,
        );
      }

      this.logger.log(`Successfully triggered recovery for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error recovering pilot session ${sessionId}:`, error);

      // Update session status back to failed if recovery attempt fails
      try {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'failed' },
        });
      } catch (updateError) {
        this.logger.error('Failed to update session status after recovery error:', updateError);
      }

      throw error;
    }
  }

  /**
   * Whenever a step is updated, check if all steps in the same epoch are completed.
   * If so, we need to update the session status to completed.
   * If not, we need to continue waiting.
   */
  async syncPilotStep(user: User, stepId: string) {
    try {
      const step = await this.prisma.pilotStep.findUnique({
        where: { stepId },
      });

      if (!step) {
        this.logger.warn(`Pilot step ${stepId} not found`);
        return;
      }

      // Find all steps in the same epoch
      const epochSteps = await this.prisma.pilotStep.findMany({
        where: {
          sessionId: step.sessionId,
          epoch: step.epoch,
        },
      });
      const session = await this.prisma.pilotSession.findUnique({
        where: { sessionId: step.sessionId },
      });

      if (!session) {
        this.logger.warn(`Pilot session ${step.sessionId} not found`);
        return;
      }

      if (session.currentEpoch !== step.epoch) {
        this.logger.warn(`Pilot session ${step.sessionId} has reached max epoch`);
        return;
      }

      const epochSubtaskSteps = epochSteps.filter((step) => step.mode === 'subtask');

      const isSubtaskStepsFailed =
        epochSubtaskSteps.length > 0 && epochSubtaskSteps.some((step) => step.status === 'failed');

      if (isSubtaskStepsFailed) {
        await this.prisma.pilotSession.update({
          where: { sessionId: step.sessionId },
          data: { status: 'failed' },
        });
        return;
      }

      const isAllSubtaskStepsFinished =
        epochSubtaskSteps.length > 0 && epochSubtaskSteps.every((step) => step.status === 'finish');

      const reachedMaxEpoch = step.epoch > session.maxEpoch - 1;
      this.logger.log(
        `Epoch (${session.currentEpoch}/${session.maxEpoch}) for session ${step.sessionId}: ` +
          `subtask steps are ${isAllSubtaskStepsFinished ? 'finished' : 'not finished'}`,
      );

      if (isAllSubtaskStepsFinished) {
        await this.prisma.pilotSession.update({
          where: { sessionId: step.sessionId },
          data: {
            status: reachedMaxEpoch ? 'finish' : 'executing',
            ...(!reachedMaxEpoch ? { currentEpoch: step.epoch + 1 } : {}),
          },
        });

        if (!reachedMaxEpoch) {
          // Queue the next runPilot job instead of running it directly

          await this.runPilotQueue.add(
            `run-pilot-${step.sessionId}-${step.epoch + 1}`,
            {
              user,
              sessionId: step.sessionId,
              mode: 'subtask',
            },
            { removeOnComplete: true, removeOnFail: 100 },
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error syncing pilot step ${stepId}:`, error);

      // Try to get the step to identify the session
      try {
        const errorStep = await this.prisma.pilotStep.findUnique({
          where: { stepId },
          select: { sessionId: true },
        });

        if (errorStep?.sessionId) {
          // Update session status to failed when an error occurs in sync
          await this.prisma.pilotSession.update({
            where: { sessionId: errorStep.sessionId },
            data: { status: 'finish' },
          });
          this.logger.log(
            `Pilot session ${errorStep.sessionId} status set to failed due to sync error`,
          );
        }
      } catch (updateError) {
        this.logger.error(
          'Failed to update session status to failed during sync error:',
          updateError,
        );
      }

      // Re-throw the original error to maintain the error handling chain
      throw error;
    }
  }
}
