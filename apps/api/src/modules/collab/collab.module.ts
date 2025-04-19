import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CollabGateway } from './collab.gateway';
import { CommonModule } from '../common/common.module';
import { RAGModule } from '../rag/rag.module';
import { QUEUE_SYNC_CANVAS_ENTITY } from '../../utils/const';
import { CollabService } from './collab.service';
import { CollabController } from './collab.controller';

@Module({
  imports: [CommonModule, RAGModule, BullModule.registerQueue({ name: QUEUE_SYNC_CANVAS_ENTITY })],
  providers: [CollabGateway, CollabService],
  exports: [CollabService],
  controllers: [CollabController],
})
export class CollabModule {}
