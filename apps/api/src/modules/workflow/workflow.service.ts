import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  User,
  InvokeSkillRequest,
  CanvasNode,
  WorkflowVariable,
  NodeDiff,
  ActionStatus,
} from '@refly/openapi-schema';
import {
  CanvasNodeFilter,
  prepareNodeExecutions,
  pickReadyChildNodes,
  convertContextItemsToInvokeParams,
  ResponseNodeMeta,
  sortNodeExecutionsByExecutionOrder,
} from '@refly/canvas-common';
import { SkillService } from '../skill/skill.service';
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
import { QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { CanvasNotFoundError, WorkflowExecutionNotFoundError } from '@refly/errors';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    @InjectQueue(QUEUE_RUN_WORKFLOW) private readonly runWorkflowQueue?: Queue,
  ) {}

  /**
   * Initialize workflow execution - entry method
   * @param user - The user to create the workflow for
   * @param sourceCanvasId - The canvas ID
   * @returns Promise<string> - The execution ID
   */
  async initializeWorkflowExecution(
    user: User,
    sourceCanvasId: string,
    targetCanvasId: string,
    variables?: WorkflowVariable[],
    options?: {
      appId?: string;
      startNodes?: string[];
      checkCanvasOwnership?: boolean;
    },
  ): Promise<string> {
    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId: sourceCanvasId },
    });

    if (!canvas) {
      throw new CanvasNotFoundError(`Canvas ${sourceCanvasId} not found`);
    }

    if (options?.checkCanvasOwnership && canvas.uid !== user.uid) {
      throw new CanvasNotFoundError(`Canvas ${sourceCanvasId} not found for user ${user.uid}`);
    }

    // Get canvas state
    const canvasData = await this.canvasSyncService.getCanvasData(
      user,
      {
        canvasId: sourceCanvasId,
      },
      canvas,
    );

    // Create workflow execution record
    const executionId = genWorkflowExecutionID();

    const isNewCanvas = targetCanvasId !== sourceCanvasId;

    // Use variables from request if provided, otherwise use variables from canvas
    let finalVariables: WorkflowVariable[] =
      variables ?? safeParseJSON(canvas.workflow)?.variables ?? [];

    // Note: Canvas creation is now handled on the frontend to avoid version conflicts
    if (isNewCanvas) {
      const newCanvas = await this.canvasService.createCanvas(user, {
        canvasId: targetCanvasId,
        title: canvas?.title,
        variables: finalVariables,
        visibility: false, // Workflow execution result canvas should not be visible
      });
      finalVariables = safeParseJSON(newCanvas.workflow)?.variables ?? [];
    } else {
      finalVariables = await this.canvasService.updateWorkflowVariables(user, {
        canvasId: targetCanvasId,
        variables: finalVariables,
      });
    }

    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId,
      canvasData,
      variables: finalVariables,
      startNodes: options?.startNodes ?? [],
      isNewCanvas,
    });

    await this.prisma.$transaction([
      this.prisma.workflowExecution.create({
        data: {
          executionId,
          uid: user.uid,
          canvasId: targetCanvasId,
          sourceCanvasId: sourceCanvasId,
          variables: JSON.stringify(finalVariables),
          title: canvas.title || 'Workflow Execution',
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
          canvasId: targetCanvasId,
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
          isNewCanvas,
        });
      }
    }

    this.logger.log(
      `Workflow execution ${executionId} initialized with ${nodeExecutions.length} nodes`,
    );
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
      processedQuery,
      originalQuery,
      resultHistory,
    } = nodeExecution;
    const node = safeParseJSON(nodeData) as CanvasNode;
    const metadata = node.data?.metadata as ResponseNodeMeta;

    if (!metadata) {
      this.logger.warn(
        `[invokeSkillTask] Metadata not found for nodeExecution: ${nodeExecutionId}`,
      );
      return;
    }

    const { modelInfo, selectedToolsets, contextItems = [] } = metadata;
    const { context, images } = convertContextItemsToInvokeParams(contextItems, () => []);

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId: entityId,
      input: {
        query: processedQuery, // Use processed query for skill execution
        originalQuery, // Pass original query separately
        images,
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
   * @param isNewCanvas - Whether the canvas is new
   * @returns Promise<void>
   */
  async executeSkillResponseNode(
    user: User,
    nodeExecution: WorkflowNodeExecutionPO,
    isNewCanvas?: boolean,
  ): Promise<void> {
    const { nodeType, nodeData, canvasId, processedQuery, originalQuery } = nodeExecution;
    const node = safeParseJSON(nodeData) as CanvasNode;

    // Check if the node is a skillResponse type
    if (nodeType !== 'skillResponse') {
      this.logger.warn(`Node type ${nodeType} is not skillResponse, skipping processing`);
      return;
    }

    if (isNewCanvas) {
      // If it's new canvas mode, add the new node to the new canvas
      const connectToFilters: CanvasNodeFilter[] = safeParseJSON(nodeExecution.connectTo) ?? [];

      await this.canvasSyncService.addNodeToCanvas(user, canvasId, node, connectToFilters);
    } else {
      await this.syncNodeDiffToCanvas(user, canvasId, [
        {
          type: 'update',
          id: nodeExecution.nodeId,
          // from: node, // TODO: check if we need to pass the from
          to: {
            data: {
              title: processedQuery,
              contentPreview: '',
              metadata: {
                status: 'executing',
                structuredData: {
                  query: originalQuery, // Store original query in canvas node structuredData
                },
              },
            },
          },
        },
      ]);
    }

    await this.invokeSkillTask(user, nodeExecution);
  }

  /**
   * Sync workflow - called after skill-invoker finishes
   * @param user - The user with minimal PII (only uid)
   * @param nodeExecutionId - The node execution ID
   */
  async syncWorkflow(user: Pick<User, 'uid'>, nodeExecutionId: string): Promise<void> {
    try {
      const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
        where: {
          nodeExecutionId: nodeExecutionId,
        },
      });

      if (!nodeExecution) {
        this.logger.warn(`No node execution found for nodeExecutionId: ${nodeExecutionId}`);
        return;
      }

      const { status, canvasId, nodeId, executionId } = nodeExecution;

      // Only update if status is still executing
      if (status === 'executing') {
        // Update node status to finish
        await this.prisma.workflowNodeExecution.update({
          where: { nodeExecutionId },
          data: {
            status: 'finish',
            progress: 100,
            endTime: new Date(),
          },
        });

        await this.syncNodeDiffToCanvas(user, canvasId, [
          {
            type: 'update',
            id: nodeId,
            from: { data: { metadata: { status: 'executing' } } },
            to: { data: { metadata: { status: 'finish' } } },
          },
        ]);
      }

      // Get all child nodes
      const childNodeIds =
        (safeParseJSON(nodeExecution.childNodeIds) as string[] | undefined)?.filter(Boolean) ?? [];

      // Fast exit if no children
      if (!childNodeIds?.length) {
        await this.updateWorkflowExecutionStats(executionId);
        this.logger.log(`Synced workflow for nodeExecutionId: ${nodeExecutionId}`);
        return;
      }

      // Single-pass load of all nodes for this execution to evaluate readiness in-memory
      const allNodes = await this.prisma.workflowNodeExecution.findMany({
        select: {
          nodeId: true,
          status: true,
          parentNodeIds: true,
        },
        where: { executionId },
      });

      const readyChildNodeIds = pickReadyChildNodes(
        childNodeIds,
        allNodes.map((n) => ({
          nodeId: n.nodeId,
          parentNodeIds: (safeParseJSON(n.parentNodeIds) ?? []) as string[],
          status: n.status as ActionStatus,
        })),
      );

      // Sort ready child nodes by their original order in the canvas to maintain execution order
      const sortedReadyChildNodeIds = readyChildNodeIds.sort((a, b) => {
        return a.localeCompare(b);
      });

      const existingJobs = await this.runWorkflowQueue?.getJobs(['waiting', 'active']);

      for (const childNodeId of sortedReadyChildNodeIds) {
        const isAlreadyQueued = existingJobs?.some(
          (job) => job?.data?.executionId === executionId && job?.data?.nodeId === childNodeId,
        );

        if (!isAlreadyQueued && this.runWorkflowQueue) {
          await this.runWorkflowQueue.add('runWorkflow', {
            user: { uid: user.uid },
            executionId,
            nodeId: childNodeId,
          });
        }
      }

      // Update workflow execution statistics
      await this.updateWorkflowExecutionStats(nodeExecution.executionId);

      this.logger.log(`Synced workflow for nodeExecutionId: ${nodeExecutionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync workflow for nodeExecutionId ${nodeExecutionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Run workflow node - execute a single node
   * @param user - The user
   * @param executionId - The workflow execution ID
   * @param nodeId - The node ID to execute
   * @param newNodeId - The new node ID for new canvas mode (optional)
   */
  async runWorkflow(user: User, executionId: string, nodeId: string): Promise<void> {
    try {
      this.logger.log(`[runWorkflow] executionId: ${executionId}, nodeId: ${nodeId}`);

      // Find the workflow node execution by nodeExecutionId
      const [workflowExecution, nodeExecution] = await Promise.all([
        this.prisma.workflowExecution.findUnique({
          select: {
            canvasId: true,
            sourceCanvasId: true,
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
        this.logger.warn(`No workflow execution found for executionId: ${executionId}`);
        return;
      }

      if (!nodeExecution) {
        this.logger.warn(
          `Node execution not found for executionId: ${executionId}, nodeId: ${nodeId}`,
        );
        return;
      }

      // Check if node is already being processed
      if (nodeExecution.status === 'executing') {
        this.logger.warn(`Node ${nodeId} is already being executed`);
        return;
      }

      // Get all parent nodes for this child
      const parentNodeIds = safeParseJSON(nodeExecution.parentNodeIds) ?? [];

      // Check if all parents are finished
      const allParentsFinished =
        (await this.prisma.workflowNodeExecution.count({
          where: {
            executionId: nodeExecution.executionId,
            nodeId: { in: parentNodeIds },
            status: 'finish',
          },
        })) === parentNodeIds.length;

      if (!allParentsFinished) {
        this.logger.warn(`Node ${nodeId} has unfinished parents`);
        return;
      }

      // Update node status to executing
      await this.prisma.workflowNodeExecution.update({
        where: { nodeExecutionId: nodeExecution.nodeExecutionId },
        data: {
          status: 'executing',
          startTime: new Date(),
          progress: 0,
        },
      });

      // Execute node based on type
      if (nodeExecution.nodeType === 'skillResponse') {
        const isNewCanvas = workflowExecution.canvasId !== workflowExecution.sourceCanvasId;
        await this.executeSkillResponseNode(user, nodeExecution, isNewCanvas);
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
        await this.syncWorkflow(user, nodeExecution.nodeExecutionId);
      }

      this.logger.log(`Started execution of node ${nodeId} in workflow ${executionId}`);
    } catch (error) {
      // Mark node as failed
      const failedNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
        where: {
          executionId,
          nodeId,
        },
      });

      if (failedNodeExecution) {
        await this.prisma.workflowNodeExecution.update({
          where: {
            nodeExecutionId: failedNodeExecution.nodeExecutionId,
          },
          data: {
            status: 'failed',
            errorMessage: error.message,
            endTime: new Date(),
          },
        });
      }

      this.logger.error(`Failed to run workflow node ${nodeId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update workflow execution statistics
   * @param executionId - The workflow execution ID
   */
  private async updateWorkflowExecutionStats(executionId: string): Promise<void> {
    const stats = await this.prisma.workflowNodeExecution.groupBy({
      by: ['status'],
      where: { executionId },
      _count: { status: true },
    });

    const executedNodes = stats.find((s) => s.status === 'finish')?._count.status || 0;
    const failedNodes = stats.find((s) => s.status === 'failed')?._count.status || 0;

    // Check if all nodes are finished
    const waitingNodes = stats.find((s) => s.status === 'waiting')?._count.status || 0;
    const executingNodes = stats.find((s) => s.status === 'executing')?._count.status || 0;

    let status = 'executing';
    if (failedNodes > 0) {
      status = 'failed';
    } else if (waitingNodes === 0 && executingNodes === 0) {
      status = 'finish';
    }

    await this.prisma.workflowExecution.update({
      where: { executionId },
      data: {
        executedNodes,
        failedNodes,
        status,
      },
    });
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
