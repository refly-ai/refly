import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  User,
  InvokeSkillRequest,
  Entity,
  EntityType,
  ActionResult,
  CanvasNodeType,
  CanvasNode,
} from '@refly/openapi-schema';
import { ResponseNodeMeta, CanvasNodeFilter } from '@refly/canvas-common';
import { SkillService } from '../skill/skill.service';
import { convertResultContextToItems } from '@refly/canvas-common';
import { CanvasService } from '../canvas/canvas.service';
import { McpServerService } from '../mcp-server/mcp-server.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import {
  genWorkflowExecutionID,
  genWorkflowNodeExecutionID,
  genTransactionId,
  genNodeID,
} from '@refly/utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { SkillContext } from '@refly/openapi-schema';
import { WorkflowVariableService } from './workflow-variable.service';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
    private readonly mcpServerService: McpServerService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly workflowVariableService: WorkflowVariableService,
    @InjectQueue(QUEUE_SYNC_WORKFLOW) private readonly syncWorkflowQueue?: Queue,
    @InjectQueue(QUEUE_RUN_WORKFLOW) private readonly runWorkflowQueue?: Queue,
  ) {}

  /**
   * Process query with workflow variables
   * @param query - Original query string
   * @param canvasId - Canvas ID to get workflow variables from
   * @param user - User object
   * @returns Processed query string with variables replaced
   */
  private async processQueryWithVariables(
    query: string,
    canvasId: string,
    user: User,
  ): Promise<string> {
    try {
      // Get canvas state to retrieve workflow variables
      const canvasState = await this.canvasSyncService.getState(user, { canvasId });
      let variables = (canvasState as any)?.workflow?.variables || [];

      // If no variables found, use mock data
      if (!variables || variables.length === 0) {
        variables = [
          {
            name: 'car',
            value: 'xpeng P7',
            description: '车名',
          },
        ];
      }

      // Process query with variables
      return this.workflowVariableService.processQuery(query, variables);
    } catch (error) {
      this.logger.warn(`Failed to process query with variables: ${error.message}`);
      // Return original query if processing fails
      return query;
    }
  }

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
  async initializeWorkflowExecution(
    user: User,
    canvasId: string,
    newCanvasId?: string,
  ): Promise<string> {
    try {
      // Add a new execution mode: if a new canvas ID is provided, create a new canvas and add nodes to it one by one as they are executed.
      // Only the node being executed will be added to the new canvas at that time.

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

      // Note: Canvas creation is now handled on the frontend to avoid version conflicts
      if (newCanvasId) {
        await this.canvasService.createCanvas(user, {
          canvasId: newCanvasId,
          title: canvas?.title,
        });
      }

      await this.prisma.workflowExecution.create({
        data: {
          executionId,
          uid: user.uid,
          canvasId,
          title: canvas?.title || 'Workflow Execution',
          status: 'executing',
          totalNodes: nodes.length,
          // If in new mode, add a new field to workflowExecution to record the new canvas ID
          newCanvasId,
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

      // If there's a new canvas ID, generate new node IDs for each node and store them in the new database field
      // Create node execution records
      const nodeExecutions = [];
      for (const node of nodes) {
        const nodeExecutionId = genWorkflowNodeExecutionID();
        const parents = parentMap.get(node.id) || [];
        const children = childMap.get(node.id) || [];

        // Generate new node ID if newCanvasId exists
        const newNodeId = newCanvasId ? genNodeID() : null;

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
            newNodeId, // Store the new node ID for new canvas mode
          },
        });

        nodeExecutions.push(nodeExecution);
      }

      // Add start nodes to runWorkflowQueue
      if (this.runWorkflowQueue) {
        for (const startNodeId of startNodes) {
          // Find the node execution record to get the new node ID
          const nodeExecution = nodeExecutions.find((ne) => ne.nodeId === startNodeId);
          await this.runWorkflowQueue.add('runWorkflow', {
            user: { uid: user.uid },
            executionId,
            nodeId: startNodeId,
            newNodeId: nodeExecution?.newNodeId, // Pass the new node ID for new canvas mode
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
   * @param executionId - The workflow execution ID (optional)
   * @param newNodeId - The new node ID for new canvas mode (optional)
   * @returns Promise<void>
   */
  async executeSkillResponseNode(
    user: User,
    node: CanvasNode & { data: { metadata?: ResponseNodeMeta } },
    canvasId: string,
    executionId?: string,
    newNodeId?: string,
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
    const { selectedSkill, tplConfig = {}, runtimeConfig = {}, modelInfo } = metadata;

    // Prefer to get query from data.metadata.structuredData?.query, fallback to data.title if not available
    const originalQuery = String(data?.metadata?.structuredData?.query ?? data?.title ?? '');

    // Process query with workflow variables
    const processedQuery = await this.processQueryWithVariables(originalQuery, canvasId, user);

    // Get resultId from entityId
    const resultId = data.entityId;

    if (!resultId) {
      this.logger.warn('Node entityId is missing, skipping processing');
      return;
    }

    // Get canvas content items for building context and history
    const canvasContentItems: CanvasContentItem[] = await this.canvasService.getCanvasContentItems(
      user,
      canvasId,
      true,
    );

    // Initialize context and history
    let context: SkillContext = { resources: [], documents: [], codeArtifacts: [] };
    let resultHistory: ActionResult[] = [];
    let images: string[] = [];

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

    // Get current node execution to find parent node IDs (for both new canvas and existing canvas modes)
    const currentNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
      where: {
        executionId,
        nodeId: node.id,
      },
    });

    // Build context and history from parent nodes
    let connectToFilters: CanvasNodeFilter[] = [];

    if (currentNodeExecution?.parentNodeIds) {
      const parentNodeIds = JSON.parse(currentNodeExecution.parentNodeIds) as string[];

      if (parentNodeIds.length > 0) {
        // Get all parent node executions to find their entity IDs
        const parentNodeExecutions = await this.prisma.workflowNodeExecution.findMany({
          where: {
            executionId,
            nodeId: { in: parentNodeIds },
          },
        });

        // Extract entity IDs from parent nodes
        const parentEntityIds = parentNodeExecutions
          .map((execution) => execution.entityId)
          .filter((entityId) => entityId && entityId !== '');

        // Build context and history from parent nodes using canvas content items
        const {
          context: parentContext,
          history: parentHistory,
          images: parentImages,
        } = await this.buildContextAndHistoryFromParentNodes(canvasContentItems, parentEntityIds);

        // Update context and history with parent data
        context = parentContext;
        resultHistory = parentHistory;
        images = parentImages;

        // Build connection filters based on parent entity IDs
        connectToFilters = parentEntityIds.map((entityId) => ({
          type: node.type as CanvasNodeType,
          entityId,
          handleType: 'source',
        }));
      }
    }

    // If it's new canvas mode, add the new node to the new canvas
    if (newNodeId && executionId) {
      // Convert context and history to context items for metadata
      const filteredContextItems = convertResultContextToItems(context, resultHistory);

      // Add the new node to the new canvas using the canvas service with connection information
      // Note: Don't set status to executing or clear contentPreview here - will be handled before skill invocation
      await this.canvasService.addNodeToCanvas(
        user,
        canvasId,
        {
          id: newNodeId,
          type: node.type as CanvasNodeType,
          data: {
            ...node.data,
            title: processedQuery,
            entityId: resultId, // Use the same entityId for consistency
            metadata: {
              ...node.data?.metadata,
              contextItems: filteredContextItems,
              structuredData: {
                query: originalQuery, // Store original query in canvas node structuredData
              },
            },
          },
        },
        connectToFilters,
      );

      this.logger.log(
        `Added new node ${newNodeId} to canvas ${canvasId} for workflow execution ${executionId} with connections`,
      );
    }

    if (canvasId) {
      const canvasState = await this.canvasSyncService.getCanvasData(user, {
        canvasId,
      });
      const { nodes } = canvasState;
      const targetNodeId = newNodeId || node.id;
      const canvasNode = nodes?.find((n) => n.id === targetNodeId);

      if (canvasNode) {
        const updatedNode = {
          ...canvasNode,
          data: {
            ...canvasNode.data,
            title: processedQuery,
            contentPreview: '', // Clear content preview when starting execution
            metadata: {
              ...canvasNode.data?.metadata,
              status: 'executing',
              structuredData: {
                query: originalQuery, // Store original query in canvas node structuredData
              },
            },
          },
        };

        await this.canvasSyncService.syncState(user, {
          canvasId,
          transactions: [
            {
              txId: genTransactionId(),
              createdAt: Date.now(),
              syncedAt: Date.now(),
              nodeDiffs: [
                {
                  type: 'update',
                  id: targetNodeId,
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

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId,
      input: {
        query: processedQuery, // Use processed query for skill execution
        originalQuery, // Pass original query separately
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
   * @param user - The user with minimal PII (only uid)
   * @param nodeExecutionId - The node execution ID
   */
  async syncWorkflow(user: Pick<User, 'uid'>, nodeExecutionId: string): Promise<void> {
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
          // Get full user object for canvas operations
          const fullUser = await this.prisma.user.findUnique({
            where: { uid: user.uid },
          });

          if (!fullUser) {
            this.logger.warn(`User not found for uid: ${user.uid}`);
            return;
          }

          // Determine which canvas to update based on whether it's new canvas mode
          const targetCanvasId =
            nodeExecution.newNodeId && workflowExecution.newCanvasId
              ? workflowExecution.newCanvasId
              : workflowExecution.canvasId;

          const targetNodeId = nodeExecution.newNodeId || nodeExecution.nodeId;

          const canvasState = await this.canvasSyncService.getCanvasData(fullUser, {
            canvasId: targetCanvasId,
          });
          const { nodes } = canvasState;
          const canvasNode = nodes?.find((n) => n.id === targetNodeId);

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

            await this.canvasSyncService.syncState(fullUser, {
              canvasId: targetCanvasId,
              transactions: [
                {
                  txId: genTransactionId(),
                  createdAt: Date.now(),
                  syncedAt: Date.now(),
                  nodeDiffs: [
                    {
                      type: 'update',
                      id: targetNodeId,
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
            // Get the child node execution to find its new node ID
            const childNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
              where: {
                executionId: nodeExecution.executionId,
                nodeId: childNodeId,
              },
            });

            await this.runWorkflowQueue.add('runWorkflow', {
              user: { uid: user.uid },
              executionId: nodeExecution.executionId,
              nodeId: childNodeId,
              newNodeId: childNodeExecution?.newNodeId, // Pass the new node ID for new canvas mode
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
   * @param newNodeId - The new node ID for new canvas mode (optional)
   */
  async runWorkflow(
    user: User,
    executionId: string,
    nodeId: string,
    newNodeId?: string,
  ): Promise<void> {
    try {
      //增加传入新的节点ID
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
        await this.executeSkillResponseNode(
          user,
          canvasNode as unknown as CanvasNode & { data: { metadata?: ResponseNodeMeta } },
          newNodeId && workflowExecution.newCanvasId
            ? workflowExecution.newCanvasId
            : workflowExecution.canvasId,
          executionId,
          newNodeId,
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

  /**
   * Build context and history from parent nodes and canvas content items
   * Similar to pilot module's buildContextAndHistory method
   */
  private async buildContextAndHistoryFromParentNodes(
    canvasContentItems: CanvasContentItem[],
    parentEntityIds: string[],
  ): Promise<{ context: SkillContext; history: ActionResult[]; images: string[] }> {
    // Create an empty context structure
    const context: SkillContext = {
      resources: [],
      documents: [],
      codeArtifacts: [],
    };
    const history: ActionResult[] = [];
    const images: string[] = [];

    // If either array is empty, return the empty context
    if (!canvasContentItems?.length || !parentEntityIds?.length) {
      return { context, history, images };
    }

    // Create a map of entityId to contentItem for efficient lookup
    const contentItemMap = new Map<string, CanvasContentItem>();
    for (const item of canvasContentItems) {
      contentItemMap.set(item.id, item);
    }

    // Process each parent entity ID
    for (const entityId of parentEntityIds) {
      const contentItem = contentItemMap.get(entityId);
      if (!contentItem) {
        continue;
      }

      switch (contentItem.type) {
        case 'resource':
          context.resources.push({
            resourceId: contentItem.id,
            resource: {
              resourceId: contentItem.id,
              title: contentItem.title ?? '',
              resourceType: 'text', // Default to text if not specified
              content: contentItem.content ?? contentItem.contentPreview ?? '',
              contentPreview: contentItem.contentPreview ?? '',
            },
            isCurrent: true,
          });
          break;
        case 'document':
          context.documents.push({
            docId: contentItem.id,
            document: {
              docId: contentItem.id,
              title: contentItem.title ?? '',
              content: contentItem.content ?? contentItem.contentPreview ?? '',
              contentPreview: contentItem.contentPreview ?? '',
            },
            isCurrent: true,
          });
          break;
        case 'codeArtifact':
          context.codeArtifacts.push({
            artifactId: contentItem.id,
            codeArtifact: {
              artifactId: contentItem.id,
              title: contentItem.title ?? '',
              content: contentItem.content ?? '',
              type: 'text/markdown', // Default type if not specified
            },
            isCurrent: true,
          });
          break;
        case 'skillResponse':
          history.push({
            resultId: contentItem.id,
            title: contentItem.title ?? '',
          });
          break;
        default:
          // For other types (including image, website, memo), add them as contentList items
          if (contentItem.content || contentItem.contentPreview) {
            context.contentList = context.contentList || [];
            context.contentList.push({
              content: contentItem.content ?? contentItem.contentPreview ?? '',
              metadata: {
                title: contentItem.title,
                id: contentItem.id,
                type: contentItem.type,
              },
            });
          }
          break;
      }
    }

    return { context, history, images };
  }
}
