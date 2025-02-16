import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MiscController } from './misc.controller';
import { MiscService } from './misc.service';
import { CommonModule } from '@/common/common.module';
import { QUEUE_IMAGE_PROCESSING, QUEUE_CLEAN_STATIC_FILES } from '@/utils';
import { ImageProcessor, CleanStaticFilesProcessor } from '@/misc/misc.processor';

@Module({
  imports: [
    CommonModule,
    BullModule.registerQueue({ name: QUEUE_IMAGE_PROCESSING }),
    BullModule.registerQueue({
      name: QUEUE_CLEAN_STATIC_FILES,
      prefix: 'misc_cron',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [MiscController],
  providers: [MiscService, ImageProcessor, CleanStaticFilesProcessor],
  exports: [MiscService],
})
export class MiscModule {}
