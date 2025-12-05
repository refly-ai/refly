import { Module, forwardRef } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { TemplateScoringService } from './template-scoring.service';
import { ProviderModule } from '../provider/provider.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [CommonModule, ProviderModule, forwardRef(() => CreditModule)],
  controllers: [VoucherController],
  providers: [VoucherService, TemplateScoringService],
  exports: [VoucherService, TemplateScoringService],
})
export class VoucherModule {}
