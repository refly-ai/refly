import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import {
  ClearCanvasEntityProcessor,
  SyncCanvasEntityProcessor,
  AutoNameCanvasProcessor,
  PostDeleteCanvasProcessor,
  VerifyNodeAdditionProcessor,
} from './canvas.processor';
import { CollabModule } from '../collab/collab.module';
import {
  QUEUE_DELETE_KNOWLEDGE_ENTITY,
  QUEUE_POST_DELETE_CANVAS,
  QUEUE_VERIFY_NODE_ADDITION,
} from '../../utils/const';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ActionModule } from '../action/action.module';
import { ProviderModule } from '../provider/provider.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    CollabModule,
    MiscModule,
    KnowledgeModule,
    ActionModule,
    ProviderModule,
    CodeArtifactModule,
    SubscriptionModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({
            name: QUEUE_DELETE_KNOWLEDGE_ENTITY,
          }),
          BullModule.registerQueue({
            name: QUEUE_POST_DELETE_CANVAS,
          }),
          BullModule.registerQueue({
            name: QUEUE_VERIFY_NODE_ADDITION,
          }),
        ]),
  ],
  controllers: [CanvasController],
  providers: [
    CanvasService,
    ...(isDesktop()
      ? []
      : [
          SyncCanvasEntityProcessor,
          ClearCanvasEntityProcessor,
          AutoNameCanvasProcessor,
          PostDeleteCanvasProcessor,
          VerifyNodeAdditionProcessor,
        ]),
  ],
  exports: [CanvasService],
})
export class CanvasModule {}
