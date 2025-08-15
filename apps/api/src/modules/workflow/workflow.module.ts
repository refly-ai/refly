import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { SkillModule } from '../skill/skill.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { WorkflowService } from './workflow.service';
import { WorkflowVariableService } from './workflow-variable.service';
import { WorkflowController } from './workflow.controller';
import { SyncWorkflowProcessor, RunWorkflowProcessor } from './workflow.processor';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    SkillModule,
    McpServerModule,
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
    WorkflowVariableService,
    ...(isDesktop() ? [] : [SyncWorkflowProcessor, RunWorkflowProcessor]),
  ],
  exports: [WorkflowService, WorkflowVariableService],
})
export class WorkflowModule {}
