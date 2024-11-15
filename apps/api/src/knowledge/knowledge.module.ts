import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { CommonModule } from '@/common/common.module';
import { RAGModule } from '@/rag/rag.module';
import { MiscModule } from '@/misc/misc.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { ReferenceProcessor, ResourceProcessor } from './knowledge.processor';
import { CanvasWsGateway } from './knowledge.gateway';
import {
  QUEUE_RESOURCE,
  QUEUE_PARSE_REF_URL,
  QUEUE_SIMPLE_EVENT,
  QUEUE_SYNC_STORAGE_USAGE,
} from '@/utils';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    RAGModule,
    MiscModule,
    SubscriptionModule,
    BullModule.registerQueue({ name: QUEUE_RESOURCE }),
    BullModule.registerQueue({ name: QUEUE_PARSE_REF_URL }),
    BullModule.registerQueue({ name: QUEUE_SIMPLE_EVENT }),
    BullModule.registerQueue({ name: QUEUE_SYNC_STORAGE_USAGE }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, ResourceProcessor, ReferenceProcessor, CanvasWsGateway],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
