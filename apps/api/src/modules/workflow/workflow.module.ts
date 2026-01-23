import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { SkillModule } from '../skill/skill.module';
import { ToolModule } from '../tool/tool.module';
import { VoucherModule } from '../voucher/voucher.module';
import { ToolCallModule } from '../tool-call/tool-call.module';
import { ProviderModule } from '../provider/provider.module';
import { CopilotAutogenModule } from '../copilot-autogen/copilot-autogen.module';
import { WorkflowService } from './workflow.service';
import { WorkflowCliService } from './workflow-cli.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowCliController, NodeCliController } from './workflow-cli.controller';
import { WorkflowPlanCliController } from './workflow-plan-cli.controller';
import { RunWorkflowProcessor, PollWorkflowProcessor } from './workflow.processor';
import { QUEUE_RUN_WORKFLOW, QUEUE_POLL_WORKFLOW } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';
import { CreditModule } from '../credit/credit.module';
import { WorkflowPlanService } from './workflow-plan.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    CanvasSyncModule,
    ToolModule,
    ToolCallModule,
    SkillModule,
    CreditModule,
    NotificationModule,
    VoucherModule,
    ProviderModule,
    forwardRef(() => CopilotAutogenModule),
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_RUN_WORKFLOW }),
          BullModule.registerQueue({ name: QUEUE_POLL_WORKFLOW }),
        ]),
  ],
  controllers: [
    WorkflowController,
    WorkflowCliController,
    NodeCliController,
    WorkflowPlanCliController,
  ],
  providers: [
    WorkflowService,
    WorkflowPlanService,
    WorkflowCliService,
    ...(isDesktop() ? [] : [RunWorkflowProcessor, PollWorkflowProcessor]),
  ],
  exports: [WorkflowService, WorkflowCliService],
})
export class WorkflowModule {}
