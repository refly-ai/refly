import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../common/prisma.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { QUEUE_WORKFLOW_APP_TEMPLATE } from '../../utils/const';
import type { GenerateWorkflowAppTemplateJobData } from './workflow-app.dto';
import { CanvasService } from '../canvas/canvas.service';

@Processor(QUEUE_WORKFLOW_APP_TEMPLATE)
export class WorkflowAppTemplateProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowAppTemplateProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variableExtractionService: VariableExtractionService,
    private readonly canvasService: CanvasService,
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
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Template content updated for appId=${appId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Error processing job ${job.id}: ${error?.stack}`,
      );
      throw error;
    }
  }
}
