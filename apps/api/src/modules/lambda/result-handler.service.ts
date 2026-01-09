import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { readingTime } from 'reading-time-estimator';

import { truncateContent } from '@refly/utils/token';
import {
  LAMBDA_JOB_STATUS_FAILED,
  LAMBDA_JOB_STATUS_PROCESSING,
  LAMBDA_JOB_STATUS_SUCCESS,
  LAMBDA_STORAGE_TYPE_PERMANENT,
} from '../../utils/const';
import { OSS_INTERNAL, ObjectStorageService } from '../common/object-storage';
import { PrismaService } from '../common/prisma.service';
import {
  DocumentIngestResultPayload,
  DocumentRenderResultPayload,
  ImageTransformResultPayload,
  LambdaResultEnvelope,
  ResultHandlerContext,
  ResultPayload,
  VideoAnalyzeResultPayload,
} from './lambda.dto';

@Injectable()
export class LambdaResultHandlerService {
  private s3Client: S3Client | null = null;
  private readonly s3Bucket: string;

  constructor(
    @InjectPinoLogger(LambdaResultHandlerService.name)
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(OSS_INTERNAL) private readonly internalOss: ObjectStorageService,
  ) {
    this.s3Bucket = this.config.get<string>('lambda.s3.bucket') || 'refly-weblink';
    const region = this.config.get<string>('lambda.region') || 'us-east-1';
    this.s3Client = new S3Client({ region });
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
      fileId: job.fileId ?? undefined,
      resultId: job.resultId ?? undefined,
      resultVersion: job.resultVersion ?? undefined,
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
    const { jobId, uid, fileId } = context;

    // Update job with result
    await this.prisma.lambdaJob.update({
      where: { jobId },
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
        durationMs: 0,
      },
    });

    // Persist content to MinIO cache if fileId exists
    if (fileId) {
      await this.persistContentToCache(uid, fileId, payload);
    }
  }

  /**
   * Persist parsed content to MinIO and update DriveFileParseCache
   */
  private async persistContentToCache(
    uid: string,
    fileId: string,
    payload: DocumentIngestResultPayload,
  ): Promise<void> {
    try {
      // 1. Read content from AWS S3
      const content = await this.getS3Content(payload.document.key);
      if (!content) {
        this.logger.error({ fileId, key: payload.document.key }, 'Failed to read Lambda output');
        return;
      }

      // 2. Process content
      const cleanContent = content.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
      // Storage limit is higher than read limit to preserve more content
      const maxStorageTokens = this.config.get<number>('drive.maxStorageTokens') || 100000;
      const truncatedContent = truncateContent(cleanContent, maxStorageTokens);

      // 3. Check if content was truncated
      const isTruncated = truncatedContent.includes('[... truncated ...]');

      // 4. Save to MinIO
      const cacheKey = `drive-parsed/${uid}/${fileId}.txt`;
      await this.internalOss.putObject(cacheKey, truncatedContent);

      // 5. Update DriveFileParseCache with truncation status in metadata
      const wordCount = payload.metadata?.wordCount || readingTime(truncatedContent).words;
      const cacheMetadata = JSON.stringify({ truncated: isTruncated });

      await this.prisma.driveFileParseCache.upsert({
        where: { fileId },
        create: {
          fileId,
          uid,
          contentStorageKey: cacheKey,
          contentType: payload.document.mimeType,
          parser: 'lambda',
          numPages: payload.metadata?.pageCount || null,
          wordCount,
          parseStatus: 'success',
          metadata: cacheMetadata,
        },
        update: {
          contentStorageKey: cacheKey,
          parser: 'lambda',
          numPages: payload.metadata?.pageCount || null,
          wordCount,
          parseStatus: 'success',
          parseError: null,
          metadata: cacheMetadata,
          updatedAt: new Date(),
        },
      });

      this.logger.info({ fileId, cacheKey, wordCount, isTruncated }, 'Content persisted to cache');
    } catch (error) {
      this.logger.error({ fileId, error }, 'Failed to persist content to cache');
      // Update cache with error status
      await this.prisma.driveFileParseCache.upsert({
        where: { fileId },
        create: {
          fileId,
          uid,
          contentStorageKey: '',
          contentType: '',
          parser: 'lambda',
          parseStatus: 'failed',
          parseError: JSON.stringify({ message: (error as Error).message }),
        },
        update: {
          parseStatus: 'failed',
          parseError: JSON.stringify({ message: (error as Error).message }),
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Read content from AWS S3
   */
  private async getS3Content(key: string): Promise<string | null> {
    if (!this.s3Client) return null;

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.s3Bucket, Key: key }),
      );
      if (!response.Body) return null;

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf-8');
    } catch (error) {
      this.logger.error({ key, error }, 'Failed to read from S3');
      return null;
    }
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

    // TODO: If there's a fileId, trigger further processing
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
