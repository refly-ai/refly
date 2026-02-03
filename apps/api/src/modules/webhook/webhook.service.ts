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
import { normalizeOpenapiStorageKey } from '../../utils/openapi-file-key';
import { mergeVariablesWithCanvas } from '../../utils/workflow-variables';
import { redactApiCallRecord } from '../../utils/data-redaction';

type ResourceFileType = 'document' | 'image' | 'video' | 'audio';

/**
 * Normalize unknown error into a safe shape with defined properties
 */
function normalizeError(error: unknown): {
  message: string;
  status: number;
  name: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      status: (error as any).status ?? 500,
      name: error.name,
    };
  }
  return {
    message: String(error),
    status: 500,
    name: 'UnknownError',
  };
}

export interface WebhookConfig {
  apiId: string;
  uid: string;
  canvasId: string;
  isEnabled: boolean;
  timeout: number;
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
    timeout = 30,
  ): Promise<{ webhookId: string; webhookUrl: string }> {
    // Check canvas ownership
    const canvas = await this.prisma.canvas.findFirst({
      where: { canvasId, uid },
    });

    if (!canvas) {
      throw new NotFoundException('Canvas not found or access denied');
    }

    // Check if webhook already exists (including soft-deleted records due to unique constraint)
    const existing = await this.prisma.workflowWebhook.findFirst({
      where: { canvasId, uid },
    });

    if (existing) {
      // Update existing webhook (reactivate if soft-deleted)
      const updated = await this.prisma.workflowWebhook.update({
        where: { pk: existing.pk },
        data: {
          isEnabled: true,
          deletedAt: null,
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
    const webhook = await this.prisma.workflowWebhook.create({
      data: {
        apiId: webhookId,
        uid,
        canvasId,
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
    const webhook = await this.prisma.workflowWebhook.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    // Soft delete
    await this.prisma.workflowWebhook.update({
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
    const webhook = await this.prisma.workflowWebhook.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    // Generate new webhook ID
    const newWebhookId = this.generateWebhookId();

    // Update webhook
    const updated = await this.prisma.workflowWebhook.update({
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
      timeout?: number;
    },
  ): Promise<void> {
    const webhook = await this.prisma.workflowWebhook.findFirst({
      where: { apiId: webhookId, uid, deletedAt: null },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found or access denied');
    }

    await this.prisma.workflowWebhook.update({
      where: { pk: webhook.pk },
      data: {
        ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled }),
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
    const webhook = await this.prisma.workflowWebhook.findFirst({
      where: { canvasId, uid, deletedAt: null },
    });

    if (!webhook) {
      return null;
    }

    return {
      apiId: webhook.apiId,
      uid: webhook.uid,
      canvasId: webhook.canvasId,
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
    const scheduleRecordId = genScheduleRecordId();
    const scheduledAt = new Date();
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

    const canvasData = await this.canvasService.createSnapshotFromCanvas(
      { uid: config.uid },
      config.canvasId,
    );
    // Convert variables to workflow format and align with canvas variable IDs
    const runtimeVariables = await this.buildWorkflowVariables(config.uid, variables);
    const workflowVariables = mergeVariablesWithCanvas(
      canvasData?.variables ?? [],
      runtimeVariables,
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
        workflowTitle: canvasData?.title ?? 'Untitled',
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
      webhookId,
      variables,
      canvasData,
      scheduleId,
      scheduleRecordId,
    ).catch((error) => {
      const normalizedError = normalizeError(error);
      this.logger.error(
        `[WEBHOOK_ASYNC_ERROR] uid=${config.uid} webhookId=${webhookId} error=${normalizedError.message}`,
      );
    });

    this.logger.log(`[WEBHOOK_RECEIVED] uid=${config.uid} webhookId=${webhookId}`);

    // Return immediately - webhook only confirms receipt
    return { received: true };
  }

  /**
   * Execute workflow asynchronously (internal method)
   */
  private async executeWorkflowAsync(
    user: any,
    config: WebhookConfig,
    workflowVariables: WorkflowVariable[],
    webhookId: string,
    _variables: Record<string, any>,
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

      this.logger.log(
        `[WEBHOOK_EXECUTED] uid=${config.uid} webhookId=${webhookId} executionId=${executionId}`,
      );
    } catch (error) {
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
    const webhook = await this.prisma.workflowWebhook.findFirst({
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
    const webhook = await this.prisma.workflowWebhook.findFirst({
      where: { apiId: webhookId, deletedAt: null },
    });

    if (!webhook) {
      return null;
    }

    const config: WebhookConfig = {
      apiId: webhook.apiId,
      uid: webhook.uid,
      canvasId: webhook.canvasId,
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
  public async recordApiCall(data: {
    recordId: string;
    uid: string;
    apiId?: string | null;
    canvasId?: string;
    workflowExecutionId?: string;
    requestUrl?: string;
    requestMethod?: string;
    requestBody?: any;
    requestHeaders?: Record<string, unknown> | string;
    httpStatus: number;
    responseTime: number;
    status: ApiCallStatus;
    failureReason?: string;
  }): Promise<void> {
    try {
      const requestBody =
        data.requestBody !== undefined ? safeStringifyJSON(data.requestBody) : null;
      const requestHeaders =
        data.requestHeaders !== undefined
          ? typeof data.requestHeaders === 'string'
            ? data.requestHeaders
            : safeStringifyJSON(data.requestHeaders)
          : null;

      // Redact sensitive data before persisting
      const redacted = redactApiCallRecord({
        requestBody,
        requestHeaders,
        responseBody: null,
      });

      await this.prisma.apiCallRecord.create({
        data: {
          recordId: data.recordId,
          uid: data.uid,
          apiId: data.apiId ?? null,
          canvasId: data.canvasId ?? null,
          workflowExecutionId: data.workflowExecutionId,
          requestUrl: data.requestUrl,
          requestMethod: data.requestMethod,
          requestHeaders: redacted.requestHeaders,
          requestBody: redacted.requestBody,
          httpStatus: data.httpStatus,
          responseTime: data.responseTime,
          status: data.status,
          failureReason: data.failureReason,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to record API call: ${errorMessage}`);
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

const mapContentTypeToFileType = (contentType?: string): ResourceFileType => {
  if (!contentType) return 'document';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'document';
};
