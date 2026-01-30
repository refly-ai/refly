import { Injectable, Logger, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { CanvasService } from '../canvas/canvas.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { createId } from '@paralleldrive/cuid2';
import { genScheduleRecordId, safeStringifyJSON, safeParseJSON } from '@refly/utils';
import { extractToolsetsWithNodes, sortNodeExecutionsByExecutionOrder } from '@refly/canvas-common';
import type { DriveFileViaApi, User, VariableValue, WorkflowVariable } from '@refly/openapi-schema';
import { WorkflowExecutionNotFoundError } from '@refly/errors';
import {
  actionMessagePO2DTO,
  driveFilePO2DTO,
  workflowNodeExecutionPO2DTO,
} from './types/request.types';
import { sanitizeToolOutput } from '../action/action.dto';
import { ToolCallResult as ToolCallResultModel } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { normalizeOpenapiStorageKey } from '../../utils/openapi-file-key';

enum ApiCallStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

type ResourceFileType = 'document' | 'image' | 'video' | 'audio';

@Injectable()
export class OpenapiService {
  private readonly logger = new Logger(OpenapiService.name);
  private get endpoint(): string | undefined {
    return this.config.get<string>('endpoint');
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowAppService: WorkflowAppService,
    private readonly canvasService: CanvasService,
    @Inject(OSS_INTERNAL) private readonly objectStorage: ObjectStorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Run workflow via API (sync, returns execution ID)
   * API triggers require authentication and return task ID for status tracking
   */
  async runWorkflow(
    canvasId: string,
    uid: string,
    variables: Record<string, any>,
  ): Promise<{ executionId: string; status: string }> {
    const startTime = Date.now();
    const recordId = `rec_${createId()}`;
    const scheduleRecordId = genScheduleRecordId();
    const scheduledAt = new Date();
    let recordCreated = false;

    try {
      // Get workflow API config
      const config = await this.prisma.workflowApi.findFirst({
        where: { canvasId, uid, deletedAt: null },
      });

      if (!config) {
        throw new NotFoundException('Workflow API not found for this canvas');
      }

      if (!config.isEnabled) {
        throw new ForbiddenException('Workflow API is disabled');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { uid },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Convert variables to workflow format
      const workflowVariables = await this.buildWorkflowVariables(uid, variables);
      const canvasData = await this.canvasService.createSnapshotFromCanvas({ uid }, canvasId);
      const toolsetsWithNodes = extractToolsetsWithNodes(canvasData?.nodes ?? []);
      const usedToolIds = toolsetsWithNodes.map((t) => t.toolset?.toolset?.key).filter(Boolean);
      const scheduleId = `api:${config.apiId}`;

      await this.prisma.workflowScheduleRecord.create({
        data: {
          scheduleRecordId,
          scheduleId,
          uid,
          sourceCanvasId: canvasId,
          canvasId: '',
          workflowTitle: canvasData?.title || 'Untitled',
          status: 'running',
          scheduledAt,
          triggeredAt: scheduledAt,
          priority: 5,
          usedTools: JSON.stringify(usedToolIds),
        },
      });
      recordCreated = true;

      // Initialize workflow execution (synchronous)
      const { executionId, canvasId: executionCanvasId } =
        await this.workflowAppService.executeFromCanvasData(
          { uid },
          canvasData,
          workflowVariables,
          {
            scheduleId,
            scheduleRecordId,
            triggerType: 'api',
          },
        );

      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          canvasId: executionCanvasId,
          workflowExecutionId: executionId,
        },
      });

      const responseTime = Date.now() - startTime;

      // Record API call
      await this.recordApiCall({
        recordId,
        uid,
        apiId: config.apiId,
        canvasId,
        workflowExecutionId: executionId,
        requestBody: variables,
        httpStatus: 200,
        responseTime,
        status: ApiCallStatus.SUCCESS,
      });

      this.logger.log(
        `[API_EXECUTED] uid=${uid} canvasId=${canvasId} executionId=${executionId} responseTime=${responseTime}ms`,
      );

      return {
        executionId,
        status: 'running',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed API call
      await this.recordApiCall({
        recordId,
        uid,
        apiId: 'unknown',
        canvasId,
        requestBody: variables,
        httpStatus: error.status || 500,
        responseTime,
        status: ApiCallStatus.FAILED,
        failureReason: error.message,
      });

      if (recordCreated) {
        await this.prisma.workflowScheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'failed',
            failureReason: error.message,
            errorDetails: safeStringifyJSON({
              message: error.message,
              name: error.name,
              stack: error.stack,
            }),
            completedAt: new Date(),
          },
        });
      }

      throw error;
    }
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

  async getWorkflowOutput(user: User, executionId: string) {
    const workflowExecutionDTO = await this.getWorkflowDetail(user, executionId);

    // Sort node executions by execution order (topological sort based on parent-child relationships)
    const sortedNodeExecutions = workflowExecutionDTO.nodeExecutions;

    // Filter nodes that are considered "products"
    const productNodes = sortedNodeExecutions.filter(
      (node) => node.nodeType === 'skillResponse' && node.status === 'finish',
    );

    // Collect result IDs for skillResponse nodes
    const skillResultIds = productNodes.map((node) => node.entityId);

    const actionDetailsMap = new Map<string, any>();

    if (skillResultIds.length > 0) {
      const actionResults = await this.prisma.actionResult.findMany({
        where: {
          resultId: { in: skillResultIds as string[] },
          uid: user.uid,
        },
      });

      // Fetch Messages
      const messages = await this.prisma.actionMessage.findMany({
        where: {
          resultId: { in: skillResultIds as string[] },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Fetch ToolCalls
      const toolCalls = await this.prisma.toolCallResult.findMany({
        where: {
          resultId: { in: skillResultIds as string[] },
          deletedAt: null,
        },
      });

      const toolCallResultMap = new Map<string, ToolCallResultModel>();
      for (const tc of toolCalls) {
        toolCallResultMap.set(tc.callId, tc);
      }

      const resultsByUniqueId = new Map<string, any>(); // key: resultId, value: result

      for (const result of actionResults) {
        const current = resultsByUniqueId.get(result.resultId);
        if (!current || result.version > current.version) {
          resultsByUniqueId.set(result.resultId, result);
        }
      }

      for (const result of Array.from(resultsByUniqueId.values())) {
        const resultMessages = messages
          .filter((m) => m.resultId === result.resultId && m.version === result.version)
          .map((message) => {
            const dto = actionMessagePO2DTO(message);

            // Enrich with tool call result
            if (message.type === 'tool' && message.toolCallId) {
              const toolCallResult = toolCallResultMap.get(message.toolCallId);
              if (toolCallResult) {
                const rawOutput = safeParseJSON(toolCallResult.output || '{}') ?? {
                  rawOutput: toolCallResult.output,
                };
                const output = sanitizeToolOutput(toolCallResult.toolName, rawOutput);

                // Attach the tool call result to the message
                dto.toolCallResult = {
                  toolName: toolCallResult.toolName,
                  input: safeParseJSON(toolCallResult.input || '{}') ?? {},
                  output,
                  error: toolCallResult.error || '',
                  status: toolCallResult.status as 'executing' | 'completed' | 'failed',
                  createdAt: toolCallResult.createdAt.getTime(),
                };
              }
            }
            return dto;
          });

        actionDetailsMap.set(result.resultId, {
          messages: resultMessages,
        });
      }
    }

    // Enhance productNodes with action details
    const products = productNodes.map((node) => {
      if (node.nodeType === 'skillResponse' && node.entityId) {
        const detail = actionDetailsMap.get(node.entityId);
        if (detail) {
          return {
            ...workflowNodeExecutionPO2DTO(node),
            messages: detail.messages,
          };
        }
      }
      return node;
    });

    // Fetch Drive Files linked to these results
    let driveFiles: DriveFileViaApi[] = [];
    if (skillResultIds.length > 0) {
      const dbDriveFiles = await this.prisma.driveFile.findMany({
        where: {
          resultId: { in: skillResultIds as string[] },
          deletedAt: null,
          scope: 'present',
          source: 'agent',
        },
      });
      driveFiles = dbDriveFiles.map((file) => driveFilePO2DTO(file, this.endpoint));
    }

    return {
      products,
      driveFiles,
    };
  }
  /**
   * Record API call to database
   */
  private async recordApiCall(data: {
    recordId: string;
    uid: string;
    apiId: string;
    canvasId: string;
    workflowExecutionId?: string;
    requestBody: any;
    httpStatus: number;
    responseTime: number;
    status: ApiCallStatus;
    failureReason?: string;
  }): Promise<void> {
    try {
      await this.prisma.apiCallRecord.create({
        data: {
          recordId: data.recordId,
          uid: data.uid,
          apiId: data.apiId,
          canvasId: data.canvasId,
          workflowExecutionId: data.workflowExecutionId,
          requestBody: safeStringifyJSON(data.requestBody),
          httpStatus: data.httpStatus,
          responseTime: data.responseTime,
          status: data.status,
          failureReason: data.failureReason,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record API call: ${error.message}`);
    }
  }

  private async buildWorkflowVariables(
    uid: string,
    variables: Record<string, any>,
  ): Promise<WorkflowVariable[]> {
    if (!variables || typeof variables !== 'object') {
      return [];
    }

    const entries = Object.entries(variables);
    const storageKeys = new Set<string>();
    for (const [, rawValue] of entries) {
      const keys = this.extractOpenapiStorageKeys(uid, rawValue);
      for (const key of keys) {
        storageKeys.add(key);
      }
    }

    const openapiFileMeta = await this.fetchOpenapiFileMeta(uid, Array.from(storageKeys));

    return entries.map(([key, rawValue]) => {
      const value = this.normalizeVariableValue(rawValue, uid, openapiFileMeta);
      const variableType = value.some((item) => item.type === 'resource') ? 'resource' : 'string';

      return {
        variableId: `var-${createId()}`,
        name: key,
        value,
        variableType,
      };
    });
  }

  private normalizeVariableValue(
    rawValue: unknown,
    uid: string,
    openapiFileMeta: Map<string, { name?: string; fileType?: ResourceFileType }>,
  ): VariableValue[] {
    const openapiValues = this.normalizeOpenapiFileKeyValues(rawValue, uid, openapiFileMeta);
    if (openapiValues) {
      return openapiValues;
    }

    if (Array.isArray(rawValue)) {
      if (
        rawValue.length > 0 &&
        typeof rawValue[0] === 'object' &&
        rawValue[0] !== null &&
        'type' in rawValue[0]
      ) {
        return (rawValue as VariableValue[]).map((item) =>
          this.normalizeResourceValue(item, uid, openapiFileMeta),
        );
      }
      return rawValue.map((item) => ({
        type: 'text' as const,
        text: this.stringifyVariableValue(item),
      }));
    }

    if (
      rawValue &&
      typeof rawValue === 'object' &&
      'type' in (rawValue as Record<string, unknown>)
    ) {
      return [this.normalizeResourceValue(rawValue as VariableValue, uid, openapiFileMeta)];
    }

    return [
      {
        type: 'text' as const,
        text: this.stringifyVariableValue(rawValue),
      },
    ];
  }

  private normalizeOpenapiFileKeyValues(
    rawValue: unknown,
    uid: string,
    openapiFileMeta: Map<string, { name?: string; fileType?: ResourceFileType }>,
  ): VariableValue[] | null {
    if (typeof rawValue === 'string') {
      const storageKey = normalizeOpenapiStorageKey(uid, rawValue);
      if (!storageKey?.startsWith('openapi/')) {
        return null;
      }
      const meta = openapiFileMeta.get(storageKey);
      return [
        {
          type: 'resource',
          resource: {
            name: meta?.name ?? 'uploaded_file',
            fileType: meta?.fileType ?? 'document',
            storageKey,
          },
        },
      ];
    }

    if (Array.isArray(rawValue) && rawValue.length > 0) {
      if (!rawValue.every((item) => typeof item === 'string')) {
        return null;
      }
      const storageKeys = rawValue
        .map((item) => normalizeOpenapiStorageKey(uid, item as string))
        .filter((item) => item?.startsWith('openapi/')) as string[];

      if (storageKeys.length !== rawValue.length) {
        return null;
      }

      return storageKeys.map((storageKey) => {
        const meta = openapiFileMeta.get(storageKey);
        return {
          type: 'resource',
          resource: {
            name: meta?.name ?? 'uploaded_file',
            fileType: meta?.fileType ?? 'document',
            storageKey,
          },
        };
      });
    }

    return null;
  }

  private normalizeResourceValue(
    value: VariableValue,
    uid: string,
    openapiFileMeta: Map<string, { name?: string; fileType?: ResourceFileType }>,
  ): VariableValue {
    if (value.type !== 'resource' || !value.resource) {
      return value;
    }

    const resource = value.resource as Record<string, any>;
    const storageKey = normalizeOpenapiStorageKey(uid, resource.storageKey ?? resource.fileKey);
    if (!storageKey) {
      return value;
    }

    const meta = openapiFileMeta.get(storageKey);
    const name = resource.name ?? meta?.name ?? 'uploaded_file';
    const fileType = resource.fileType ?? meta?.fileType ?? 'document';

    return {
      ...value,
      resource: {
        ...resource,
        name,
        fileType,
        storageKey,
      },
    };
  }

  private extractOpenapiStorageKeys(uid: string, rawValue: unknown): string[] {
    if (!rawValue) return [];
    const storageKeys: string[] = [];

    const addKey = (value: unknown) => {
      if (typeof value !== 'string') return;
      const storageKey = normalizeOpenapiStorageKey(uid, value);
      if (storageKey?.startsWith('openapi/')) {
        storageKeys.push(storageKey);
      }
    };

    if (typeof rawValue === 'string') {
      addKey(rawValue);
      return storageKeys;
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        if (typeof item === 'string') {
          addKey(item);
          continue;
        }
        if (item && typeof item === 'object' && 'type' in (item as Record<string, unknown>)) {
          const resource = (item as any).resource;
          addKey(resource?.storageKey ?? resource?.fileKey);
        }
      }
      return storageKeys;
    }

    if (
      rawValue &&
      typeof rawValue === 'object' &&
      'type' in (rawValue as Record<string, unknown>)
    ) {
      const resource = (rawValue as any).resource;
      addKey(resource?.storageKey ?? resource?.fileKey);
    }

    return storageKeys;
  }

  private async fetchOpenapiFileMeta(
    uid: string,
    storageKeys: string[],
  ): Promise<Map<string, { name?: string; fileType?: ResourceFileType }>> {
    if (storageKeys.length === 0) {
      return new Map();
    }

    const files = await this.prisma.staticFile.findMany({
      where: {
        uid,
        storageKey: { in: storageKeys },
        deletedAt: null,
      },
      select: {
        storageKey: true,
        originalName: true,
        contentType: true,
      },
    });

    const map = new Map<string, { name?: string; fileType?: ResourceFileType }>();
    for (const file of files) {
      map.set(file.storageKey, {
        name: file.originalName ?? undefined,
        fileType: mapContentTypeToFileType(file.contentType),
      });
    }

    return map;
  }

  private stringifyVariableValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

const mapContentTypeToFileType = (contentType?: string): ResourceFileType => {
  if (!contentType) return 'document';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'document';
};
