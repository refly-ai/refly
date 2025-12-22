import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MiscController } from './misc.controller';
import { MiscService } from './misc.service';
import { CommonModule } from '../common/common.module';
import { QUEUE_IMAGE_PROCESSING, QUEUE_CLEAN_STATIC_FILES } from '../../utils';
import { ImageProcessor, CleanStaticFilesProcessor } from '../misc/misc.processor';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_IMAGE_PROCESSING }),
          BullModule.registerQueue({ name: QUEUE_CLEAN_STATIC_FILES, prefix: 'misc_cron' }),
        ]),
  ],
  controllers: [MiscController],
  providers: [MiscService, ...(isDesktop() ? [] : [ImageProcessor, CleanStaticFilesProcessor])],
  exports: [MiscService],
})
export class MiscModule {}
