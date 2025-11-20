import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { SkillModule } from '../skill/skill.module';
import { ActionModule } from '../action/action.module';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { RunWorkflowProcessor, PollWorkflowProcessor } from './workflow.processor';
import { QUEUE_RUN_WORKFLOW, QUEUE_POLL_WORKFLOW } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    CanvasSyncModule,
    SkillModule,
    ActionModule,
    CreditModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_RUN_WORKFLOW }),
          BullModule.registerQueue({ name: QUEUE_POLL_WORKFLOW }),
        ]),
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    ...(isDesktop() ? [] : [RunWorkflowProcessor, PollWorkflowProcessor]),
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
