import { Module } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { SyncTokenCreditUsageProcessor } from './credit.processor';
import { CommonModule } from '../common/common.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';

@Module({
  imports: [CommonModule, CanvasSyncModule],
  controllers: [CreditController],
  providers: [CreditService, SyncTokenCreditUsageProcessor],
  exports: [CreditService],
})
export class CreditModule {}
