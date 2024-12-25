import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CanvasService } from './canvas.service';
import { CanvasController } from './canvas.controller';
import { CommonModule } from '@/common/common.module';
import { CollabModule } from '@/collab/collab.module';
import { MiscModule } from '@/misc/misc.module';
import { QUEUE_SYNC_STORAGE_USAGE } from '@/utils/const';

@Module({
  imports: [
    CommonModule,
    CollabModule,
    MiscModule,
    BullModule.registerQueue({ name: QUEUE_SYNC_STORAGE_USAGE }),
  ],
  providers: [CanvasService],
  controllers: [CanvasController],
  exports: [CanvasService],
})
export class CanvasModule {}
