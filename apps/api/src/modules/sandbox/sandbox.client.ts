import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
import { SANDBOX_CHANNELS, SANDBOX_TIMEOUTS } from './sandbox.constants';
import { SandboxExecutionTimeoutError, SandboxResponseParseError } from './sandbox.exception';
import { guard } from '../../utils/guard';

/**
 * Sandbox Worker Redis Pub/Sub Client
 *
 * Handles communication with refly-sandbox worker via Redis Pub/Sub
 * Protocol: sandbox:execute:request -> sandbox:execute:response:{requestId}
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
    // Get Redis clients
    const client = this.redisService.getClient();
    this.publisher = client;
    this.subscriber = client.duplicate();

    this.logger.info('SandboxClient initialized');
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    this.logger.info('SandboxClient destroyed');
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
    const responseChannel = `${SANDBOX_CHANNELS.RESPONSE_PREFIX}${requestId}`;
    const timeoutMs = timeout || SANDBOX_TIMEOUTS.DEFAULT;

    this.logger.info({
      requestId,
      language: params.language,
      canvasId: context.canvasId,
      uid: context.uid,
      codeLength: params.code?.length,
    });

    try {
      // Subscribe to response channel
      await this.subscriber.subscribe(responseChannel);

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

      // Publish request
      await this.publisher.publish(SANDBOX_CHANNELS.REQUEST, JSON.stringify(request));
      this.logger.debug(`Request published: requestId=${requestId}`);

      // Wait for response
      const response = await this.waitForResponse(responseChannel, requestId, timeoutMs);

      // Cleanup
      await this.subscriber.unsubscribe(responseChannel);

      this.logger.info({
        requestId,
        status: response.status,
        exitCode: response.data?.exitCode,
        hasError: !!response.data?.error,
        filesCount: response.data?.files?.length || 0,
      });

      return response;
    } catch (error) {
      this.logger.error({
        requestId,
        error: error.message,
        stack: error.stack,
      });

      // Cleanup on error
      await this.subscriber.unsubscribe(responseChannel).catch(() => {
        // Ignore unsubscribe errors
      });

      throw error;
    }
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
