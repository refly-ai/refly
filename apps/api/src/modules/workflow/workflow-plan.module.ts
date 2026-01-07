import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { WorkflowPlanService } from './workflow-plan.service';

@Module({
  imports: [CommonModule],
  providers: [WorkflowPlanService],
  exports: [WorkflowPlanService],
})
export class WorkflowPlanModule {}
