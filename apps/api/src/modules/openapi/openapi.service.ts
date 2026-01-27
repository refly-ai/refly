import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { CanvasService } from '../canvas/canvas.service';
import { createId } from '@paralleldrive/cuid2';
import { genScheduleRecordId, safeStringifyJSON } from '@refly/utils';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import type { RawCanvasData, VariableValue, WorkflowVariable } from '@refly/openapi-schema';

enum ApiCallStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Injectable()
export class OpenapiService {
  private readonly logger = new Logger(OpenapiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowAppService: WorkflowAppService,
    private readonly canvasService: CanvasService,
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
      const workflowVariables = this.buildWorkflowVariables(variables);
      const canvasData = await this.createSnapshotFromCanvas({ uid }, canvasId);
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

  private buildWorkflowVariables(variables: Record<string, any>): WorkflowVariable[] {
    if (!variables || typeof variables !== 'object') {
      return [];
    }

    return Object.entries(variables).map(([key, rawValue]) => {
      const value = this.normalizeVariableValue(rawValue);
      const variableType = value.some((item) => item.type === 'resource') ? 'resource' : 'string';

      return {
        variableId: `var-${createId()}`,
        name: key,
        value,
        variableType,
      };
    });
  }

  private normalizeVariableValue(rawValue: unknown): VariableValue[] {
    if (Array.isArray(rawValue)) {
      if (
        rawValue.length > 0 &&
        typeof rawValue[0] === 'object' &&
        rawValue[0] !== null &&
        'type' in rawValue[0]
      ) {
        return rawValue as VariableValue[];
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
      return [rawValue as VariableValue];
    }

    return [
      {
        type: 'text' as const,
        text: this.stringifyVariableValue(rawValue),
      },
    ];
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

  private async createSnapshotFromCanvas(
    user: { uid: string },
    canvasId: string,
  ): Promise<RawCanvasData> {
    const rawData = await this.canvasService.getCanvasRawData(user as any, canvasId);

    const driveFiles = await this.prisma.driveFile.findMany({
      where: {
        uid: user.uid,
        canvasId,
        scope: 'present',
        deletedAt: null,
      },
    });

    const files = driveFiles.map((file) => ({
      fileId: file.fileId,
      canvasId: file.canvasId,
      name: file.name,
      type: file.type,
      category: file.category,
      size: Number(file.size),
      source: file.source,
      scope: file.scope,
      summary: file.summary ?? undefined,
      variableId: file.variableId ?? undefined,
      resultId: file.resultId ?? undefined,
      resultVersion: file.resultVersion ?? undefined,
      storageKey: file.storageKey ?? undefined,
      createdAt: file.createdAt.toJSON(),
      updatedAt: file.updatedAt.toJSON(),
    }));

    const resources = await this.prisma.resource.findMany({
      where: {
        uid: user.uid,
        canvasId,
        deletedAt: null,
      },
      select: {
        resourceId: true,
        title: true,
        resourceType: true,
        storageKey: true,
        storageSize: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      title: rawData.title,
      nodes: rawData.nodes ?? [],
      edges: rawData.edges ?? [],
      variables: rawData.variables ?? [],
      files,
      resources: resources.map((resource) => ({
        ...resource,
        storageSize: Number(resource.storageSize || 0),
        createdAt: resource.createdAt.toJSON(),
        updatedAt: resource.updatedAt.toJSON(),
      })),
    } as RawCanvasData;
  }
}
