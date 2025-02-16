import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import {
  ClearCanvasEntityProcessor,
  SyncCanvasEntityProcessor,
  AutoNameCanvasProcessor,
} from './canvas.processor';
import { CollabModule } from '@/collab/collab.module';
import { QUEUE_DELETE_KNOWLEDGE_ENTITY } from '@/utils/const';
import { CommonModule } from '@/common/common.module';
import { MiscModule } from '@/misc/misc.module';

@Module({
  imports: [
    CommonModule,
    CollabModule,
    MiscModule,
    BullModule.registerQueue({
      name: QUEUE_DELETE_KNOWLEDGE_ENTITY,
    }),
  ],
  controllers: [CanvasController],
  providers: [
    CanvasService,
    SyncCanvasEntityProcessor,
    ClearCanvasEntityProcessor,
    AutoNameCanvasProcessor,
  ],
  exports: [CanvasService],
})
export class CanvasModule {}
