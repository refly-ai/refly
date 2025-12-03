import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../common/prisma.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { QUEUE_WORKFLOW_APP_TEMPLATE } from '../../utils/const';
import type { GenerateWorkflowAppTemplateJobData } from './workflow-app.dto';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';

@Processor(QUEUE_WORKFLOW_APP_TEMPLATE)
export class WorkflowAppTemplateProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowAppTemplateProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variableExtractionService: VariableExtractionService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
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
        this.logger.warn(
          `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Missing required fields in job data: ${JSON.stringify(job.data)}`,
        );
        return;
      }

      // Fetch user to call generator with proper context
      const user = await this.prisma.user.findUnique({
        where: { uid },
      });
      if (!user) {
        this.logger.warn(
          `[${QUEUE_WORKFLOW_APP_TEMPLATE}] User not found for uid=${uid}, skip generation.`,
        );
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
        this.logger.warn(
          `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Template placeholders validation failed for appId=${appId}`,
        );
        return;
      }

      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          templateContent: templateResult?.templateContent ?? null,
          variables: JSON.stringify(variables),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Template content updated for appId=${appId}`,
      );

      // Update object storage with the new templateContent and variables
      await this.updateSharedAppStorage(user, appId, templateResult?.templateContent, variables);
    } catch (error: any) {
      this.logger.error(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Error processing job ${job.id}: ${error?.stack}`,
      );
      throw error;
    }
  }

  /**
   * Update the templateContent and variables in the shared app JSON file stored in object storage
   */
  private async updateSharedAppStorage(
    user: any,
    appId: string,
    templateContent: string | null | undefined,
    variables: any,
  ): Promise<void> {
    try {
      // Find the share record for this workflow app
      const shareRecord = await this.prisma.shareRecord.findFirst({
        where: {
          entityId: appId,
          entityType: 'workflowApp',
          deletedAt: null,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (!shareRecord?.storageKey) {
        this.logger.log(
          `[${QUEUE_WORKFLOW_APP_TEMPLATE}] No share record found for appId=${appId}, skip storage update`,
        );
        return;
      }

      // Download the existing JSON file from object storage
      const existingBuffer = await this.miscService.downloadFile({
        storageKey: shareRecord.storageKey,
        visibility: 'public',
      });

      const existingData = JSON.parse(existingBuffer.toString('utf-8'));

      // Update only the templateContent and variables fields
      const updatedData = {
        ...existingData,
        templateContent: templateContent ?? null,
        variables: Array.isArray(variables) ? variables : [],
      };

      // Re-upload the updated JSON file
      await this.miscService.uploadBuffer(user, {
        fpath: 'workflow-app.json',
        buf: Buffer.from(JSON.stringify(updatedData)),
        entityId: appId,
        entityType: 'workflowApp',
        visibility: 'public',
        storageKey: shareRecord.storageKey,
      });

      this.logger.log(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Updated storage for appId=${appId}, shareId=${shareRecord.shareId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Failed to update storage for appId=${appId}: ${error?.message}`,
      );
      // Don't throw error to avoid failing the entire job
    }
  }
}
