import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../common/prisma.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { QUEUE_WORKFLOW_APP_TEMPLATE } from '../../utils/const';
import type { GenerateWorkflowAppTemplateJobData } from './workflow-app.dto';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { OSS_EXTERNAL, ObjectStorageService } from '../common/object-storage';

@Processor(QUEUE_WORKFLOW_APP_TEMPLATE)
export class WorkflowAppTemplateProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowAppTemplateProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variableExtractionService: VariableExtractionService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
    @Inject(OSS_EXTERNAL) private readonly externalOss: ObjectStorageService,
  ) {
    super();
  }

  async process(job: Job<GenerateWorkflowAppTemplateJobData>) {
    const { appId, canvasId, uid } = job.data ?? {};
    this.logger.log(
      `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Start generating template for appId=${appId}, canvasId=${canvasId}, uid=${uid}`,
    );

    try {
      // Validate required inputs
      if (!appId || !canvasId || !uid) {
        const errorMsg = `Missing required fields in job data: ${JSON.stringify(job.data)}`;
        this.logger.warn(`[${QUEUE_WORKFLOW_APP_TEMPLATE}] ${errorMsg}`);
        await this.updateGenerationStatus(appId, 'failed', errorMsg);
        return;
      }

      // Update status to 'generating'
      await this.updateGenerationStatus(appId, 'generating');

      // Fetch user to call generator with proper context
      const user = await this.prisma.user.findUnique({
        where: { uid },
      });
      if (!user) {
        const errorMsg = `User not found for uid=${uid}`;
        this.logger.warn(`[${QUEUE_WORKFLOW_APP_TEMPLATE}] ${errorMsg}, skip generation.`);
        await this.updateGenerationStatus(appId, 'failed', errorMsg);
        return;
      }

      // Get workflow variables from Canvas service
      const variables = await this.canvasService.getWorkflowVariables(user, {
        canvasId,
      });

      const templateResult = await this.variableExtractionService.generateAppPublishTemplate(
        user,
        canvasId,
      );

      this.logger.log(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Generation result for appId=${appId}: ${JSON.stringify(templateResult)}`,
      );

      const placeholders = templateResult?.templateContentPlaceholders ?? [];
      const isValid =
        !!templateResult?.templateContent &&
        (Array.isArray(variables)
          ? placeholders?.length === variables?.length &&
            (variables?.every?.((v: any) => placeholders?.includes?.(`{{${v?.name ?? ''}}}`)) ??
              false)
          : true);

      if (!isValid) {
        const errorMsg = `Template placeholders validation failed. Expected ${variables?.length ?? 0} placeholders, got ${placeholders?.length ?? 0}`;
        this.logger.warn(`[${QUEUE_WORKFLOW_APP_TEMPLATE}] ${errorMsg} for appId=${appId}`);
        await this.updateGenerationStatus(appId, 'failed', errorMsg);
        return;
      }

      // Update database with template content and status
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          templateContent: templateResult?.templateContent ?? null,
          variables: JSON.stringify(variables),
          templateGenerationStatus: 'completed',
          templateGenerationError: null,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Template content updated for appId=${appId}`,
      );

      // Update object storage with the new templateContent and variables
      await this.updateSharedAppStorage(appId, templateResult?.templateContent, variables);
    } catch (error: any) {
      const errorMsg = error?.message ?? 'Unknown error during template generation';
      this.logger.error(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Error processing job ${job.id}: ${error?.stack}`,
      );
      await this.updateGenerationStatus(appId, 'failed', errorMsg);
      throw error;
    }
  }

  /**
   * Update template generation status in database
   */
  private async updateGenerationStatus(
    appId: string | undefined,
    status: 'generating' | 'completed' | 'failed',
    error?: string,
  ): Promise<void> {
    if (!appId) return;

    try {
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          templateGenerationStatus: status,
          templateGenerationError: error ?? null,
          updatedAt: new Date(),
        },
      });
    } catch (err: any) {
      this.logger.error(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Failed to update status for appId=${appId}: ${err?.message}`,
      );
    }
  }

  /**
   * Update the templateContent and variables in the shared app JSON file stored in object storage
   */
  private async updateSharedAppStorage(
    appId: string,
    templateContent: string | null | undefined,
    variables: any,
  ): Promise<void> {
    try {
      // Find all share records for this workflow app (regular share + template share)
      const shareRecords = await this.prisma.shareRecord.findMany({
        where: {
          entityId: appId,
          entityType: 'workflowApp',
          deletedAt: null,
        },
      });

      if (!shareRecords?.length) {
        this.logger.log(
          `[${QUEUE_WORKFLOW_APP_TEMPLATE}] No share records found for appId=${appId}, skip storage update`,
        );
        return;
      }

      // Update all share records (could be regular share and/or template share)
      for (const shareRecord of shareRecords) {
        if (!shareRecord?.storageKey) {
          this.logger.warn(
            `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Share record ${shareRecord.shareId} has no storageKey, skip`,
          );
          continue;
        }

        try {
          // Download the existing JSON file from object storage
          const existingBuffer = await this.miscService.downloadFile({
            storageKey: shareRecord.storageKey,
            visibility: 'public',
          });

          const existingData = JSON.parse(existingBuffer.toString('utf-8'));

          // Validate existingData is an object
          if (!existingData || typeof existingData !== 'object' || Array.isArray(existingData)) {
            this.logger.warn(
              `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Invalid JSON structure in ${shareRecord.storageKey}, skip`,
            );
            continue;
          }

          // Update only the templateContent and variables fields
          const updatedData = {
            ...existingData,
            templateContent: templateContent ?? null,
            variables: Array.isArray(variables) ? variables : [],
          };

          // Directly update object storage using putObject to avoid creating duplicate staticFile records
          const jsonBuffer = Buffer.from(JSON.stringify(updatedData));
          await this.externalOss.putObject(shareRecord.storageKey, jsonBuffer, {
            'Content-Type': 'application/json',
          });

          this.logger.log(
            `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Updated storage for appId=${appId}, shareId=${shareRecord.shareId}`,
          );
        } catch (error: any) {
          this.logger.error(
            `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Failed to update storage for shareId=${shareRecord.shareId}: ${error?.message}`,
            error?.stack,
          );
          // Continue to next share record even if one fails
        }
      }
    } catch (error: any) {
      this.logger.error(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Failed to update storage for appId=${appId}: ${error?.message}`,
        error?.stack,
      );
      // Don't throw error to avoid failing the entire job
    }
  }
}
