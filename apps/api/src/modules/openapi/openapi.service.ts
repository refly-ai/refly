import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { CanvasService } from '../canvas/canvas.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { createId } from '@paralleldrive/cuid2';
import { genScheduleRecordId, safeStringifyJSON } from '@refly/utils';
import { extractToolsetsWithNodes, sortNodeExecutionsByExecutionOrder } from '@refly/canvas-common';
import type {
  CanvasEdge,
  CanvasNode,
  DriveFileViaApi,
  ListOrder,
  User,
  VariableValue,
  WorkflowTask,
  WorkflowVariable,
} from '@refly/openapi-schema';
import type { Prisma, User as PrismaUser } from '@prisma/client';
import { WorkflowExecutionNotFoundError } from '@refly/errors';
import {
  actionMessagePO2DTO,
  driveFilePO2DTO,
  workflowNodeExecutionPO2DTO,
} from './types/request.types';
import { ConfigService } from '@nestjs/config';
import { normalizeOpenapiStorageKey } from '../../utils/openapi-file-key';
import { WorkflowService } from '../workflow/workflow.service';

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
    private readonly workflowService: WorkflowService,
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
      const scheduleId = `api:${canvasId}`;

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
        apiId: null,
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
        apiId: null,
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
   * Get workflow execution status (minimal fields)
   * @param user - The user requesting the workflow status
   * @param executionId - The workflow execution ID
   * @returns Promise<WorkflowExecution> - The workflow execution status
   */
  async getWorkflowStatus(user: User, executionId: string) {
    const workflowExecution = await this.prisma.workflowExecution.findUnique({
      where: { executionId, uid: user.uid },
    });

    if (!workflowExecution) {
      throw new WorkflowExecutionNotFoundError(`Workflow execution ${executionId} not found`);
    }

    const nodeExecutions = await this.prisma.workflowNodeExecution.findMany({
      where: { executionId },
    });

    const sortedNodeExecutions = sortNodeExecutionsByExecutionOrder(nodeExecutions);

    return { ...workflowExecution, nodeExecutions: sortedNodeExecutions };
  }

  async getWorkflowOutput(user: User, executionId: string) {
    const workflowExecution = await this.prisma.workflowExecution.findUnique({
      where: { executionId, uid: user.uid },
    });

    if (!workflowExecution) {
      throw new WorkflowExecutionNotFoundError(`Workflow execution ${executionId} not found`);
    }

    const nodeExecutions = await this.prisma.workflowNodeExecution.findMany({
      where: { executionId },
    });

    // Sort node executions by execution order (topological sort based on parent-child relationships)
    const sortedNodeExecutions = sortNodeExecutionsByExecutionOrder(nodeExecutions);

    let resultNodeIds: string[] | null = null;
    let sourceCanvasId = workflowExecution.canvasId;

    if (workflowExecution.scheduleRecordId) {
      const scheduleRecord = await this.prisma.workflowScheduleRecord.findUnique({
        where: { scheduleRecordId: workflowExecution.scheduleRecordId },
        select: { sourceCanvasId: true },
      });
      if (scheduleRecord?.sourceCanvasId) {
        sourceCanvasId = scheduleRecord.sourceCanvasId;
      }
    }

    try {
      const openapiConfig = await this.prisma.workflowOpenapiConfig.findFirst({
        where: { canvasId: sourceCanvasId, uid: user.uid },
        select: { resultNodeIds: true },
      });
      resultNodeIds = openapiConfig?.resultNodeIds ? JSON.parse(openapiConfig.resultNodeIds) : null;
    } catch (error) {
      this.logger.warn(
        `Failed to parse resultNodeIds for execution ${executionId}: ${error?.message}`,
      );
    }

    let allowedNodeIds: Set<string> | null = null;
    let forceEmptyOutput = false;
    if (Array.isArray(resultNodeIds)) {
      if (resultNodeIds.length === 0) {
        forceEmptyOutput = true;
      } else {
        allowedNodeIds = new Set(resultNodeIds);
      }
    }

    // Filter nodes that are considered "products"
    const productNodes = forceEmptyOutput
      ? []
      : sortedNodeExecutions.filter(
          (node) =>
            node.nodeType === 'skillResponse' &&
            node.status === 'finish' &&
            (!allowedNodeIds || allowedNodeIds.has(node.nodeId)),
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
          .filter(
            (message) =>
              isNonEmptyText(message.content) || isNonEmptyText(message.reasoningContent),
          )
          .map((message) => actionMessagePO2DTO(message));

        actionDetailsMap.set(result.resultId, {
          messages: resultMessages,
        });
      }
    }

    // Enhance productNodes with action details
    const output = productNodes.map((node) => {
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
    let files: DriveFileViaApi[] = [];
    if (skillResultIds.length > 0) {
      const dbDriveFiles = await this.prisma.driveFile.findMany({
        where: {
          resultId: { in: skillResultIds as string[] },
          deletedAt: null,
          scope: 'present',
          source: 'agent',
        },
      });
      files = dbDriveFiles.map((file) => driveFilePO2DTO(file, this.endpoint));
    }

    return {
      output,
      files,
    };
  }

  async abortWorkflow(user: PrismaUser, executionId: string): Promise<void> {
    await this.workflowService.abortWorkflow(user, executionId);
  }

  async searchWorkflows(
    user: User,
    query: {
      keyword?: string;
      order?: ListOrder;
      page?: number;
      pageSize?: number;
    },
  ): Promise<Array<{ canvasId: string; title: string }>> {
    const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : '';
    const order = this.normalizeListOrder(query.order);
    const page = query.page && Number.isFinite(query.page) && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize && Number.isFinite(query.pageSize) && query.pageSize > 0
        ? Math.min(query.pageSize, 100)
        : 20;

    const orderBy: Prisma.CanvasOrderByWithRelationInput = (() => {
      switch (order) {
        case 'creationAsc':
          return { createdAt: 'asc' };
        case 'creationDesc':
          return { createdAt: 'desc' };
        case 'updationAsc':
          return { updatedAt: 'asc' };
        default:
          return { updatedAt: 'desc' };
      }
    })();

    const where: Prisma.CanvasWhereInput = {
      uid: user.uid,
      deletedAt: null,
      visibility: true,
    };

    if (keyword) {
      where.title = { contains: keyword, mode: 'insensitive' };
    }

    const canvases = await this.prisma.canvas.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        canvasId: true,
        title: true,
      },
    });

    return canvases.map((canvas) => ({
      canvasId: canvas.canvasId,
      title: canvas.title || 'Untitled',
    }));
  }

  async getWorkflowPlan(
    user: User,
    canvasId: string,
  ): Promise<{
    title: string;
    tasks: WorkflowTask[];
    variables: Array<{
      name: string;
      variableType?: string;
      required?: boolean;
      options?: string[];
    }>;
  }> {
    const rawData = await this.canvasService.getCanvasRawData(user, canvasId, {
      checkOwnership: true,
    });

    const tasks = this.buildWorkflowTasks(rawData.nodes ?? [], rawData.edges ?? []);
    const variables = this.sanitizeWorkflowVariables(rawData.variables ?? []);

    return {
      title: rawData.title || 'Untitled',
      tasks,
      variables,
    };
  }

  async getOpenapiConfig(
    uid: string,
    canvasId: string,
  ): Promise<{ canvasId: string; resultNodeIds: string[] | null } | null> {
    const config = await this.prisma.workflowOpenapiConfig.findFirst({
      where: { canvasId, uid },
    });

    if (!config) {
      return null;
    }

    let resultNodeIds: string[] | null = null;
    try {
      resultNodeIds = config.resultNodeIds ? JSON.parse(config.resultNodeIds) : null;
    } catch (error) {
      this.logger.warn(`Failed to parse resultNodeIds for canvas ${canvasId}: ${error?.message}`);
    }

    return { canvasId: config.canvasId, resultNodeIds };
  }

  async upsertOpenapiConfig(
    uid: string,
    canvasId: string,
    resultNodeIds?: string[] | null,
  ): Promise<{ canvasId: string; resultNodeIds: string[] | null }> {
    const normalizedResultNodeIds = resultNodeIds ?? null;
    const storedResultNodeIds =
      normalizedResultNodeIds === null ? null : JSON.stringify(normalizedResultNodeIds);

    const config = await this.prisma.workflowOpenapiConfig.upsert({
      where: {
        canvasId_uid: {
          canvasId,
          uid,
        },
      },
      create: {
        canvasId,
        uid,
        resultNodeIds: storedResultNodeIds,
      },
      update: {
        resultNodeIds: storedResultNodeIds,
      },
    });

    return {
      canvasId: config.canvasId,
      resultNodeIds: normalizedResultNodeIds,
    };
  }
  /**
   * Record API call to database
   */
  private async recordApiCall(data: {
    recordId: string;
    uid: string;
    apiId: string | null;
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
          apiId: data.apiId ?? null,
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

  private normalizeListOrder(order?: ListOrder): ListOrder {
    switch (order) {
      case 'creationAsc':
      case 'creationDesc':
      case 'updationAsc':
      case 'updationDesc':
        return order;
      default:
        return 'updationDesc';
    }
  }

  private sanitizeWorkflowVariables(rawVariables: WorkflowVariable[] | undefined): Array<{
    name: string;
    variableType?: string;
    required?: boolean;
    options?: string[];
  }> {
    if (!Array.isArray(rawVariables)) {
      return [];
    }

    return rawVariables
      .map((variable) => {
        if (!variable?.name) {
          return null;
        }
        const options = Array.isArray(variable.options)
          ? variable.options.filter((option) => typeof option === 'string')
          : undefined;
        return {
          name: variable.name,
          variableType: variable.variableType,
          required: variable.required ?? false,
          ...(options && options.length > 0 ? { options } : {}),
        };
      })
      .filter((variable): variable is NonNullable<typeof variable> => Boolean(variable));
  }

  private buildWorkflowTasks(nodes: CanvasNode[], edges: CanvasEdge[]): WorkflowTask[] {
    if (!Array.isArray(nodes)) {
      return [];
    }

    const skillNodes = nodes.filter((node) => node?.type === 'skillResponse');
    const skillNodeIds = new Set(skillNodes.map((node) => node.id).filter(Boolean));

    const dependencyMap = new Map<string, Set<string>>();
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        const sourceId = edge?.source;
        const targetId = edge?.target;
        if (!sourceId || !targetId) continue;
        if (!skillNodeIds.has(sourceId) || !skillNodeIds.has(targetId)) continue;
        if (!dependencyMap.has(targetId)) {
          dependencyMap.set(targetId, new Set());
        }
        dependencyMap.get(targetId)!.add(sourceId);
      }
    }

    return skillNodes.map((node) => {
      const metadata = (node.data?.metadata ?? {}) as Record<string, any>;
      const prompt =
        typeof metadata.query === 'string'
          ? metadata.query
          : typeof metadata?.structuredData?.query === 'string'
            ? metadata.structuredData.query
            : '';

      const selectedToolsets = Array.isArray(metadata.selectedToolsets)
        ? metadata.selectedToolsets
        : [];
      const toolsets = Array.from(
        new Set(
          selectedToolsets
            .map((toolset: any) => toolset?.toolset?.key ?? toolset?.id)
            .filter(
              (value: unknown): value is string => typeof value === 'string' && value.length > 0,
            ),
        ),
      );

      const task: WorkflowTask = {
        id: node.id,
        title: node.data?.editedTitle || node.data?.title || 'Untitled',
        prompt,
        toolsets,
      };

      const dependencies = dependencyMap.get(node.id);
      if (dependencies && dependencies.size > 0) {
        task.dependentTasks = Array.from(dependencies);
      }

      return task;
    });
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

const isNonEmptyText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
