import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { CanvasService } from '../canvas/canvas.service';
import { createId } from '@paralleldrive/cuid2';
import {
  WEBHOOK_ID_PREFIX,
  WEBHOOK_ID_LENGTH,
  WEBHOOK_CONFIG_CACHE_TTL,
  REDIS_KEY_WEBHOOK_CONFIG,
  ApiCallStatus,
} from './webhook.constants';
import * as crypto from 'node:crypto';
import { genScheduleRecordId, safeStringifyJSON } from '@refly/utils';
import { extractToolsetsWithNodes } from '@refly/canvas-common';
import type { RawCanvasData, VariableValue, WorkflowVariable } from '@refly/openapi-schema';

export interface WebhookConfig {
  apiId: string;
  uid: string;
  canvasId: string;
  resultNodeIds: string[] | null;
  isEnabled: boolean;
  timeout: number;
}

export interface WebhookCallResult {
  executionId: string;
  workflowId: string;
  status: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly workflowAppService: WorkflowAppService,
    private readonly canvasService: CanvasService,
  ) {}

  /**
   * Enable webhook for a canvas
   */
  async enableWebhook(
    canvasId: string,
    uid: string,
    resultNodeIds?: string[],
    timeout = 30,
  ): Promise<{ webhookId: string; webhookUrl: string }> {
    // Check canvas ownership
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found or access denied');
    }

    // Check if webhook already exists
    const existing = await this.prisma.workflowApi.findFirst({
      where: { canvasId, uid, deletedAt: null },
    });

    if (existing) {
      // Update existing webhook
      const updated = await this.prisma.workflowApi.update({
        where: { pk: existing.pk },
        data: {
          isEnabled: true,
          resultNodeIds: resultNodeIds ? JSON.stringify(resultNodeIds) : null,
          timeout,
          updatedAt: new Date(),
        },
      });

      // Clear cache
      await this.clearWebhookCache(updated.apiId);

      this.logger.log(
        `[WEBHOOK_ENABLED] uid=${uid} canvasId=${canvasId} webhookId=${updated.apiId}`,
      );

      return {
        webhookId: updated.apiId,
        webhookUrl: this.generateWebhookUrl(updated.apiId),
      };
    }

    // Generate new webhook ID
    const webhookId = this.generateWebhookId();

    // Create new webhook
    const webhook = await this.prisma.workflowApi.create({
      data: {
        apiId: webhookId,
        uid,
        canvasId,
        resultNodeIds: resultNodeIds ? JSON.stringify(resultNodeIds) : null,
        isEnabled: true,
        timeout,
      },
    });

    this.logger.log(`[WEBHOOK_CREATED] uid=${uid} canvasId=${canvasId} webhookId=${webhookId}`);

    return {
      webhookId: webhook.apiId,
      webhookUrl: this.generateWebhookUrl(webhook.apiId),
    };
  }

  /**
   * Disable webhook
   */
  async disableWebhook(webhookId: string, uid: string): Promise<void> {
    const webhook = await this.prisma.workflowApi.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    // Soft delete
    await this.prisma.workflowApi.update({
      where: { pk: webhook.pk },
      data: {
        deletedAt: new Date(),
        isEnabled: false,
      },
    });

    // Clear cache
    await this.clearWebhookCache(webhookId);

    this.logger.log(`[WEBHOOK_DISABLED] uid=${uid} webhookId=${webhookId}`);
  }

  /**
   * Reset webhook (generate new ID)
   */
  async resetWebhook(
    webhookId: string,
    uid: string,
  ): Promise<{ webhookId: string; webhookUrl: string }> {
    const webhook = await this.prisma.workflowApi.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    // Generate new webhook ID
    const newWebhookId = this.generateWebhookId();

    // Update webhook
    const updated = await this.prisma.workflowApi.update({
      where: { pk: webhook.pk },
      data: {
        apiId: newWebhookId,
        updatedAt: new Date(),
      },
    });

    // Clear old cache
    await this.clearWebhookCache(webhookId);

    this.logger.log(
      `[WEBHOOK_RESET] uid=${uid} oldWebhookId=${webhookId} newWebhookId=${newWebhookId}`,
    );

    return {
      webhookId: updated.apiId,
      webhookUrl: this.generateWebhookUrl(updated.apiId),
    };
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    webhookId: string,
    uid: string,
    updates: {
      isEnabled?: boolean;
      resultNodeIds?: string[];
      timeout?: number;
    },
  ): Promise<void> {
    const webhook = await this.prisma.workflowApi.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    await this.prisma.workflowApi.update({
      where: { pk: webhook.pk },
      data: {
        ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
        ...(updates.resultNodeIds !== undefined && {
          resultNodeIds: JSON.stringify(updates.resultNodeIds),
        }),
        ...(updates.timeout !== undefined && { timeout: updates.timeout }),
        updatedAt: new Date(),
      },
    });

    // Clear cache
    await this.clearWebhookCache(webhookId);

    this.logger.log(`[WEBHOOK_UPDATED] uid=${uid} webhookId=${webhookId}`);
  }

  /**
   * Get webhook configuration
   */
  async getWebhookConfig(canvasId: string, uid: string): Promise<WebhookConfig | null> {
    const webhook = await this.prisma.workflowApi.findFirst({
      where: { canvasId, uid, deletedAt: null },
    });

    if (!webhook) {
      return null;
    }

    return {
      apiId: webhook.apiId,
      uid: webhook.uid,
      canvasId: webhook.canvasId,
      resultNodeIds: webhook.resultNodeIds ? JSON.parse(webhook.resultNodeIds) : null,
      isEnabled: webhook.isEnabled,
      timeout: webhook.timeout,
    };
  }

  /**
   * Run workflow via webhook (async, no result returned)
   * Webhook triggers are fire-and-forget - they only confirm receipt
   */
  async runWorkflow(
    webhookId: string,
    variables: Record<string, any>,
  ): Promise<{ received: boolean }> {
    const startTime = Date.now();
    const recordId = `rec_${createId()}`;
    const scheduleRecordId = genScheduleRecordId();
    const scheduledAt = new Date();

    try {
      // Get webhook config (with cache)
      const config = await this.getWebhookConfigById(webhookId);

      if (!config) {
        throw new NotFoundException('Webhook not found');
      }

      if (!config.isEnabled) {
        throw new ForbiddenException('Webhook is disabled');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { uid: config.uid },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Convert variables to workflow format
      const workflowVariables = this.buildWorkflowVariables(variables);
      const canvasData = await this.canvasService.createSnapshotFromCanvas(
        { uid: config.uid },
        config.canvasId,
      );
      const toolsetsWithNodes = extractToolsetsWithNodes(canvasData?.nodes ?? []);
      const usedToolIds = toolsetsWithNodes.map((t) => t.toolset?.toolset?.key).filter(Boolean);
      const scheduleId = `webhook:${webhookId}`;

      await this.prisma.workflowScheduleRecord.create({
        data: {
          scheduleRecordId,
          scheduleId,
          uid: config.uid,
          sourceCanvasId: config.canvasId,
          canvasId: '',
          workflowTitle: canvasData?.title || 'Untitled',
          status: 'running',
          scheduledAt,
          triggeredAt: scheduledAt,
          priority: 5,
          usedTools: JSON.stringify(usedToolIds),
        },
      });

      // Execute workflow asynchronously (fire-and-forget)
      // Don't await - let it run in background
      this.executeWorkflowAsync(
        { uid: config.uid },
        config,
        workflowVariables,
        recordId,
        startTime,
        webhookId,
        variables,
        canvasData,
        scheduleId,
        scheduleRecordId,
      ).catch((error) => {
        this.logger.error(
          `[WEBHOOK_ASYNC_ERROR] uid=${config.uid} webhookId=${webhookId} error=${error.message}`,
        );
      });

      this.logger.log(
        `[WEBHOOK_RECEIVED] uid=${config.uid} webhookId=${webhookId} recordId=${recordId}`,
      );

      // Return immediately - webhook only confirms receipt
      return { received: true };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed API call
      await this.recordApiCall({
        recordId,
        uid: 'unknown',
        apiId: webhookId,
        canvasId: 'unknown',
        requestBody: variables,
        httpStatus: error.status || 500,
        responseTime,
        status: ApiCallStatus.FAILED,
        failureReason: error.message,
      });

      throw error;
    }
  }

  /**
   * Execute workflow asynchronously (internal method)
   */
  private async executeWorkflowAsync(
    user: any,
    config: WebhookConfig,
    workflowVariables: WorkflowVariable[],
    recordId: string,
    startTime: number,
    webhookId: string,
    variables: Record<string, any>,
    canvasData: RawCanvasData,
    scheduleId: string,
    scheduleRecordId: string,
  ): Promise<void> {
    try {
      // Initialize workflow execution
      const { executionId, canvasId: executionCanvasId } =
        await this.workflowAppService.executeFromCanvasData(user, canvasData, workflowVariables, {
          scheduleId,
          scheduleRecordId,
          triggerType: 'webhook',
        });

      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          canvasId: executionCanvasId,
          workflowExecutionId: executionId,
        },
      });

      const responseTime = Date.now() - startTime;

      // Record successful API call
      await this.recordApiCall({
        recordId,
        uid: config.uid,
        apiId: webhookId,
        canvasId: config.canvasId,
        workflowExecutionId: executionId,
        requestBody: variables,
        httpStatus: 200,
        responseTime,
        status: ApiCallStatus.SUCCESS,
      });

      this.logger.log(
        `[WEBHOOK_EXECUTED] uid=${config.uid} webhookId=${webhookId} executionId=${executionId} responseTime=${responseTime}ms`,
      );
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed execution
      await this.recordApiCall({
        recordId,
        uid: config.uid,
        apiId: webhookId,
        canvasId: config.canvasId,
        requestBody: variables,
        httpStatus: 500,
        responseTime,
        status: ApiCallStatus.FAILED,
        failureReason: error.message,
      });

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

      throw error;
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

  /**
   * Get call history for a webhook
   */
  async getCallHistory(
    webhookId: string,
    uid: string,
    pagination: { page: number; pageSize: number },
  ): Promise<{
    records: any[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // Verify ownership
    const webhook = await this.prisma.workflowApi.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      this.prisma.apiCallRecord.findMany({
        where: { apiId: webhookId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.apiCallRecord.count({
        where: { apiId: webhookId },
      }),
    ]);

    return {
      records: records.map((record) => ({
        recordId: record.recordId,
        status: record.status,
        httpStatus: record.httpStatus,
        responseTime: record.responseTime,
        failureReason: record.failureReason,
        createdAt: record.createdAt,
        completedAt: record.completedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get webhook config by ID (with cache)
   */
  async getWebhookConfigById(webhookId: string): Promise<WebhookConfig | null> {
    const cacheKey = `${REDIS_KEY_WEBHOOK_CONFIG}:${webhookId}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const webhook = await this.prisma.workflowApi.findFirst({
      where: { apiId: webhookId, deletedAt: null },
    });

    if (!webhook) {
      return null;
    }

    const config: WebhookConfig = {
      apiId: webhook.apiId,
      uid: webhook.uid,
      canvasId: webhook.canvasId,
      resultNodeIds: webhook.resultNodeIds ? JSON.parse(webhook.resultNodeIds) : null,
      isEnabled: webhook.isEnabled,
      timeout: webhook.timeout,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, WEBHOOK_CONFIG_CACHE_TTL, JSON.stringify(config));

    return config;
  }

  /**
   * Clear webhook cache
   */
  private async clearWebhookCache(webhookId: string): Promise<void> {
    const cacheKey = `${REDIS_KEY_WEBHOOK_CONFIG}:${webhookId}`;
    await this.redis.del(cacheKey);
  }

  /**
   * Record API call
   */
  private async recordApiCall(data: {
    recordId: string;
    uid: string;
    apiId: string;
    canvasId: string;
    workflowExecutionId?: string;
    requestBody?: any;
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
          requestBody: data.requestBody ? safeStringifyJSON(data.requestBody) : null,
          httpStatus: data.httpStatus,
          responseTime: data.responseTime,
          status: data.status,
          failureReason: data.failureReason,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record API call: ${error.message}`);
    }
  }

  /**
   * Generate webhook ID
   */
  private generateWebhookId(): string {
    const randomBytes = crypto.randomBytes(WEBHOOK_ID_LENGTH / 2);
    const randomHex = randomBytes.toString('hex');
    return `${WEBHOOK_ID_PREFIX}${randomHex}`;
  }

  /**
   * Generate webhook URL
   */
  private generateWebhookUrl(webhookId: string): string {
    // TODO: Get base URL from config
    return `https://api.refly.ai/v1/openapi/webhook/${webhookId}/run`;
  }
}
