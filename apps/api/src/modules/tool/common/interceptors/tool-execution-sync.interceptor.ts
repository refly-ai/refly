import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CanvasNode, CanvasNodeType, EntityType, User } from '@refly/openapi-schema';
import { genActionResultID, genMediaID, safeParseJSON } from '@refly/utils';
import { ActionResult } from '../../../../generated/client';
import { ActionResultNotFoundError } from '@refly/errors';
import { PrismaService } from '../../../common/prisma.service';
import { CanvasSyncService } from '../../../canvas-sync/canvas-sync.service';
import { MiscService } from '../../../misc/misc.service';

/**
 * Context passed to the interceptor
 */
export interface ToolExecutionContext {
  user: User;
  request: any;
  options: {
    resultType: string;
    getParentResultId: (request: any) => string | undefined;
    getTitle: (request: any) => string;
    getModel?: (request: any) => string | undefined;
    getProviderItemId?: (request: any) => string | undefined;
    createCanvasNode?: boolean;
    updateWorkflowNode?: boolean;
    getMetadata?: (request: any, result: any) => Record<string, any>;
  };
}

/**
 * Result from the core execution method
 */
export interface ToolExecutionResult {
  status: 'success' | 'error';
  data?: {
    // File data - either URL/storageKey (already uploaded) or buffer (to be uploaded by interceptor)
    outputUrl?: string;
    storageKey?: string;
    buffer?: Buffer;
    filename?: string;
    mimetype?: string;
    // Metadata
    duration?: number;
    format?: string;
    size?: number;
    text?: string;
    segments?: any[];
    [key: string]: any;
  };
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Tool Execution Sync Interceptor
 *
 * This interceptor handles all the boilerplate code for tool execution:
 * - ActionResult lifecycle management
 * - Parent-child relationship handling
 * - Workflow node execution tracking
 * - Canvas node creation and connection
 * - Error handling and status updates
 */
@Injectable()
export class ToolExecutionSyncInterceptor {
  private readonly logger = new Logger(ToolExecutionSyncInterceptor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly canvasSyncService: CanvasSyncService,
    @Optional() @Inject(MiscService) private readonly miscService: MiscService,
  ) {}

  /**
   * Wrap a tool execution method with automatic lifecycle management
   */
  async intercept(
    context: ToolExecutionContext,
    coreExecutionFn: () => Promise<ToolExecutionResult>,
  ): Promise<ToolExecutionResult> {
    const { user, request, options } = context;
    const { resultType, getParentResultId, getTitle, getModel, getProviderItemId, getMetadata } =
      options;

    const parentResultId = getParentResultId(request);
    const title = getTitle(request);

    // Store workflow node execution to update status at the end
    let nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode } | null = null;
    let parentResult: any = null;

    // Step 1: Handle parent result and workflow node lookup
    if (parentResultId) {
      parentResult = await this.prismaService.actionResult.findFirst({
        select: {
          targetId: true,
          targetType: true,
          workflowNodeExecutionId: true,
          modelName: true,
        },
        where: { resultId: parentResultId },
        orderBy: { version: 'desc' },
      });

      if (!parentResult) {
        throw new ActionResultNotFoundError(`Action result ${parentResultId} not found`);
      }

      // Inherit targetId/targetType from parent if not provided
      if (!request.targetId || !request.targetType) {
        request.targetId = parentResult.targetId;
        request.targetType = parentResult.targetType as EntityType;
      }

      // Look for workflow node execution to update
      if (options.updateWorkflowNode !== false && parentResult.workflowNodeExecutionId) {
        nodeExecutionToUpdate = await this.findWorkflowNodeToUpdate(
          parentResult.workflowNodeExecutionId,
          resultType,
        );
      }
    }

    // Step 2: Create ActionResult
    const actionResult = await this.prismaService.actionResult.create({
      data: {
        resultId: genActionResultID(),
        uid: user.uid,
        type: resultType,
        title: title,
        modelName: getModel?.(request) || parentResult?.modelName,
        targetType: request.targetType || parentResult?.targetType,
        targetId: request.targetId || parentResult?.targetId,
        providerItemId: getProviderItemId?.(request),
        status: 'waiting',
        input: JSON.stringify(request),
        version: 0,
        parentResultId: parentResultId,
      },
    });

    try {
      // Step 3: Update status to executing
      await this.prismaService.actionResult.update({
        where: { pk: actionResult.pk },
        data: { status: 'executing' },
      });

      // Step 4: Execute core logic
      const result = await coreExecutionFn();
      // Step 5: Handle success
      if (result.status === 'success' && result.data) {
        let { outputUrl, storageKey } = result.data;
        const metadata = getMetadata?.(request, result) || {};

        // Step 5.1: Upload file if buffer is provided
        if (result.data.buffer && this.miscService) {
          const uploadResult = await this.miscService.uploadFile(
            {
              uid: user.uid,
              email: user.email || '',
            },
            {
              file: {
                buffer: result.data.buffer,
                mimetype: result.data.mimetype || 'application/octet-stream',
                originalname: result.data.filename || `file.${this.getExtension(resultType)}`,
              },
              entityId: actionResult.resultId,
              entityType: 'mediaResult',
              visibility: 'private',
            },
          );

          outputUrl = uploadResult.url;
          storageKey = uploadResult.storageKey;
        }
        // Update workflow node if exists
        if (nodeExecutionToUpdate && outputUrl && storageKey) {
          await this.updateWorkflowNode(
            nodeExecutionToUpdate,
            resultType,
            title,
            outputUrl,
            storageKey,
            metadata,
          );
        }

        if (
          options.createCanvasNode !== false &&
          actionResult.targetType === 'canvas' &&
          actionResult.targetId &&
          outputUrl &&
          storageKey
        ) {
          await this.createCanvasNode(
            user,
            actionResult,
            resultType,
            title,
            outputUrl,
            storageKey,
            parentResultId,
            metadata,
          );
        }
        // Update ActionResult to finish
        await this.prismaService.actionResult.update({
          where: { pk: actionResult.pk },
          data: {
            status: 'finish',
            outputUrl,
            storageKey,
          },
        });

        // Update result.data with the uploaded file info and entityId
        if (result.data) {
          result.data.outputUrl = outputUrl;
          result.data.storageKey = storageKey;
          result.data.entityId = actionResult.resultId;
        }
      } else {
        // Handle error case
        await this.prismaService.actionResult.update({
          where: { pk: actionResult.pk },
          data: { status: 'failed' },
        });

        if (nodeExecutionToUpdate) {
          await this.updateWorkflowNodeStatus(nodeExecutionToUpdate.nodeExecutionId, 'failed');
        }
      }

      return result;
    } catch (error) {
      // Handle exception
      await this.prismaService.actionResult.update({
        where: { pk: actionResult.pk },
        data: { status: 'failed' },
      });

      if (nodeExecutionToUpdate) {
        await this.updateWorkflowNodeStatus(nodeExecutionToUpdate.nodeExecutionId, 'failed');
      }

      throw error;
    }
  }

  /**
   * Get media type from result type
   */
  private getMediaType(resultType: string): 'image' | 'video' | 'audio' {
    const lowerType = resultType.toLowerCase();
    if (lowerType.includes('video')) return 'video';
    if (lowerType.includes('audio')) return 'audio';
    if (lowerType.includes('image')) return 'image';
    return 'audio'; // default
  }

  /**
   * Get file extension from result type
   */
  private getExtension(resultType: string): string {
    const lowerType = resultType.toLowerCase();
    if (lowerType.includes('video')) return 'mp4';
    if (lowerType.includes('audio')) return 'mp3';
    if (lowerType.includes('image')) return 'png';
    return 'bin'; // default
  }

  /**
   * Find workflow node execution to update
   */
  private async findWorkflowNodeToUpdate(
    workflowNodeExecutionId: string,
    resultType: string,
  ): Promise<{ nodeExecutionId: string; nodeData: CanvasNode } | null> {
    const nodeExecution = await this.prismaService.workflowNodeExecution.findUnique({
      where: { nodeExecutionId: workflowNodeExecutionId },
    });

    if (!nodeExecution?.childNodeIds) {
      return null;
    }

    const childNodeIds = safeParseJSON(nodeExecution.childNodeIds) as string[];
    const mediaNodeExecution = await this.prismaService.workflowNodeExecution.findFirst({
      where: {
        nodeId: { in: childNodeIds },
        status: 'waiting',
        nodeType: resultType as CanvasNodeType,
        executionId: nodeExecution.executionId,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!mediaNodeExecution?.entityId) {
      return null;
    }

    const nodeData: CanvasNode = safeParseJSON(mediaNodeExecution.nodeData);
    return {
      nodeExecutionId: mediaNodeExecution.nodeExecutionId,
      nodeData,
    };
  }

  /**
   * Update workflow node with execution results
   */
  private async updateWorkflowNode(
    nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode },
    resultType: string,
    title: string,
    outputUrl: string,
    storageKey: string,
    customMetadata: Record<string, any> = {},
  ): Promise<void> {
    await this.prismaService.workflowNodeExecution.update({
      where: { nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId },
      data: {
        title: title,
        entityId: nodeExecutionToUpdate.nodeData.data?.entityId || '',
        status: 'finish',
        nodeData: JSON.stringify({
          ...nodeExecutionToUpdate.nodeData,
          data: {
            ...nodeExecutionToUpdate.nodeData.data,
            title: title,
            entityId: nodeExecutionToUpdate.nodeData.data?.entityId || '',
            metadata: {
              ...nodeExecutionToUpdate.nodeData.data?.metadata,
              [`${resultType}Url`]: outputUrl,
              storageKey: storageKey,
              ...customMetadata,
            },
          },
        }),
      },
    });
  }

  /**
   * Update workflow node status only
   */
  private async updateWorkflowNodeStatus(
    nodeExecutionId: string,
    status: 'finish' | 'failed',
  ): Promise<void> {
    try {
      await this.prismaService.workflowNodeExecution.update({
        where: { nodeExecutionId },
        data: { status },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update workflow node execution status to ${status}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Create canvas node for the execution result
   */
  private async createCanvasNode(
    user: User,
    actionResult: ActionResult,
    resultType: string,
    title: string,
    outputUrl: string,
    storageKey: string,
    parentResultId?: string,
    customMetadata: Record<string, any> = {},
  ): Promise<void> {
    const entityId = genMediaID(resultType as any);
    await this.canvasSyncService.addNodeToCanvas(
      user,
      actionResult.targetId,
      {
        type: resultType as CanvasNodeType,
        data: {
          title: title || `${resultType}-${Date.now()}`,
          entityId,
          metadata: {
            resultId: actionResult.resultId,
            storageKey,
            [`${resultType}Url`]: outputUrl,
            ...customMetadata,
          },
        },
      },
      parentResultId ? [{ type: 'skillResponse', entityId: parentResultId }] : undefined,
      { autoLayout: true },
    );
  }
}

// Backward compatibility alias
export const MediaGenerationInterceptor = ToolExecutionSyncInterceptor;
export type MediaGenerationContext = ToolExecutionContext;
export type MediaGenerationResult = ToolExecutionResult;
