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
import { buildBootstrapSummaryAndPlanInput } from './prompt/bootstrap';
import { extractPlanFromMarkdown, mapPlanToRawSteps } from './plan-extractor';
import { findBestMatch } from '../../utils/similarity';

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
        currentEpoch: 0, // Start with epoch 0 for bootstrap
        title: request.title || request.input?.query || 'New Pilot Session',
        input: JSON.stringify(request.input),
        targetType: request.targetType,
        targetId: request.targetId,
        providerItemId: providerItem.itemId,
        status: 'executing',
      },
    });

    // Queue the bootstrap GlobalPlan process instead of running subtask directly
    await this.runPilotQueue.add(
      `run-pilot-${sessionId}`,
      { user, sessionId, mode: 'bootstrap' },
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
  async runPilot(
    user: User,
    sessionId: string,
    session?: PilotSession,
    mode?: 'subtask' | 'summary' | 'finalOutput' | 'bootstrap',
  ) {
    if (mode === 'summary') {
      return this.runPilotSummary(user, sessionId, session, mode);
    }

    if (mode === 'bootstrap') {
      return this.runPilotBootstrap(user, sessionId, session);
    }

    if (mode === 'finalOutput') {
      return this.runPilotFinalOutput(user, sessionId, session);
    }

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
    const sessionInputObj = JSON.parse(pilotSession.input ?? '{}');
    const userQuestion = sessionInputObj?.query ?? '';
    const canvasContentItems: CanvasContentItem[] = await this.canvasService.getCanvasContentItems(
      user,
      targetId,
      true,
    );

    const { steps } = await this.getPilotSessionDetail(user, sessionId);
    const latestSummarySteps =
      steps?.filter(({ step }) => step.epoch === currentEpoch - 1 && step.mode === 'summary') || [];

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
      latestSummarySteps.map(({ step, actionResult }) => pilotStepPO2DTO(step, actionResult)),
    );
    const rawSteps = await engine.run(canvasContentItems, 5, locale);

    if (rawSteps.length === 0) {
      await this.prisma.pilotSession.update({
        where: { sessionId },
        data: { status: 'finish' },
      });
      this.logger.log(`Pilot session ${sessionId} finished due to no steps`);
      return;
    }

    const skills = this.skillService.listSkills(true);

    const contextEntityIds = latestSummarySteps.map(({ step }) => step.entityId);

    for (const rawStep of rawSteps) {
      const stepId = genPilotStepID();
      const skill = skills.find((skill) => skill.name === rawStep.skillName);
      if (!skill) {
        this.logger.warn(`Skill ${rawStep.skillName} not found, skip this step`);
        continue;
      }

      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems,
        contextEntityIds,
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
          input: JSON.stringify(
            buildSubtaskSkillInput({
              userQuestion,
              locale,
              summaryTitle:
                latestSummarySteps?.[0]?.actionResult?.title || latestSummarySteps?.[0]?.step?.name,
              plannedAction: {
                priority: rawStep?.priority,
                skillName: rawStep?.skillName as any,
                query: rawStep?.query,
                contextHints: (rawStep?.contextItemIds as string[]) ?? [],
              },
            }) as SkillInput,
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
        input: buildSubtaskSkillInput({
          userQuestion,
          locale,
          summaryTitle:
            latestSummarySteps?.[0]?.actionResult?.title || latestSummarySteps?.[0]?.step?.name,
          plannedAction: {
            priority: rawStep?.priority,
            skillName: rawStep?.skillName as any,
            query: rawStep?.query,
            contextHints: (rawStep?.contextItemIds as string[]) ?? [],
          },
        }),
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
   * Run the bootstrap GlobalPlan for a new session
   * @param user - The user to run the bootstrap for
   * @param sessionId - The ID of the session to bootstrap
   */
  async runPilotBootstrap(user: User, sessionId: string, session?: PilotSession) {
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

    const { targetId, targetType, maxEpoch } = pilotSession;
    const sessionInputObj = JSON.parse(pilotSession.input ?? '{}');
    const userQuestion = sessionInputObj?.query ?? '';

    // Get user's output locale preference
    const userPo = await this.prisma.user.findUnique({
      select: { outputLocale: true },
      where: { uid: user.uid },
    });
    const locale = userPo?.outputLocale;

    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new ProviderItemNotFoundError('provider item not valid for bootstrap');
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    const skills = this.skillService.listSkills(true);

    // Create the GlobalPlan step
    const stepId = genPilotStepID();
    const skill = skills.find((skill) => skill.name === 'commonQnA');
    if (!skill) {
      this.logger.warn('Skill commonQnA not found, skip bootstrap');
      return;
    }

    // No context/history for bootstrap (starting fresh)
    const context = {
      resources: [],
      documents: [],
      codeArtifacts: [],
    };
    const history = [];
    const resultId = genActionResultID();

    const actionResult = await this.prisma.actionResult.create({
      data: {
        uid: user.uid,
        resultId,
        title: 'GlobalPlan',
        actionMeta: JSON.stringify({
          type: 'skill',
          name: skill.name,
          icon: skill.icon,
        } as ActionMeta),
        input: JSON.stringify(
          buildBootstrapSummaryAndPlanInput({
            userQuestion,
            maxEpoch,
            locale,
          }) as SkillInput,
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
        tplConfig: '{}',
        providerItemId: chatPi.itemId,
      },
    });

    await this.prisma.pilotStep.create({
      data: {
        stepId,
        name: 'GlobalPlan',
        sessionId,
        epoch: 0, // Bootstrap is epoch 0
        entityId: actionResult.resultId,
        entityType: 'skillResponse',
        rawOutput: JSON.stringify({}),
        status: 'executing',
        mode: 'summary', // Use summary mode but this is actually bootstrap
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
            title: 'GlobalPlan',
            entityId: resultId,
            metadata: {
              status: 'executing',
              contextItems,
              tplConfig: '{}',
              runtimeConfig: '{}',
              modelInfo: {
                modelId: chatModelId,
              },
              // Mark this as a bootstrap/global plan node
              summaryAndPlan: true,
              epoch: 0,
              isGlobalPlan: true,
              globalPlanConfig: {
                maxEpoch,
                userQuestion,
                expectedEpochs: Array.from({ length: maxEpoch }, (_, i) => i + 1),
              },
            },
          },
        },
        convertContextItemsToNodeFilters(contextItems),
      );
    }

    await this.skillService.sendInvokeSkillTask(user, {
      resultId,
      input: buildBootstrapSummaryAndPlanInput({
        userQuestion,
        maxEpoch,
        locale,
      }),
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

    // Update session status to waiting
    await this.prisma.pilotSession.update({
      where: { sessionId },
      data: {
        status: 'waiting',
      },
    });
  }

  /**
   * Run the final output generation for a session
   * @param user - The user to run the final output for
   * @param sessionId - The ID of the session to generate final output
   */
  async runPilotFinalOutput(user: User, sessionId: string, session?: PilotSession) {
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

    const { targetId, targetType, currentEpoch } = pilotSession;
    const sessionInputObj = JSON.parse(pilotSession.input ?? '{}');
    const userQuestion = sessionInputObj?.query ?? '';

    // Get user's output locale preference
    const userPo = await this.prisma.user.findUnique({
      select: { outputLocale: true },
      where: { uid: user.uid },
    });
    const locale = userPo?.outputLocale;

    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new ProviderItemNotFoundError('provider item not valid for final output');
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    const skills = this.skillService.listSkills(true);

    // Get all previous steps for context
    const { steps } = await this.getPilotSessionDetail(user, sessionId);
    const allCompletedSteps = steps?.filter(({ step }) => step.status === 'finish') || [];
    const contextEntityIds = allCompletedSteps.map(({ step }) => step.entityId);

    const canvasContentItems = await this.canvasService.getCanvasContentItems(user, targetId, true);

    // Create the FinalOutput step
    const stepId = genPilotStepID();
    const skill = skills.find((skill) => skill.name === 'generateDoc'); // Use generateDoc for final output
    if (!skill) {
      this.logger.warn('Skill generateDoc not found, using commonQnA for final output');
      const fallbackSkill = skills.find((skill) => skill.name === 'commonQnA');
      if (!fallbackSkill) {
        this.logger.error('No suitable skill found for final output');
        return;
      }
    }

    const finalSkill = skill || skills.find((skill) => skill.name === 'commonQnA')!;

    const { context, history } = await this.buildContextAndHistory(
      canvasContentItems,
      contextEntityIds,
    );
    const resultId = genActionResultID();

    // Build final output input
    const finalOutputInput = {
      query: `Based on all the research and analysis completed across ${currentEpoch} epochs, please provide a comprehensive final output for the user's original question: "${userQuestion}". 

Please synthesize all findings, insights, and conclusions into a coherent, well-structured response that fully addresses the user's needs. The output should be in ${locale || 'en-US'}.

Key requirements:
1. Comprehensive synthesis of all research and analysis
2. Clear, actionable insights and recommendations
3. Well-structured and professional presentation
4. Direct answers to the original question
5. Supporting evidence and reasoning from the research conducted`,
    };

    const actionResult = await this.prisma.actionResult.create({
      data: {
        uid: user.uid,
        resultId,
        title: 'Final Output',
        actionMeta: JSON.stringify({
          type: 'skill',
          name: finalSkill.name,
          icon: finalSkill.icon,
        } as ActionMeta),
        input: JSON.stringify(finalOutputInput as SkillInput),
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
        name: 'Final Output',
        sessionId,
        epoch: currentEpoch, // Same epoch as final decision
        entityId: actionResult.resultId,
        entityType: 'skillResponse',
        rawOutput: JSON.stringify({}),
        status: 'executing',
        mode: 'finalOutput', // New mode for final output
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
            title: 'Final Output',
            entityId: resultId,
            metadata: {
              status: 'executing',
              contextItems,
              tplConfig: '{}',
              runtimeConfig: '{}',
              modelInfo: {
                modelId: chatModelId,
              },
              // Mark as final output
              finalOutput: true,
              epoch: currentEpoch,
            },
          },
        },
        convertContextItemsToNodeFilters(contextItems),
      );
    }

    await this.skillService.sendInvokeSkillTask(user, {
      resultId,
      input: finalOutputInput,
      target: {
        entityId: targetId,
        entityType: targetType as EntityType,
      },
      modelName: chatModelId,
      modelItemId: chatPi.itemId,
      context,
      resultHistory: history,
      skillName: finalSkill.name,
      selectedMcpServers: [],
    });

    // Mark session as finished
    await this.prisma.pilotSession.update({
      where: { sessionId },
      data: {
        status: 'finish',
      },
    });

    this.logger.log(`Final output generated for session ${sessionId}`);
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
    _mode?: 'subtask' | 'summary' | 'finalOutput',
  ) {
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
    const canvasContentItems: CanvasContentItem[] = await this.canvasService.getCanvasContentItems(
      user,
      targetId,
      true,
    );

    const { steps } = await this.getPilotSessionDetail(user, sessionId);
    const latestSubtaskSteps =
      steps?.filter(({ step }) => step.epoch === currentEpoch && step.mode === 'subtask') || [];

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

    // Get user's output locale preference
    const userPo = await this.prisma.user.findUnique({
      select: { outputLocale: true },
      where: { uid: user.uid },
    });
    const locale = userPo?.outputLocale;

    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new ProviderItemNotFoundError(`provider item ${pilotSession.providerItemId} not valid`);
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    const skills = this.skillService.listSkills(true);

    const contextEntityIds = latestSubtaskSteps.map(({ step }) => step.entityId);

    {
      const stepId = genPilotStepID();
      const skill = skills.find((skill) => skill.name === 'commonQnA');
      if (!skill) {
        this.logger.warn('Skill commonQnA not found, skip this step');
        return;
      }

      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems,
        contextEntityIds,
      );
      const resultId = genActionResultID();

      const actionResult = await this.prisma.actionResult.create({
        data: {
          uid: user.uid,
          resultId,
          title: 'Summary',
          actionMeta: JSON.stringify({
            type: 'skill',
            name: skill.name,
            icon: skill.icon,
          } as ActionMeta),
          input: JSON.stringify(
            buildSummarySkillInput({
              userQuestion: JSON.parse(pilotSession.input ?? '{}')?.query ?? '',
              currentEpoch,
              maxEpoch,
              locale,
              subtaskTitles:
                latestSubtaskSteps
                  ?.map(({ actionResult }) => actionResult?.title)
                  ?.filter(Boolean) ?? [],
            }) as SkillInput,
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
          tplConfig: '{}',
          providerItemId: chatPi.itemId,
        },
      });
      await this.prisma.pilotStep.create({
        data: {
          stepId,
          name: `Summary ${locale}`,
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
              title: 'Summary',
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
        input: buildSummarySkillInput({
          userQuestion: JSON.parse(pilotSession.input ?? '{}')?.query ?? '',
          currentEpoch,
          maxEpoch,
          locale:
            (
              await this.prisma.user.findUnique({
                select: { outputLocale: true },
                where: { uid: user.uid },
              })
            )?.outputLocale ?? 'en-US',
          subtaskTitles:
            latestSubtaskSteps?.map(({ actionResult }) => actionResult?.title)?.filter(Boolean) ??
            [],
        }),
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
   * Create subtasks from a parsed plan (used when SummaryAndPlan provides next epoch plan)
   * @param user - The user
   * @param sessionId - The session ID
   * @param targetEpoch - The target epoch for the new subtasks
   * @param rawSteps - The raw steps from the plan
   */
  private async createSubtasksFromPlan(
    user: User,
    sessionId: string,
    targetEpoch: number,
    rawSteps: Array<{
      name: string;
      skillName: string;
      priority: number;
      query: string;
      contextItemIds: string[];
      workflowStage: string;
    }>,
  ) {
    // Get session and canvas content
    const pilotSession = await this.prisma.pilotSession.findUnique({
      where: { sessionId, uid: user.uid },
    });

    if (!pilotSession) {
      throw new Error('Pilot session not found');
    }

    const { targetId, targetType } = pilotSession;
    const sessionInputObj = JSON.parse(pilotSession.input ?? '{}');
    const userQuestion = sessionInputObj?.query ?? '';

    const canvasContentItems = await this.canvasService.getCanvasContentItems(user, targetId, true);

    // Get user's output locale preference
    const userPo = await this.prisma.user.findUnique({
      select: { outputLocale: true },
      where: { uid: user.uid },
    });
    const locale = userPo?.outputLocale;

    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new ProviderItemNotFoundError('provider item not valid');
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    const skills = this.skillService.listSkills(true);

    // Get previous summary step for context
    const { steps } = await this.getPilotSessionDetail(user, sessionId);
    const latestSummarySteps =
      steps?.filter(({ step }) => step.epoch === targetEpoch - 1 && step.mode === 'summary') || [];

    // Create subtasks from the plan
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
          input: JSON.stringify(
            buildSubtaskSkillInput({
              userQuestion,
              locale,
              summaryTitle:
                latestSummarySteps?.[0]?.actionResult?.title || latestSummarySteps?.[0]?.step?.name,
              plannedAction: {
                priority: rawStep.priority,
                skillName: rawStep.skillName as any,
                query: rawStep.query,
                contextHints: rawStep.contextItemIds,
              },
            }) as SkillInput,
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
          tplConfig: '{}',
          providerItemId: chatPi.itemId,
        },
      });

      await this.prisma.pilotStep.create({
        data: {
          stepId,
          name: rawStep.name,
          sessionId,
          epoch: targetEpoch,
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
        input: buildSubtaskSkillInput({
          userQuestion,
          locale,
          summaryTitle:
            latestSummarySteps?.[0]?.actionResult?.title || latestSummarySteps?.[0]?.step?.name,
          plannedAction: {
            priority: rawStep.priority,
            skillName: rawStep.skillName as any,
            query: rawStep.query,
            contextHints: rawStep.contextItemIds,
          },
        }),
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

    this.logger.log(`Created ${rawSteps.length} subtasks for epoch ${targetEpoch} from plan`);
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

    const isAllSubtaskStepsFinished =
      epochSteps.filter((step) => step.mode === 'subtask').length > 0 &&
      epochSteps
        .filter((step) => step.mode === 'subtask')
        .every((step) => step.status === 'finish');

    const isAllSummaryStepsFinished =
      epochSteps.filter((step) => step.mode === 'summary').length > 0 &&
      epochSteps
        .filter((step) => step.mode === 'summary')
        .every((step) => step.status === 'finish');

    // Epoch 0 is GlobalPlan, so actual work epochs are 1..maxEpoch
    // We reach max when current epoch > maxEpoch (e.g., epoch 4 when maxEpoch=3)
    const reachedMaxEpoch = step.epoch > session.maxEpoch;

    // Special handling for Bootstrap (epoch 0) - only has GlobalPlan (summary mode)
    const isBootstrapEpoch = step.epoch === 0;
    const isBootstrapCompleted = isBootstrapEpoch && isAllSummaryStepsFinished;

    // For display purposes: show 0 as "Bootstrap", others as actual work epoch (epoch-1)
    const displayEpoch = isBootstrapEpoch ? 'Bootstrap' : `${step.epoch}/${session.maxEpoch}`;

    this.logger.log(
      `Epoch ${displayEpoch} for session ${step.sessionId}: ` +
        `${isBootstrapEpoch ? 'GlobalPlan' : 'Regular'} epoch, ` +
        `steps are ${isAllSummaryStepsFinished ? 'finished' : 'not finished'}`,
    );

    // Handle Bootstrap completion (epoch 0)
    if (isBootstrapCompleted) {
      this.logger.log(
        `Bootstrap GlobalPlan completed for session ${step.sessionId}, extracting first epoch plan`,
      );

      // Extract and execute plan from GlobalPlan
      const summaryStep = epochSteps.find((s) => s.mode === 'summary');
      let planExecuted = false;

      if (summaryStep) {
        const actionResult = await this.prisma.actionResult.findFirst({
          where: { pilotStepId: summaryStep.stepId },
          orderBy: { version: 'desc' },
        });

        if (actionResult) {
          // Get the ActionStep content for this ActionResult
          const actionSteps = await this.prisma.actionStep.findMany({
            where: {
              resultId: actionResult.resultId,
              version: actionResult.version,
            },
            orderBy: { order: 'asc' },
          });

          const content = actionSteps.map((s) => s.content).join('\n\n');

          if (content) {
            // Extract plan from the GlobalPlan content
            const extractionResult = extractPlanFromMarkdown(content, 5);

            if (extractionResult.success) {
              const plan = extractionResult.plan;
              this.logger.log(
                `Extracted plan from GlobalPlan: readyForFinal=${plan.readyForFinal}, steps=${plan.nextEpochPlan.length}`,
              );

              // Save global planning information if available
              if (plan.globalPlanning) {
                this.logger.log(
                  `Global planning extracted with ${plan.globalPlanning.epochBreakdown.length} epochs`,
                );

                // Update the PilotStep's rawOutput with global planning info
                await this.prisma.pilotStep.update({
                  where: { stepId: summaryStep.stepId },
                  data: {
                    rawOutput: JSON.stringify({
                      globalPlanning: plan.globalPlanning,
                      extractedAt: new Date().toISOString(),
                    }),
                  },
                });
              }

              if (plan.readyForFinal) {
                // Rare case: ready for final output immediately after bootstrap
                await this.runPilotQueue.add(
                  `run-pilot-finalOutput-${step.sessionId}`,
                  {
                    user,
                    sessionId: step.sessionId,
                    mode: 'finalOutput',
                  },
                  { removeOnComplete: true, removeOnFail: 100 },
                );

                await this.prisma.pilotSession.update({
                  where: { sessionId: step.sessionId },
                  data: { status: 'executing' },
                });

                planExecuted = true;
              } else if (plan.nextEpochPlan.length > 0) {
                // Create first epoch subtasks from GlobalPlan
                const rawSteps = mapPlanToRawSteps(plan);
                await this.createSubtasksFromPlan(user, step.sessionId, 1, rawSteps); // Start with epoch 1

                await this.prisma.pilotSession.update({
                  where: { sessionId: step.sessionId },
                  data: {
                    status: 'executing',
                    currentEpoch: 1, // Move to epoch 1
                  },
                });

                planExecuted = true;
              }
            } else {
              this.logger.warn(`Failed to extract plan from GlobalPlan: ${extractionResult}`);
            }
          }
        }
      }

      // Fallback: if plan extraction failed, use traditional approach for epoch 1
      if (!planExecuted) {
        this.logger.warn(
          'GlobalPlan extraction failed, falling back to traditional approach for epoch 1',
        );

        await this.prisma.pilotSession.update({
          where: { sessionId: step.sessionId },
          data: {
            status: 'executing',
            currentEpoch: 1, // Move to epoch 1
          },
        });

        await this.runPilotQueue.add(
          `run-pilot-${step.sessionId}-1`,
          {
            user,
            sessionId: step.sessionId,
            mode: 'subtask',
          },
          { removeOnComplete: true, removeOnFail: 100 },
        );
      }

      return; // Exit early for bootstrap handling
    }

    if (isAllSubtaskStepsFinished && !isAllSummaryStepsFinished) {
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
      // Try to extract and execute plan from SummaryAndPlan
      const summaryStep = epochSteps.find((s) => s.mode === 'summary');
      let planExecuted = false;

      if (summaryStep) {
        const actionResult = await this.prisma.actionResult.findFirst({
          where: { pilotStepId: summaryStep.stepId },
          orderBy: { version: 'desc' },
        });

        if (actionResult) {
          // Get the ActionStep content for this ActionResult
          const actionSteps = await this.prisma.actionStep.findMany({
            where: {
              resultId: actionResult.resultId,
              version: actionResult.version,
            },
            orderBy: { order: 'asc' },
          });

          const content = actionSteps.map((s) => s.content).join('\n\n');

          if (content) {
            // Extract plan from the SummaryAndPlan content
            const extractionResult = extractPlanFromMarkdown(content, 5);

            if (extractionResult.success) {
              const plan = extractionResult.plan;
              this.logger.log(
                `Extracted plan from SummaryAndPlan: readyForFinal=${plan.readyForFinal}, steps=${plan.nextEpochPlan.length}`,
              );

              if (plan.readyForFinal) {
                // Ready for final output - trigger finalOutput mode
                await this.runPilotQueue.add(
                  `run-pilot-finalOutput-${step.sessionId}`,
                  {
                    user,
                    sessionId: step.sessionId,
                    mode: 'finalOutput',
                  },
                  { removeOnComplete: true, removeOnFail: 100 },
                );

                await this.prisma.pilotSession.update({
                  where: { sessionId: step.sessionId },
                  data: { status: 'executing' },
                });

                planExecuted = true;
              } else if (!reachedMaxEpoch && plan.nextEpochPlan.length > 0) {
                // Create next epoch subtasks directly from the plan
                const rawSteps = mapPlanToRawSteps(plan);
                await this.createSubtasksFromPlan(
                  user,
                  step.sessionId,
                  session.currentEpoch + 1,
                  rawSteps,
                );

                await this.prisma.pilotSession.update({
                  where: { sessionId: step.sessionId },
                  data: {
                    status: 'executing',
                    currentEpoch: session.currentEpoch + 1,
                  },
                });

                planExecuted = true;
              }
            } else {
              this.logger.warn(`Failed to extract plan from SummaryAndPlan: ${extractionResult}`);
            }
          }
        }
      }

      // Fallback: use old approach if plan extraction failed or no summary step
      if (!planExecuted) {
        if (reachedMaxEpoch) {
          // Force final output only as last resort when max epoch exceeded and plan extraction failed
          this.logger.warn(
            `Session ${step.sessionId} exceeded maxEpoch (${session.maxEpoch}) and plan extraction failed. Forcing final output as last resort.`,
          );

          await this.runPilotQueue.add(
            `run-pilot-finalOutput-${step.sessionId}`,
            {
              user,
              sessionId: step.sessionId,
              mode: 'finalOutput',
            },
            { removeOnComplete: true, removeOnFail: 100 },
          );

          await this.prisma.pilotSession.update({
            where: { sessionId: step.sessionId },
            data: { status: 'executing' },
          });
        } else {
          // Use old PilotEngine approach as fallback for non-final epochs
          await this.prisma.pilotSession.update({
            where: { sessionId: step.sessionId },
            data: {
              status: 'executing',
              currentEpoch: session.currentEpoch + 1,
            },
          });

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
    }
  }
}
