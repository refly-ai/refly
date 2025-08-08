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
  QUEUE_CHECK_STUCK_ACTIONS,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_AUTO_NAME_CANVAS,
  QUEUE_SYNC_PILOT_STEP,
  QUEUE_SYNC_TOKEN_CREDIT_USAGE,
  QUEUE_SYNC_WORKFLOW,
} from '../../utils';
import { LabelModule } from '../label/label.module';
import { SkillProcessor, CheckStuckActionsProcessor } from '../skill/skill.processor';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CreditModule } from '../credit/credit.module';
import { CollabModule } from '../collab/collab.module';
import { MiscModule } from '../misc/misc.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { ProviderModule } from '../provider/provider.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { MediaGeneratorModule } from '../media-generator/media-generator.module';
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
    CreditModule,
    CollabModule,
    MiscModule,
    CodeArtifactModule,
    ProviderModule,
    McpServerModule,
    MediaGeneratorModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_SKILL }),
          BullModule.registerQueue({
            name: QUEUE_CHECK_STUCK_ACTIONS,
            prefix: 'skill_cron',
            defaultJobOptions: {
              removeOnComplete: true,
              removeOnFail: false,
            },
          }),
          BullModule.registerQueue({ name: QUEUE_SYNC_TOKEN_USAGE }),
          BullModule.registerQueue({ name: QUEUE_SYNC_TOKEN_CREDIT_USAGE }),
          BullModule.registerQueue({ name: QUEUE_SYNC_REQUEST_USAGE }),
          BullModule.registerQueue({ name: QUEUE_AUTO_NAME_CANVAS }),
          BullModule.registerQueue({ name: QUEUE_SYNC_PILOT_STEP }),
          BullModule.registerQueue({ name: QUEUE_SYNC_WORKFLOW }),
        ]),
  ],
  providers: [
    SkillService,
    SkillEngineService,
    SkillInvokerService,
    ...(isDesktop() ? [] : [SkillProcessor, CheckStuckActionsProcessor]),
  ],
  controllers: [SkillController],
  exports: [SkillService, SkillInvokerService],
})
export class SkillModule {}
