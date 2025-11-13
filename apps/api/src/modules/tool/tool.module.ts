import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ToolController } from './tool.controller';
import { ToolService } from './tool.service';
import { InternalToolService } from './internal-tool.service';
import { McpServerModule } from '../mcp-server/mcp-server.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { CollabModule } from '../collab/collab.module';
import { ProviderModule } from '../provider/provider.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { QUEUE_SYNC_TOOL_CREDIT_USAGE } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';
import { SyncToolCreditUsageProcessor } from '../credit/credit.processor';
import { BullModule } from '@nestjs/bullmq';
import { CreditModule } from '../credit/credit.module';
import { ComposioModule } from './composio/composio.module';
import { FishAudioModule } from './media/audio/fish-audio.module';
import { HeyGenModule } from './media/video/heygen.module';
import { SandboxModule } from './sandbox/sandbox.module';

@Module({
  imports: [
    CommonModule,
    McpServerModule,
    ComposioModule,
    CodeArtifactModule,
    CollabModule,
    KnowledgeModule,
    CanvasSyncModule,
    ProviderModule,
    CreditModule,
    FishAudioModule,
    HeyGenModule,
    SandboxModule,
    ...(isDesktop() ? [] : [BullModule.registerQueue({ name: QUEUE_SYNC_TOOL_CREDIT_USAGE })]),
  ],
  controllers: [ToolController],
  providers: [ToolService, InternalToolService, SyncToolCreditUsageProcessor],
  exports: [ToolService, InternalToolService],
})
export class ToolModule {}
