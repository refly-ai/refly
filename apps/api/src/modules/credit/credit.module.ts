import { Module } from '@nestjs/common';
import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { PrismaService } from '../common/prisma.service';
import { SyncTokenCreditUsageProcessor } from './credit.processor';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CreditController],
  providers: [CreditService, PrismaService, SyncTokenCreditUsageProcessor],
  exports: [CreditService],
})
export class CreditModule {}
