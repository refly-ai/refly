import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { VoucherService } from './voucher.service';
import { QUEUE_CLEANUP_EXPIRED_VOUCHERS } from '../../utils/const';

@Processor(QUEUE_CLEANUP_EXPIRED_VOUCHERS)
export class CleanupExpiredVouchersProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupExpiredVouchersProcessor.name);

  constructor(private voucherService: VoucherService) {
    super();
  }

  async process() {
    try {
      this.logger.log('Starting expired vouchers cleanup job...');
      const result = await this.voucherService.cleanupExpiredVouchers();
      this.logger.log(
        `Expired vouchers cleanup completed: ${result.vouchersExpired} vouchers, ${result.invitationsExpired} invitations`,
      );
    } catch (error) {
      this.logger.error(`[${QUEUE_CLEANUP_EXPIRED_VOUCHERS}] error: ${error?.stack}`);
      throw error;
    }
  }
}
