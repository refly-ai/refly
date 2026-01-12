import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  CanvasNode,
  CanvasEdge,
  WorkflowVariable,
  CanvasNodeType,
} from '@refly/openapi-schema';
import { CanvasNodeFilter } from '@refly/canvas-common';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { WorkflowService } from './workflow.service';
import { ToolService } from '../tool/tool.service';
import { genCanvasID, genNodeID, genNodeEntityId } from '@refly/utils';
import {
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  WorkflowInfo,
  ListWorkflowsResponse,
  WorkflowSummary,
  RunWorkflowRequest,
  RunWorkflowResponse,
  WorkflowRunStatus,
  UpdateWorkflowRequest,
  WorkflowOperation,
  RunNodeRequest,
  RunNodeResponse,
  ListNodeTypesResponse,
  NodeTypeInfo,
  NodeExecutionStatus,
  GenerateWorkflowCliRequest,
  GenerateWorkflowCliResponse,
  CLI_ERROR_CODES,
} from './workflow-cli.dto';
import { CopilotAutogenService } from '../copilot-autogen/copilot-autogen.service';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build connectTo filters from edges to preserve connections when adding nodes.
 * Maps target node IDs to source node filters for CanvasSyncService.addNodesToCanvas.
 */
function buildConnectToFilters(
  nodes: CanvasNode[],
  edges: Array<{ source: string; target: string }>,
): Map<string, CanvasNodeFilter[]> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const map = new Map<string, CanvasNodeFilter[]>();

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    if (!sourceNode) continue;

    const list = map.get(edge.target) || [];
    list.push({
      type: sourceNode.type as CanvasNodeType,
      entityId: (sourceNode.data?.entityId as string) || '',
      handleType: 'source',
    });
    map.set(edge.target, list);
  }

  return map;
}

/**
 * CLI node input structure (from CLI builder schema)
 */
interface CliNodeInput {
  id: string;
  type: string;
  input?: Record<string, unknown>;
  dependsOn?: string[];
  // Also support proper CanvasNode fields if passed
  data?: {
    title?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

/**
 * Transform CLI nodes to proper canvas node format.
 * CLI nodes use a simplified schema with `input` field, but canvas expects
 * proper `data` structure with `entityId`, `metadata`, etc.
 *
 * This function ensures nodes have:
 * - Unique node ID (generated if missing)
 * - Valid canvas node type
 * - Proper data structure with entityId and metadata
 * - Default position (prepareAddNode will calculate actual position)
 */
function transformCliNodesToCanvasNodes(
  cliNodes: CliNodeInput[],
): Array<Pick<CanvasNode, 'type' | 'data'> & Partial<Pick<CanvasNode, 'id'>>> {
  return cliNodes.map((cliNode) => {
    const nodeType = cliNode.type as CanvasNodeType;

    // Generate entityId based on node type
    const entityId = cliNode.data?.entityId || genNodeEntityId(nodeType);

    // Build metadata based on node type
    const defaultMetadata = getDefaultMetadataForNodeType(nodeType);
    const inputMetadata = cliNode.input || {};

    // Merge CLI input into metadata (for configuration like query, modelInfo, etc.)
    const metadata = {
      ...defaultMetadata,
      ...cliNode.data?.metadata,
      ...inputMetadata,
      sizeMode: 'compact' as const,
    };

    // Build the canvas node
    return {
      id: cliNode.id || genNodeID(),
      type: nodeType,
      data: {
        title: cliNode.data?.title || getDefaultTitleForNodeType(nodeType),
        entityId,
        contentPreview: (cliNode.data?.contentPreview as string) || '',
        metadata,
      },
    };
  });
}

/**
 * Get default metadata for a node type
 */
function getDefaultMetadataForNodeType(nodeType: CanvasNodeType): Record<string, unknown> {
  switch (nodeType) {
    case 'skillResponse':
      return {
        status: 'init',
        version: 0,
      };
    case 'document':
      return {
        contentPreview: '',
        lastModified: new Date().toISOString(),
        status: 'finish',
      };
    case 'resource':
      return {
        resourceType: 'weblink',
        lastAccessed: new Date().toISOString(),
      };
    case 'tool':
      return {
        toolType: 'TextToSpeech',
        configuration: {},
        status: 'ready',
      };
    case 'toolResponse':
      return {
        status: 'waiting',
      };
    case 'memo':
      return {};
    default:
      return {};
  }
}

/**
 * Get default title for a node type
 */
function getDefaultTitleForNodeType(nodeType: CanvasNodeType): string {
  switch (nodeType) {
    case 'skillResponse':
      return 'Agent';
    case 'document':
      return 'Document';
    case 'resource':
      return 'Resource';
    case 'tool':
      return 'Tool';
    case 'toolResponse':
      return 'Tool Response';
    case 'memo':
      return 'Memo';
    default:
      return 'Untitled';
  }
}

/**
 * Merge workflow variables with runtime variables.
 * Runtime variables override existing ones by name.
 */
function mergeWorkflowVariables(
  existing: WorkflowVariable[] = [],
  runtime: WorkflowVariable[] = [],
): WorkflowVariable[] {
  const merged = new Map<string, WorkflowVariable>();

  // Add existing variables
  for (const v of existing) {
    if (v.name) {
      merged.set(v.name, v);
    }
  }

  // Override with runtime variables
  for (const v of runtime) {
    if (v.name) {
      merged.set(v.name, v);
    }
  }

  return Array.from(merged.values());
}

/**
 * Apply workflow operations to nodes and edges.
 * Returns the modified nodes and edges.
 * Note: When adding nodes, CLI nodes are transformed to proper canvas format.
 */
function applyWorkflowOperations(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  operations: WorkflowOperation[],
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const resultNodes = [...nodes];
  const resultEdges = [...edges];

  for (const op of operations) {
    switch (op.type) {
      case 'add_node': {
        // Transform CLI node to proper canvas format if needed
        const [transformedNode] = transformCliNodesToCanvasNodes([
          op.node as unknown as CliNodeInput,
        ]);
        // Merge with original node to preserve any canvas-specific fields
        const canvasNode: CanvasNode = {
          ...op.node,
          type: transformedNode.type,
          data: {
            ...transformedNode.data,
            ...op.node.data, // Preserve any existing data fields
          },
          position: op.node.position || { x: 0, y: 0 },
        };
        resultNodes.push(canvasNode);
        break;
      }
      case 'remove_node': {
        const nodeIdx = resultNodes.findIndex((n) => n.id === op.nodeId);
        if (nodeIdx !== -1) {
          resultNodes.splice(nodeIdx, 1);
        }
        // Also remove edges connected to this node
        for (let i = resultEdges.length - 1; i >= 0; i--) {
          if (resultEdges[i].source === op.nodeId || resultEdges[i].target === op.nodeId) {
            resultEdges.splice(i, 1);
          }
        }
        break;
      }
      case 'update_node': {
        const nodeIdx = resultNodes.findIndex((n) => n.id === op.nodeId);
        if (nodeIdx !== -1) {
          resultNodes[nodeIdx] = { ...resultNodes[nodeIdx], ...op.data };
        }
        break;
      }
      case 'add_edge':
        resultEdges.push(op.edge);
        break;
      case 'remove_edge': {
        const edgeIdx = resultEdges.findIndex((e) => e.id === op.edgeId);
        if (edgeIdx !== -1) {
          resultEdges.splice(edgeIdx, 1);
        }
        break;
      }
    }
  }

  return { nodes: resultNodes, edges: resultEdges };
}

/**
 * Build CLI success response
 */
function buildCliSuccessResponse<T>(data: T): { success: boolean; data: T } {
  return { success: true, data };
}

/**
 * Build CLI error response and throw HTTP exception
 */
function throwCliError(
  code: string,
  message: string,
  hint?: string,
  status: number = HttpStatus.BAD_REQUEST,
): never {
  throw new HttpException(
    {
      ok: false,
      type: 'error',
      version: '1.0.0',
      error: { code, message, hint },
    },
    status,
  );
}

// ============================================================================
// WorkflowCliController
// ============================================================================

/**
 * CLI-specific workflow controller
 * These endpoints are designed for the Refly CLI and use JWT authentication.
 * Workflows are stored as canvases with nodes/edges.
 */
@Controller('v1/cli/workflow')
export class WorkflowCliController {
  private readonly logger = new Logger(WorkflowCliController.name);

  constructor(
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly workflowService: WorkflowService,
    private readonly copilotAutogenService: CopilotAutogenService,
  ) {}

  /**
   * Create a new workflow
   * POST /v1/cli/workflow
   *
   * Note: Canvas is created with default nodes (start node + skillResponse node)
   * to ensure proper canvas initialization. The start node is displayed as "User Input"
   * in the UI and is required for the canvas to function correctly.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @LoginedUser() user: User,
    @Body() body: CreateWorkflowRequest,
  ): Promise<{ success: boolean; data: CreateWorkflowResponse }> {
    this.logger.log(`Creating workflow for user ${user.uid}: ${body.name}`);

    try {
      // Create canvas with workflow data
      // Do NOT skip default nodes - the start node (User Input) is required for canvas to work properly
      const canvasId = genCanvasID();
      const canvas = await this.canvasService.createCanvas(user, {
        canvasId,
        title: body.name,
        variables: body.variables,
      });

      // If spec contains nodes/edges, add them to the canvas (in addition to default nodes)
      if (body.spec?.nodes?.length) {
        // Transform CLI nodes to proper canvas node format
        // CLI nodes may use simplified schema with `input` field instead of proper `data` structure
        const transformedNodes = transformCliNodesToCanvasNodes(
          body.spec.nodes as unknown as CliNodeInput[],
        );

        // Build connection map using original node IDs (before transformation)
        const connectToMap = body.spec.edges
          ? buildConnectToFilters(
              transformedNodes.map((n) => ({
                ...n,
                id: n.id!,
                position: { x: 0, y: 0 },
              })) as CanvasNode[],
              body.spec.edges,
            )
          : new Map();

        const nodesToAdd = transformedNodes.map((node) => ({
          node,
          connectTo: connectToMap.get(node.id!) || [],
        }));

        await this.canvasSyncService.addNodesToCanvas(user, canvasId, nodesToAdd, {
          autoLayout: true,
        });
      }

      return buildCliSuccessResponse({
        workflowId: canvas.canvasId,
        name: canvas.title ?? body.name,
        createdAt: canvas.createdAt.toJSON(),
      });
    } catch (error) {
      this.logger.error(`Failed to create workflow: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to create workflow: ${(error as Error).message}`,
        'Check your workflow specification and try again',
      );
    }
  }

  /**
   * Generate a workflow using AI from natural language
   * POST /v1/cli/workflow/generate
   *
   * This endpoint uses the Copilot Agent to generate a complete workflow
   * from a natural language description. It delegates to CopilotAutogenService.
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(
    @LoginedUser() user: User,
    @Body() body: GenerateWorkflowCliRequest,
  ): Promise<{ success: boolean; data: GenerateWorkflowCliResponse }> {
    this.logger.log(`Generating workflow for user ${user.uid}: ${body.query.slice(0, 50)}...`);

    try {
      // Delegate to CopilotAutogenService which handles:
      // 1. Canvas creation (or use existing)
      // 2. Copilot Agent invocation
      // 3. WorkflowPlan extraction (via planId reference)
      // 4. Canvas nodes/edges generation
      // 5. Canvas state update
      const result = await this.copilotAutogenService.generateWorkflow(user, {
        query: body.query,
        canvasId: body.canvasId,
        projectId: body.projectId,
        modelItemId: body.modelItemId,
        locale: body.locale,
        variables: body.variables,
        skipDefaultNodes: body.skipDefaultNodes,
        timeout: body.timeout,
      });

      return buildCliSuccessResponse({
        workflowId: result.canvasId,
        canvasId: result.canvasId,
        sessionId: result.sessionId,
        resultId: result.resultId,
        planId: result.planId,
        workflowPlan: result.workflowPlan,
        nodesCount: result.nodesCount,
        edgesCount: result.edgesCount,
      });
    } catch (error) {
      this.logger.error(`Failed to generate workflow: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to generate workflow: ${(error as Error).message}`,
        'Try refining your query to be more specific about the workflow you want to create',
      );
    }
  }

  /**
   * List all workflows for the current user
   * GET /v1/cli/workflow
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @LoginedUser() user: User,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{ success: boolean; data: ListWorkflowsResponse }> {
    this.logger.log(`Listing workflows for user ${user.uid}`);

    const pageSize = limit ?? 20;
    const page = offset ? Math.floor(offset / pageSize) + 1 : 1;

    const canvases = await this.canvasService.listCanvases(user, {
      page,
      pageSize,
    });

    const workflows: WorkflowSummary[] = canvases.map((canvas) => ({
      workflowId: canvas.canvasId,
      name: canvas.title ?? 'Untitled',
      nodeCount: 0, // Will be fetched if needed
      createdAt: canvas.createdAt?.toJSON?.() ?? new Date().toJSON(),
      updatedAt: canvas.updatedAt?.toJSON?.() ?? new Date().toJSON(),
    }));

    return buildCliSuccessResponse({
      workflows,
      total: workflows.length,
      limit: pageSize,
      offset: offset ?? 0,
    });
  }

  /**
   * Get workflow details
   * GET /v1/cli/workflow/:id
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
  ): Promise<{ success: boolean; data: WorkflowInfo }> {
    this.logger.log(`Getting workflow ${workflowId} for user ${user.uid}`);

    try {
      const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      return buildCliSuccessResponse({
        workflowId,
        name: rawData.title ?? 'Untitled',
        nodes: rawData.nodes ?? [],
        edges: rawData.edges ?? [],
        variables: rawData.variables ?? [],
        createdAt: rawData.owner?.createdAt ?? new Date().toJSON(),
        updatedAt: new Date().toJSON(), // Canvas doesn't expose updatedAt directly
      });
    } catch (error) {
      this.logger.error(`Failed to get workflow ${workflowId}: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow ${workflowId} not found`,
        'Check the workflow ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Update workflow
   * PATCH /v1/cli/workflow/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Body() body: UpdateWorkflowRequest,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Updating workflow ${workflowId} for user ${user.uid}`);

    try {
      // Update canvas title if provided
      if (body.name) {
        await this.canvasService.updateCanvas(user, {
          canvasId: workflowId,
          title: body.name,
        });
      }

      // Update variables if provided
      if (body.variables) {
        await this.canvasService.updateWorkflowVariables(user, {
          canvasId: workflowId,
          variables: body.variables,
        });
      }

      // Apply operations if provided
      if (body.operations?.length) {
        const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
          checkOwnership: true,
        });

        const { nodes: updatedNodes, edges: updatedEdges } = applyWorkflowOperations(
          rawData.nodes ?? [],
          rawData.edges ?? [],
          body.operations,
        );

        // Sync the updated state to canvas
        const nodeDiffs = [];
        const edgeDiffs = [];

        // Build node diffs
        const existingNodeIds = new Set((rawData.nodes ?? []).map((n) => n.id));
        const updatedNodeIds = new Set(updatedNodes.map((n) => n.id));

        // Find added nodes
        for (const node of updatedNodes) {
          if (!existingNodeIds.has(node.id)) {
            nodeDiffs.push({ type: 'add' as const, id: node.id, to: node });
          }
        }

        // Find removed nodes
        for (const node of rawData.nodes ?? []) {
          if (!updatedNodeIds.has(node.id)) {
            nodeDiffs.push({ type: 'delete' as const, id: node.id, from: node });
          }
        }

        // Find modified nodes
        const existingNodeMap = new Map((rawData.nodes ?? []).map((n) => [n.id, n]));
        for (const node of updatedNodes) {
          const existing = existingNodeMap.get(node.id);
          if (existing && JSON.stringify(existing) !== JSON.stringify(node)) {
            nodeDiffs.push({ type: 'update' as const, id: node.id, from: existing, to: node });
          }
        }

        // Build edge diffs similarly
        const existingEdgeIds = new Set((rawData.edges ?? []).map((e) => e.id));
        const updatedEdgeIds = new Set(updatedEdges.map((e) => e.id));

        for (const edge of updatedEdges) {
          if (!existingEdgeIds.has(edge.id)) {
            edgeDiffs.push({ type: 'add' as const, id: edge.id, to: edge });
          }
        }

        for (const edge of rawData.edges ?? []) {
          if (!updatedEdgeIds.has(edge.id)) {
            edgeDiffs.push({ type: 'delete' as const, id: edge.id, from: edge });
          }
        }

        if (nodeDiffs.length > 0 || edgeDiffs.length > 0) {
          await this.canvasSyncService.syncState(user, {
            canvasId: workflowId,
            transactions: [
              {
                txId: `cli-update-${Date.now()}`,
                createdAt: Date.now(),
                syncedAt: Date.now(),
                source: { type: 'system' },
                nodeDiffs,
                edgeDiffs,
              },
            ],
          });
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update workflow ${workflowId}: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to update workflow: ${(error as Error).message}`,
        'Check the workflow ID and operations',
      );
    }
  }

  /**
   * Delete workflow
   * DELETE /v1/cli/workflow/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Deleting workflow ${workflowId} for user ${user.uid}`);

    try {
      await this.canvasService.deleteCanvas(user, { canvasId: workflowId });
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to delete workflow ${workflowId}: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow ${workflowId} not found`,
        'Check the workflow ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Execute a workflow
   * POST /v1/cli/workflow/:id/run
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/run')
  async run(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Body() body: RunWorkflowRequest,
  ): Promise<{ success: boolean; data: RunWorkflowResponse }> {
    this.logger.log(`Running workflow ${workflowId} for user ${user.uid}`);

    try {
      // Get existing workflow variables and merge with runtime variables
      const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      const mergedVariables = mergeWorkflowVariables(rawData.variables, body.variables);

      // Initialize workflow execution
      const executionId = await this.workflowService.initializeWorkflowExecution(
        user,
        workflowId,
        mergedVariables,
        {
          startNodes: body.startNodes,
          checkCanvasOwnership: true,
        },
      );

      return buildCliSuccessResponse({
        runId: executionId,
        workflowId,
        status: 'init',
        startedAt: new Date().toJSON(),
      });
    } catch (error) {
      this.logger.error(`Failed to run workflow ${workflowId}: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to start workflow: ${(error as Error).message}`,
        'Check the workflow configuration and try again',
      );
    }
  }

  /**
   * Get workflow run status
   * GET /v1/cli/workflow/run/:runId
   */
  @UseGuards(JwtAuthGuard)
  @Get('run/:runId')
  async getRunStatus(
    @LoginedUser() user: User,
    @Param('runId') runId: string,
  ): Promise<{ success: boolean; data: WorkflowRunStatus }> {
    this.logger.log(`Getting run status for ${runId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getWorkflowDetail(user, runId);

      const nodeStatuses: NodeExecutionStatus[] = (detail.nodeExecutions ?? []).map((nodeExec) => ({
        nodeId: nodeExec.nodeId,
        nodeType: nodeExec.nodeType,
        status: nodeExec.status,
        title: nodeExec.title ?? '',
        startTime: nodeExec.startTime?.toJSON(),
        endTime: nodeExec.endTime?.toJSON(),
        progress: nodeExec.progress ?? 0,
        errorMessage: nodeExec.errorMessage ?? undefined,
      }));

      const executedNodes = nodeStatuses.filter((n) => n.status === 'finish').length;
      const failedNodes = nodeStatuses.filter((n) => n.status === 'failed').length;

      return buildCliSuccessResponse({
        runId: detail.executionId,
        workflowId: detail.canvasId,
        status: detail.status as any,
        title: detail.title,
        totalNodes: detail.totalNodes,
        executedNodes,
        failedNodes,
        nodeStatuses,
        createdAt: detail.createdAt.toJSON(),
        updatedAt: detail.updatedAt.toJSON(),
      });
    } catch (error) {
      this.logger.error(`Failed to get run status ${runId}: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow run ${runId} not found`,
        'Check the run ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Abort a running workflow
   * POST /v1/cli/workflow/run/:runId/abort
   */
  @UseGuards(JwtAuthGuard)
  @Post('run/:runId/abort')
  async abort(
    @LoginedUser() user: User,
    @Param('runId') runId: string,
  ): Promise<{ success: boolean }> {
    this.logger.log(`Aborting workflow run ${runId} for user ${user.uid}`);

    try {
      await this.workflowService.abortWorkflow(user, runId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to abort workflow run ${runId}: ${(error as Error).message}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to abort workflow: ${(error as Error).message}`,
        'The workflow may have already completed or does not exist',
      );
    }
  }
}

// ============================================================================
// NodeCliController
// ============================================================================

/**
 * CLI Node operations controller
 * Endpoints for listing node types and running individual nodes
 */
@Controller('v1/cli/node')
export class NodeCliController {
  private readonly logger = new Logger(NodeCliController.name);

  constructor(private readonly toolService: ToolService) {}

  /**
   * List available node types
   * GET /v1/cli/node/types
   */
  @UseGuards(JwtAuthGuard)
  @Get('types')
  async listTypes(
    @LoginedUser() user: User,
  ): Promise<{ success: boolean; data: ListNodeTypesResponse }> {
    this.logger.log(`Listing node types for user ${user.uid}`);

    const nodeTypes: NodeTypeInfo[] = [];

    // Core node types (always available)
    nodeTypes.push({
      type: 'start',
      name: 'Start / User Input',
      description: 'Workflow entry point that captures user input and initiates execution',
      category: 'core',
    });

    nodeTypes.push({
      type: 'skillResponse',
      name: 'AI Agent',
      description: 'AI-powered response node that can use tools and generate content',
      category: 'core',
    });

    nodeTypes.push({
      type: 'document',
      name: 'Document',
      description: 'Reference a document from your library',
      category: 'core',
    });

    nodeTypes.push({
      type: 'resource',
      name: 'Resource',
      description: 'Reference a resource (URL, file, etc.)',
      category: 'core',
    });

    nodeTypes.push({
      type: 'memo',
      name: 'Memo',
      description: 'Add notes or instructions',
      category: 'core',
    });

    // Get builtin tools
    const builtinTools = this.toolService.listBuiltinTools();
    for (const tool of builtinTools) {
      nodeTypes.push({
        type: `tool:${tool.toolset?.key ?? tool.id}`,
        name: tool.name,
        description: (tool.toolset?.definition?.descriptionDict?.en as string) ?? 'Builtin tool',
        category: 'builtin',
        authorized: true,
      });
    }

    // Get user tools (authorized and unauthorized)
    try {
      const userTools = await this.toolService.listUserTools(user);
      for (const tool of userTools) {
        nodeTypes.push({
          type: `tool:${tool.key}`,
          name: tool.name,
          description: tool.description ?? 'External tool',
          category: 'installed',
          authorized: tool.authorized,
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to get user tools: ${(error as Error).message}`);
    }

    return buildCliSuccessResponse({
      nodeTypes,
      total: nodeTypes.length,
    });
  }

  /**
   * Run a single node (for debugging/testing)
   * POST /v1/cli/node/run
   *
   * TODO: Implement full node execution.
   * This requires invokeSkillForCli wrapper and executeToolNode helper
   * to properly execute nodes outside of a workflow context.
   */
  @UseGuards(JwtAuthGuard)
  @Post('run')
  async runNode(
    @LoginedUser() user: User,
    @Body() body: RunNodeRequest,
  ): Promise<{ success: boolean; data: RunNodeResponse }> {
    this.logger.log(`Running node type ${body.nodeType} for user ${user.uid}`);

    // TODO: Implement single node execution
    // This requires:
    // 1. invokeSkillForCli wrapper for skillResponse nodes
    // 2. executeToolNode helper for tool nodes
    // 3. Proper context setup and result handling

    // For now, return a placeholder response indicating the feature is pending
    throwCliError(
      CLI_ERROR_CODES.VALIDATION_ERROR,
      'Single node execution not yet implemented',
      'Use workflow execution instead: refly workflow run <id>',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
