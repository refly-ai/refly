import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  ActionResult,
  SkillContext,
  User,
  CreatePilotSessionRequest,
  UpdatePilotSessionRequest,
  EntityType,
  ActionMeta,
} from '@refly/openapi-schema';
import {
  convertContextItemsToNodeFilters,
  convertResultContextToItems,
} from '@refly/canvas-common';
import { PilotEngine } from './pilot-engine';
import { PilotSession } from '../../generated/client';
import { SkillService } from '../skill/skill.service';
import { genActionResultID, genPilotSessionID, genPilotStepID } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { ProviderService } from '../provider/provider.service';
import { CanvasService } from '../canvas/canvas.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_RUN_PILOT } from '../../utils/const';
import { RunPilotJobData } from './pilot.processor';
import { ProviderItemNotFoundError } from '@refly/errors';
import { pilotSessionPO2DTO, pilotStepPO2DTO } from './pilot.dto';
import { buildSummarySkillInput } from './prompt/summary';
import { buildSubtaskSkillInput } from './prompt/subtask';
import { findBestMatch } from '../../utils/similarity';

export const MAX_STEPS_PER_EPOCH = 3;
export const MAX_SUMMARY_STEPS_PER_EPOCH = 1;

export const MAX_EPOCH = 3;

@Injectable()
export class PilotService {
  private logger = new Logger(PilotService.name);

  constructor(
    private prisma: PrismaService,
    private skillService: SkillService,
    private providerService: ProviderService,
    private canvasService: CanvasService,
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

    // TODO: maybe later we can use the provider item specified in the request
    const providerItem = await this.providerService.findDefaultProviderItem(user, 'agent');

    if (!providerItem) {
      throw new ProviderItemNotFoundError(`provider item ${request.providerItemId} not valid`);
    }

    const session = await this.prisma.pilotSession.create({
      data: {
        sessionId,
        uid: user.uid,
        maxEpoch: request.maxEpoch ?? MAX_EPOCH,
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
          in: steps.map((step) => step.stepId).filter(Boolean),
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
        matchedItems.push(contentItemMap.get(bestMatch));
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
        if (epochSubtaskSteps.length !== 0) {
          return;
        }
      } else {
        if (epochSummarySteps.length !== 0) {
          return;
        }

        return this.runPilotSummary(user, sessionId, session, mode);
      }

      const sessionInputObj = JSON.parse(pilotSession.input ?? '{}');
      const userQuestion = sessionInputObj?.query ?? '';
      const canvasContentItems: CanvasContentItem[] =
        await this.canvasService.getCanvasContentItems(user, targetId, true);

      const { steps } = await this.getPilotSessionDetail(user, sessionId);

      this.logger.log(`Epoch (${currentEpoch}/${maxEpoch}) for session ${sessionId} started`);

      // Get user's output locale preference
      const userPo = await this.prisma.user.findUnique({
        select: { outputLocale: true },
        where: { uid: user.uid },
      });
      const locale = userPo?.outputLocale;

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
      const chatModelId = JSON.parse(chatPi.config).modelId;

      const engine = new PilotEngine(
        agentModel,
        pilotSessionPO2DTO(pilotSession),
        steps.map(({ step, actionResult }) => pilotStepPO2DTO(step, actionResult)),
      );
      const rawSteps = await engine.run(canvasContentItems, MAX_STEPS_PER_EPOCH, locale);

      if (rawSteps.length === 0) {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'finish' },
        });
        this.logger.log(`Pilot session ${sessionId} finished due to no steps`);
        return;
      }

      const skills = this.skillService.listSkills(true);

      const latestSummarySteps =
        steps?.filter(({ step }) => step.epoch === currentEpoch - 1 && step.mode === 'summary') ||
        [];
      const contextEntityIds = latestSummarySteps.map(({ step }) => step.entityId);
      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems,
        contextEntityIds,
      );

      for (const rawStep of rawSteps) {
        const stepId = genPilotStepID();
        const skill = skills.find((skill) => skill.name === rawStep.skillName);
        if (!skill) {
          this.logger.warn(`Skill ${rawStep.skillName} not found, skip this step`);
          continue;
        }

        const recommendedContext = await this.buildContextAndHistory(
          canvasContentItems,
          rawStep.contextItemIds,
        );

        const resultId = genActionResultID();

        // Prepare tplConfig based on skill type
        let tplConfig = {};
        if (skill.name === 'webSearch') {
          // Force enable Deep Search for webSearch skill
          tplConfig = {
            enableDeepReasonWebSearch: { value: true, label: 'Deep Search', displayValue: 'true' },
          };
        }

        const actionResult = await this.prisma.actionResult.create({
          data: {
            uid: user.uid,
            resultId,
            title: rawStep.name,
            actionMeta: JSON.stringify({
              type: 'skill',
              name: skill.name,
              icon: skill.icon,
            } as ActionMeta),
            input: JSON.stringify(
              buildSubtaskSkillInput({
                userQuestion,
                query: rawStep?.query,
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
            tplConfig: JSON.stringify(tplConfig),
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
          await this.canvasService.addNodeToCanvas(
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
                  tplConfig: JSON.stringify(tplConfig),
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
            userQuestion,
            query: rawStep?.query,
          }),
          target: {
            entityId: targetId,
            entityType: targetType as EntityType,
          },
          modelName: chatModelId,
          modelItemId: chatPi.itemId,
          context: recommendedContext.context,
          resultHistory: recommendedContext.history,
          skillName: skill.name,
          selectedMcpServers: [],
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
   * Run the pilot for a given session
   * @param user - The user to run the pilot for
   * @param sessionId - The ID of the session to run the pilot for
   */
  async runPilotSummary(
    user: User,
    sessionId: string,
    session?: PilotSession,
    _mode?: 'subtask' | 'summary',
  ) {
    try {
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
      const canvasContentItems: CanvasContentItem[] =
        await this.canvasService.getCanvasContentItems(user, targetId, true);

      if (currentEpoch >= maxEpoch) {
        this.logger.log(`Pilot session ${sessionId} finished due to max epoch`);

        if (pilotSession.status !== 'finish') {
          await this.prisma.pilotSession.update({
            where: { sessionId },
            data: { status: 'finish' },
          });
        }

        return;
      }

      this.logger.log(`Epoch (${currentEpoch}/${maxEpoch}) for session ${sessionId} started`);

      const agentPi = await this.providerService.findProviderItemById(
        user,
        pilotSession.providerItemId,
      );
      if (!agentPi || agentPi.category !== 'llm' || !agentPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid for agent`,
        );
      }

      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid`,
        );
      }
      const chatModelId = JSON.parse(chatPi.config).modelId;

      const skills = this.skillService.listSkills(true);

      const { steps } = await this.getPilotSessionDetail(user, sessionId);

      const recommendedContext = await this.buildContextAndHistory(
        canvasContentItems,
        steps.map(({ step }) => step.entityId),
      );

      {
        const stepId = genPilotStepID();
        const skill = skills.find((skill) => skill.name === 'commonQnA');
        if (!skill) {
          this.logger.warn('Skill commonQnA not found, skip this step');
          return;
        }

        const { steps } = await this.getPilotSessionDetail(user, sessionId);
        const latestSubtaskSteps =
          steps?.filter(({ step }) => step.epoch === currentEpoch && step.mode === 'subtask') || [];

        const contextEntityIds = latestSubtaskSteps.map(({ step }) => step.entityId);

        const { context, history } = await this.buildContextAndHistory(
          canvasContentItems,
          contextEntityIds,
        );
        const resultId = genActionResultID();

        const input = buildSummarySkillInput({
          userQuestion: JSON.parse(pilotSession.input ?? '{}')?.query ?? '',
          currentEpoch,
          maxEpoch,
          subtaskTitles:
            latestSubtaskSteps?.map(({ actionResult }) => actionResult?.title)?.filter(Boolean) ??
            [],
        });

        const actionResult = await this.prisma.actionResult.create({
          data: {
            uid: user.uid,
            resultId,
            title: input.query,
            actionMeta: JSON.stringify({
              type: 'skill',
              name: skill.name,
              icon: skill.icon,
            } as ActionMeta),
            input: JSON.stringify(input),
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
            tplConfig: '{}',
            providerItemId: chatPi.itemId,
          },
        });
        await this.prisma.pilotStep.create({
          data: {
            stepId,
            name: input.query,
            sessionId,
            epoch: currentEpoch,
            entityId: actionResult.resultId,
            entityType: 'skillResponse',
            rawOutput: JSON.stringify({}),
            status: 'executing',
            mode: 'summary',
          },
        });

        const contextItems = convertResultContextToItems(context, history);

        if (targetType === 'canvas') {
          await this.canvasService.addNodeToCanvas(
            user,
            targetId,
            {
              type: 'skillResponse',
              data: {
                title: input.query,
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
          );
        }

        await this.skillService.sendInvokeSkillTask(user, {
          resultId,
          input: input,
          target: {
            entityId: targetId,
            entityType: targetType as EntityType,
          },
          modelName: chatModelId,
          modelItemId: chatPi.itemId,
          context: recommendedContext.context,
          resultHistory: recommendedContext.history,
          skillName: skill.name,
          selectedMcpServers: [],
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
      this.logger.error(`Error running pilot summary for session ${sessionId}:`, error);

      // Update session status to failed when an error occurs
      try {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'failed' },
        });
        this.logger.log(`Pilot session ${sessionId} status set to failed due to error in summary`);
      } catch (updateError) {
        this.logger.error(`Failed to update session ${sessionId} status to failed:`, updateError);
      }

      // Re-throw the original error to maintain the error handling chain
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

      const epochSubtaskSteps = epochSteps.filter((step) => step.mode === 'subtask');
      const epochSummarySteps = epochSteps.filter((step) => step.mode === 'summary');

      const isAllSubtaskStepsFinished =
        epochSubtaskSteps.length > 0 && epochSubtaskSteps.every((step) => step.status === 'finish');

      const isAllSummaryStepsFinished =
        epochSummarySteps.length > 0 && epochSummarySteps.every((step) => step.status === 'finish');

      const reachedMaxEpoch = step.epoch > session.maxEpoch - 1;
      this.logger.log(
        `Epoch (${session.currentEpoch}/${session.maxEpoch}) for session ${step.sessionId}: ` +
          `steps are ${isAllSummaryStepsFinished ? 'finished' : 'not finished'}`,
      );

      if (isAllSubtaskStepsFinished && epochSummarySteps.length === 0) {
        await this.runPilotQueue.add(
          `run-pilot-${step.sessionId}-${session.currentEpoch}`,
          {
            user,
            sessionId: step.sessionId,
            mode: 'summary',
          },
          { removeOnComplete: true, removeOnFail: 100 },
        );
        return;
      }

      if (isAllSubtaskStepsFinished && isAllSummaryStepsFinished) {
        await this.prisma.pilotSession.update({
          where: { sessionId: step.sessionId },
          data: {
            status: reachedMaxEpoch ? 'finish' : 'executing',
            ...(!reachedMaxEpoch ? { currentEpoch: session.currentEpoch + 1 } : {}),
          },
        });

        if (!reachedMaxEpoch) {
          // Queue the next runPilot job instead of running it directly

          await this.runPilotQueue.add(
            `run-pilot-${step.sessionId}-${session.currentEpoch + 1}`,
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
