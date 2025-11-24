import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  User,
  InvokeSkillRequest,
  CanvasNode,
  WorkflowVariable,
  NodeDiff,
  RawCanvasData,
} from '@refly/openapi-schema';
import {
  CanvasNodeFilter,
  prepareNodeExecutions,
  convertContextItemsToInvokeParams,
  ResponseNodeMeta,
  sortNodeExecutionsByExecutionOrder,
} from '@refly/canvas-common';
import { SkillService } from '../skill/skill.service';
import { ActionService } from '../action/action.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import {
  genWorkflowExecutionID,
  genTransactionId,
  safeParseJSON,
  genWorkflowNodeExecutionID,
  pick,
} from '@refly/utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowNodeExecution as WorkflowNodeExecutionPO } from '../../generated/client';
import { QUEUE_POLL_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { WorkflowExecutionNotFoundError } from '@refly/errors';
import { RedisService } from '../common/redis.service';
import { PollWorkflowJobData, RunWorkflowJobData } from './workflow.dto';
import { CreditService } from '../credit/credit.service';
import { ceil } from 'lodash';

const WORKFLOW_POLL_INTERVAL = 1500;

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly skillService: SkillService,
    private readonly actionService: ActionService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly creditService: CreditService,
    @InjectQueue(QUEUE_RUN_WORKFLOW) private readonly runWorkflowQueue?: Queue<RunWorkflowJobData>,
    @InjectQueue(QUEUE_POLL_WORKFLOW)
    private readonly pollWorkflowQueue?: Queue<PollWorkflowJobData>,
  ) {}

  /**
   * Initialize workflow execution - entry method
   * @param user - The user to create the workflow for
   * @param sourceCanvasId - The canvas ID
   * @returns Promise<string> - The execution ID
   */
  async initializeWorkflowExecution(
    user: User,
    canvasId: string,
    variables?: WorkflowVariable[],
    options?: {
      sourceCanvasId?: string;
      sourceCanvasData?: RawCanvasData;
      appId?: string;
      startNodes?: string[];
      checkCanvasOwnership?: boolean;
      createNewCanvas?: boolean;
      nodeBehavior?: 'create' | 'update';
    },
  ): Promise<string> {
    let canvasData: RawCanvasData;
    const {
      sourceCanvasId = canvasId,
      sourceCanvasData,
      checkCanvasOwnership,
      createNewCanvas,
      nodeBehavior: requestedNodeBehavior,
    } = options ?? {};
    const nodeBehavior = requestedNodeBehavior ?? (createNewCanvas ? 'create' : 'update');

    if (sourceCanvasData) {
      canvasData = sourceCanvasData;
    } else if (sourceCanvasId) {
      canvasData = await this.canvasService.getCanvasRawData(user, sourceCanvasId, {
        checkOwnership: checkCanvasOwnership,
      });
    } else {
      throw new Error('Source canvas data or source canvas ID is required');
    }

    // Create workflow execution record
    const executionId = genWorkflowExecutionID();

    // Use variables from request if provided, otherwise use variables from canvas
    let finalVariables: WorkflowVariable[] = variables ?? canvasData?.variables ?? [];

    // Note: Canvas creation is now handled on the frontend to avoid version conflicts
    if (createNewCanvas) {
      const newCanvas = await this.canvasService.createCanvas(user, {
        canvasId: canvasId,
        title: canvasData.title,
        variables: finalVariables,
        visibility: false, // Workflow execution result canvas should not be visible
      });
      finalVariables = safeParseJSON(newCanvas.workflow)?.variables ?? [];
    } else {
      finalVariables = await this.canvasService.updateWorkflowVariables(user, {
        canvasId: canvasId,
        variables: finalVariables,
      });
    }

    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId,
      canvasData,
      variables: finalVariables,
      startNodes: options?.startNodes ?? [],
      nodeBehavior,
    });

    // If it's new canvas mode, add the new node to the new canvas
    if (nodeBehavior === 'create' && nodeExecutions.length > 0) {
      const nodesToAdd = nodeExecutions.map((nodeExecution) => ({
        node: nodeExecution.node,
        connectTo: Array.isArray(nodeExecution.connectTo)
          ? nodeExecution.connectTo
          : ((safeParseJSON(nodeExecution.connectTo) as CanvasNodeFilter[]) ?? []),
      }));

      await this.canvasSyncService.addNodesToCanvas(user, canvasId, nodesToAdd, {
        autoLayout: true,
      });
    }

    await this.prisma.$transaction([
      this.prisma.workflowExecution.create({
        data: {
          executionId,
          uid: user.uid,
          canvasId: canvasId,
          sourceCanvasId: sourceCanvasId,
          variables: JSON.stringify(finalVariables),
          title: canvasData.title ?? 'Workflow Execution',
          status: nodeExecutions.length > 0 ? 'executing' : 'finish',
          totalNodes: nodeExecutions.length,
          appId: options?.appId,
        },
      }),
      this.prisma.workflowNodeExecution.createMany({
        data: nodeExecutions.map((nodeExecution) => ({
          ...pick(nodeExecution, [
            'nodeId',
            'nodeType',
            'entityId',
            'title',
            'status',
            'processedQuery',
            'originalQuery',
            'connectTo',
            'parentNodeIds',
            'childNodeIds',
          ]),
          nodeExecutionId: genWorkflowNodeExecutionID(),
          executionId,
          canvasId: canvasId,
          nodeData: JSON.stringify(nodeExecution.node),
          connectTo: JSON.stringify(nodeExecution.connectTo),
          parentNodeIds: JSON.stringify(nodeExecution.parentNodeIds),
          childNodeIds: JSON.stringify(nodeExecution.childNodeIds),
          resultHistory: JSON.stringify(nodeExecution.resultHistory),
        })),
      }),
    ]);

    // Add start nodes to runWorkflowQueue in sorted order to maintain original canvas order
    if (this.runWorkflowQueue) {
      // Sort start nodes by their original order in the canvas
      const sortedStartNodes = [...startNodes].sort((a, b) => {
        return a.localeCompare(b);
      });

      for (const startNodeId of sortedStartNodes) {
        await this.runWorkflowQueue.add('runWorkflow', {
          user: { uid: user.uid },
          executionId,
          nodeId: startNodeId,
          nodeBehavior,
        });
      }
    }

    this.logger.log(
      `Workflow execution ${executionId} initialized with ${nodeExecutions.length} nodes`,
    );

    // Trigger a poll job for this execution; subsequent polls will re-schedule themselves as needed
    if (this.pollWorkflowQueue) {
      await this.pollWorkflowQueue.add(
        'pollWorkflow',
        { user, executionId, nodeBehavior },
        { delay: WORKFLOW_POLL_INTERVAL, removeOnComplete: true },
      );
    }

    return executionId;
  }

  /**
   * Sync node diff to canvas
   * @param user - The user to sync the node diff to
   * @param canvasId - The canvas ID to sync the node diff to
   * @param nodeDiffs - The node diffs to sync
   */
  private async syncNodeDiffToCanvas(user: User, canvasId: string, nodeDiffs: NodeDiff[]) {
    await this.canvasSyncService.syncState(user, {
      canvasId,
      transactions: [
        {
          txId: genTransactionId(),
          createdAt: Date.now(),
          syncedAt: Date.now(),
          source: { type: 'system' },
          nodeDiffs,
          edgeDiffs: [],
        },
      ],
    });
  }

  /**
   * Invoke skill task
   * @param user - The user to invoke the skill task
   * @param nodeExecution - The node execution to invoke the skill task
   * @returns Promise<void>
   */
  private async invokeSkillTask(user: User, nodeExecution: WorkflowNodeExecutionPO): Promise<void> {
    const {
      nodeExecutionId,
      canvasId,
      entityId,
      nodeData,
      connectTo,
      processedQuery,
      originalQuery,
      resultHistory,
    } = nodeExecution;
    const node = safeParseJSON(nodeData) as CanvasNode;
    const metadata = node.data?.metadata as ResponseNodeMeta;
    const connectToFilters: CanvasNodeFilter[] = safeParseJSON(connectTo) ?? [];

    if (!metadata) {
      this.logger.warn(
        `[invokeSkillTask] Metadata not found for nodeExecution: ${nodeExecutionId}`,
      );
      return;
    }

    const { modelInfo, selectedToolsets, contextItems = [] } = metadata;
    const context = convertContextItemsToInvokeParams(
      contextItems,
      connectToFilters
        .filter((filter) => filter.type === 'skillResponse')
        .map((filter) => filter.entityId),
    );

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId: entityId,
      input: {
        query: processedQuery, // Use processed query for skill execution
        originalQuery, // Pass original query separately
      },
      target: {
        entityType: 'canvas' as const,
        entityId: canvasId,
      },
      modelName: modelInfo?.name,
      modelItemId: modelInfo?.providerItemId,
      context,
      resultHistory: safeParseJSON(resultHistory) ?? [],
      toolsets: selectedToolsets,
      workflowExecutionId: nodeExecution.executionId,
      workflowNodeExecutionId: nodeExecution.nodeExecutionId,
    };

    // Send the invoke skill task
    await this.skillService.sendInvokeSkillTask(user, invokeRequest);

    this.logger.log(`Successfully sent invoke skill task for resultId: ${nodeExecution.entityId}`);
  }

  /**
   * Process a skillResponse node and invoke the skill task
   * @param user - The user to process the node for
   * @param nodeExecution - The node execution to process
   * @param nodeBehavior - The node behavior to process
   * @returns Promise<void>
   */
  async executeSkillResponseNode(
    user: User,
    nodeExecution: WorkflowNodeExecutionPO,
  ): Promise<void> {
    const { nodeType, canvasId } = nodeExecution;

    // Check if the node is a skillResponse type
    if (nodeType !== 'skillResponse') {
      this.logger.warn(`Node type ${nodeType} is not skillResponse, skipping processing`);
      return;
    }

    await this.syncNodeDiffToCanvas(user, canvasId, [
      {
        type: 'update',
        id: nodeExecution.nodeId,
        // from: node, // TODO: check if we need to pass the from
        to: {
          data: {
            contentPreview: '',
            metadata: {
              status: 'executing',
            },
          },
        },
      },
    ]);

    await this.invokeSkillTask(user, nodeExecution);
  }

  /**
   * Run workflow node - execute a single node
   * @param user - The user
   * @param executionId - The workflow execution ID
   * @param nodeId - The node ID to execute
   * @param newNodeId - The new node ID for new canvas mode (optional)
   */
  async runWorkflow(data: RunWorkflowJobData): Promise<void> {
    const { user, executionId, nodeId } = data;
    this.logger.log(`[runWorkflow] executionId: ${executionId}, nodeId: ${nodeId}`);

    // Acquire a distributed lock to avoid duplicate execution across workers
    const lockKey = `workflow:node:${executionId}:${nodeId}`;
    const releaseLock = await this.redis.acquireLock(lockKey);
    if (!releaseLock) {
      this.logger.warn(`[runWorkflow] lock not acquired for ${lockKey}, skip`);
      return;
    }

    let nodeExecutionIdForFailure: string | null = null;
    try {
      // Find the workflow node execution and workflow execution
      const [workflowExecution, nodeExecution] = await Promise.all([
        this.prisma.workflowExecution.findUnique({
          select: {
            canvasId: true,
            sourceCanvasId: true,
            uid: true,
          },
          where: { executionId },
        }),
        this.prisma.workflowNodeExecution.findFirst({
          where: {
            executionId,
            nodeId,
          },
        }),
      ]);

      if (!workflowExecution) {
        this.logger.warn(
          `[runWorkflow] No workflow execution found for executionId: ${executionId}`,
        );
        return;
      }

      if (!nodeExecution) {
        this.logger.warn(
          `[runWorkflow] Node execution not found for executionId: ${executionId}, nodeId: ${nodeId}`,
        );
        return;
      }
      nodeExecutionIdForFailure = nodeExecution.nodeExecutionId;

      // Only proceed if current status is waiting; otherwise exit early
      if (nodeExecution.status !== 'init' && nodeExecution.status !== 'waiting') {
        this.logger.warn(`[runWorkflow] Node ${nodeId} status is ${nodeExecution.status}, skip`);
        return;
      }

      // Validate parents first
      const parentNodeIds = safeParseJSON(nodeExecution.parentNodeIds) ?? [];
      const allParentsFinishedCount = await this.prisma.workflowNodeExecution.count({
        where: {
          executionId: nodeExecution.executionId,
          nodeId: { in: parentNodeIds as string[] },
          status: 'finish',
        },
      });
      const allParentsFinished = allParentsFinishedCount === (parentNodeIds?.length ?? 0);

      if (!allParentsFinished) {
        this.logger.warn(`[runWorkflow] Node ${nodeId} has unfinished parents`);
        return;
      }

      // Atomically transition to executing only if still waiting
      const updateRes = await this.prisma.workflowNodeExecution.updateMany({
        where: {
          nodeExecutionId: nodeExecution.nodeExecutionId,
          status: { in: ['init', 'waiting'] },
        },
        data: { status: 'executing', startTime: new Date(), progress: 0 },
      });
      if ((updateRes?.count ?? 0) === 0) {
        // Another worker raced and took it
        this.logger.warn(`Node ${nodeId} status changed concurrently, skip`);
        return;
      }

      // Execute node based on type
      if (nodeExecution.nodeType === 'skillResponse') {
        await this.executeSkillResponseNode(user, nodeExecution);
      } else {
        // For other node types, just mark as finish for now
        await this.prisma.workflowNodeExecution.update({
          where: { nodeExecutionId: nodeExecution.nodeExecutionId },
          data: {
            status: 'finish',
            progress: 100,
            endTime: new Date(),
          },
        });
      }

      this.logger.log(`Started execution of node ${nodeId} in workflow ${executionId}`);
    } catch (error) {
      // Only mark as failed if lock was acquired (we are inside lock scope) and node id is known
      if (nodeExecutionIdForFailure) {
        await this.prisma.workflowNodeExecution.update({
          where: { nodeExecutionId: nodeExecutionIdForFailure },
          data: {
            status: 'failed',
            errorMessage: (error as any)?.message ?? 'Unknown error',
            endTime: new Date(),
          },
        });
      }

      this.logger.error(`Failed to run workflow node ${nodeId}: ${(error as any)?.message}`);
      throw error;
    } finally {
      // Always release the lock
      try {
        await releaseLock?.();
      } catch {
        this.logger.warn(`[runWorkflow] failed to release lock ${lockKey}`);
      }
    }
  }

  /**
   * Poll one workflow execution: enqueue ready waiting nodes and decide whether to requeue a poll.
   */
  async pollWorkflow(data: PollWorkflowJobData): Promise<void> {
    const { user, executionId, nodeBehavior } = data;

    // Load all nodes for this execution in a single query
    const allNodes = await this.prisma.workflowNodeExecution.findMany({
      select: {
        nodeId: true,
        nodeType: true,
        status: true,
        parentNodeIds: true,
        childNodeIds: true,
      },
      where: { executionId },
    });

    if (!allNodes?.length) {
      return;
    }

    const statusByNodeId = new Map<string, string>();
    for (const n of allNodes) {
      if (n?.nodeId) {
        statusByNodeId.set(n.nodeId, n.status ?? 'init');
      }
    }

    // Find waiting skillResponse nodes and check parent readiness in-memory
    const waitingSkillNodes = allNodes.filter(
      (n) => (n.status === 'init' || n.status === 'waiting') && n.nodeType === 'skillResponse',
    );

    for (const n of waitingSkillNodes) {
      const parents = (safeParseJSON(n.parentNodeIds) ?? []) as string[];
      const allParentsFinished =
        (parents?.length ?? 0) === 0
          ? true
          : parents.every((p) => statusByNodeId.get(p) === 'finish');

      if (!allParentsFinished) {
        continue;
      }

      if (this.runWorkflowQueue) {
        await this.runWorkflowQueue.add(
          'runWorkflow',
          {
            user: { uid: user.uid },
            executionId,
            nodeId: n.nodeId,
            nodeBehavior,
          },
          {
            jobId: `run:${executionId}:${n.nodeId}`,
            removeOnComplete: true,
          },
        );
        this.logger.log(
          `[pollWorkflow] Enqueued node ${n.nodeId} for execution ${executionId} as parents are finished`,
        );
      }
    }

    // For finished skillResponse nodes, mark their non-skillResponse children as finish if not already finished
    const finishedSkillResponseNodes = allNodes.filter(
      (n) => n.status === 'finish' && n.nodeType === 'skillResponse',
    );

    const nodesToUpdate: string[] = [];
    for (const finishedNode of finishedSkillResponseNodes) {
      const childNodeIds = (safeParseJSON(finishedNode.childNodeIds) ?? []) as string[];
      for (const childId of childNodeIds) {
        const childNode = allNodes.find((n) => n.nodeId === childId);
        if (childNode && childNode.nodeType !== 'skillResponse' && childNode.status !== 'finish') {
          nodesToUpdate.push(childId);
        }
      }
    }

    // Update the status of child nodes to finish
    if (nodesToUpdate.length > 0) {
      await this.prisma.workflowNodeExecution.updateMany({
        where: {
          executionId,
          nodeId: { in: nodesToUpdate },
          status: { not: 'finish' },
          nodeType: { not: 'skillResponse' },
        },
        data: {
          status: 'finish',
          progress: 100,
          endTime: new Date(),
        },
      });
      this.logger.log(
        `[pollWorkflow] Marked ${nodesToUpdate.length} child nodes as finished for execution ${executionId}`,
      );
    }

    // Determine if we should continue polling for this execution
    const hasPendingOrExecuting = allNodes.some(
      (n) => n.status === 'init' || n.status === 'waiting' || n.status === 'executing',
    );

    // Update workflow execution statistics using in-memory snapshot
    try {
      const executedNodes = allNodes.filter((n) => n.status === 'finish')?.length ?? 0;
      const failedNodes = allNodes.filter((n) => n.status === 'failed')?.length ?? 0;
      const pendingNodes =
        allNodes.filter((n) => n.status === 'init' || n.status === 'waiting')?.length ?? 0;
      const executingNodes = allNodes.filter((n) => n.status === 'executing')?.length ?? 0;

      let status: 'executing' | 'failed' | 'finish' = 'executing';
      if (failedNodes > 0) {
        status = 'failed';
      } else if (pendingNodes === 0 && executingNodes === 0) {
        status = 'finish';

        // Check workflow execution for appId and validate uid consistency
        const workflowExecution = await this.prisma.workflowExecution.findUnique({
          select: {
            executionId: true,
            appId: true,
            canvasId: true,
          },
          where: { executionId },
        });

        if (workflowExecution?.appId) {
          const workflowApp = await this.prisma.workflowApp.findUnique({
            where: { appId: workflowExecution.appId },
          });

          if (workflowApp) {
            const creditUsage = await this.creditService.countExecutionCreditUsageByExecutionId(
              user,
              executionId,
            );
            const commissionCredit = ceil(creditUsage * 0.2);
            await this.creditService.createCommissionCreditUsageAndRecharge(
              user.uid,
              workflowApp.uid,
              executionId,
              commissionCredit,
              workflowExecution.appId,
              workflowApp.title,
              workflowApp.shareId,
            );
          }
        }
      }

      await this.prisma.workflowExecution.update({
        where: { executionId },
        data: { executedNodes, failedNodes, status },
      });
    } catch (err: any) {
      this.logger.warn(`[pollWorkflow] failed to update execution stats: ${err?.message ?? err}`);
    }

    if (hasPendingOrExecuting && this.pollWorkflowQueue) {
      await this.pollWorkflowQueue.add(
        'pollWorkflow',
        { user, executionId, nodeBehavior },
        { delay: WORKFLOW_POLL_INTERVAL, removeOnComplete: true },
      );
    }
  }

  /**
   * Abort workflow execution - stop all running/waiting nodes
   * @param user - The user
   * @param executionId - The workflow execution ID to abort
   */
  async abortWorkflowExecution(user: User, executionId: string): Promise<void> {
    // Verify workflow execution exists and belongs to user
    const workflowExecution = await this.prisma.workflowExecution.findUnique({
      where: { executionId, uid: user.uid },
    });

    if (!workflowExecution) {
      throw new WorkflowExecutionNotFoundError(`Workflow execution ${executionId} not found`);
    }

    // Check if workflow is already finished or failed
    if (workflowExecution.status === 'finish' || workflowExecution.status === 'failed') {
      this.logger.warn(
        `Workflow execution ${executionId} is already ${workflowExecution.status}, cannot abort`,
      );
      return;
    }

    // Get all executing and waiting nodes
    const nodesToAbort = await this.prisma.workflowNodeExecution.findMany({
      where: {
        executionId,
        status: { in: ['waiting', 'executing'] },
      },
    });

    this.logger.log(
      `Aborting workflow ${executionId}: found ${nodesToAbort.length} nodes to abort`,
    );

    // Abort all executing skillResponse nodes by calling abort action
    const executingSkillNodes = nodesToAbort.filter((n) => n.nodeType === 'skillResponse');

    // Abort all executing nodes in parallel for better performance
    const abortResults = await Promise.allSettled(
      executingSkillNodes.map(async (node) => {
        try {
          await this.actionService.abortActionFromReq(
            user,
            { resultId: node.entityId },
            'Workflow aborted by user',
          );
          this.logger.log(`Aborted action ${node.entityId} for node ${node.nodeId}`);
          return { success: true, nodeId: node.nodeId };
        } catch (error) {
          this.logger.warn(
            `Failed to abort action ${node.entityId}: ${(error as any)?.message ?? error}`,
          );
          return { success: false, nodeId: node.nodeId, error };
        }
      }),
    );

    const successCount = abortResults.filter((r) => r.status === 'fulfilled').length;
    this.logger.log(`Aborted ${successCount}/${executingSkillNodes.length} executing skill nodes`);

    // Update all non-terminal nodes to failed (not just waiting/executing)
    await this.prisma.workflowNodeExecution.updateMany({
      where: {
        executionId,
        status: { notIn: ['finish', 'failed'] },
      },
      data: {
        status: 'failed',
        errorMessage: 'Workflow aborted by user',
        endTime: new Date(),
      },
    });

    // Update workflow execution to failed if not already terminal
    await this.prisma.workflowExecution.updateMany({
      where: {
        executionId,
        status: { notIn: ['finish', 'failed'] },
      },
      data: {
        status: 'failed',
        abortedByUser: true,
      },
    });

    this.logger.log(`Workflow execution ${executionId} aborted by user ${user.uid}`);
  }

  /**
   * Get workflow execution detail with node executions
   * @param user - The user requesting the workflow detail
   * @param executionId - The workflow execution ID
   * @returns Promise<WorkflowExecution> - The workflow execution detail
   */
  async getWorkflowDetail(user: User, executionId: string) {
    // Get workflow execution
    const workflowExecution = await this.prisma.workflowExecution.findUnique({
      where: { executionId, uid: user.uid },
    });

    if (!workflowExecution) {
      throw new WorkflowExecutionNotFoundError(`Workflow execution ${executionId} not found`);
    }

    // Get node executions
    const nodeExecutions = await this.prisma.workflowNodeExecution.findMany({
      where: { executionId },
    });

    // Sort node executions by execution order (topological sort based on parent-child relationships)
    const sortedNodeExecutions = sortNodeExecutionsByExecutionOrder(nodeExecutions);

    // Return workflow execution detail
    return { ...workflowExecution, nodeExecutions: sortedNodeExecutions };
  }
}
