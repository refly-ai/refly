import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { CommonModule } from '../common/common.module';
import { SearchModule } from '../search/search.module';
import { CanvasModule } from '../canvas/canvas.module';
import { RAGModule } from '../rag/rag.module';
import {
  QUEUE_SYNC_TOKEN_USAGE,
  QUEUE_SKILL,
  QUEUE_SKILL_TIMEOUT_CHECK,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_AUTO_NAME_CANVAS,
  QUEUE_SYNC_PILOT_STEP,
} from '../../utils';
import { LabelModule } from '../label/label.module';
import { SkillProcessor, SkillTimeoutCheckProcessor } from '../skill/skill.processor';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CollabModule } from '../collab/collab.module';
import { MiscModule } from '../misc/misc.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { ProviderModule } from '../provider/provider.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { SkillEngineService } from './skill-engine.service';
import { SkillInvokerService } from './skill-invoker.service';
import { isDesktop } from '../../utils/runtime';
import { ActionModule } from '../action/action.module';

@Module({
  imports: [
    CommonModule,
    forwardRef(() => ActionModule),
    LabelModule,
    SearchModule,
    CanvasModule,
    KnowledgeModule,
    RAGModule,
    SubscriptionModule,
    CollabModule,
    MiscModule,
    CodeArtifactModule,
    ProviderModule,
    McpServerModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_SKILL }),
          BullModule.registerQueue({ name: QUEUE_SKILL_TIMEOUT_CHECK }),
          BullModule.registerQueue({ name: QUEUE_SYNC_TOKEN_USAGE }),
          BullModule.registerQueue({ name: QUEUE_SYNC_REQUEST_USAGE }),
          BullModule.registerQueue({ name: QUEUE_AUTO_NAME_CANVAS }),
          BullModule.registerQueue({ name: QUEUE_SYNC_PILOT_STEP }),
        ]),
  ],
  providers: [
    SkillService,
    SkillEngineService,
    SkillInvokerService,
    ...(isDesktop() ? [] : [SkillProcessor, SkillTimeoutCheckProcessor]),
  ],
  controllers: [SkillController],
  exports: [SkillService, SkillInvokerService],
})
export class SkillModule {}
