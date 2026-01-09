import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'node:stream';

import { PrismaService } from '../common/prisma.service';
import {
  QUEUE_LAMBDA_DOC_INGEST,
  QUEUE_LAMBDA_IMAGE_TRANSFORM,
  QUEUE_LAMBDA_DOC_RENDER,
  QUEUE_LAMBDA_VIDEO_ANALYZE,
  LAMBDA_JOB_STATUS_PENDING,
  LAMBDA_JOB_STATUS_FAILED,
  LAMBDA_STORAGE_TYPE_TEMPORARY,
} from '../../utils/const';
import {
  LambdaTaskType,
  LambdaTaskEnvelope,
  DispatchDocumentIngestParams,
  DispatchImageTransformParams,
  DispatchDocumentRenderParams,
  DispatchVideoAnalyzeParams,
  DocumentIngestTaskPayload,
  ImageTransformTaskPayload,
  DocumentRenderTaskPayload,
  VideoAnalyzeTaskPayload,
  LambdaJobRecord,
} from './lambda.dto';

@Injectable()
export class LambdaService {
  private sqsClient: SQSClient | null = null;
  private s3Client: S3Client | null = null;
  private readonly s3Bucket: string;
  private readonly outputPrefix: string;

  constructor(
    @InjectPinoLogger(LambdaService.name)
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(QUEUE_LAMBDA_DOC_INGEST)
    private readonly docIngestQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_LAMBDA_IMAGE_TRANSFORM)
    private readonly imageTransformQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_LAMBDA_DOC_RENDER)
    private readonly docRenderQueue?: Queue,
    @Optional()
    @InjectQueue(QUEUE_LAMBDA_VIDEO_ANALYZE)
    private readonly videoAnalyzeQueue?: Queue,
  ) {
    this.s3Bucket = this.config.get<string>('lambda.s3.bucket') || 'refly-weblink';
    this.outputPrefix = this.config.get<string>('lambda.s3.outputPrefix') || 'lambda-output';

    const region = this.config.get<string>('lambda.region') || 'us-east-1';
    this.sqsClient = new SQSClient({ region });
    this.s3Client = new S3Client({ region });
    this.logger.info(`Lambda service initialized with region: ${region}`);
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    return `lj-${uuidv4()}`;
  }

  /**
   * Build S3 output prefix for a job
   */
  private buildOutputPrefix(type: LambdaTaskType, jobId: string): string {
    return `${this.outputPrefix}/${type}/${jobId}`;
  }

  /**
   * Create a LambdaJob record in the database
   */
  private async createJobRecord(params: {
    jobId: string;
    type: LambdaTaskType;
    uid: string;
    name?: string;
    mimeType?: string;
    fileId?: string;
    resultId?: string;
    resultVersion?: number;
  }): Promise<LambdaJobRecord> {
    const job = await this.prisma.lambdaJob.create({
      data: {
        jobId: params.jobId,
        type: params.type,
        uid: params.uid,
        status: LAMBDA_JOB_STATUS_PENDING,
        name: params.name,
        mimeType: params.mimeType,
        storageType: LAMBDA_STORAGE_TYPE_TEMPORARY,
        fileId: params.fileId,
        resultId: params.resultId,
        resultVersion: params.resultVersion,
      },
    });

    return job as unknown as LambdaJobRecord;
  }

  /**
   * Mark a job as failed
   */
  private async markJobFailed(jobId: string, error: string): Promise<void> {
    await this.prisma.lambdaJob.update({
      where: { jobId },
      data: {
        status: LAMBDA_JOB_STATUS_FAILED,
        error,
      },
    });
  }

  /**
   * Send task message to SQS
   */
  private async sendToSQS<TPayload>(
    queueUrl: string,
    envelope: LambdaTaskEnvelope<TPayload>,
  ): Promise<void> {
    if (!this.sqsClient) {
      throw new Error('SQS client not initialized');
    }

    this.logger.info(
      { queueUrl, jobId: envelope.jobId, type: envelope.type },
      'Sending message to SQS',
    );

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(envelope),
      MessageAttributes: {
        task_type: {
          DataType: 'String',
          StringValue: envelope.type,
        },
        job_id: {
          DataType: 'String',
          StringValue: envelope.jobId,
        },
      },
    });

    const result = await this.sqsClient.send(command);
    this.logger.info(
      { jobId: envelope.jobId, messageId: result.MessageId },
      'SQS message sent successfully',
    );
  }

  /**
   * Get SQS queue URL for a task type
   */
  private getQueueUrl(type: LambdaTaskType): string {
    const urlMap: Record<LambdaTaskType, string> = {
      'document-ingest': this.config.get<string>('lambda.sqs.docIngestQueueUrl') || '',
      'image-transform': this.config.get<string>('lambda.sqs.imageTransformQueueUrl') || '',
      'document-render': this.config.get<string>('lambda.sqs.documentRenderQueueUrl') || '',
      'video-analyze': this.config.get<string>('lambda.sqs.videoAnalyzeQueueUrl') || '',
    };

    const url = urlMap[type];
    if (!url) {
      throw new Error(`SQS queue URL not configured for type: ${type}`);
    }
    return url;
  }

  /**
   * Dispatch a document ingest task
   */
  async dispatchDocumentIngest(params: DispatchDocumentIngestParams): Promise<LambdaJobRecord> {
    const jobId = this.generateJobId();
    const type: LambdaTaskType = 'document-ingest';

    // 1. Create job record in DB first (before dispatch)
    const job = await this.createJobRecord({
      jobId,
      type,
      uid: params.uid,
      name: params.name,
      mimeType: params.contentType,
      fileId: params.fileId,
      resultId: params.resultId,
      resultVersion: params.resultVersion,
    });

    try {
      // 2. Build task payload
      const payload: DocumentIngestTaskPayload = {
        s3Input: params.s3Input,
        s3Output: {
          bucket: params.outputBucket,
          prefix: this.buildOutputPrefix(type, jobId),
        },
        fileId: params.fileId,
        contentType: params.contentType,
        name: params.name,
        options: params.options,
      };

      // 3. Build envelope
      const envelope: LambdaTaskEnvelope<DocumentIngestTaskPayload> = {
        version: 'v1',
        type,
        jobId,
        uid: params.uid,
        payload,
        meta: {
          createdAt: new Date().toISOString(),
        },
      };

      // 4. Send to SQS
      await this.sendToSQS(this.getQueueUrl(type), envelope);

      return job;
    } catch (error) {
      this.logger.error({ jobId, error }, 'Failed to dispatch document ingest task');
      await this.markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Dispatch an image transform task
   */
  async dispatchImageTransform(params: DispatchImageTransformParams): Promise<LambdaJobRecord> {
    const jobId = this.generateJobId();
    const type: LambdaTaskType = 'image-transform';

    const job = await this.createJobRecord({
      jobId,
      type,
      uid: params.uid,
      name: params.name,
      fileId: params.fileId,
      resultId: params.resultId,
      resultVersion: params.resultVersion,
    });

    try {
      const payload: ImageTransformTaskPayload = {
        s3Input: params.s3Input,
        s3Output: {
          bucket: params.outputBucket,
          prefix: this.buildOutputPrefix(type, jobId),
        },
        fileId: params.fileId,
        name: params.name,
        options: params.options || {
          format: 'webp',
          quality: 80,
          maxWidth: 1920,
          maxHeight: 1080,
        },
      };

      const envelope: LambdaTaskEnvelope<ImageTransformTaskPayload> = {
        version: 'v1',
        type,
        jobId,
        uid: params.uid,
        payload,
        meta: {
          createdAt: new Date().toISOString(),
        },
      };

      await this.sendToSQS(this.getQueueUrl(type), envelope);

      return job;
    } catch (error) {
      this.logger.error({ jobId, error }, 'Failed to dispatch image transform task');
      await this.markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Dispatch a document render task
   */
  async dispatchDocumentRender(params: DispatchDocumentRenderParams): Promise<LambdaJobRecord> {
    const jobId = this.generateJobId();
    const type: LambdaTaskType = 'document-render';

    const job = await this.createJobRecord({
      jobId,
      type,
      uid: params.uid,
      name: params.name,
      fileId: params.fileId,
      resultId: params.resultId,
      resultVersion: params.resultVersion,
    });

    try {
      const payload: DocumentRenderTaskPayload = {
        s3Input: params.s3Input,
        s3Output: {
          bucket: params.outputBucket,
          prefix: this.buildOutputPrefix(type, jobId),
        },
        fileId: params.fileId,
        name: params.name,
        options: {
          format: params.format,
          ...params.options,
        },
      };

      const envelope: LambdaTaskEnvelope<DocumentRenderTaskPayload> = {
        version: 'v1',
        type,
        jobId,
        uid: params.uid,
        payload,
        meta: {
          createdAt: new Date().toISOString(),
        },
      };

      await this.sendToSQS(this.getQueueUrl(type), envelope);

      return job;
    } catch (error) {
      this.logger.error({ jobId, error }, 'Failed to dispatch document render task');
      await this.markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Dispatch a video analyze task
   */
  async dispatchVideoAnalyze(params: DispatchVideoAnalyzeParams): Promise<LambdaJobRecord> {
    const jobId = this.generateJobId();
    const type: LambdaTaskType = 'video-analyze';

    const job = await this.createJobRecord({
      jobId,
      type,
      uid: params.uid,
      name: params.name,
      fileId: params.fileId,
      resultId: params.resultId,
      resultVersion: params.resultVersion,
    });

    try {
      const defaultFrameCount =
        this.config.get<number>('lambda.videoAnalyze.defaultFrameCount') || 10;
      const maxDuration = this.config.get<number>('lambda.videoAnalyze.maxDuration') || 600;

      const payload: VideoAnalyzeTaskPayload = {
        s3Input: params.s3Input,
        s3Output: {
          bucket: params.outputBucket,
          prefix: this.buildOutputPrefix(type, jobId),
        },
        fileId: params.fileId,
        name: params.name,
        options: {
          frameCount: params.options?.frameCount ?? defaultFrameCount,
          frameFormat: params.options?.frameFormat ?? 'jpeg',
          extractAudio: params.options?.extractAudio ?? false,
          maxDuration: params.options?.maxDuration ?? maxDuration,
        },
      };

      const envelope: LambdaTaskEnvelope<VideoAnalyzeTaskPayload> = {
        version: 'v1',
        type,
        jobId,
        uid: params.uid,
        payload,
        meta: {
          createdAt: new Date().toISOString(),
        },
      };

      await this.sendToSQS(this.getQueueUrl(type), envelope);

      return job;
    } catch (error) {
      this.logger.error({ jobId, error }, 'Failed to dispatch video analyze task');
      await this.markJobFailed(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<LambdaJobRecord | null> {
    const job = await this.prisma.lambdaJob.findUnique({
      where: { jobId },
    });
    return job as unknown as LambdaJobRecord | null;
  }

  /**
   * Get job status with effective status calculation
   */
  async getJobStatus(jobId: string): Promise<{
    job: LambdaJobRecord | null;
    effectiveStatus: string | null;
  }> {
    const job = await this.getJob(jobId);
    if (!job) {
      return { job: null, effectiveStatus: null };
    }

    let effectiveStatus: string;
    if (job.status === 'failed') {
      effectiveStatus = 'FAILED';
    } else if (job.status === 'success') {
      effectiveStatus = job.storageType === 'temporary' ? 'PENDING_PERSIST' : 'COMPLETED';
    } else if (job.status === 'processing') {
      effectiveStatus = 'PROCESSING';
    } else {
      effectiveStatus = 'PENDING';
    }

    return { job, effectiveStatus };
  }

  /**
   * List jobs by user with pagination
   */
  async listJobsByUser(
    uid: string,
    options?: {
      type?: LambdaTaskType;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<LambdaJobRecord[]> {
    const jobs = await this.prisma.lambdaJob.findMany({
      where: {
        uid,
        ...(options?.type && { type: options.type }),
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });
    return jobs as unknown as LambdaJobRecord[];
  }

  /**
   * Get job output content from Lambda's S3 bucket
   * This reads from AWS S3 where Lambda writes its output
   */
  async getJobOutput(storageKey: string): Promise<Readable | null> {
    if (!this.s3Client) {
      this.logger.warn('S3 client not initialized, cannot get job output');
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        this.logger.warn({ storageKey }, 'No body in S3 response');
        return null;
      }

      // Convert SDK stream to Node.js Readable
      return response.Body as Readable;
    } catch (error) {
      this.logger.error({ storageKey, error }, 'Failed to get job output from S3');
      throw error;
    }
  }

  /**
   * Get job output as string from Lambda's S3 bucket
   */
  async getJobOutputAsString(storageKey: string): Promise<string | null> {
    const stream = await this.getJobOutput(storageKey);
    if (!stream) {
      return null;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
