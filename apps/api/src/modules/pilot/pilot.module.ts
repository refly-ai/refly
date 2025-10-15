import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { SkillModule } from '../skill/skill.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ProviderModule } from '../provider/provider.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { VariableExtractionModule } from '../variable-extraction/variable-extraction.module';
import { PilotService } from './pilot.service';
import { PilotController } from './pilot.controller';
import { RunPilotProcessor, SyncPilotStepProcessor } from './pilot.processor';
import { IntentAnalysisService } from './intent-analysis.service';
import { PilotEngineService } from './pilot-engine.service';
import { QUEUE_RUN_PILOT } from '../../utils/const';
import { ToolModule } from '../tool/tool.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    CanvasSyncModule,
    SkillModule,
    ToolModule,
    ProviderModule,
    KnowledgeModule,
    CodeArtifactModule,
    VariableExtractionModule,
    WorkflowModule,
    BullModule.registerQueue({
      name: QUEUE_RUN_PILOT,
    }),
  ],
  controllers: [PilotController],
  providers: [
    PilotService,
    IntentAnalysisService,
    PilotEngineService,
    RunPilotProcessor,
    SyncPilotStepProcessor,
  ],
  exports: [PilotService],
})
export class PilotModule {}
