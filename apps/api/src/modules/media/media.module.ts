import { Module } from '@nestjs/common';
import { MediaController } from '@/modules/media/media.controller';
import { MediaService } from '@/modules/media/media.service';
import { CommonModule } from '../common/common.module';
import { ProviderModule } from '../provider/provider.module';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_MEDIA } from '../../utils';
import { ImageProcessor } from './processors/image.processor';
import { VideoProcessor } from './processors/video.processor';
import { AudioProcessor } from './processors/audio.processor';

@Module({
  imports: [
    CommonModule,
    ProviderModule,
    BullModule.registerQueue({
      name: QUEUE_MEDIA,
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, ImageProcessor, VideoProcessor, AudioProcessor],
})
export class MediaModule {}
