import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';

import { QUEUE_LAMBDA_RESULT } from '../../utils/const';
import { LambdaResultEnvelope, ResultPayload } from './lambda.dto';

/**
 * SQS to BullMQ Bridge Service
 *
 * This service polls the SQS result queue for Lambda completion messages
 * and enqueues them into BullMQ for processing by the LambdaResultProcessor.
 *
 * Architecture:
 * Lambda Function -> SQS Result Queue -> SQS Bridge -> BullMQ -> Result Handler
 *
 * Features:
 * - Long polling for efficient SQS consumption
 * - Graceful shutdown with in-flight message handling
 * - Automatic retry with exponential backoff on errors
 * - Message visibility timeout management
 * - Idempotent processing (handled by Result Handler)
 */
@Injectable()
export class SqsBridgeService implements OnModuleInit, OnModuleDestroy {
  private sqsClient: SQSClient | null = null;
  private readonly resultQueueUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxMessages: number;
  private readonly waitTimeSeconds: number;
  private readonly visibilityTimeout: number;

  private isPolling = false;
  private shouldStop = false;
  private pollTimeout: NodeJS.Timeout | null = null;
  private inFlightMessages = 0;

  constructor(
    @InjectPinoLogger(SqsBridgeService.name)
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
    @Optional()
    @InjectQueue(QUEUE_LAMBDA_RESULT)
    private readonly resultQueue?: Queue,
  ) {
    this.resultQueueUrl = this.config.get<string>('lambda.sqs.resultQueueUrl') ?? '';
    this.pollIntervalMs = this.config.get<number>('lambda.sqs.bridge.pollIntervalMs') ?? 1000;
    this.maxMessages = this.config.get<number>('lambda.sqs.bridge.maxMessages') ?? 10;
    this.waitTimeSeconds = this.config.get<number>('lambda.sqs.bridge.waitTimeSeconds') ?? 20;
    this.visibilityTimeout = this.config.get<number>('lambda.sqs.bridge.visibilityTimeout') ?? 60;

    if (this.resultQueueUrl) {
      const region = this.config.get<string>('lambda.region') || 'us-east-1';
      this.sqsClient = new SQSClient({ region });
    }
  }

  async onModuleInit() {
    if (!this.resultQueueUrl) {
      this.logger.warn('SQS Bridge disabled: resultQueueUrl not configured');
      return;
    }

    this.logger.info(
      {
        resultQueueUrl: this.resultQueueUrl,
        pollIntervalMs: this.pollIntervalMs,
        maxMessages: this.maxMessages,
        waitTimeSeconds: this.waitTimeSeconds,
      },
      'Starting SQS Bridge service',
    );

    this.startPolling();
  }

  async onModuleDestroy() {
    this.logger.info('Stopping SQS Bridge service');
    this.shouldStop = true;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    // Wait for in-flight messages to complete (max 30 seconds)
    const maxWaitMs = 30000;
    const startTime = Date.now();
    while (this.inFlightMessages > 0 && Date.now() - startTime < maxWaitMs) {
      this.logger.info(
        { inFlightMessages: this.inFlightMessages },
        'Waiting for in-flight messages',
      );
      await this.sleep(1000);
    }

    if (this.inFlightMessages > 0) {
      this.logger.warn(
        { inFlightMessages: this.inFlightMessages },
        'Shutdown with in-flight messages',
      );
    }

    this.logger.info('SQS Bridge service stopped');
  }

  /**
   * Start the polling loop
   */
  private startPolling(): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.pollLoop().catch((error) => {
      this.logger.error(
        { error: error?.message, stack: error?.stack },
        '[SQS Bridge] Poll loop crashed',
      );
      this.isPolling = false;
    });
  }

  /**
   * Main polling loop
   */
  private async pollLoop(): Promise<void> {
    while (!this.shouldStop) {
      try {
        await this.pollMessages();
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : error, stack: (error as Error)?.stack },
          '[SQS Bridge] Error in poll loop',
        );
        // Exponential backoff on error
        await this.sleep(Math.min(this.pollIntervalMs * 2, 30000));
      }

      // Small delay between poll cycles
      if (!this.shouldStop) {
        await this.sleep(this.pollIntervalMs);
      }
    }

    this.isPolling = false;
  }

  /**
   * Poll messages from SQS
   */
  private async pollMessages(): Promise<void> {
    if (!this.sqsClient) {
      return;
    }

    const command = new ReceiveMessageCommand({
      QueueUrl: this.resultQueueUrl,
      MaxNumberOfMessages: this.maxMessages,
      WaitTimeSeconds: this.waitTimeSeconds,
      VisibilityTimeout: this.visibilityTimeout,
      MessageAttributeNames: ['All'],
    });

    const response = await this.sqsClient.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    this.logger.info(
      { messageCount: response.Messages.length },
      '[SQS Bridge] Received messages from SQS',
    );

    // Process messages concurrently
    await Promise.all(response.Messages.map((msg) => this.processMessage(msg)));
  }

  /**
   * Process a single SQS message
   */
  private async processMessage(message: Message): Promise<void> {
    const messageId = message.MessageId;
    const receiptHandle = message.ReceiptHandle;

    if (!message.Body || !receiptHandle) {
      this.logger.warn({ messageId }, 'Invalid message: missing body or receipt handle');
      return;
    }

    this.inFlightMessages++;

    try {
      // Parse the envelope
      const envelope = this.parseEnvelope(message.Body);
      if (!envelope) {
        this.logger.warn({ messageId }, 'Failed to parse message envelope');
        // Delete invalid messages to prevent reprocessing
        await this.deleteMessage(receiptHandle);
        return;
      }

      const { jobId } = envelope;

      // Enqueue to BullMQ for processing
      if (!this.resultQueue) {
        this.logger.error({ messageId, jobId }, 'Result queue not available');
        return;
      }

      await this.resultQueue.add(
        'process-result',
        { envelope },
        {
          jobId: `${jobId}`, // Use jobId for deduplication
          removeOnComplete: true,
          removeOnFail: 100, // Keep last 100 failed jobs for debugging
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      // Delete message from SQS after successful enqueue
      await this.deleteMessage(receiptHandle);
    } catch (error) {
      this.logger.error({ messageId, error }, 'Error processing message');
      // Don't delete the message - it will be retried after visibility timeout
    } finally {
      this.inFlightMessages--;
    }
  }

  /**
   * Parse the message body into a result envelope
   */
  private parseEnvelope(body: string): LambdaResultEnvelope<ResultPayload> | null {
    try {
      const parsed = JSON.parse(body);

      // Validate required fields
      if (!parsed.version || !parsed.type || !parsed.jobId || !parsed.status) {
        this.logger.warn({ parsed }, 'Invalid envelope: missing required fields');
        return null;
      }

      // Validate version
      if (parsed.version !== 'v1') {
        this.logger.warn({ version: parsed.version }, 'Unknown envelope version');
        return null;
      }

      return parsed as LambdaResultEnvelope<ResultPayload>;
    } catch (error) {
      this.logger.error({ error, body: body.substring(0, 200) }, 'Failed to parse JSON');
      return null;
    }
  }

  /**
   * Delete a message from SQS
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.sqsClient) {
      return;
    }

    try {
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.resultQueueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );
    } catch (error) {
      this.logger.error({ error, receiptHandle }, 'Failed to delete message from SQS');
      // Non-fatal: message will be reprocessed after visibility timeout
      // The result handler is idempotent, so this is safe
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollTimeout = setTimeout(resolve, ms);
    });
  }

  /**
   * Get bridge status for health checks
   */
  getStatus(): {
    enabled: boolean;
    isPolling: boolean;
    inFlightMessages: number;
    queueUrl: string;
  } {
    return {
      enabled: !!this.resultQueueUrl,
      isPolling: this.isPolling,
      inFlightMessages: this.inFlightMessages,
      queueUrl: this.resultQueueUrl,
    };
  }
}
