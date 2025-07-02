import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { SkillModule } from '../skill/skill.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ProviderModule } from '../provider/provider.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { PilotService } from './pilot.service';
import { PilotController } from './pilot.controller';
import { RunPilotProcessor, SyncPilotStepProcessor } from './pilot.processor';
import { QUEUE_RUN_PILOT } from '../../utils/const';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    SkillModule,
    ProviderModule,
    KnowledgeModule,
    CodeArtifactModule,
    BullModule.registerQueue({
      name: QUEUE_RUN_PILOT,
    }),
  ],
  controllers: [PilotController],
  providers: [PilotService, RunPilotProcessor, SyncPilotStepProcessor],
  exports: [PilotService],
})
export class PilotModule {}
