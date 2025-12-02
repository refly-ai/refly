/**
 * Billing Module
 * Provides unified billing service for tool execution
 */

import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CreditModule } from '../../credit/credit.module';
import { BillingService } from './billing.service';

@Module({
  imports: [CommonModule, CreditModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
