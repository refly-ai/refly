import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

import { PrismaService } from '../common/prisma.service';
import {
  LAMBDA_JOB_STATUS_SUCCESS,
  LAMBDA_JOB_STATUS_FAILED,
  LAMBDA_JOB_STATUS_PROCESSING,
  LAMBDA_STORAGE_TYPE_PERMANENT,
} from '../../utils/const';
import {
  LambdaResultEnvelope,
  ResultPayload,
  ResultHandlerContext,
  DocumentIngestResultPayload,
  ImageTransformResultPayload,
  DocumentRenderResultPayload,
  VideoAnalyzeResultPayload,
} from './lambda.dto';

@Injectable()
export class LambdaResultHandlerService {
  private s3Client: S3Client | null = null;
  private readonly lambdaEnabled: boolean;
  private readonly s3Bucket: string;

  constructor(
    @InjectPinoLogger(LambdaResultHandlerService.name)
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.lambdaEnabled = this.config.get<boolean>('lambda.enabled') || false;
    this.s3Bucket = this.config.get<string>('lambda.s3.bucket') || 'refly-weblink';

    if (this.lambdaEnabled) {
      const region = this.config.get<string>('lambda.region') || 'us-east-1';
      this.s3Client = new S3Client({ region });
    }
  }

  /**
   * Process a result envelope from Lambda
   * This is the main entry point for handling Lambda results
   */
  async processResult(envelope: LambdaResultEnvelope<ResultPayload>): Promise<void> {
    const { jobId, type, status } = envelope;

    // Idempotent check - only process if job is in pending/processing state
    const job = await this.prisma.lambdaJob.findUnique({
      where: { jobId },
    });

    if (!job) {
      this.logger.warn({ jobId }, 'Job not found, skipping result processing');
      return;
    }

    // Skip if already in terminal state (idempotency)
    if (job.status === LAMBDA_JOB_STATUS_SUCCESS || job.status === LAMBDA_JOB_STATUS_FAILED) {
      return;
    }

    const context: ResultHandlerContext = {
      jobId,
      type,
      uid: job.uid,
      resourceId: job.resourceId ?? undefined,
      fileId: job.fileId ?? undefined,
      canvasId: job.canvasId ?? undefined,
    };

    if (status === 'failed') {
      await this.handleFailure(context, envelope.error);
      return;
    }

    // Route to appropriate handler based on type
    try {
      switch (type) {
        case 'document-ingest':
          await this.handleDocumentIngestResult(
            context,
            envelope.payload as DocumentIngestResultPayload,
          );
          break;
        case 'image-transform':
          await this.handleImageTransformResult(
            context,
            envelope.payload as ImageTransformResultPayload,
          );
          break;
        case 'document-render':
          await this.handleDocumentRenderResult(
            context,
            envelope.payload as DocumentRenderResultPayload,
          );
          break;
        case 'video-analyze':
          await this.handleVideoAnalyzeResult(
            context,
            envelope.payload as VideoAnalyzeResultPayload,
          );
          break;
        default:
          this.logger.warn({ type }, 'Unknown task type');
      }
    } catch (error) {
      this.logger.error({ jobId, error }, 'Error processing result');
      await this.handleFailure(context, {
        code: 'RESULT_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      });
    }
  }

  /**
   * Handle document ingest result
   */
  private async handleDocumentIngestResult(
    context: ResultHandlerContext,
    payload: DocumentIngestResultPayload,
  ): Promise<void> {
    // Update job with result
    await this.prisma.lambdaJob.update({
      where: { jobId: context.jobId },
      data: {
        status: LAMBDA_JOB_STATUS_SUCCESS,
        storageKey: payload.document.key,
        name: payload.document.name,
        mimeType: payload.document.mimeType,
        metadata: JSON.stringify({
          ...payload.metadata,
          size: payload.document.size,
          documentMetadata: payload.document.metadata,
          images: payload.images,
        }),
        durationMs: 0, // Will be updated from envelope meta if available
      },
    });

    // TODO: If there's a resourceId, emit event or enqueue finalization job for RAG indexing
  }

  /**
   * Handle image transform result
   */
  private async handleImageTransformResult(
    context: ResultHandlerContext,
    payload: ImageTransformResultPayload,
  ): Promise<void> {
    await this.prisma.lambdaJob.update({
      where: { jobId: context.jobId },
      data: {
        status: LAMBDA_JOB_STATUS_SUCCESS,
        storageKey: payload.image.key,
        name: payload.image.name,
        mimeType: payload.image.mimeType,
        metadata: JSON.stringify({
          ...payload.metadata,
          size: payload.image.size,
          imageMetadata: payload.image.metadata,
          thumbnail: payload.thumbnail,
        }),
      },
    });

    // Update the file record if fileId is available
    if (context.fileId) {
      await this.updateDriveFile(context.fileId, payload.image.key, payload.image.size);
    }
  }

  /**
   * Handle document render result
   */
  private async handleDocumentRenderResult(
    context: ResultHandlerContext,
    payload: DocumentRenderResultPayload,
  ): Promise<void> {
    await this.prisma.lambdaJob.update({
      where: { jobId: context.jobId },
      data: {
        status: LAMBDA_JOB_STATUS_SUCCESS,
        storageKey: payload.document.key,
        name: payload.document.name,
        mimeType: payload.document.mimeType,
        metadata: JSON.stringify({
          ...payload.metadata,
          size: payload.document.size,
          documentMetadata: payload.document.metadata,
        }),
      },
    });

    // Update the file record if fileId is available
    if (context.fileId) {
      await this.updateDriveFile(context.fileId, payload.document.key, payload.document.size);
    }
  }

  /**
   * Handle video analyze result
   */
  private async handleVideoAnalyzeResult(
    context: ResultHandlerContext,
    payload: VideoAnalyzeResultPayload,
  ): Promise<void> {
    const primaryOutput = payload.thumbnail ?? payload.audio;

    await this.prisma.lambdaJob.update({
      where: { jobId: context.jobId },
      data: {
        status: LAMBDA_JOB_STATUS_SUCCESS,
        storageKey: primaryOutput?.key,
        name: primaryOutput?.name,
        mimeType: primaryOutput?.mimeType,
        metadata: JSON.stringify({
          ...payload.metadata,
          thumbnail: payload.thumbnail,
          audio: payload.audio,
        }),
      },
    });

    // TODO: If there's a resourceId, trigger further processing
  }

  /**
   * Handle failure case
   */
  private async handleFailure(
    context: ResultHandlerContext,
    error?: { code: string; message: string; retryable: boolean },
  ): Promise<void> {
    await this.prisma.lambdaJob.update({
      where: { jobId: context.jobId },
      data: {
        status: LAMBDA_JOB_STATUS_FAILED,
        error: error ? `${error.code}: ${error.message}` : 'Unknown error',
      },
    });

    // If there's a fileId, mark the file as failed
    if (context.fileId) {
      await this.markDriveFileFailed(context.fileId, error?.message || 'Lambda processing failed');
    }
  }

  /**
   * Update DriveFile record with result
   */
  private async updateDriveFile(fileId: string, storageKey: string, size?: number): Promise<void> {
    try {
      await this.prisma.driveFile.update({
        where: { fileId },
        data: {
          storageKey,
          ...(size !== undefined && { size: BigInt(size) }),
        },
      });
    } catch (error) {
      this.logger.error({ fileId, error }, 'Failed to update DriveFile');
    }
  }

  /**
   * Mark DriveFile as failed
   * Note: DriveFile doesn't have an uploadStatus field.
   * The status is tracked via the LambdaJob table instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async markDriveFileFailed(_fileId: string, _errorMessage: string): Promise<void> {
    // DriveFile doesn't have an uploadStatus field
    // The failure is tracked in LambdaJob table
    // We could optionally delete the pre-created DriveFile here, but leaving it
    // allows users to see that there was an attempted upload
  }

  /**
   * Persist temporary result to permanent storage
   * This is called when a user wants to keep a result permanently
   */
  async persistResult(jobId: string): Promise<{ storageKey: string } | null> {
    const job = await this.prisma.lambdaJob.findUnique({
      where: { jobId },
    });

    if (!job) {
      this.logger.warn({ jobId }, 'Job not found for persistence');
      return null;
    }

    if (job.status !== LAMBDA_JOB_STATUS_SUCCESS) {
      this.logger.warn({ jobId, status: job.status }, 'Cannot persist non-successful job');
      return null;
    }

    if (job.storageType === LAMBDA_STORAGE_TYPE_PERMANENT) {
      this.logger.info({ jobId }, 'Job already persisted');
      return { storageKey: job.storageKey! };
    }

    if (!job.storageKey || !this.s3Client) {
      this.logger.error({ jobId }, 'Cannot persist: no storage key or S3 client');
      return null;
    }

    try {
      // Copy from temporary to permanent location
      const tempKey = job.storageKey;
      const permanentKey = tempKey.replace('lambda-output/', 'drive/');

      await this.s3Client.send(
        new CopyObjectCommand({
          Bucket: this.s3Bucket,
          CopySource: `${this.s3Bucket}/${tempKey}`,
          Key: permanentKey,
        }),
      );

      // Update job record
      await this.prisma.lambdaJob.update({
        where: { jobId },
        data: {
          storageKey: permanentKey,
          storageType: LAMBDA_STORAGE_TYPE_PERMANENT,
        },
      });

      // Optionally delete the temporary file
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: tempKey,
        }),
      );

      return { storageKey: permanentKey };
    } catch (error) {
      this.logger.error({ jobId, error }, 'Failed to persist result');
      return null;
    }
  }

  /**
   * Mark job as processing (when Lambda picks up the task)
   */
  async markJobProcessing(jobId: string): Promise<void> {
    await this.prisma.lambdaJob.update({
      where: { jobId },
      data: {
        status: LAMBDA_JOB_STATUS_PROCESSING,
      },
    });
  }
}
