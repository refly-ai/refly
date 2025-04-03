import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeModule } from '@/knowledge/knowledge.module';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { CommonModule } from '@/common/common.module';
import { SearchModule } from '@/search/search.module';
import { CanvasModule } from '@/canvas/canvas.module';
import { RAGModule } from '@/rag/rag.module';
import {
  QUEUE_SYNC_TOKEN_USAGE,
  QUEUE_SKILL,
  QUEUE_SKILL_TIMEOUT_CHECK,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_AUTO_NAME_CANVAS,
} from '@/utils';
import { LabelModule } from '@/label/label.module';
import { SkillProcessor, SkillTimeoutCheckProcessor } from '@/skill/skill.processor';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { CollabModule } from '@/collab/collab.module';
import { MiscModule } from '@/misc/misc.module';
import { CodeArtifactModule } from '@/code-artifact/code-artifact.module';

@Module({
  imports: [
    CommonModule,
    LabelModule,
    SearchModule,
    CanvasModule,
    KnowledgeModule,
    RAGModule,
    SubscriptionModule,
    CollabModule,
    MiscModule,
    CodeArtifactModule,
    BullModule.registerQueue({ name: QUEUE_SKILL }),
    BullModule.registerQueue({ name: QUEUE_SKILL_TIMEOUT_CHECK }),
    BullModule.registerQueue({ name: QUEUE_SYNC_TOKEN_USAGE }),
    BullModule.registerQueue({ name: QUEUE_SYNC_REQUEST_USAGE }),
    BullModule.registerQueue({ name: QUEUE_AUTO_NAME_CANVAS }),
  ],
  providers: [SkillService, SkillProcessor, SkillTimeoutCheckProcessor],
  controllers: [SkillController],
  exports: [SkillService],
})
export class SkillModule {}
