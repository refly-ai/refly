import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { CommonModule } from '../common/common.module';
import { StepModule } from '../step/step.module';
import { SearchModule } from '../search/search.module';
import { RAGModule } from '../rag/rag.module';
import {
  QUEUE_SYNC_TOKEN_USAGE,
  QUEUE_SKILL,
  QUEUE_CHECK_STUCK_ACTIONS,
  QUEUE_SYNC_REQUEST_USAGE,
  QUEUE_AUTO_NAME_CANVAS,
  QUEUE_SYNC_PILOT_STEP,
  QUEUE_SYNC_TOKEN_CREDIT_USAGE,
} from '../../utils';
import { LabelModule } from '../label/label.module';
import { SkillProcessor, CheckStuckActionsProcessor } from '../skill/skill.processor';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CreditModule } from '../credit/credit.module';
import { MiscModule } from '../misc/misc.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { ProviderModule } from '../provider/provider.module';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { MediaGeneratorModule } from '../media-generator/media-generator.module';
import { SkillEngineService } from './skill-engine.service';
import { SkillInvokerService } from './skill-invoker.service';
import { isDesktop } from '../../utils/runtime';
import { ActionModule } from '../action/action.module';
import { ToolModule } from '../tool/tool.module';
import { ToolCallModule } from '../tool-call/tool-call.module';
import { FishAudioModule } from '../tool/media/audio/fish-audio.module';
import { HeyGenModule } from '../tool/media/video/heygen.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';

@Module({
  imports: [
    CommonModule,
    StepModule,
    forwardRef(() => ActionModule),
    LabelModule,
    SearchModule,
    KnowledgeModule,
    RAGModule,
    SubscriptionModule,
    CreditModule,
    MiscModule,
    CodeArtifactModule,
    ProviderModule,
    ToolModule,
    ToolCallModule,
    McpServerModule,
    MediaGeneratorModule,
    FishAudioModule,
    HeyGenModule,
    CanvasSyncModule,
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
