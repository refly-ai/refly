import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { KnowledgeController } from './knowledge.controller';
import { CommonModule } from '../common/common.module';
import { RAGModule } from '../rag/rag.module';
import { MiscModule } from '../misc/misc.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import {
  DeleteKnowledgeEntityProcessor,
  PostDeleteKnowledgeEntityProcessor,
  ResourceProcessor,
} from './knowledge.processor';
import {
  QUEUE_RESOURCE,
  QUEUE_SIMPLE_EVENT,
  QUEUE_SYNC_STORAGE_USAGE,
  QUEUE_CLEAR_CANVAS_ENTITY,
  QUEUE_POST_DELETE_KNOWLEDGE_ENTITY,
} from '../../utils/const';
import { ProviderModule } from '../provider/provider.module';
import { isDesktop } from '../../utils/runtime';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { CollabModule } from '../collab/collab.module';
import { ResourceService } from './resource.service';
import { DocumentService } from './document.service';

@Module({
  imports: [
    CommonModule,
    RAGModule,
    MiscModule,
    CollabModule,
    CanvasSyncModule,
    ProviderModule,
    forwardRef(() => SubscriptionModule),
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_RESOURCE }),
          BullModule.registerQueue({ name: QUEUE_SIMPLE_EVENT }),
          BullModule.registerQueue({ name: QUEUE_SYNC_STORAGE_USAGE }),
          BullModule.registerQueue({ name: QUEUE_CLEAR_CANVAS_ENTITY }),
          BullModule.registerQueue({ name: QUEUE_POST_DELETE_KNOWLEDGE_ENTITY }),
        ]),
  ],
  controllers: [KnowledgeController],
  providers: [
    ResourceService,
    DocumentService,
    ...(isDesktop()
      ? []
      : [ResourceProcessor, DeleteKnowledgeEntityProcessor, PostDeleteKnowledgeEntityProcessor]),
  ],
  exports: [ResourceService, DocumentService],
})
export class KnowledgeModule {}
