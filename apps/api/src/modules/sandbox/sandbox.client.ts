import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RedisService } from '../common/redis.service';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import {
  WorkerExecuteRequest,
  WorkerExecuteResponse,
  SandboxExecuteParams,
  SandboxExecutionContext,
} from './sandbox.schema';
import { SANDBOX_QUEUES, SANDBOX_TIMEOUTS } from './sandbox.constants';
import { SandboxExecutionTimeoutError, SandboxResponseParseError } from './sandbox.exception';
import { guard } from '../../utils/guard';

/**
 * Sandbox Worker Redis Queue Client
 *
 * Handles communication with refly-sandbox worker via Redis Queue (List)
 * Protocol:
 * - Request: LPUSH to queue → Ensures single consumption by workers
 * - Response: Pub/Sub on unique channel → One-to-one response delivery
 */
@Injectable()
export class SandboxClient implements OnModuleInit, OnModuleDestroy {
  private publisher: Redis;
  private subscriber: Redis;

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SandboxClient.name);
  }

  async onModuleInit() {
    // Duplicate connections to avoid interfering with original client
    this.publisher = this.redisService.getClient().duplicate();
    this.subscriber = this.redisService.getClient().duplicate();
    this.logger.info('SandboxClient initialized with duplicated publisher and subscriber');
  }

  async onModuleDestroy() {
    // Clean up duplicated connections
    await Promise.all([
      this.publisher?.quit().catch((err) => {
        this.logger.warn({ error: err.message }, 'Failed to quit publisher connection');
      }),
      this.subscriber?.quit().catch((err) => {
        this.logger.warn({ error: err.message }, 'Failed to quit subscriber connection');
      }),
    ]);
    this.logger.info('SandboxClient connections closed');
  }

  /**
   * Acquire response channel subscription
   * Returns cleanup function that unsubscribes from the channel
   */
  private async acquireChannel(channel: string): Promise<readonly [null, () => Promise<void>]> {
    await this.subscriber.subscribe(channel);
    return [
      null,
      async () => {
        await this.subscriber.unsubscribe(channel);
      },
    ] as const;
  }

  /**
   * Execute code via sandbox worker
   */
  async executeCode(
    params: SandboxExecuteParams,
    context: SandboxExecutionContext,
    timeout?: number,
  ): Promise<WorkerExecuteResponse> {
    const requestId = uuidv4();
    const responseChannel = `${SANDBOX_QUEUES.RESPONSE_PREFIX}${requestId}`;
    const timeoutMs = timeout || SANDBOX_TIMEOUTS.DEFAULT;

    this.logger.info({
      requestId,
      language: params.language,
      canvasId: context.canvasId,
      uid: context.uid,
      codeLength: params.code?.length,
    });

    return guard.defer(
      () => this.acquireChannel(responseChannel),
      () => this.doExecute(requestId, responseChannel, params, context, timeoutMs),
      (error) => {
        this.logger.warn({ channel: responseChannel, error }, 'Channel cleanup failed');
      },
    );
  }

  /**
   * Perform the actual execution logic
   */
  private async doExecute(
    requestId: string,
    responseChannel: string,
    params: SandboxExecuteParams,
    context: SandboxExecutionContext,
    timeoutMs: number,
  ): Promise<WorkerExecuteResponse> {
    // Build request with flattened structure matching worker's expectation
    const request: WorkerExecuteRequest = {
      requestId,
      code: params.code,
      language: params.language,
      provider: params.provider,
      config: {
        s3: context.s3Config,
        s3DrivePath: context.s3DrivePath,
        timeout: context.timeout || timeoutMs,
        limits: context.limits,
      },
      metadata: {
        uid: context.uid,
        canvasId: context.canvasId,
        parentResultId: context.parentResultId,
        targetId: context.targetId,
        targetType: context.targetType,
        model: context.model,
        providerItemId: context.providerItemId,
        version: context.version,
      },
    };

    // Publish request to queue (LPUSH ensures single consumption)
    await this.publisher.lpush(SANDBOX_QUEUES.REQUEST, JSON.stringify(request));
    this.logger.debug(`Request enqueued: requestId=${requestId}`);

    // Wait for response
    const response = await this.waitForResponse(responseChannel, requestId, timeoutMs);

    this.logger.info({
      requestId,
      status: response.status,
      exitCode: response.data?.exitCode,
      hasError: !!response.data?.error,
      filesCount: response.data?.files?.length || 0,
    });

    return response;
  }

  /**
   * Wait for worker response with timeout
   */
  private waitForResponse(
    channel: string,
    requestId: string,
    timeoutMs: number,
  ): Promise<WorkerExecuteResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(SandboxExecutionTimeoutError.create(requestId, timeoutMs));
      }, timeoutMs);

      const messageHandler = (ch: string, message: string) => {
        if (ch === channel) {
          clearTimeout(timer);
          // Remove listener after receiving response
          this.subscriber.off('message', messageHandler);

          const response = guard(() => JSON.parse(message) as WorkerExecuteResponse).orThrow(
            (error) => SandboxResponseParseError.create(requestId, error),
          );

          this.logger.debug(`Response received: requestId=${response.requestId}`);
          resolve(response);
        }
      };

      this.subscriber.on('message', messageHandler);
    });
  }
}
