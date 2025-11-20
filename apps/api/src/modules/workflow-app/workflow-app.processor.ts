import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../common/prisma.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { QUEUE_WORKFLOW_APP_TEMPLATE } from '../../utils/const';
import type { GenerateWorkflowAppTemplateJobData } from './workflow-app.dto';
import { safeParseJSON } from '@refly/utils';

@Processor(QUEUE_WORKFLOW_APP_TEMPLATE)
export class WorkflowAppTemplateProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowAppTemplateProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variableExtractionService: VariableExtractionService,
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

      // Fetch workflow app to access variables for validation
      const workflowApp = await this.prisma.workflowApp.findUnique({
        where: { appId, uid, deletedAt: null },
      } as any);

      if (!workflowApp) {
        this.logger.warn(
          `[${QUEUE_WORKFLOW_APP_TEMPLATE}] Workflow app not found for appId=${appId}, skip.`,
        );
        return;
      }

      const variables = safeParseJSON(workflowApp.variables) ?? [];

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
            (variables?.every?.((v: any) =>
              placeholders?.includes?.(`{{${v?.name ?? ''}}}`),
            ) ?? false)
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


