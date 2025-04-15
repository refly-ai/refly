import { Module } from '@nestjs/common';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';
import { CanvasModule } from '@/canvas/canvas.module';
import { CommonModule } from '@/common/common.module';
import { KnowledgeModule } from '@/knowledge/knowledge.module';
import { MiscModule } from '@/misc/misc.module';
import { ActionModule } from '@/action/action.module';
import { RAGModule } from '@/rag/rag.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { CodeArtifactModule } from '@/code-artifact/code-artifact.module';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    KnowledgeModule,
    RAGModule,
    MiscModule,
    ActionModule,
    CodeArtifactModule,
    SubscriptionModule,
  ],
  providers: [ShareService],
  controllers: [ShareController],
  exports: [ShareService],
})
export class ShareModule {}
