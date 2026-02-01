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
  InvokeSkillRequest,
  GenericToolset,
  UserTool,
} from '@refly/openapi-schema';
import { CanvasNodeFilter, extractToolsetsWithNodes } from '@refly/canvas-common';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { WorkflowService } from './workflow.service';
import { ToolService } from '../tool/tool.service';
import { SkillService } from '../skill/skill.service';
import { RedisService } from '../common/redis.service';
import { genCanvasID, genNodeID, genNodeEntityId, genActionResultID } from '@refly/utils';
import { BaseError } from '@refly/errors';

/**
 * Extract error message from various error types.
 * Handles BaseError (which stores message in messageDict) and standard Error.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof BaseError) {
    return error.getMessage('en') || error.toString();
  }
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  return String(error);
}
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
  NodeExecutionDetail,
  WorkflowRunDetail,
  WorkflowToolsStatusResponse,
  GenerateWorkflowCliRequest,
  GenerateWorkflowCliResponse,
  GenerateWorkflowAsyncResponse,
  GenerateStatusResponse,
  NodeOutputResponse,
  EditWorkflowCliRequest,
  EditWorkflowCliResponse,
  CLI_ERROR_CODES,
} from './workflow-cli.dto';
import { genCopilotSessionID } from '@refly/utils';
import { CopilotAutogenService } from '../copilot-autogen/copilot-autogen.service';
import { ToolCallService } from '../tool-call/tool-call.service';
import { PrismaService } from '../common/prisma.service';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a toolset is authorized/installed
 * - MCP servers: check if exists in userTools by name
 * - Builtin tools: always available, no installation needed
 * - Regular tools: check if exists in userTools by key and authorized status
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  // MCP servers need to be checked separately
  if (toolset.type === 'mcp') {
    return userTools.some((t) => t.toolset?.name === toolset.name);
  }

  // Builtin tools are always available
  if (toolset.builtin) {
    return true;
  }

  // Find matching user tool by key
  const matchingUserTool = userTools.find((t) => t.key === toolset.toolset?.key);

  // If not in userTools list, user hasn't installed/authorized this tool
  if (!matchingUserTool) {
    return false;
  }

  // For external OAuth tools, check authorized status
  return matchingUserTool.authorized ?? false;
};

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
  // Top-level shorthand fields (for simplified CLI/agent usage)
  query?: string;
  toolsetKeys?: string[];
  // Also support proper CanvasNode fields if passed
  data?: {
    title?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    // Common fields that should go into metadata
    query?: string;
    selectedToolsets?: unknown[];
    toolsetKeys?: string[];
    modelInfo?: Record<string, unknown>;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

/**
 * Map CLI node types to canvas node types.
 * CLI uses simplified type names (e.g., 'agent') that need to be mapped
 * to proper canvas node types (e.g., 'skillResponse').
 */
function mapCliNodeTypeToCanvasType(cliType: string): CanvasNodeType {
  const typeMapping: Record<string, CanvasNodeType> = {
    agent: 'skillResponse',
    skill: 'skillResponse',
    // Add more mappings as needed
  };
  return (typeMapping[cliType] || cliType) as CanvasNodeType;
}

/**
 * Transform CLI nodes to proper canvas node format.
 * CLI nodes use a simplified schema with `input` field, but canvas expects
 * proper `data` structure with `entityId`, `metadata`, etc.
 *
 * This function ensures nodes have:
 * - Unique node ID (generated if missing)
 * - Valid canvas node type (maps 'agent' -> 'skillResponse')
 * - Proper data structure with entityId and metadata
 * - Fields like query, selectedToolsets, modelInfo are moved to metadata
 * - Default position (prepareAddNode will calculate actual position)
 */
function transformCliNodesToCanvasNodes(
  cliNodes: CliNodeInput[],
): Array<Pick<CanvasNode, 'type' | 'data'> & Partial<Pick<CanvasNode, 'id'>>> {
  return cliNodes.map((cliNode) => {
    // Map CLI type to canvas type (e.g., 'agent' -> 'skillResponse')
    const nodeType = mapCliNodeTypeToCanvasType(cliNode.type);

    // Generate entityId based on node type
    const entityId = cliNode.data?.entityId || genNodeEntityId(nodeType);

    // Build metadata based on node type
    const defaultMetadata = getDefaultMetadataForNodeType(nodeType);
    const inputMetadata = cliNode.input || {};

    // Extract fields from data that should be in metadata
    // Supports both top-level shorthand and nested data fields
    // Priority: top-level > data.field > data.metadata.field
    const dataFieldsForMetadata: Record<string, unknown> = {};

    // query: top-level > data.query
    if (cliNode.query !== undefined) {
      dataFieldsForMetadata.query = cliNode.query;
    } else if (cliNode.data?.query !== undefined) {
      dataFieldsForMetadata.query = cliNode.data.query;
    }

    // toolsetKeys: top-level > data.toolsetKeys > data.metadata.toolsetKeys
    if (cliNode.toolsetKeys !== undefined) {
      dataFieldsForMetadata.toolsetKeys = cliNode.toolsetKeys;
    } else if (cliNode.data?.toolsetKeys !== undefined) {
      dataFieldsForMetadata.toolsetKeys = cliNode.data.toolsetKeys;
    }

    if (cliNode.data?.selectedToolsets !== undefined) {
      dataFieldsForMetadata.selectedToolsets = cliNode.data.selectedToolsets;
    }
    if (cliNode.data?.modelInfo !== undefined) {
      dataFieldsForMetadata.modelInfo = cliNode.data.modelInfo;
    }

    // Merge all metadata sources (priority: dataFieldsForMetadata > input > data.metadata > default)
    const metadata = {
      ...defaultMetadata,
      ...cliNode.data?.metadata,
      ...inputMetadata,
      ...dataFieldsForMetadata,
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
    case 'start':
      return {};
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
    case 'start':
      return 'Start';
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
 * Runtime variables override existing ones by variableId (preferred) or name (fallback).
 */
function mergeWorkflowVariables(
  existing: WorkflowVariable[] = [],
  runtime: WorkflowVariable[] = [],
): WorkflowVariable[] {
  const mergedById = new Map<string, WorkflowVariable>();
  const mergedByName = new Map<string, WorkflowVariable>();

  // Add existing variables (index by both id and name)
  for (const v of existing) {
    if (v.variableId) {
      mergedById.set(v.variableId, v);
    }
    if (v.name) {
      mergedByName.set(v.name, v);
    }
  }

  // Override with runtime variables (prefer variableId, fallback to name)
  for (const v of runtime) {
    if (v.variableId && mergedById.has(v.variableId)) {
      // Match by variableId (preferred)
      mergedById.set(v.variableId, v);
      // Also update name map if name exists
      if (v.name) {
        mergedByName.set(v.name, v);
      }
    } else if (v.name && mergedByName.has(v.name)) {
      // Fallback: match by name
      const existingVar = mergedByName.get(v.name)!;
      mergedByName.set(v.name, v);
      if (existingVar.variableId) {
        mergedById.set(existingVar.variableId, v);
      }
    }
    // If neither variableId nor name matches, skip (don't add new variables)
  }

  // Return deduplicated list (prefer id-based map)
  const result = new Map<string, WorkflowVariable>();
  for (const v of mergedById.values()) {
    result.set(v.variableId || v.name, v);
  }
  for (const v of mergedByName.values()) {
    if (!v.variableId || !result.has(v.variableId)) {
      result.set(v.name, v);
    }
  }

  return Array.from(result.values());
}

/**
 * Apply workflow operations to nodes and edges (for remove/update only).
 * add_node operations are handled separately via canvasSyncService.addNodesToCanvas.
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
      case 'add_node':
        // Handled separately via canvasSyncService.addNodesToCanvas
        break;
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
  suggestedFix?: {
    field?: string;
    format?: string;
    example?: string;
  },
): never {
  throw new HttpException(
    {
      ok: false,
      type: 'error',
      version: '1.0.0',
      error: { code, message, hint, ...(suggestedFix && { suggestedFix }) },
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
    private readonly toolCallService: ToolCallService,
    private readonly toolService: ToolService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new workflow
   * POST /v1/cli/workflow
   *
   * When spec.nodes is provided:
   * - If nodes include a start node, skip default nodes and use user's nodes directly
   * - If nodes don't include a start node, create only a start node (not start + skillResponse)
   *   and connect user's first node to it
   *
   * When spec.nodes is not provided:
   * - Create default nodes (start + skillResponse) for normal canvas behavior
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @LoginedUser() user: User,
    @Body() body: CreateWorkflowRequest,
  ): Promise<{ success: boolean; data: CreateWorkflowResponse }> {
    this.logger.log(`Creating workflow for user ${user.uid}: ${body.name}`);

    try {
      const canvasId = genCanvasID();

      // Check if user provides nodes in spec
      const hasUserNodes = body.spec?.nodes?.length > 0;
      // Check if user provides a start node
      const userProvidesStartNode = body.spec?.nodes?.some((n: any) => n.type === 'start');

      // Determine whether to skip default nodes:
      // - If user provides nodes with a start node: skip all default nodes
      // - If user provides nodes without a start node: we'll create only a start node below
      // - If no user nodes: use default behavior (start + skillResponse)
      const skipDefaultNodes = hasUserNodes;

      const canvas = await this.canvasService.createCanvas(
        user,
        {
          canvasId,
          title: body.name,
          variables: body.variables,
        },
        { skipDefaultNodes },
      );

      // If spec contains nodes/edges, add them to the canvas
      if (hasUserNodes) {
        // Transform CLI nodes to proper canvas node format
        const transformedNodes = transformCliNodesToCanvasNodes(
          body.spec.nodes as unknown as CliNodeInput[],
        );

        // Resolve toolset keys to full GenericToolset objects with nested toolset.key
        // This ensures proper authorization checking in the frontend
        for (const node of transformedNodes) {
          const toolsetKeys = (node.data?.metadata as Record<string, unknown>)?.toolsetKeys as
            | string[]
            | undefined;
          if (toolsetKeys?.length) {
            this.logger.log(`[CREATE] Resolving toolset keys: ${toolsetKeys.join(', ')}`);
            const { resolved } = await this.toolService.resolveToolsetsByKeys(user, toolsetKeys);
            this.logger.log(`[CREATE] Resolved ${resolved.length} toolsets`);
            const metadata = node.data?.metadata as Record<string, unknown>;
            const existingToolsets = (metadata?.selectedToolsets as unknown[]) || [];
            metadata.selectedToolsets = [...existingToolsets, ...resolved];
            metadata.toolsetKeys = undefined;

            // Insert toolset mentions into query for proper frontend display
            if (resolved.length > 0) {
              const toolsetMentions = resolved
                .map((t) => `@{type=toolset,id=${t.id},name=${t.name}}`)
                .join(' ');
              const existingQuery = (metadata.query as string) || '';
              // Add toolset mentions if not already present
              if (!existingQuery.includes('@{type=toolset')) {
                metadata.query = existingQuery
                  ? `使用 ${toolsetMentions} ${existingQuery}`
                  : toolsetMentions;
                this.logger.log(`[CREATE] Updated query with toolset mentions: ${metadata.query}`);
              }
            }
          }
        }

        // If user doesn't provide a start node, create one and connect first node to it
        if (!userProvidesStartNode) {
          // Create a start node first
          const startNode = {
            node: {
              id: genNodeID(),
              type: 'start' as const,
              data: {
                title: 'Start',
                entityId: genNodeEntityId('start'),
              },
            },
            connectTo: [],
          };

          await this.canvasSyncService.addNodesToCanvas(user, canvasId, [startNode], {
            autoLayout: true,
          });
        }

        // Build connection map using original node IDs
        // This maps target node IDs to their source node filters based on edges
        let connectToMap: Map<string, CanvasNodeFilter[]> = new Map();

        if (body.spec.edges) {
          // Use explicit edges if provided
          connectToMap = buildConnectToFilters(
            transformedNodes.map((n) => ({
              ...n,
              id: n.id!,
              position: { x: 0, y: 0 },
            })) as CanvasNode[],
            body.spec.edges,
          );
        } else {
          // Build connections from dependsOn fields in simplified format
          const cliNodes = body.spec.nodes as unknown as CliNodeInput[];
          for (const cliNode of cliNodes) {
            if (cliNode.dependsOn?.length) {
              // Find entityIds for the source nodes
              const connectTo: CanvasNodeFilter[] = cliNode.dependsOn
                .map((sourceId) => {
                  const sourceNode = transformedNodes.find((n) => n.id === sourceId);
                  if (sourceNode?.data?.entityId) {
                    return {
                      type: sourceNode.type as CanvasNodeType,
                      entityId: sourceNode.data.entityId,
                    };
                  }
                  return null;
                })
                .filter((x): x is CanvasNodeFilter => x !== null);

              if (connectTo.length > 0) {
                connectToMap.set(cliNode.id, connectTo);
              }
            }
          }
        }

        // Build nodes to add with their connection info
        // If connectTo is empty for a node, prepareAddNode will auto-connect to start node
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
      this.logger.error(`Failed to create workflow: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to create workflow: ${getErrorMessage(error)}`,
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
   *
   * Supports two modes:
   * - Sync mode (default): Waits for completion and returns full result
   * - Async mode (async=true): Returns immediately with sessionId for polling
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generate(
    @LoginedUser() user: User,
    @Body() body: GenerateWorkflowCliRequest,
  ): Promise<{
    success: boolean;
    data: GenerateWorkflowCliResponse | GenerateWorkflowAsyncResponse;
  }> {
    this.logger.log(`Generating workflow for user ${user.uid}: ${body.query.slice(0, 50)}...`);

    try {
      // Async mode: Start generation and return immediately
      if (body.async) {
        const sessionId = body.sessionId || genCopilotSessionID();
        this.logger.log(`[Async] Starting async generation with sessionId: ${sessionId}`);

        const asyncResult = await this.copilotAutogenService.startGenerateWorkflowAsync(user, {
          ...body,
          sessionId,
        });

        return buildCliSuccessResponse(asyncResult);
      }

      // Sync mode: Wait for completion (original behavior)
      // Delegate to CopilotAutogenService.generateWorkflowForCli which handles:
      // 1. Canvas creation (or use existing)
      // 2. Copilot Agent invocation
      // 3. WorkflowPlan reference extraction (planId + version)
      // 4. Full plan fetching from database for display
      // 5. Canvas nodes/edges generation
      // 6. Canvas state update
      const result = await this.copilotAutogenService.generateWorkflowForCli(user, {
        query: body.query,
        canvasId: body.canvasId,
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
      this.logger.error(`Failed to generate workflow: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to generate workflow: ${getErrorMessage(error)}`,
        'Try refining your query to be more specific about the workflow you want to create',
      );
    }
  }

  /**
   * Get workflow generation status (for polling in async mode)
   * GET /v1/cli/workflow/generate-status
   *
   * Use this endpoint to poll for progress when using async generation mode.
   * Returns progress information during execution and full result when completed.
   */
  @UseGuards(JwtAuthGuard)
  @Get('generate-status')
  async getGenerateStatus(
    @LoginedUser() user: User,
    @Query('sessionId') sessionId: string,
    @Query('canvasId') canvasId?: string,
  ): Promise<{ success: boolean; data: GenerateStatusResponse }> {
    if (!sessionId) {
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        'sessionId is required',
        'Provide the sessionId returned from the async generate request',
      );
    }

    this.logger.debug(`Checking generate status for session: ${sessionId}`);

    try {
      const status = await this.copilotAutogenService.getGenerateStatus(user, sessionId, canvasId);
      return buildCliSuccessResponse(status);
    } catch (error) {
      this.logger.error(`Failed to get generate status: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to get status: ${getErrorMessage(error)}`,
        'Check if the sessionId is correct',
      );
    }
  }

  /**
   * Edit a workflow using natural language
   * POST /v1/cli/workflow/edit
   *
   * This endpoint uses the Copilot Agent to edit an existing workflow
   * based on a natural language instruction. It supports both:
   * - generate_workflow: Copilot generates a new workflow plan
   * - patch_workflow: Copilot patches the existing workflow plan
   */
  @UseGuards(JwtAuthGuard)
  @Post('edit')
  async editWorkflow(
    @LoginedUser() user: User,
    @Body() body: EditWorkflowCliRequest,
  ): Promise<{ success: boolean; data: EditWorkflowCliResponse }> {
    this.logger.log(`[CLI] Editing workflow ${body.canvasId} with query: ${body.query}`);

    // Validate input
    if (!body.canvasId) {
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        'canvasId is required',
        'Provide a valid Canvas ID (c-xxx)',
      );
    }

    if (!body.query) {
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        'query is required',
        'Provide a natural language description of the edit you want to make',
      );
    }

    try {
      const result = await this.copilotAutogenService.editWorkflowForCli(user, body);
      return buildCliSuccessResponse(result);
    } catch (error) {
      this.logger.error(`Failed to edit workflow: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to edit workflow: ${getErrorMessage(error)}`,
        'Try refining your edit instruction to be more specific',
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
   * List available toolset inventory keys
   * GET /v1/cli/workflow/toolset-keys
   *
   * Returns all available toolset keys that can be used when adding nodes.
   * This allows CLI users to reference toolsets by key (e.g., 'tavily', 'fal_audio')
   * instead of full toolset IDs.
   *
   * NOTE: This route must be defined BEFORE the :id route to avoid being caught by it.
   */
  @UseGuards(JwtAuthGuard)
  @Get('toolset-keys')
  async listToolsetKeys(@LoginedUser() user: User): Promise<{
    success: boolean;
    data: {
      keys: Array<{ key: string; name: string; type: string; requiresAuth: boolean }>;
    };
  }> {
    this.logger.log(`Listing toolset keys for user ${user.uid}`);
    const keys = await this.toolService.listInventoryKeysForCli();
    return buildCliSuccessResponse({ keys });
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

    // Validate workflow ID format (should start with 'c-')
    if (!workflowId.startsWith('c-')) {
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Invalid workflow ID: "${workflowId}". Workflow IDs should start with "c-"`,
        'Usage: refly workflow get <workflowId>. Example: refly workflow get c-xxx',
      );
    }

    try {
      const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      // Get the latest copilot session for this workflow
      const latestSession = await this.prisma.copilotSession.findFirst({
        where: { canvasId: workflowId, uid: user.uid },
        orderBy: { createdAt: 'desc' },
        select: { sessionId: true },
      });

      return buildCliSuccessResponse({
        workflowId,
        name: rawData.title ?? 'Untitled',
        nodes: rawData.nodes ?? [],
        edges: rawData.edges ?? [],
        variables: rawData.variables ?? [],
        createdAt: rawData.owner?.createdAt ?? new Date().toJSON(),
        updatedAt: new Date().toJSON(), // Canvas doesn't expose updatedAt directly
        sessionId: latestSession?.sessionId,
      });
    } catch (error) {
      this.logger.error(`Failed to get workflow ${workflowId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow ${workflowId} not found`,
        'Check the workflow ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get workflow session info
   * GET /v1/cli/workflow/:id/session
   *
   * Returns the latest copilot session for this workflow, useful for
   * maintaining context continuity in workflow edit operations.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/session')
  async getSession(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
  ): Promise<{
    success: boolean;
    data: { workflowId: string; sessionId?: string; createdAt?: string; lastUsedAt?: string };
  }> {
    this.logger.log(`Getting session for workflow ${workflowId}, user ${user.uid}`);

    try {
      // Verify workflow exists and belongs to user
      await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      // Get the latest copilot session for this workflow
      const latestSession = await this.prisma.copilotSession.findFirst({
        where: { canvasId: workflowId, uid: user.uid },
        orderBy: { createdAt: 'desc' },
        select: { sessionId: true, createdAt: true, updatedAt: true },
      });

      return buildCliSuccessResponse({
        workflowId,
        sessionId: latestSession?.sessionId,
        createdAt: latestSession?.createdAt?.toISOString(),
        lastUsedAt: latestSession?.updatedAt?.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to get session for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
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
   *
   * Query params:
   * - resolveToolsetKeys: If 'true', resolve toolset keys (e.g., 'tavily') to full toolset IDs
   * - autoLayout: If 'true', enable auto-layout to prevent node overlapping
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Body() body: UpdateWorkflowRequest,
    @Query('resolveToolsetKeys') resolveToolsetKeys?: string,
    @Query('autoLayout') autoLayout?: string,
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
      const operations = body.operations;
      if (operations?.length) {
        // Separate add_node operations from others
        const addNodeOps = operations.filter((op) => op.type === 'add_node');
        const otherOps = operations.filter((op) => op.type !== 'add_node');

        // Handle add_node via canvasSyncService.addNodesToCanvas (proper node creation)
        if (addNodeOps.length > 0) {
          this.logger.log(`[PATCH] Processing ${addNodeOps.length} add_node operations`);

          // Transform CLI nodes to canvas format and resolve toolset keys
          const cliNodes = addNodeOps.map(
            (op) => (op as { type: 'add_node'; node: CanvasNode }).node as unknown as CliNodeInput,
          );
          this.logger.log(`[PATCH] CLI nodes: ${JSON.stringify(cliNodes)}`);

          const transformedNodes = transformCliNodesToCanvasNodes(cliNodes);
          this.logger.log(`[PATCH] Transformed nodes: ${JSON.stringify(transformedNodes)}`);

          // Resolve toolset keys if requested
          if (resolveToolsetKeys === 'true') {
            this.logger.log('[PATCH] Resolving toolset keys...');
            for (const node of transformedNodes) {
              const toolsetKeys = (node.data?.metadata as Record<string, unknown>)?.toolsetKeys as
                | string[]
                | undefined;
              if (toolsetKeys?.length) {
                this.logger.log(`[PATCH] Resolving toolset keys: ${toolsetKeys.join(', ')}`);
                const { resolved } = await this.toolService.resolveToolsetsByKeys(
                  user,
                  toolsetKeys,
                );
                this.logger.log(`[PATCH] Resolved ${resolved.length} toolsets`);
                const metadata = node.data?.metadata as Record<string, unknown>;
                const existingToolsets = (metadata?.selectedToolsets as unknown[]) || [];
                metadata.selectedToolsets = [...existingToolsets, ...resolved];
                metadata.toolsetKeys = undefined;

                // Insert toolset mentions into query for proper frontend display
                if (resolved.length > 0) {
                  const toolsetMentions = resolved
                    .map((t) => `@{type=toolset,id=${t.id},name=${t.name}}`)
                    .join(' ');
                  const existingQuery = (metadata.query as string) || '';
                  // Add toolset mentions if not already present
                  if (!existingQuery.includes('@{type=toolset')) {
                    // If no query exists, just set the toolset mentions
                    // If query exists, prepend toolset mentions with "使用" prefix
                    metadata.query = existingQuery
                      ? `使用 ${toolsetMentions} ${existingQuery}`
                      : toolsetMentions;
                    this.logger.log(
                      `[PATCH] Updated query with toolset mentions: ${metadata.query}`,
                    );
                  }
                }
              }
            }
          }

          // Add default style and position for proper rendering
          const nodesToAdd = transformedNodes.map((node, index) => {
            const inputNode = addNodeOps[index] as { type: 'add_node'; node: CanvasNode };
            return {
              node: {
                ...node,
                position: inputNode.node.position || { x: 0, y: 0 },
                style: { width: 288, height: 'auto' },
              } as unknown as CanvasNode,
              connectTo: [],
            };
          });

          this.logger.log(`[PATCH] Final nodes to add: ${JSON.stringify(nodesToAdd)}`);
          this.logger.log(`[PATCH] autoLayout: ${autoLayout}`);

          await this.canvasSyncService.addNodesToCanvas(user, workflowId, nodesToAdd, {
            autoLayout: autoLayout === 'true',
          });
          this.logger.log('[PATCH] addNodesToCanvas completed');
        }

        // Handle remove/update operations via syncState
        if (otherOps.length > 0) {
          const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
            checkOwnership: true,
          });

          const { nodes: updatedNodes, edges: updatedEdges } = applyWorkflowOperations(
            rawData.nodes ?? [],
            rawData.edges ?? [],
            otherOps,
          );

          // Build diffs for remove/update operations
          const nodeDiffs = [];
          const edgeDiffs = [];

          const updatedNodeIds = new Set(updatedNodes.map((n) => n.id));

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

          // Build edge diffs
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
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update workflow ${workflowId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to update workflow: ${getErrorMessage(error)}`,
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
      this.logger.error(`Failed to delete workflow ${workflowId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.WORKFLOW_NOT_FOUND,
        `Workflow ${workflowId} not found`,
        'Check the workflow ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Auto-layout workflow nodes
   * POST /v1/cli/workflow/:id/layout
   *
   * Simple layout algorithm:
   * 1. Find node levels based on edges (BFS from start node)
   * 2. Position nodes in a grid layout (LR = left-to-right)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/layout')
  async layout(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Query('direction') direction?: 'TB' | 'LR',
  ): Promise<{ success: boolean }> {
    this.logger.log(`Auto-layout workflow ${workflowId} for user ${user.uid}`);

    try {
      // Get current canvas data
      const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      const nodes = rawData.nodes ?? [];
      const edges = rawData.edges ?? [];

      if (nodes.length === 0) {
        return { success: true };
      }

      // Layout constants (match canvas-common spacing)
      const NODE_WIDTH = 288;
      const NODE_HEIGHT = 180; // Compact node height estimate
      const SPACING_X = 100;
      const SPACING_Y = 30; // Match canvas-common SPACING.Y
      const MARGIN = 50;

      // Build adjacency list
      const outEdges = new Map<string, string[]>();
      const inEdges = new Map<string, string[]>();
      for (const edge of edges) {
        if (!outEdges.has(edge.source)) outEdges.set(edge.source, []);
        outEdges.get(edge.source)!.push(edge.target);
        if (!inEdges.has(edge.target)) inEdges.set(edge.target, []);
        inEdges.get(edge.target)!.push(edge.source);
      }

      // Find root nodes (no incoming edges)
      const rootNodes = nodes.filter((n) => !inEdges.has(n.id) || inEdges.get(n.id)!.length === 0);

      // BFS to assign levels
      const nodeLevel = new Map<string, number>();
      const queue: Array<{ id: string; level: number }> = rootNodes.map((n) => ({
        id: n.id,
        level: 0,
      }));
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { id, level } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        nodeLevel.set(id, level);

        const targets = outEdges.get(id) ?? [];
        for (const target of targets) {
          if (!visited.has(target)) {
            queue.push({ id: target, level: level + 1 });
          }
        }
      }

      // Assign level 0 to unvisited nodes
      for (const node of nodes) {
        if (!nodeLevel.has(node.id)) {
          nodeLevel.set(node.id, 0);
        }
      }

      // Group nodes by level
      const levelNodes = new Map<number, CanvasNode[]>();
      for (const node of nodes) {
        const level = nodeLevel.get(node.id) ?? 0;
        if (!levelNodes.has(level)) levelNodes.set(level, []);
        levelNodes.get(level)!.push(node);
      }

      // Calculate new positions
      const dir = direction ?? 'LR';
      const newPositions = new Map<string, { x: number; y: number }>();

      for (const [level, levelNodeList] of levelNodes.entries()) {
        for (let i = 0; i < levelNodeList.length; i++) {
          const node = levelNodeList[i];
          let x: number;
          let y: number;

          if (dir === 'LR') {
            x = MARGIN + level * (NODE_WIDTH + SPACING_X);
            y = MARGIN + i * (NODE_HEIGHT + SPACING_Y);
          } else {
            x = MARGIN + i * (NODE_WIDTH + SPACING_X);
            y = MARGIN + level * (NODE_HEIGHT + SPACING_Y);
          }

          newPositions.set(node.id, { x, y });
        }
      }

      // Build node diffs
      const nodeDiffs = nodes
        .map((node) => {
          const newPos = newPositions.get(node.id);
          if (!newPos) return null;

          const posChanged =
            Math.abs((node.position?.x ?? 0) - newPos.x) > 1 ||
            Math.abs((node.position?.y ?? 0) - newPos.y) > 1;

          if (!posChanged) return null;

          return {
            type: 'update' as const,
            id: node.id,
            from: node,
            to: { ...node, position: newPos },
          };
        })
        .filter((diff) => diff !== null);

      if (nodeDiffs.length === 0) {
        this.logger.log('[layout] No position changes needed');
        return { success: true };
      }

      // Sync the layout changes
      await this.canvasSyncService.syncState(user, {
        canvasId: workflowId,
        transactions: [
          {
            txId: `tx-layout-${Date.now()}`,
            createdAt: Date.now(),
            syncedAt: Date.now(),
            source: { type: 'system' },
            nodeDiffs,
            edgeDiffs: [],
          },
        ],
      });

      this.logger.log(`[layout] Updated ${nodeDiffs.length} node positions`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to layout workflow ${workflowId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Failed to layout workflow: ${getErrorMessage(error)}`,
        'Check the workflow ID and try again',
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

    // Validate workflow ID format (should start with 'c-')
    if (!workflowId.startsWith('c-')) {
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        `Invalid workflow ID: "${workflowId}". Workflow IDs should start with "c-"`,
        'Usage: refly workflow run <workflowId> [--input <json>]. Example: refly workflow run c-xxx --input \'{"var": "value"}\'',
      );
    }

    try {
      // Get existing workflow variables and merge with runtime variables
      const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      const toolsetsWithNodes = extractToolsetsWithNodes(rawData.nodes);

      // Get user's installed tools for authorization check
      const userTools = await this.toolService.listUserTools(user);

      // Check for unauthorized tools
      const unauthorizedTools = toolsetsWithNodes.filter((toolWithNodes) => {
        return !isToolsetAuthorized(toolWithNodes.toolset, userTools);
      });

      const mergedVariables = mergeWorkflowVariables(rawData.variables, body.variables);

      // If there are unauthorized tools, return them instead of executing
      if (unauthorizedTools.length > 0) {
        this.logger.log(
          `Workflow ${workflowId} has ${unauthorizedTools.length} unauthorized tools, returning tool list`,
        );

        return buildCliSuccessResponse({
          runId: '',
          workflowId,
          status: 'failed',
          startedAt: new Date().toJSON(),
          unauthorizedTools,
        });
      }

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
      this.logger.error(`Failed to run workflow ${workflowId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to start workflow: ${getErrorMessage(error)}`,
        'Check the workflow configuration and try again',
      );
    }
  }

  // ============================================================================
  // New workflowId-based endpoints (recommended)
  // These endpoints use workflowId and automatically find the current/latest run
  // ============================================================================

  /**
   * Get current workflow execution status by workflowId
   * GET /v1/cli/workflow/:id/status
   *
   * Returns the status of the currently active or latest execution for this workflow.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  async getStatusByWorkflowId(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
  ): Promise<{ success: boolean; data: WorkflowRunStatus }> {
    this.logger.log(`Getting status for workflow ${workflowId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getActiveOrLatestExecution(user, workflowId);

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
      this.logger.error(
        `Failed to get status for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `No execution found for workflow ${workflowId}`,
        'Run the workflow first with `refly workflow run <workflowId>`',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get workflow tools authorization status by workflowId
   * GET /v1/cli/workflow/:id/tools-status
   *
   * Returns the authorization status of all tools required by this workflow.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/tools-status')
  async getToolsStatusByWorkflowId(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
  ): Promise<{ success: boolean; data: WorkflowToolsStatusResponse }> {
    this.logger.log(`Getting tools status for workflow ${workflowId}, user ${user.uid}`);

    try {
      // Get existing workflow variables and merge with runtime variables
      const rawData = await this.canvasService.getCanvasRawData(user, workflowId, {
        checkOwnership: true,
      });

      const toolsetsWithNodes = extractToolsetsWithNodes(rawData.nodes);

      // Get user's installed tools for authorization check
      const userTools = await this.toolService.listUserTools(user);

      // Check for unauthorized tools
      const unauthorizedTools = toolsetsWithNodes.filter((toolWithNodes) => {
        return !isToolsetAuthorized(toolWithNodes.toolset, userTools);
      });

      return buildCliSuccessResponse({
        authorized: unauthorizedTools.length === 0,
        unauthorizedTools,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get tools status for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to check tools status: ${getErrorMessage(error)}`,
        'Check the workflow configuration and try again',
      );
    }
  }

  /**
   * Get detailed execution info by workflowId
   * GET /v1/cli/workflow/:id/detail
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/detail')
  async getDetailByWorkflowId(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Query('outputPreviewLength') outputPreviewLength?: string,
  ): Promise<{ success: boolean; data: WorkflowRunDetail }> {
    this.logger.log(`Getting detail for workflow ${workflowId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getActiveOrLatestExecution(user, workflowId);
      const _previewLength = outputPreviewLength ? Number.parseInt(outputPreviewLength, 10) : 500;

      const nodes: NodeExecutionDetail[] = (detail.nodeExecutions ?? []).map((nodeExec) => ({
        nodeId: nodeExec.nodeId,
        nodeExecutionId: nodeExec.nodeExecutionId,
        resultId: nodeExec.entityId ?? undefined,
        nodeType: nodeExec.nodeType,
        status: nodeExec.status,
        title: nodeExec.title ?? '',
        startTime: nodeExec.startTime?.toJSON(),
        endTime: nodeExec.endTime?.toJSON(),
        progress: nodeExec.progress ?? 0,
        query: nodeExec.originalQuery ?? nodeExec.processedQuery ?? undefined,
        errorMessage: nodeExec.errorMessage ?? undefined,
        toolCallsCount: 0,
      }));

      const errors = nodes
        .filter((n) => n.status === 'failed' && n.errorMessage)
        .map((n) => ({
          nodeId: n.nodeId,
          nodeTitle: n.title,
          errorType: 'execution_error',
          errorMessage: n.errorMessage ?? 'Unknown error',
          timestamp: n.endTime ?? new Date().toJSON(),
        }));

      const executedNodes = nodes.filter((n) => n.status === 'finish').length;
      const failedNodes = nodes.filter((n) => n.status === 'failed').length;

      const durationMs =
        detail.createdAt && detail.updatedAt
          ? new Date(detail.updatedAt).getTime() - new Date(detail.createdAt).getTime()
          : undefined;

      return buildCliSuccessResponse({
        runId: detail.executionId,
        workflowId: detail.canvasId,
        title: detail.title,
        status: detail.status as WorkflowRunDetail['status'],
        totalNodes: detail.totalNodes,
        executedNodes,
        failedNodes,
        startedAt: detail.createdAt.toJSON(),
        finishedAt:
          detail.status === 'finish' || detail.status === 'failed'
            ? detail.updatedAt.toJSON()
            : undefined,
        durationMs,
        nodes,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get detail for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `No execution found for workflow ${workflowId}`,
        'Run the workflow first with `refly workflow run <workflowId>`',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get node output content by workflowId
   * GET /v1/cli/workflow/:id/node/:nodeId/output
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/node/:nodeId/output')
  async getNodeOutputByWorkflowId(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Param('nodeId') nodeId: string,
    @Query('includeToolCalls') includeToolCalls?: string,
    @Query('raw') raw?: string,
  ): Promise<{ success: boolean; data: NodeOutputResponse }> {
    this.logger.log(
      `Getting node output for workflow ${workflowId}, node ${nodeId}, user ${user.uid}`,
    );

    try {
      const detail = await this.workflowService.getActiveOrLatestExecution(user, workflowId);
      return this.buildNodeOutputResponse(
        detail,
        nodeId,
        includeToolCalls === 'true',
        raw === 'true',
      );
    } catch (error) {
      this.logger.error(
        `Failed to get node output for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `No execution found for workflow ${workflowId}`,
        'Run the workflow first with `refly workflow run <workflowId>`',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get tool calls by workflowId
   * GET /v1/cli/workflow/:id/toolcalls
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/toolcalls')
  async getToolCallsByWorkflowId(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Query('nodeId') nodeId?: string,
    @Query('toolsetId') toolsetId?: string,
    @Query('toolName') toolName?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sanitizeForDisplay') sanitizeForDisplay?: string,
  ): Promise<{ success: boolean; data: any }> {
    this.logger.log(`Getting tool calls for workflow ${workflowId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getActiveOrLatestExecution(user, workflowId);
      const nodeExecutions = detail.nodeExecutions ?? [];

      const filteredNodeExecutions = nodeId
        ? nodeExecutions.filter((n) => n.nodeId === nodeId)
        : nodeExecutions;

      const allToolCalls: any[] = [];
      for (const nodeExec of filteredNodeExecutions) {
        if (!nodeExec.entityId) continue;

        const toolCalls = await this.prisma.toolCallResult.findMany({
          where: {
            resultId: nodeExec.entityId,
            deletedAt: null,
            ...(toolsetId ? { toolsetId } : {}),
            ...(toolName ? { toolName } : {}),
            ...(status ? { status } : {}),
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const tc of toolCalls) {
          allToolCalls.push({
            callId: tc.callId,
            nodeId: nodeExec.nodeId,
            nodeTitle: nodeExec.title,
            toolsetId: tc.toolsetId,
            toolName: tc.toolName,
            stepName: tc.stepName,
            input: this.safeParseJSON(tc.input),
            output:
              sanitizeForDisplay === 'false'
                ? this.safeParseJSON(tc.output)
                : this.truncateOutput(this.safeParseJSON(tc.output)),
            status: tc.status,
            error: tc.error,
            createdAt: tc.createdAt.toISOString(),
            updatedAt: tc.updatedAt.toISOString(),
            durationMs: tc.updatedAt.getTime() - tc.createdAt.getTime(),
          });
        }
      }

      const limitNum = limit ? Number.parseInt(limit, 10) : 100;
      const offsetNum = offset ? Number.parseInt(offset, 10) : 0;
      const paginatedToolCalls = allToolCalls.slice(offsetNum, offsetNum + limitNum);

      const byStatus = {
        executing: allToolCalls.filter((tc) => tc.status === 'executing').length,
        completed: allToolCalls.filter((tc) => tc.status === 'completed').length,
        failed: allToolCalls.filter((tc) => tc.status === 'failed').length,
      };

      const byToolset: Record<string, number> = {};
      const byTool: Record<string, number> = {};
      for (const tc of allToolCalls) {
        byToolset[tc.toolsetId] = (byToolset[tc.toolsetId] || 0) + 1;
        byTool[tc.toolName] = (byTool[tc.toolName] || 0) + 1;
      }

      return buildCliSuccessResponse({
        workflowId,
        runId: detail.executionId,
        totalCount: allToolCalls.length,
        toolCalls: paginatedToolCalls,
        byStatus,
        byToolset,
        byTool,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get tool calls for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `No execution found for workflow ${workflowId}`,
        'Run the workflow first with `refly workflow run <workflowId>`',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Abort current workflow execution by workflowId
   * POST /v1/cli/workflow/:id/abort
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/abort')
  async abortByWorkflowId(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
  ): Promise<{ success: boolean; data: { message: string; workflowId: string; runId?: string } }> {
    this.logger.log(`Aborting workflow ${workflowId} for user ${user.uid}`);

    try {
      // Find the active execution
      const activeExecution = await this.workflowService.getActiveExecution(user, workflowId);

      if (!activeExecution) {
        throwCliError(
          CLI_ERROR_CODES.NOT_FOUND,
          `No active execution found for workflow ${workflowId}`,
          'The workflow is not currently running',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.workflowService.abortWorkflow(user, activeExecution.executionId);

      return buildCliSuccessResponse({
        message: 'Workflow execution aborted',
        workflowId,
        runId: activeExecution.executionId,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to abort workflow ${workflowId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to abort workflow: ${getErrorMessage(error)}`,
        'The workflow may have already completed',
      );
    }
  }

  /**
   * List workflow run history
   * GET /v1/cli/workflow/:id/runs
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/runs')
  async listRuns(
    @LoginedUser() user: User,
    @Param('id') workflowId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    success: boolean;
    data: {
      workflowId: string;
      runs: Array<{
        runId: string;
        status: string;
        totalNodes: number;
        startedAt: string;
        finishedAt?: string;
        triggerType: string;
      }>;
      total: number;
    };
  }> {
    this.logger.log(`Listing runs for workflow ${workflowId}, user ${user.uid}`);

    try {
      const limitNum = limit ? Number.parseInt(limit, 10) : 20;
      const offsetNum = offset ? Number.parseInt(offset, 10) : 0;

      const { executions, total } = await this.workflowService.listWorkflowExecutions(user, {
        canvasId: workflowId,
        page: offsetNum / limitNum + 1,
        pageSize: limitNum,
      });

      const runs = executions.map((exec) => ({
        runId: exec.executionId,
        status: exec.status,
        totalNodes: exec.totalNodes,
        startedAt: exec.createdAt.toJSON(),
        finishedAt:
          exec.status === 'finish' || exec.status === 'failed'
            ? exec.updatedAt.toJSON()
            : undefined,
        triggerType: exec.triggerType ?? 'manual',
      }));

      return buildCliSuccessResponse({
        workflowId,
        runs,
        total,
      });
    } catch (error) {
      this.logger.error(
        `Failed to list runs for workflow ${workflowId}: ${getErrorMessage(error)}`,
      );
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow ${workflowId} not found`,
        'Check the workflow ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // ============================================================================
  // Legacy runId-based endpoints (deprecated, kept for backwards compatibility)
  // ============================================================================

  /**
   * Get workflow run status
   * GET /v1/cli/workflow/run/:runId
   * @deprecated Use GET /v1/cli/workflow/:id/status instead
   */
  @UseGuards(JwtAuthGuard)
  @Get('run/:runId')
  async getRunStatus(
    @LoginedUser() user: User,
    @Param('runId') runId: string,
  ): Promise<{ success: boolean; data: WorkflowRunStatus }> {
    this.logger.log(`[DEPRECATED] Getting run status for ${runId}, user ${user.uid}`);

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
      this.logger.error(`Failed to get run status ${runId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow run ${runId} not found`,
        'Check the run ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get detailed workflow run information
   * GET /v1/cli/workflow/run/:runId/detail
   */
  @UseGuards(JwtAuthGuard)
  @Get('run/:runId/detail')
  async getRunDetail(
    @LoginedUser() user: User,
    @Param('runId') runId: string,
    @Query('includeToolCalls') _includeToolCalls?: string,
    @Query('outputPreviewLength') outputPreviewLength?: string,
  ): Promise<{ success: boolean; data: WorkflowRunDetail }> {
    this.logger.log(`Getting run detail for ${runId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getWorkflowDetail(user, runId);
      const _previewLength = outputPreviewLength ? Number.parseInt(outputPreviewLength, 10) : 500;

      // Build detailed node execution info
      const nodes: NodeExecutionDetail[] = (detail.nodeExecutions ?? []).map((nodeExec) => {
        const nodeDetail: NodeExecutionDetail = {
          nodeId: nodeExec.nodeId,
          nodeExecutionId: nodeExec.nodeExecutionId,
          resultId: nodeExec.entityId ?? undefined, // entityId is used as resultId for action results
          nodeType: nodeExec.nodeType,
          status: nodeExec.status,
          title: nodeExec.title ?? '',
          startTime: nodeExec.startTime?.toJSON(),
          endTime: nodeExec.endTime?.toJSON(),
          progress: nodeExec.progress ?? 0,
          query: nodeExec.originalQuery ?? nodeExec.processedQuery ?? undefined,
          errorMessage: nodeExec.errorMessage ?? undefined,
          toolCallsCount: 0, // TODO: Add tool calls count when available
        };

        return nodeDetail;
      });

      // Collect errors from failed nodes
      const errors = nodes
        .filter((n) => n.status === 'failed' && n.errorMessage)
        .map((n) => ({
          nodeId: n.nodeId,
          nodeTitle: n.title,
          errorType: 'execution_error',
          errorMessage: n.errorMessage ?? 'Unknown error',
          timestamp: n.endTime ?? new Date().toJSON(),
        }));

      const executedNodes = nodes.filter((n) => n.status === 'finish').length;
      const failedNodes = nodes.filter((n) => n.status === 'failed').length;

      // Calculate duration if both start and end times are available
      const startTime = detail.createdAt;
      const endTime = detail.updatedAt;
      const durationMs =
        startTime && endTime
          ? new Date(endTime).getTime() - new Date(startTime).getTime()
          : undefined;

      return buildCliSuccessResponse({
        runId: detail.executionId,
        workflowId: detail.canvasId,
        title: detail.title,
        status: detail.status as WorkflowRunDetail['status'],
        totalNodes: detail.totalNodes,
        executedNodes,
        failedNodes,
        startedAt: detail.createdAt.toJSON(),
        finishedAt:
          detail.status === 'finish' || detail.status === 'failed'
            ? detail.updatedAt.toJSON()
            : undefined,
        durationMs,
        nodes,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      this.logger.error(`Failed to get run detail ${runId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow run ${runId} not found`,
        'Check the run ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get node output content by runId
   * GET /v1/cli/workflow/run/:runId/node/:nodeId/output
   */
  @UseGuards(JwtAuthGuard)
  @Get('run/:runId/node/:nodeId/output')
  async getNodeOutputByRunId(
    @LoginedUser() user: User,
    @Param('runId') runId: string,
    @Param('nodeId') nodeId: string,
    @Query('includeToolCalls') includeToolCalls?: string,
    @Query('raw') raw?: string,
  ): Promise<{ success: boolean; data: NodeOutputResponse }> {
    this.logger.log(`Getting node output for run ${runId}, node ${nodeId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getWorkflowDetail(user, runId);
      return this.buildNodeOutputResponse(
        detail,
        nodeId,
        includeToolCalls === 'true',
        raw === 'true',
      );
    } catch (error) {
      this.logger.error(`Failed to get node output for run ${runId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow run ${runId} not found`,
        'Check the run ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Get tool calls for a workflow run
   * GET /v1/cli/workflow/run/:runId/toolcalls
   */
  @UseGuards(JwtAuthGuard)
  @Get('run/:runId/toolcalls')
  async getToolCalls(
    @LoginedUser() user: User,
    @Param('runId') runId: string,
    @Query('nodeId') nodeId?: string,
    @Query('toolsetId') toolsetId?: string,
    @Query('toolName') toolName?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sanitizeForDisplay') sanitizeForDisplay?: string,
  ): Promise<{ success: boolean; data: any }> {
    this.logger.log(`Getting tool calls for run ${runId}, user ${user.uid}`);

    try {
      const detail = await this.workflowService.getWorkflowDetail(user, runId);
      const nodeExecutions = detail.nodeExecutions ?? [];

      // Filter by nodeId if specified
      const filteredNodeExecutions = nodeId
        ? nodeExecutions.filter((n) => n.nodeId === nodeId)
        : nodeExecutions;

      // Collect all tool calls from all node executions
      const allToolCalls: any[] = [];
      for (const nodeExec of filteredNodeExecutions) {
        if (!nodeExec.entityId) continue;

        // Get tool calls for this node (entityId is used as resultId)
        const toolCalls = await this.prisma.toolCallResult.findMany({
          where: {
            resultId: nodeExec.entityId,
            deletedAt: null,
            ...(toolsetId ? { toolsetId } : {}),
            ...(toolName ? { toolName } : {}),
            ...(status ? { status } : {}),
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const tc of toolCalls) {
          allToolCalls.push({
            callId: tc.callId,
            nodeId: nodeExec.nodeId,
            nodeTitle: nodeExec.title,
            toolsetId: tc.toolsetId,
            toolName: tc.toolName,
            stepName: tc.stepName,
            input: this.safeParseJSON(tc.input),
            output:
              sanitizeForDisplay === 'false'
                ? this.safeParseJSON(tc.output)
                : this.truncateOutput(this.safeParseJSON(tc.output)),
            status: tc.status,
            error: tc.error,
            createdAt: tc.createdAt.toISOString(),
            updatedAt: tc.updatedAt.toISOString(),
            durationMs: tc.updatedAt.getTime() - tc.createdAt.getTime(),
          });
        }
      }

      // Apply pagination
      const limitNum = limit ? Number.parseInt(limit, 10) : 100;
      const offsetNum = offset ? Number.parseInt(offset, 10) : 0;
      const paginatedToolCalls = allToolCalls.slice(offsetNum, offsetNum + limitNum);

      // Build summary statistics
      const byStatus = {
        executing: allToolCalls.filter((tc) => tc.status === 'executing').length,
        completed: allToolCalls.filter((tc) => tc.status === 'completed').length,
        failed: allToolCalls.filter((tc) => tc.status === 'failed').length,
      };

      const byToolset: Record<string, number> = {};
      const byTool: Record<string, number> = {};
      for (const tc of allToolCalls) {
        byToolset[tc.toolsetId] = (byToolset[tc.toolsetId] || 0) + 1;
        byTool[tc.toolName] = (byTool[tc.toolName] || 0) + 1;
      }

      return buildCliSuccessResponse({
        runId,
        totalCount: allToolCalls.length,
        toolCalls: paginatedToolCalls,
        byStatus,
        byToolset,
        byTool,
      });
    } catch (error) {
      this.logger.error(`Failed to get tool calls for run ${runId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.NOT_FOUND,
        `Workflow run ${runId} not found`,
        'Check the run ID and try again',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Build node output response from workflow execution detail
   */
  private buildNodeOutputResponse(
    detail: any,
    nodeId: string,
    includeToolCalls: boolean,
    raw: boolean,
  ): { success: boolean; data: NodeOutputResponse } {
    // Find the node execution
    const nodeExec = (detail.nodeExecutions ?? []).find((n: any) => n.nodeId === nodeId);

    if (!nodeExec) {
      throwCliError(
        CLI_ERROR_CODES.NODE_NOT_FOUND,
        `Node ${nodeId} not found in this workflow execution`,
        'Check the node ID with `refly workflow detail <workflowId>`',
        HttpStatus.NOT_FOUND,
      );
    }

    // Calculate timing
    const startTime = nodeExec.startTime?.toJSON();
    const endTime = nodeExec.endTime?.toJSON();
    const durationMs =
      nodeExec.startTime && nodeExec.endTime
        ? new Date(nodeExec.endTime).getTime() - new Date(nodeExec.startTime).getTime()
        : undefined;

    // Build response
    const response: NodeOutputResponse = {
      runId: detail.executionId,
      workflowId: detail.canvasId,
      nodeId: nodeExec.nodeId,
      nodeTitle: nodeExec.title ?? '',
      nodeType: nodeExec.nodeType,
      status: nodeExec.status as NodeOutputResponse['status'],
      timing: {
        startTime,
        endTime,
        durationMs,
      },
    };

    // Add content if available (from actionResult)
    if (nodeExec.actionResult) {
      const content = nodeExec.actionResult.content;
      response.content = raw ? content : this.truncateOutput(content, 10000);
      response.contentType = 'text/plain';

      // Add token usage if available
      if (nodeExec.actionResult.tokenUsage) {
        const tokenUsage = this.safeParseJSON(nodeExec.actionResult.tokenUsage);
        response.outputTokens = tokenUsage?.outputTokens;
      }
    }

    // Add error if failed
    if (nodeExec.status === 'failed' && nodeExec.errorMessage) {
      response.error = {
        type: 'execution_error',
        message: nodeExec.errorMessage,
      };
    }

    // Add tool calls if requested
    if (includeToolCalls && nodeExec.actionResult?.toolCalls) {
      response.toolCalls = nodeExec.actionResult.toolCalls.map((tc: any) => ({
        callId: tc.toolCallId,
        toolName: tc.toolName,
        status: tc.status,
        output: raw
          ? this.safeParseJSON(tc.output)
          : this.truncateOutput(this.safeParseJSON(tc.output)),
      }));
    }

    return { success: true, data: response };
  }

  private safeParseJSON(str: string | null | undefined): any {
    if (!str) return {};
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  private truncateOutput(output: any, maxLength = 500): any {
    if (typeof output === 'string') {
      return output.length > maxLength ? `${output.substring(0, maxLength)}...` : output;
    }
    if (typeof output === 'object' && output !== null) {
      const str = JSON.stringify(output);
      if (str.length > maxLength) {
        return { _truncated: true, preview: `${str.substring(0, maxLength)}...` };
      }
    }
    return output;
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
      this.logger.error(`Failed to abort workflow run ${runId}: ${getErrorMessage(error)}`);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to abort workflow: ${getErrorMessage(error)}`,
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

  constructor(
    private readonly toolService: ToolService,
    private readonly skillService: SkillService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

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
      this.logger.warn(`Failed to get user tools: ${getErrorMessage(error)}`);
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
   * Supports skillResponse node type with concurrency control.
   * Uses Redis distributed lock to prevent concurrent execution of the same node.
   */
  @UseGuards(JwtAuthGuard)
  @Post('run')
  async runNode(
    @LoginedUser() user: User,
    @Body() body: RunNodeRequest,
  ): Promise<{ success: boolean; data: RunNodeResponse }> {
    const startTime = Date.now();
    this.logger.log(`Running node type ${body.nodeType} for user ${user.uid}`);

    // Validate node type
    if (!body.nodeType) {
      throwCliError(
        CLI_ERROR_CODES.VALIDATION_ERROR,
        'nodeType is required',
        'Specify a node type like "skillResponse" or "tool:execute_code"',
      );
    }

    // Currently only support skillResponse node type
    if (body.nodeType !== 'skillResponse') {
      throwCliError(
        CLI_ERROR_CODES.NODE_TYPE_NOT_FOUND,
        `Node type "${body.nodeType}" execution not supported`,
        'Currently only "skillResponse" node type is supported for single node execution',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    // Generate a unique result ID for this execution
    const resultId = genActionResultID();

    // Build lock key based on user and result ID to prevent concurrent executions
    // of the same node by the same user
    const lockKey = `cli:node:run:${user.uid}:${resultId}`;

    let releaseLock: (() => Promise<boolean>) | null = null;

    try {
      // Try to acquire lock with retry logic
      releaseLock = await this.redis.waitLock(lockKey, {
        maxRetries: 3,
        initialDelay: 100,
        ttlSeconds: 300, // 5 minute TTL for long-running executions
        noThrow: true,
      });

      if (!releaseLock) {
        throwCliError(
          CLI_ERROR_CODES.EXECUTION_FAILED,
          'Node execution is already in progress',
          'Wait for the current execution to complete before starting a new one',
          HttpStatus.CONFLICT,
        );
      }

      // Build InvokeSkillRequest from CLI input
      const skillRequest: InvokeSkillRequest = {
        resultId,
        input: {
          query: body.input?.query ?? '',
        },
        target: {},
        context: {
          resources: (body.input?.context as any[]) ?? [],
        },
        modelItemId: body.config?.modelItemId as string,
        mode: 'node_agent',
      };

      // Extract toolset keys/ids from query (e.g., @{type=toolset,id=perplexity,name=Perplexity})
      const toolsetKeysFromQuery = this.extractToolsetIdsFromQuery(body.input?.query ?? '');

      // Add toolsets if specified in config or extracted from query
      const configToolsets = (body.config?.selectedToolsets as any[]) ?? [];
      const configToolsetKeys = configToolsets.map((t) => t.toolsetId || t.id || t.key || t);
      const allToolsetKeys = [...new Set([...toolsetKeysFromQuery, ...configToolsetKeys])];

      if (allToolsetKeys.length > 0) {
        // Use ToolService to resolve toolset keys to proper GenericToolset objects
        const { resolved, errors } = await this.toolService.resolveToolsetsByKeys(
          user,
          allToolsetKeys,
        );

        if (errors.length > 0) {
          this.logger.warn(
            `Some toolsets could not be resolved: ${errors.map((e) => `${e.key}: ${e.reason}`).join(', ')}`,
          );
        }

        if (resolved.length > 0) {
          skillRequest.toolsets = resolved;
          this.logger.log(
            `Resolved ${resolved.length} toolsets: ${resolved.map((t) => t.id).join(', ')}`,
          );
        }
      }

      this.logger.log(`Invoking skill for resultId: ${resultId}`);

      // Execute the skill via sendInvokeSkillTask (queued execution)
      const actionResult = await this.skillService.sendInvokeSkillTask(user, skillRequest);

      // Poll for completion (with timeout)
      const maxWaitTime = 120000; // 2 minutes max wait
      const pollInterval = 1000; // 1 second poll interval
      let elapsed = 0;
      const finalResult = actionResult;

      while (elapsed < maxWaitTime) {
        // Check the status of the action result
        const result = await this.prisma.actionResult.findFirst({
          where: {
            resultId,
            uid: user.uid,
          },
          orderBy: { version: 'desc' },
        });

        if (!result) {
          break;
        }

        if (result.status === 'finish' || result.status === 'failed') {
          // Build final result
          const duration = Date.now() - startTime;
          const errors = result.errors ? JSON.parse(result.errors) : [];

          return buildCliSuccessResponse({
            nodeType: body.nodeType,
            status: result.status === 'finish' ? 'completed' : 'failed',
            output: {
              resultId: result.resultId,
              version: result.version,
              status: result.status,
            },
            duration,
            error: errors.length > 0 ? errors.join('; ') : undefined,
          });
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        elapsed += pollInterval;
      }

      // Timeout reached - return current status
      const duration = Date.now() - startTime;
      return buildCliSuccessResponse({
        nodeType: body.nodeType,
        status: 'completed',
        output: {
          resultId: finalResult.resultId,
          message: 'Execution started but did not complete within timeout',
          hint: `Use "refly node result ${finalResult.resultId}" to check the result`,
        },
        duration,
      });
    } catch (error) {
      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to run node: ${getErrorMessage(error)}`, (error as Error).stack);
      throwCliError(
        CLI_ERROR_CODES.EXECUTION_FAILED,
        `Failed to execute node: ${getErrorMessage(error)}`,
        'Check the node configuration and try again',
      );
    } finally {
      // Always release the lock
      if (releaseLock) {
        try {
          await releaseLock();
        } catch (lockError) {
          this.logger.warn(`Failed to release lock: ${lockError}`);
        }
      }
    }
  }

  /**
   * Extract toolset IDs from a query string containing @{type=toolset,...} mentions
   * @param query - The query string to parse
   * @returns Array of toolset IDs found in the query
   */
  private extractToolsetIdsFromQuery(query: string): string[] {
    if (!query) return [];

    const mentionRegex = /@\{([^}]+)\}/g;
    const matches = query.match(mentionRegex);
    if (!matches) return [];

    const toolsetIds: string[] = [];

    for (const match of matches) {
      const paramsStr = match.match(/@\{([^}]+)\}/)?.[1];
      if (!paramsStr) continue;

      // Skip malformed mentions
      if (paramsStr.includes('@{') || paramsStr.includes('}')) continue;

      const params: Record<string, string> = {};
      for (const param of paramsStr.split(',')) {
        const [key, value] = param.split('=');
        if (key && value) {
          params[key.trim()] = value.trim();
        }
      }

      // Only extract toolset type mentions
      if (params.type === 'toolset' && params.id) {
        toolsetIds.push(params.id);
      }
    }

    return toolsetIds;
  }
}
