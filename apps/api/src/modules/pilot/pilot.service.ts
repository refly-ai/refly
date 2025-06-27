import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  ActionResult,
  SkillContext,
  SkillInput,
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
import { PilotSession } from '@/generated/client';
import { SkillService } from '@/modules/skill/skill.service';
import { genActionResultID, genPilotSessionID, genPilotStepID } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { ProviderService } from '@/modules/provider/provider.service';
import { CanvasService } from '@/modules/canvas/canvas.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_RUN_PILOT } from '@/utils/const';
import { RunPilotJobData } from './pilot.processor';
import { ProviderItemNotFoundError } from '@refly/errors';
import { pilotSessionPO2DTO, pilotStepPO2DTO } from '@/modules/pilot/pilot.dto';
import { findBestMatch } from '@/utils/similarity';

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
        maxEpoch: request.maxEpoch ?? 3,
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
      { user, sessionId },
      { removeOnComplete: true, removeOnFail: 100 },
    );

    return session;
  }

  /**
   * Update a pilot session
   * @param user - The user updating the session
   * @param request - The update request
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
   */
  async runPilot(user: User, sessionId: string, session?: PilotSession) {
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

    const { steps } = await this.getPilotSessionDetail(user, sessionId);

    const { targetId, targetType, currentEpoch, maxEpoch } = pilotSession;
    const canvasContentItems: CanvasContentItem[] = await this.canvasService.getCanvasContentItems(
      user,
      targetId,
      true,
    );

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
    const agentModelId = JSON.parse(agentPi.config).modelId;
    const agentModel = await this.providerService.prepareChatModel(user, agentModelId);

    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${pilotSession.providerItemId} not valid`);
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    const engine = new PilotEngine(
      agentModel,
      pilotSessionPO2DTO(pilotSession),
      steps.map(({ step, actionResult }) => pilotStepPO2DTO(step, actionResult)),
    );
    const rawSteps = await engine.run(canvasContentItems, 3, locale);

    if (rawSteps.length === 0) {
      await this.prisma.pilotSession.update({
        where: { sessionId },
        data: { status: 'finish' },
      });
      this.logger.log(`Pilot session ${sessionId} finished due to no steps`);
      return;
    }

    const skills = this.skillService.listSkills(true);

    for (const rawStep of rawSteps) {
      const stepId = genPilotStepID();
      const skill = skills.find((skill) => skill.name === rawStep.skillName);
      if (!skill) {
        this.logger.warn(`Skill ${rawStep.skillName} not found, skip this step`);
        continue;
      }

      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems,
        rawStep.contextItemIds,
      );
      const resultId = genActionResultID();

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
          input: JSON.stringify({ query: rawStep.query } as SkillInput),
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
          name: rawStep.name,
          sessionId,
          epoch: currentEpoch,
          entityId: actionResult.resultId,
          entityType: 'skillResponse',
          rawOutput: JSON.stringify(rawStep),
          status: 'executing',
        },
      });

      const contextItems = convertResultContextToItems(context, history);

      if (targetType === 'canvas') {
        await this.canvasService.addNodeToCanvasDoc(
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
        );
      }

      await this.skillService.sendInvokeSkillTask(user, {
        resultId,
        input: { query: rawStep.query },
        target: {
          entityId: targetId,
          entityType: targetType as EntityType,
        },
        modelName: chatModelId,
        modelItemId: chatPi.itemId,
        context,
        resultHistory: history,
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
  }

  /**
   * Whenever a step is updated, check if all steps in the same epoch are completed.
   * If so, we need to update the session status to completed.
   * If not, we need to continue waiting.
   */
  async syncPilotStep(user: User, stepId: string) {
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

    const isAllStepsFinished = epochSteps.every((step) => step.status === 'finish');
    const reachedMaxEpoch = step.epoch >= session.maxEpoch;
    this.logger.log(
      `Epoch (${session.currentEpoch}/${session.maxEpoch}) for session ${step.sessionId}: ` +
        `steps are ${isAllStepsFinished ? 'finished' : 'not finished'}`,
    );

    if (isAllStepsFinished) {
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
          { user, sessionId: step.sessionId },
          { removeOnComplete: true, removeOnFail: 100 },
        );
      }
    }
  }
}
