import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
import { VoucherModule } from '../voucher/voucher.module';
import { isDesktop } from '../../utils/runtime';
import { QUEUE_WORKFLOW_APP_TEMPLATE } from '../../utils/const';
import { WorkflowAppTemplateProcessor } from './workflow-app.processor';
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
    VoucherModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_WORKFLOW_APP_TEMPLATE })]),
  ],
  controllers: [WorkflowAppController],
  providers: [WorkflowAppService, ...(isDesktop() ? [] : [WorkflowAppTemplateProcessor])],
  exports: [WorkflowAppService],
})
export class WorkflowAppModule {}
