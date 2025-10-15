import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { SkillModule } from '../skill/skill.module';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { SyncWorkflowProcessor, RunWorkflowProcessor } from './workflow.processor';
import { DailyNewsWorkflowService } from './daily-news-workflow.service';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    CanvasSyncModule,
    SkillModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_SYNC_WORKFLOW }),
          BullModule.registerQueue({ name: QUEUE_RUN_WORKFLOW }),
        ]),
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    DailyNewsWorkflowService,
    ...(isDesktop() ? [] : [SyncWorkflowProcessor, RunWorkflowProcessor]),
  ],
  exports: [WorkflowService, DailyNewsWorkflowService],
})
export class WorkflowModule {}
