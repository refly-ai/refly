import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ShareCommonService } from './share-common.service';
import { ShareController } from './share.controller';
import { CanvasModule } from '../canvas/canvas.module';
import { CommonModule } from '../common/common.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { MiscModule } from '../misc/misc.module';
import { ActionModule } from '../action/action.module';
import { RAGModule } from '../rag/rag.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { isDesktop } from '../../utils/runtime';
import { QUEUE_CREATE_SHARE } from '../../utils/const';
import { CreateShareProcessor } from './share.processor';
import { ShareCreationService } from './share-creation.service';
import { ShareDuplicationService } from './share-duplication.service';
import { ShareRateLimitService } from './share-rate-limit.service';
import { ToolModule } from '../tool/tool.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { CreditModule } from '../credit/credit.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    CanvasSyncModule,
    KnowledgeModule,
    RAGModule,
    MiscModule,
    ToolModule,
    ActionModule,
    CodeArtifactModule,
    SubscriptionModule,
    CreditModule,
    ConfigModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_CREATE_SHARE })]),
  ],
  providers: [
    ShareCommonService,
    ShareCreationService,
    ShareDuplicationService,
    ShareRateLimitService,
    ...(isDesktop() ? [] : [CreateShareProcessor]),
  ],
  controllers: [ShareController],
  exports: [
    ShareCommonService,
    ShareCreationService,
    ShareDuplicationService,
    ShareRateLimitService,
  ],
})
export class ShareModule {}
