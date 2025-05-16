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
import { PilotEngine } from './pilot-engine';
import { PilotSession } from '@/generated/client';
import { SkillService } from '@/modules/skill/skill.service';
import { genActionResultID, genPilotSessionID, genPilotStepID } from '@refly/utils';
import { CanvasContentItem } from '@/modules/canvas/canvas.dto';
import { ProviderService } from '@/modules/provider/provider.service';
import { CanvasService } from '@/modules/canvas/canvas.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_RUN_PILOT } from '@/utils/const';
import { RunPilotJobData } from './pilot.processor';
import { ProviderItemNotFoundError } from '@refly/errors';

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
    const session = await this.prisma.pilotSession.create({
      data: {
        sessionId,
        uid: user.uid,
        maxEpoch: request.maxEpoch ?? 2,
        title: request.title || request.input?.query || 'New Pilot Session',
        input: JSON.stringify(request.input),
        targetType: request.targetType,
        targetId: request.targetId,
        providerItemId: request.providerItemId,
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

    for (const contextItemId of contextItemIds) {
      // Find the contentItem with the smallest edit distance to the contextItemId
      let bestMatch: CanvasContentItem | null = null;
      let smallestDistance = Number.POSITIVE_INFINITY;

      for (const item of contentItems) {
        if (!item?.id) continue;

        const distance = this.calculateEditDistance(item.id, contextItemId);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          bestMatch = item;
        }
      }

      // If a match was found and it's reasonably close, add it to the matched items
      // (Using a threshold to avoid completely unrelated matches)
      if (bestMatch && smallestDistance <= 10) {
        matchedItems.push(bestMatch);
      }
    }

    // Process the matched items and add them to the appropriate context arrays
    for (const item of matchedItems) {
      switch (item?.type) {
        case 'resource':
          context.resources?.push({
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
          context.documents?.push({
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
          context.codeArtifacts?.push({
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

  // Calculate Levenshtein distance between two strings
  private calculateEditDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    // Initialize the matrix
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost, // substitution
        );
      }
    }

    return matrix[a.length][b.length];
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

    const { targetId, targetType, currentEpoch, maxEpoch, providerItemId } = pilotSession;
    const canvasContentItems: CanvasContentItem[] = await this.canvasService.getCanvasContentItems(
      user,
      targetId,
    );

    this.logger.log(`Epoch (${currentEpoch}/${maxEpoch}) for session ${sessionId} started`);

    const providerItem = await this.providerService.findProviderItemById(user, providerItemId);

    if (!providerItem || providerItem.category !== 'llm' || !providerItem.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${pilotSession.providerItemId} not valid`);
    }

    const modelId = JSON.parse(providerItem.config).modelId;
    const chatModel = await this.providerService.prepareChatModel(user, modelId);

    const engine = new PilotEngine(chatModel, pilotSession);
    const rawSteps = await engine.run(canvasContentItems);

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
          modelName: modelId,
          tier: providerItem.tier,
          errors: '[]',
          pilotStepId: stepId,
          pilotSessionId: sessionId,
          runtimeConfig: '{}',
          tplConfig: '{}',
          providerItemId: providerItem.itemId,
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
          status: 'init',
        },
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
