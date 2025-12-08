import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { TemplateScoringService } from './template-scoring.service';
import { CleanupExpiredVouchersProcessor } from './voucher.processor';
import { ProviderModule } from '../provider/provider.module';
import { CreditModule } from '../credit/credit.module';
import { QUEUE_CLEANUP_EXPIRED_VOUCHERS } from '../../utils/const';

@Module({
  imports: [
    CommonModule,
    ProviderModule,
    forwardRef(() => CreditModule),
    BullModule.registerQueue({
      name: QUEUE_CLEANUP_EXPIRED_VOUCHERS,
    }),
  ],
  controllers: [VoucherController],
  providers: [VoucherService, TemplateScoringService, CleanupExpiredVouchersProcessor],
  exports: [VoucherService, TemplateScoringService],
})
export class VoucherModule {}
