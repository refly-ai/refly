import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { WorkflowAppController } from './workflow-app.controller';
import { WorkflowAppService } from './workflow-app.service';
import { CanvasModule } from '../canvas/canvas.module';
import { MiscModule } from '../misc/misc.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ShareModule } from '../share/share.module';
import { ToolModule } from '../tool/tool.module';
import { VariableExtractionModule } from '../variable-extraction/variable-extraction.module';
import { CreditModule } from '../credit/credit.module';
import { NotificationModule } from '../notification/notification.module';
@Module({
  imports: [
    CommonModule,
    CanvasModule,
    MiscModule,
    WorkflowModule,
    ShareModule,
    ToolModule,
    VariableExtractionModule,
    CreditModule,
    NotificationModule,
  ],
  controllers: [WorkflowAppController],
  providers: [WorkflowAppService],
  exports: [WorkflowAppService],
})
export class WorkflowAppModule {}
