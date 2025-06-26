import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CollabGateway } from './collab.gateway';
import { CommonModule } from '../common/common.module';
import { RAGModule } from '../rag/rag.module';
import { QUEUE_SYNC_CANVAS_ENTITY } from '../../utils/const';
import { CollabService } from './collab.service';
import { CollabController } from './collab.controller';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    RAGModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_CANVAS_ENTITY })]),
  ],
  providers: [CollabGateway, CollabService],
  exports: [CollabService],
  controllers: [CollabController],
})
export class CollabModule {}
