import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User, InvokeSkillRequest, Entity, EntityType, ActionResult } from '@refly/openapi-schema';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { SkillService } from '../skill/skill.service';
import { convertContextItemsToInvokeParams } from '@refly/canvas-common';
import { CanvasService } from '../canvas/canvas.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { genWorkflowExecutionID, genWorkflowNodeExecutionID, genTransactionId } from '@refly/utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
    private readonly mcpServerService: McpServerService,
    private readonly canvasSyncService: CanvasSyncService,
    @InjectQueue(QUEUE_SYNC_WORKFLOW) private readonly syncWorkflowQueue?: Queue,
    @InjectQueue(QUEUE_RUN_WORKFLOW) private readonly runWorkflowQueue?: Queue,
  ) {}

  /**
   * Get user's selected MCP servers
   * Simple implementation that returns enabled MCP servers for the user
   */
  private async getSelectedMcpServers(user: User): Promise<string[]> {
    try {
      // Get all enabled MCP servers for the user
      const servers = await this.mcpServerService.listMcpServers(user, { enabled: true });

      // Return the names of enabled servers
      return servers.map((server) => server.name);
    } catch (error) {
      this.logger.warn(`Failed to get selected MCP servers for user ${user.uid}: ${error.message}`);
      return [];
    }
  }

  /**
   * Initialize workflow execution - entry method
   * @param user - The user to create the workflow for
   * @param canvasId - The canvas ID
   * @returns Promise<string> - The execution ID
   */
  async initializeWorkflowExecution(user: User, canvasId: string): Promise<string> {
    try {
      // Get canvas state
      const canvasState = await this.canvasSyncService.getCanvasData(user, { canvasId });
      const { nodes, edges } = canvasState;

      if (!nodes?.length) {
        throw new Error('No nodes found in canvas');
      }

      // Create workflow execution record
      const executionId = genWorkflowExecutionID();
      const canvas = await this.prisma.canvas.findUnique({
        where: { canvasId },
        select: { title: true },
      });

      await this.prisma.workflowExecution.create({
        data: {
          executionId,
          uid: user.uid,
          canvasId,
          title: canvas?.title || 'Workflow Execution',
          status: 'executing',
          totalNodes: nodes.length,
        },
      });

      // Build node relationships
      const nodeMap = new Map<string, CanvasNode>();
      const parentMap = new Map<string, string[]>();
      const childMap = new Map<string, string[]>();

      // Initialize maps
      for (const node of nodes) {
        nodeMap.set(node.id, node);
        parentMap.set(node.id, []);
        childMap.set(node.id, []);
      }

      // Build relationships from edges
      for (const edge of edges || []) {
        const sourceId = edge.source;
        const targetId = edge.target;

        if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
          // Add target as child of source
          const sourceChildren = childMap.get(sourceId) || [];
          sourceChildren.push(targetId);
          childMap.set(sourceId, sourceChildren);

          // Add source as parent of target
          const targetParents = parentMap.get(targetId) || [];
          targetParents.push(sourceId);
          parentMap.set(targetId, targetParents);
        }
      }

      // Find start nodes (nodes without parents)
      const startNodes: string[] = [];
      for (const [nodeId, parents] of parentMap) {
        if (parents.length === 0) {
          startNodes.push(nodeId);
        }
      }

      if (startNodes.length === 0) {
        throw new Error('No start nodes found in workflow');
      }

      // Create node execution records
      const nodeExecutions = [];
      for (const node of nodes) {
        const nodeExecutionId = genWorkflowNodeExecutionID();
        const parents = parentMap.get(node.id) || [];
        const children = childMap.get(node.id) || [];

        const nodeExecution = await this.prisma.workflowNodeExecution.create({
          data: {
            nodeExecutionId,
            executionId,
            nodeId: node.id,
            nodeType: node.type,
            entityId: node.data?.entityId || '',
            title: node.data?.title || '',
            status: startNodes.includes(node.id) ? 'waiting' : 'waiting',
            parentNodeIds: JSON.stringify(parents),
            childNodeIds: JSON.stringify(children),
          },
        });

        nodeExecutions.push(nodeExecution);
      }

      // Add start nodes to runWorkflowQueue
      if (this.runWorkflowQueue) {
        for (const startNodeId of startNodes) {
          await this.runWorkflowQueue.add('runWorkflow', {
            user: { uid: user.uid },
            executionId,
            nodeId: startNodeId,
          });
        }
      }

      this.logger.log(`Workflow execution ${executionId} initialized with ${nodes.length} nodes`);
      return executionId;
    } catch (error) {
      this.logger.error(`Failed to initialize workflow execution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a skillResponse node and invoke the skill task
   * @param user - The user to process the node for
   * @param node - The CanvasNode to process
   * @param canvasId - The canvas ID
   * @returns Promise<void>
   */
  async executeSkillResponseNode(
    user: User,
    node: CanvasNode & { data: { metadata?: ResponseNodeMeta } },
    canvasId: string,
    executionId?: string,
  ): Promise<void> {
    // Check if the node is a skillResponse type
    if (node.type !== 'skillResponse') {
      this.logger.warn(`Node type ${node.type} is not skillResponse, skipping processing`);
      return;
    }

    const { data } = node;
    const { metadata } = data;

    if (!metadata) {
      this.logger.warn('Node metadata is missing, skipping processing');
      return;
    }

    // Extract required parameters from ResponseNodeMeta
    const {
      selectedSkill,
      contextItems = [],
      tplConfig = {},
      runtimeConfig = {},
      modelInfo,
    } = metadata;

    // Get query from title
    const query = data.title || '';

    // Get resultId from entityId
    //后续改为重新生成一个id，节点entityId不动，现在先保持这样，result ID和entityId保持一致
    const resultId = data.entityId;

    if (!resultId) {
      this.logger.warn('Node entityId is missing, skipping processing');
      return;
    }
    // Retrieve all canvas nodes to build context and history
    // Fix: Pass correct parameter object to getCanvasData as required by its type definition
    const canvasData = await this.canvasSyncService.getCanvasData(user, { canvasId });
    const allNodes = canvasData?.nodes ?? [];

    // Convert contextItems to invoke parameters with proper data lookup
    const { context, resultHistory, images } = convertContextItemsToInvokeParams(
      contextItems,
      // History function - find skillResponse nodes and convert to ActionResult
      (item) => {
        if (item.type === 'skillResponse') {
          const skillNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (skillNode) {
            return [
              {
                resultId: skillNode.data?.entityId || '',
                title: skillNode.data?.title || '',
              } as ActionResult,
            ];
          }
        }
        return [];
      },
      // Memo function - find memo nodes and extract content
      (item) => {
        if (item.type === 'memo') {
          const memoNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (memoNode) {
            return [
              {
                content: memoNode.data?.contentPreview || memoNode.data?.title || '',
                title: memoNode.data?.title || 'Memo',
              },
            ];
          }
        }
        return [];
      },
      // Images function - find image nodes and extract storage keys
      (item) => {
        if (item.type === 'image') {
          const imageNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (imageNode) {
            return [
              {
                storageKey: String(imageNode.data?.metadata?.storageKey || ''),
                title: imageNode.data?.title || 'Image',
                entityId: imageNode.data?.entityId || '',
                metadata: imageNode.data?.metadata || {},
              },
            ];
          }
        }
        return [];
      },
      // Website function - find website nodes and extract URL info
      (item) => {
        if (item.type === 'website') {
          const websiteNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (websiteNode) {
            return [
              {
                url: String(websiteNode.data?.metadata?.url || ''),
                title: websiteNode.data?.title || 'Website',
              },
            ];
          }
        }
        return [];
      },
    );

    // Prepare the target entity
    const target: Entity = {
      entityType: 'canvas' as EntityType,
      entityId: canvasId,
    };

    // Note: ActionResult will be created by skill service during skillInvokePreCheck
    // This ensures consistency and avoids duplicate records

    // Get workflow execution info for passing to skill service
    // Use executionId and entityId together for more precise lookup
    const workflowNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
      where: {
        ...(executionId && { executionId }),
        entityId: resultId,
      },
    });

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId,
      input: {
        query,
        images,
      },
      target,
      modelName: modelInfo?.name,
      modelItemId: modelInfo?.providerItemId,
      context,
      resultHistory,
      skillName: selectedSkill?.name || 'commonQnA',
      selectedMcpServers: await this.getSelectedMcpServers(user), // Get selected MCP servers from backend
      tplConfig,
      runtimeConfig,
      // Add workflow fields to the request
      workflowExecutionId: workflowNodeExecution?.executionId,
      workflowNodeExecutionId: workflowNodeExecution?.nodeExecutionId,
    } as any; // Use 'as any' to bypass TypeScript type checking for workflow fields

    // Send the invoke skill task
    await this.skillService.sendInvokeSkillTask(user, invokeRequest);

    this.logger.log(`Successfully sent invoke skill task for resultId: ${resultId}`);
  }

  /**
   * Sync workflow - called after skill-invoker finishes
   * @param user - The user
   * @param nodeExecutionId - The node execution ID
   */
  async syncWorkflow(user: User, nodeExecutionId: string): Promise<void> {
    try {
      // Find the workflow node execution by nodeExecutionId
      const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
        where: {
          nodeExecutionId: nodeExecutionId,
        },
      });

      if (!nodeExecution) {
        this.logger.warn(`No node execution found for nodeExecutionId: ${nodeExecutionId}`);
        return;
      }

      // Only update if status is still executing
      if (nodeExecution.status === 'executing') {
        // Update node status to finish
        await this.prisma.workflowNodeExecution.update({
          where: { nodeExecutionId: nodeExecution.nodeExecutionId },
          data: {
            status: 'finish',
            progress: 100,
            endTime: new Date(),
          },
        });

        // Update canvas node status to finish
        const workflowExecution = await this.prisma.workflowExecution.findUnique({
          where: { executionId: nodeExecution.executionId },
        });

        if (workflowExecution) {
          const canvasState = await this.canvasSyncService.getCanvasData(user, {
            canvasId: workflowExecution.canvasId,
          });
          const { nodes } = canvasState;
          const canvasNode = nodes?.find((n) => n.id === nodeExecution.nodeId);

          if (canvasNode) {
            const updatedNode = {
              ...canvasNode,
              data: {
                ...canvasNode.data,
                metadata: {
                  ...canvasNode.data?.metadata,
                  status: 'finish',
                },
              },
            };

            await this.canvasSyncService.syncState(user, {
              canvasId: workflowExecution.canvasId,
              transactions: [
                {
                  txId: genTransactionId(),
                  createdAt: Date.now(),
                  syncedAt: Date.now(),
                  nodeDiffs: [
                    {
                      type: 'update',
                      id: nodeExecution.nodeId,
                      from: canvasNode,
                      to: updatedNode,
                    },
                  ],
                  edgeDiffs: [],
                },
              ],
            });
          }
        }
      }

      // Get all child nodes
      const childNodeIds = JSON.parse(nodeExecution.childNodeIds || '[]') as string[];

      // For each child node, check if all its parents are finished
      for (const childNodeId of childNodeIds) {
        const childNode = await this.prisma.workflowNodeExecution.findFirst({
          where: {
            executionId: nodeExecution.executionId,
            nodeId: childNodeId,
          },
        });

        if (!childNode) continue;

        // Get all parent nodes for this child
        const parentNodeIds = JSON.parse(childNode.parentNodeIds || '[]') as string[];

        // Check if all parents are finished
        const allParentsFinished =
          (await this.prisma.workflowNodeExecution.count({
            where: {
              executionId: nodeExecution.executionId,
              nodeId: { in: parentNodeIds },
              status: 'finish',
            },
          })) === parentNodeIds.length;

        // If all parents are finished and child is still waiting, add to queue
        if (allParentsFinished && childNode.status === 'waiting') {
          // Prevent duplicate queue entries by checking if already queued
          const existingJobs = await this.runWorkflowQueue?.getJobs(['waiting', 'active']);
          const isAlreadyQueued = existingJobs?.some(
            (job) =>
              job.data.executionId === nodeExecution.executionId && job.data.nodeId === childNodeId,
          );

          if (!isAlreadyQueued && this.runWorkflowQueue) {
            await this.runWorkflowQueue.add('runWorkflow', {
              user: { uid: user.uid },
              executionId: nodeExecution.executionId,
              nodeId: childNodeId,
            });
          }
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
   */
  async runWorkflow(user: User, executionId: string, nodeId: string): Promise<void> {
    try {
      // Get node execution record
      const nodeExecution = await this.prisma.workflowNodeExecution.findFirst({
        where: {
          executionId,
          nodeId,
        },
      });

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

      // Update node status to executing
      await this.prisma.workflowNodeExecution.update({
        where: { nodeExecutionId: nodeExecution.nodeExecutionId },
        data: {
          status: 'executing',
          startTime: new Date(),
          progress: 0,
        },
      });

      // Get canvas state to find the node
      const workflowExecution = await this.prisma.workflowExecution.findUnique({
        where: { executionId },
      });

      if (!workflowExecution) {
        throw new Error(`Workflow execution ${executionId} not found`);
      }

      const canvasState = await this.canvasSyncService.getCanvasData(user, {
        canvasId: workflowExecution.canvasId,
      });
      const { nodes } = canvasState;

      // Find the node in canvas state
      const canvasNode = nodes?.find((n) => n.id === nodeId);
      if (!canvasNode) {
        throw new Error(`Node ${nodeId} not found in canvas`);
      }

      // Execute node based on type
      if (canvasNode.type === 'skillResponse') {
        // Update canvas node status to executing before invoking skill
        const updatedNode = {
          ...canvasNode,
          data: {
            ...canvasNode.data,
            contentPreview: '', // Clear content preview when starting execution
            metadata: {
              ...canvasNode.data?.metadata,
              status: 'executing',
            },
          },
        };

        await this.canvasSyncService.syncState(user, {
          canvasId: workflowExecution.canvasId,
          transactions: [
            {
              txId: genTransactionId(),
              createdAt: Date.now(),
              syncedAt: Date.now(),
              nodeDiffs: [
                {
                  type: 'update',
                  id: nodeId,
                  from: canvasNode,
                  to: updatedNode,
                },
              ],
              edgeDiffs: [],
            },
          ],
        });

        await this.executeSkillResponseNode(
          user,
          canvasNode as unknown as CanvasNode & { data: { metadata?: ResponseNodeMeta } },
          workflowExecution.canvasId,
          executionId,
        );
      } else {
        // For other node types, just mark as finish for now
        // TODO: Implement execution for other node types
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
}
